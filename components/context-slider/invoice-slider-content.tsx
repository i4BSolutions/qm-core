'use client';

/**
 * Invoice Slider Content Component
 *
 * Displays Invoice details inside the context slider.
 * Used by Stock-In page when navigated from Invoice detail.
 */

import {
  FileText,
  Building2,
  Calendar,
  Package,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';

interface InvoiceSliderData {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string | null;
  exchange_rate: number | null;
  total_amount: number | null;
  total_amount_eusd: number | null;
  status: string | null;
  is_voided: boolean;
  notes: string | null;
  purchase_order?: {
    po_number: string | null;
    supplier?: { name: string; company_name: string | null } | null;
  } | null;
  line_items?: Array<{
    id: string;
    item_name: string | null;
    item_sku: string | null;
    quantity: number;
    unit_price: number;
    received_quantity: number | null;
  }>;
}

interface InvoiceSliderContentProps {
  invoice: InvoiceSliderData | null;
  isLoading: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function InvoiceSliderContent({ invoice, isLoading }: InvoiceSliderContentProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <FileText className="h-8 w-8 text-slate-500 mb-2" />
        <p className="text-sm text-slate-400">No invoice data</p>
      </div>
    );
  }

  const totalLineItems = invoice.line_items?.length ?? 0;
  const totalPendingReceive = invoice.line_items?.reduce((sum, li) => {
    const pending = (li.quantity ?? 0) - (li.received_quantity ?? 0);
    return sum + (pending > 0 ? 1 : 0);
  }, 0) ?? 0;

  return (
    <>
      {/* Invoice Number Badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800/50 border border-slate-700 w-fit mb-2">
        <code className="text-sm font-mono text-amber-400">{invoice.invoice_number || '-'}</code>
      </div>

      {/* Voided Badge */}
      {invoice.is_voided && (
        <div className="mb-3">
          <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">
            VOIDED
          </Badge>
        </div>
      )}

      {/* PO Reference */}
      {invoice.purchase_order?.po_number && (
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <FileText className="h-3.5 w-3.5" />
          <span>PO: <code className="text-amber-400/70">{invoice.purchase_order.po_number}</code></span>
        </div>
      )}

      {/* Supplier */}
      {invoice.purchase_order?.supplier && (
        <div className="flex items-start gap-2 mb-4">
          <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-400">Supplier</p>
            <p className="text-sm text-slate-200">
              {invoice.purchase_order.supplier.company_name || invoice.purchase_order.supplier.name}
            </p>
          </div>
        </div>
      )}

      {/* Date */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          <span>Invoice Date: {formatDate(invoice.invoice_date)}</span>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Total Amount:</span>
          <span className="text-sm text-slate-200 font-mono">
            {formatCurrency(invoice.total_amount ?? 0)} {invoice.currency}
          </span>
        </div>
        {invoice.exchange_rate !== null && invoice.exchange_rate !== 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Exchange Rate:</span>
            <span className="text-sm text-slate-300 font-mono">
              {invoice.exchange_rate.toFixed(4)}
            </span>
          </div>
        )}
        {invoice.total_amount_eusd !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">EUSD:</span>
            <span className="text-sm text-amber-400 font-mono font-semibold">
              {formatCurrency(invoice.total_amount_eusd)} EUSD
            </span>
          </div>
        )}
      </div>

      {/* Line Items Summary */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Line Items ({totalLineItems})
          </span>
          <span className="text-xs text-emerald-400 ml-auto">
            {totalPendingReceive} pending
          </span>
        </div>
        {invoice.line_items && invoice.line_items.length > 0 ? (
          <div className="space-y-2">
            {invoice.line_items.map((li) => {
              const pending = (li.quantity ?? 0) - (li.received_quantity ?? 0);
              return (
                <div key={li.id} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{li.item_name}</p>
                    {li.item_sku && (
                      <code className="text-[10px] text-slate-500">{li.item_sku}</code>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    <span className={`font-mono ${pending > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {pending > 0 ? pending : 0}/{li.quantity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">No line items</p>
        )}
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">
            {invoice.notes}
          </p>
        </div>
      )}
    </>
  );
}
