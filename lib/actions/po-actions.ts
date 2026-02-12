'use server';

/**
 * Purchase Order Server Actions
 *
 * Server actions for PO operations including cancellation with cascade feedback.
 */

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { recomputeStatusFromAggregates } from '@/lib/utils/po-status';
import type { POStatusEnum } from '@/types/database';

/**
 * Result type for cancel PO operation
 */
export type CancelPOResult =
  | {
      success: true;
      data: {
        poNumber: string;
        previousStatus: string;
        releasedAmountEusd: number;
        qmhqRequestId: string;
        newBalanceInHand: number;
      };
    }
  | { success: false; error: string };

/**
 * Cancels a Purchase Order and returns cascade feedback data.
 *
 * This action:
 * 1. Validates user authentication and admin role
 * 2. Fetches PO details BEFORE cancel to get baseline data
 * 3. Validates PO status (not already cancelled or closed)
 * 4. Updates PO to set status='cancelled' with reason and timestamp
 * 5. Fetches QMHQ AFTER cancel to get recalculated balance
 * 6. Revalidates affected paths
 * 7. Returns structured feedback for toast display
 *
 * The existing `update_qmhq_po_committed()` trigger automatically recalculates
 * QMHQ.total_po_committed when PO status changes, excluding cancelled POs.
 * This releases the committed budget back to Balance in Hand.
 *
 * @param poId - The UUID of the PO to cancel
 * @param reason - The reason for cancellation (mandatory)
 * @returns CancelPOResult with cascade data or error message
 *
 * @example
 * const result = await cancelPO(poId, "Supplier no longer available");
 * if (result.success) {
 *   // Show toast with cascade feedback
 *   toast({
 *     title: "PO Cancelled",
 *     description: `${result.data.poNumber} cancelled. Budget released: ${result.data.releasedAmountEusd} EUSD`
 *   });
 * }
 */
