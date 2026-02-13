'use client';

/**
 * PO Slider Content Component
 *
 * Displays Purchase Order details inside the context slider.
 * Used by Invoice create page when navigated from PO detail.
 */

import {
  ShoppingCart,
  Building2,
  Calendar,
  Package,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';

interface POSliderData {
  id: string;
  po_number: string | null;
  po_date: string | null;
  expected_delivery_date: string | null;
  currency: string | null;
  exchange_rate: number | null;
  total_amount: number | null;
  total_amount_eusd: number | null;
  status: string | null;
  notes: string | null;
  supplier?: { name: string; company_name: string | null } | null;
  line_items?: Array<{
    id: string;
    item_name: string | null;
    item_sku: string | null;
    quantity: number;
    unit_price: number;
    invoiced_quantity: number | null;
  }>;
}

interface POSliderContentProps {
  po: POSliderData | null;
  isLoading: boolean;
}

const statusColors: Record<string, string> = {
  not_started: 'text-slate-400 border-slate-500/30',
  partially_invoiced: 'text-blue-400 border-blue-500/30',
  awaiting_delivery: 'text-purple-400 border-purple-500/30',
  partially_received: 'text-amber-400 border-amber-500/30',
  closed: 'text-emerald-400 border-emerald-500/30',
  cancelled: 'text-red-400 border-red-500/30',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function POSliderContent({ po, isLoading }: POSliderContentProps) {
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

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <ShoppingCart className="h-8 w-8 text-slate-500 mb-2" />
        <p className="text-sm text-slate-400">No PO data</p>
      </div>
    );
  }

  const totalLineItems = po.line_items?.length ?? 0;
  const totalAvailable = po.line_items?.reduce((sum, li) => {
    const available = li.quantity - (li.invoiced_quantity ?? 0);
    return sum + (available > 0 ? 1 : 0);
  }, 0) ?? 0;

  return (
    <>
      {/* PO Number Badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800/50 border border-slate-700 w-fit mb-2">
        <code className="text-sm font-mono text-amber-400">{po.po_number || '-'}</code>
      </div>

      {/* Status */}
      {po.status && (
        <div className="mb-3">
          <Badge
            variant="outline"
            className={`text-xs ${statusColors[po.status] || 'text-slate-400 border-slate-500/30'}`}
          >
            {po.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </Badge>
        </div>
      )}

      {/* Supplier */}
      {po.supplier && (
        <div className="flex items-start gap-2 mb-4">
          <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
          <div>
            <p className="text-xs text-slate-400">Supplier</p>
            <p className="text-sm text-slate-200">
              {po.supplier.company_name || po.supplier.name}
            </p>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          <span>PO Date: {formatDate(po.po_date)}</span>
        </div>
        {po.expected_delivery_date && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Calendar className="h-3.5 w-3.5" />
            <span>Expected: {formatDate(po.expected_delivery_date)}</span>
          </div>
        )}
      </div>

      {/* Financial Summary */}
      <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Total Amount:</span>
          <span className="text-sm text-slate-200 font-mono">
            {formatCurrency(po.total_amount ?? 0)} {po.currency}
          </span>
        </div>
        {po.exchange_rate !== null && po.exchange_rate !== 1 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Exchange Rate:</span>
            <span className="text-sm text-slate-300 font-mono">
              {po.exchange_rate.toFixed(4)}
            </span>
          </div>
        )}
        {po.total_amount_eusd !== null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">EUSD:</span>
            <span className="text-sm text-amber-400 font-mono font-semibold">
              {formatCurrency(po.total_amount_eusd)} EUSD
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
            {totalAvailable} available
          </span>
        </div>
        {po.line_items && po.line_items.length > 0 ? (
          <div className="space-y-2">
            {po.line_items.map((li) => {
              const available = li.quantity - (li.invoiced_quantity ?? 0);
              return (
                <div key={li.id} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{li.item_name}</p>
                    {li.item_sku && (
                      <code className="text-[10px] text-slate-500">{li.item_sku}</code>
                    )}
                  </div>
                  <div className="text-right text-xs">
                    <span className={`font-mono ${available > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {available}/{li.quantity}
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
      {po.notes && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Notes
          </p>
          <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4">
            {po.notes}
          </p>
        </div>
      )}
    </>
  );
}
