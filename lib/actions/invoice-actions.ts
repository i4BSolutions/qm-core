'use server';

/**
 * Invoice Server Actions
 *
 * Server actions for invoice operations including void with cascade feedback.
 */

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Result type for void invoice operation
 */
export type VoidInvoiceResult =
  | {
      success: true;
      data: {
        invoiceNumber: string;
        poNumber: string | null;
        newPoStatus: string | null;
        invoicedQtyChanges: Array<{
          itemName: string;
          oldQty: number;
          newQty: number;
        }>;
      };
    }
  | { success: false; error: string };

/**
 * Voids an invoice and returns cascade feedback data.
 *
 * This action:
 * 1. Validates user authentication
 * 2. Updates the invoice to set is_voided = true, status = 'voided'
 * 3. Catches stock-in block errors from database triggers
 * 4. Queries cascade results (PO status changes, invoiced quantity changes)
 * 5. Revalidates affected paths
 * 6. Returns structured feedback for toast display
 *
 * @param invoiceId - The UUID of the invoice to void
 * @param reason - The reason for voiding the invoice
 * @returns VoidInvoiceResult with cascade data or error message
 *
 * @example
 * const result = await voidInvoice(invoiceId, "Duplicate entry");
 * if (result.success) {
 *   // Show toast with result.data
 * }
 */
export async function voidInvoice(
  invoiceId: string,
  reason: string
): Promise<VoidInvoiceResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Fetch invoice BEFORE void to get baseline invoiced quantities
    const { data: invoiceBefore, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        invoice_number,
        po_id,
        purchase_order:purchase_orders!invoices_po_id_fkey(
          po_number,
          status
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (fetchError) {
      return { success: false, error: `Failed to fetch invoice: ${fetchError.message}` };
    }

    // Fetch line items BEFORE void to calculate old quantities
    const { data: lineItemsBefore, error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .select(`
        quantity,
        po_line_item_id,
        po_line_item:po_line_items!invoice_line_items_po_line_item_id_fkey(
          invoiced_quantity,
          item:items(name)
        )
      `)
      .eq('invoice_id', invoiceId)
      .eq('is_active', true);

    if (lineItemsError) {
      return {
        success: false,
        error: `Failed to fetch line items: ${lineItemsError.message}`,
      };
    }

    // Execute void UPDATE
    const { error: voidError } = await supabase
      .from('invoices')
      .update({
        is_voided: true,
        voided_at: new Date().toISOString(),
        voided_by: user.id,
        void_reason: reason,
        status: 'voided',
      })
      .eq('id', invoiceId);

    // Handle errors (including stock-in block from trigger)
    if (voidError) {
      // Check if error is from aa_block_invoice_void_stockin trigger
      if (voidError.message && voidError.message.includes('Cannot void')) {
        return {
          success: false,
          error:
            'Cannot void invoice. Inventory has already been received against this invoice.',
        };
      }
      return {
        success: false,
        error: `Failed to void invoice: ${voidError.message}`,
      };
    }

    // Query cascade results: PO status after void
    let newPoStatus: string | null = null;
    if (invoiceBefore.po_id) {
      const { data: poAfter, error: poError } = await supabase
        .from('purchase_orders')
        .select('status')
        .eq('id', invoiceBefore.po_id)
        .single();

      if (!poError && poAfter) {
        newPoStatus = poAfter.status;
      }
    }

    // Calculate invoiced quantity changes
    const invoicedQtyChanges: Array<{
      itemName: string;
      oldQty: number;
      newQty: number;
    }> = [];

    if (lineItemsBefore && lineItemsBefore.length > 0) {
      for (const lineItem of lineItemsBefore) {
        if (lineItem.po_line_item_id) {
          // Fetch updated invoiced_quantity from PO line item
          const { data: poLineItemAfter, error: poLineError } = await supabase
            .from('po_line_items')
            .select('invoiced_quantity')
            .eq('id', lineItem.po_line_item_id)
            .single();

          if (!poLineError && poLineItemAfter) {
            const oldQty =
              (lineItem.po_line_item?.invoiced_quantity ?? 0) || 0;
            const newQty = poLineItemAfter.invoiced_quantity || 0;
            const itemName =
              lineItem.po_line_item?.item?.name || 'Unknown Item';

            invoicedQtyChanges.push({
              itemName,
              oldQty,
              newQty,
            });
          }
        }
      }
    }

    // Revalidate paths
    revalidatePath('/invoice');
    revalidatePath(`/invoice/${invoiceId}`);
    if (invoiceBefore.po_id) {
      revalidatePath(`/po/${invoiceBefore.po_id}`);
      revalidatePath('/po');
    }

    return {
      success: true,
      data: {
        invoiceNumber: invoiceBefore.invoice_number || '',
        poNumber: invoiceBefore.purchase_order?.po_number || null,
        newPoStatus,
        invoicedQtyChanges,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