export async function cancelPO(
  poId: string,
  reason: string
): Promise<CancelPOResult> {
  try {
    const supabase = await createClient();

    // 1. Validate authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    // 2. Check user role is admin
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError) {
      return {
        success: false,
        error: `Failed to verify user role: ${roleError.message}`,
      };
    }

    if (userData?.role !== 'admin') {
      return {
        success: false,
        error: 'Only administrators can cancel Purchase Orders',
      };
    }

    // 3. Fetch PO BEFORE cancel to get baseline data
    const { data: poBefore, error: fetchError } = await supabase
      .from('purchase_orders')
      .select(
        `
        po_number,
        status,
        total_amount_eusd,
        qmhq_id,
        qmhq:qmhq!purchase_orders_qmhq_id_fkey(
          request_id,
          total_money_in,
          total_po_committed
        )
      `
      )
      .eq('id', poId)
      .single();

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch PO: ${fetchError.message}`,
      };
    }

    // 4. Guard: Check if already cancelled
    if (poBefore.status === 'cancelled') {
      return {
        success: false,
        error: 'PO is already cancelled',
      };
    }

    // 5. Guard: Check if closed
    if (poBefore.status === 'closed') {
      return {
        success: false,
        error: 'Cannot cancel a closed PO. Unlock it first.',
      };
    }

    // 6. Execute UPDATE to cancel the PO
    const { error: cancelError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        updated_by: user.id,
      })
      .eq('id', poId);

    if (cancelError) {
      return {
        success: false,
        error: `Failed to cancel PO: ${cancelError.message}`,
      };
    }

    // 7. Fetch QMHQ AFTER cancel to get new total_po_committed
    // The update_qmhq_po_committed trigger will have recalculated this
    const { data: qmhqAfter, error: qmhqError } = await supabase
      .from('qmhq')
      .select('total_po_committed, total_money_in')
      .eq('id', poBefore.qmhq_id)
      .single();

    // 8. Calculate new Balance in Hand
    let newBalanceInHand = 0;
    if (!qmhqError && qmhqAfter) {
      const totalMoneyIn = qmhqAfter.total_money_in ?? 0;
      const totalPoCommitted = qmhqAfter.total_po_committed ?? 0;
      newBalanceInHand = totalMoneyIn - totalPoCommitted;
    }

    // 9. Revalidate affected paths
    revalidatePath('/po');
    revalidatePath(`/po/${poId}`);
    revalidatePath('/qmhq');
    revalidatePath(`/qmhq/${poBefore.qmhq_id}`);

    // 10. Return success with cascade data
    return {
      success: true,
      data: {
        poNumber: poBefore.po_number || '',
        previousStatus: poBefore.status || '',
        releasedAmountEusd: poBefore.total_amount_eusd || 0,
        qmhqRequestId: poBefore.qmhq?.request_id || '',
        newBalanceInHand,
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

/**
 * Result type for unlock PO operation
 */
export type UnlockPOResult =
  | {
      success: true;
      data: {
        poNumber: string;
        newStatus: string;
      };
    }
  | { success: false; error: string };

/**
 * Unlocks a closed Purchase Order for admin corrections.
 *
 * This action:
 * 1. Validates user authentication and admin role
 * 2. Fetches current PO and validates it must be 'closed'
 * 3. Fetches line items to calculate aggregates
 * 4. Uses recomputeStatusFromAggregates() to determine correct non-closed status
 * 5. If aggregates still indicate closed (fully matched), sets to 'partially_received' as fallback
 * 6. Updates PO status to computed status
 * 7. Creates audit log entry
 * 8. Revalidates affected paths
 * 9. Returns success with new status
 *
 * The status will auto-recalculate back to 'closed' if corrections result in
 * full match again (via existing calculate_po_status trigger).
 *
 * @param poId - The UUID of the PO to unlock
 * @returns UnlockPOResult with new status or error message
 *
 * @example
 * const result = await unlockClosedPO(poId);
 * if (result.success) {
 *   toast({ title: "PO Unlocked", description: `${result.data.poNumber} unlocked for corrections` });
 * }
 */
export async function unlockClosedPO(
  poId: string
): Promise<UnlockPOResult> {
  try {
    const supabase = await createClient();

    // 1. Validate authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Not authenticated' };
    }

    // 2. Check user role is admin
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError) {
      return {
        success: false,
        error: `Failed to verify user role: ${roleError.message}`,
      };
    }

    if (userData?.role !== 'admin') {
      return {
        success: false,
        error: 'Only administrators can unlock Purchase Orders',
      };
    }

    // 3. Fetch current PO
    const { data: po, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('po_number, status')
      .eq('id', poId)
      .single();

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch PO: ${fetchError.message}`,
      };
    }

    // 4. Guard: Must be closed
    if (po.status !== 'closed') {
      return {
        success: false,
        error: 'PO is not closed. Only closed POs can be unlocked.',
      };
    }

    // 5. Fetch line items to calculate aggregates
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('po_line_items')
      .select('quantity, invoiced_quantity, received_quantity')
      .eq('po_id', poId)
      .eq('is_active', true);

    if (lineItemsError) {
      return {
        success: false,
        error: `Failed to fetch line items: ${lineItemsError.message}`,
      };
    }

    // 6. Calculate aggregates
    const totalQty = lineItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
    const invoicedQty = lineItems?.reduce((sum, item) => sum + (item.invoiced_quantity || 0), 0) || 0;
    const receivedQty = lineItems?.reduce((sum, item) => sum + (item.received_quantity || 0), 0) || 0;

    // 7. Recompute status using existing logic
    let newStatus: POStatusEnum = recomputeStatusFromAggregates(
      totalQty,
      invoicedQty,
      receivedQty,
      false // not cancelled
    );

    // 8. Fallback: If still computed as 'closed', set to 'partially_received' to allow corrections
    // Status will auto-recalculate back to 'closed' after corrections via trigger
    if (newStatus === 'closed') {
      newStatus = 'partially_received';
    }

    // 9. Update PO status
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: newStatus,
        updated_by: user.id,
      })
      .eq('id', poId);

    if (updateError) {
      return {
        success: false,
        error: `Failed to unlock PO: ${updateError.message}`,
      };
    }

    // 10. Create audit log entry
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        entity_type: 'purchase_orders',
        entity_id: poId,
        action: 'update',
        summary: 'PO unlocked by admin for corrections',
        changed_by: user.id,
      });

    if (auditError) {
      // Log but don't fail the operation
      console.warn('Failed to create audit log:', auditError);
    }

    // 11. Revalidate paths
    revalidatePath('/po');
    revalidatePath(`/po/${poId}`);

    // 12. Return success
    return {
      success: true,
      data: {
        poNumber: po.po_number || '',
        newStatus,
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
