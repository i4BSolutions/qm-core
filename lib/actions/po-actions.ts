'use server';

/**
 * Purchase Order Server Actions
 *
 * Server actions for PO operations including cancellation with cascade feedback.
 */

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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
