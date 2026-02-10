'use client';

/**
 * QMHQ Slider Content Component
 *
 * Displays full QMHQ details inside the context slider.
 * Shows route-specific information (item/expense/PO), status, category, assignment.
 */

import { useState } from 'react';
import {
  Package,
  Wallet,
  ShoppingCart,
  User,
  Tag,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface QMHQWithSliderRelations {
  id: string;
  request_id: string | null;
  line_name: string | null;
  route_type: 'item' | 'expense' | 'po';
  description: string | null;
  notes: string | null;
  quantity: number | null;
  amount: number | null;
  currency: string | null;
  exchange_rate: number | null;
  amount_eusd: number | null;
  budget_amount: number | null;
  budget_currency: string | null;
  budget_exchange_rate: number | null;
  budget_amount_eusd: number | null;
  status?: { name: string; color: string } | null;
  category?: { name: string; color: string } | null;
  assigned_user?: { full_name: string } | null;
  contact_person?: { name: string; position: string | null } | null;
  item?: { name: string; sku: string | null } | null;
  qmhq_items?: Array<{
    item: { name: string; sku: string | null };
    quantity: number;
  }>;
}

interface QmhqSliderContentProps {
  qmhq: QMHQWithSliderRelations | null;
  isLoading: boolean;
}

// Route type configuration
const routeConfig: Record<
  'item' | 'expense' | 'po',
  { icon: React.ElementType; label: string; color: string; bgColor: string; borderColor: string }
> = {
  item: {
    icon: Package,
    label: 'Item',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  expense: {
    icon: Wallet,
    label: 'Expense',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
  },
  po: {
    icon: ShoppingCart,
    label: 'Purchase Order',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
};

/**
 * QMHQ Slider Content
 *
 * Renders full QMHQ details including:
 * - QMHQ ID badge
 * - Line name
 * - Route type badge with icon
 * - Status and category badges
 * - Assigned user and contact person
 * - Route-specific content (item/expense/PO data)
 * - Description (collapsible if >200 chars)
 * - Notes (collapsible if >200 chars)
 */
export function QmhqSliderContent({ qmhq, isLoading }: QmhqSliderContentProps) {
  // UI state for collapsible sections
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // No QMHQ data
  if (!qmhq) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <AlertCircle className="h-8 w-8 text-slate-500 mb-2" />
        <p className="text-sm text-slate-400">No QMHQ data</p>
      </div>
    );
  }

  const routeInfo = routeConfig[qmhq.route_type];
  const RouteIcon = routeInfo.icon;

  return (
    <>
      {/* QMHQ ID Badge */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800/50 border border-slate-700 w-fit">
        <code className="text-sm font-mono text-amber-400">{qmhq.request_id || '—'}</code>
      </div>

      {/* Line Name */}
      <h3 className="text-base font-semibold text-slate-200 leading-tight">
        {qmhq.line_name || 'Untitled Line'}
      </h3>

      {/* Route Type Badge */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded border w-fit',
        routeInfo.bgColor,
        routeInfo.borderColor
      )}>
        <RouteIcon className={cn('h-4 w-4', routeInfo.color)} />
        <span className={cn('text-sm font-medium', routeInfo.color)}>
          {routeInfo.label}
        </span>
      </div>

      {/* Status & Category */}
      <div className="flex flex-wrap items-center gap-2">
        {qmhq.status && (
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: qmhq.status.color || 'rgb(100, 116, 139)',
              color: qmhq.status.color || 'rgb(148, 163, 184)',
            }}
          >
            {qmhq.status.name}
          </Badge>
        )}
        {qmhq.category && (
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              borderColor: qmhq.category.color || 'rgb(100, 116, 139)',
              color: qmhq.category.color || 'rgb(148, 163, 184)',
            }}
          >
            <Tag className="mr-1 h-3 w-3" />
            {qmhq.category.name}
          </Badge>
        )}
      </div>

      {/* Assigned To */}
      {qmhq.assigned_user && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <User className="h-3.5 w-3.5" />
          <span>Assigned to: {qmhq.assigned_user.full_name}</span>
        </div>
      )}

      {/* Contact Person */}
      {qmhq.contact_person && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <User className="h-3.5 w-3.5" />
          <span>
            Contact: {qmhq.contact_person.name}
            {qmhq.contact_person.position && ` (${qmhq.contact_person.position})`}
          </span>
        </div>
      )}

      {/* Route-Specific Section */}
      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <RouteIcon className={cn('h-4 w-4', routeInfo.color)} />
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {routeInfo.label} Details
          </span>
        </div>

        {qmhq.route_type === 'item' && (
          <>
            {/* Multi-item or single item */}
            {qmhq.qmhq_items && qmhq.qmhq_items.length > 0 ? (
              <div className="space-y-2">
                {qmhq.qmhq_items.map((qmhqItem, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-slate-200 font-medium">
                        {qmhqItem.item.name}
                      </p>
                      {qmhqItem.item.sku && (
                        <p className="text-xs text-slate-500 font-mono">
                          SKU: {qmhqItem.item.sku}
                        </p>
                      )}
                    </div>
                    <div className="text-sm text-slate-300 font-mono">
                      Qty: {qmhqItem.quantity}
                    </div>
                  </div>
                ))}
              </div>
            ) : qmhq.item ? (
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm text-slate-200 font-medium">
                    {qmhq.item.name}
                  </p>
                  {qmhq.item.sku && (
                    <p className="text-xs text-slate-500 font-mono">
                      SKU: {qmhq.item.sku}
                    </p>
                  )}
                </div>
                {qmhq.quantity !== null && (
                  <div className="text-sm text-slate-300 font-mono">
                    Qty: {qmhq.quantity}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No item selected</p>
            )}
          </>
        )}

        {qmhq.route_type === 'expense' && (
          <div className="space-y-2">
            {qmhq.amount !== null && qmhq.currency ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Amount:</span>
                  <span className="text-sm text-slate-200 font-mono">
                    {formatCurrency(qmhq.amount)} {qmhq.currency}
                  </span>
                </div>
                {qmhq.exchange_rate !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Exchange Rate:</span>
                    <span className="text-sm text-slate-300 font-mono">
                      {qmhq.exchange_rate.toFixed(4)}
                    </span>
                  </div>
                )}
                {qmhq.amount_eusd !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">EUSD:</span>
                    <span className="text-sm text-amber-400 font-mono font-semibold">
                      ${qmhq.amount_eusd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 italic">No amount specified</p>
            )}
          </div>
        )}

        {qmhq.route_type === 'po' && (
          <div className="space-y-2">
            {qmhq.budget_amount !== null && qmhq.budget_currency ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Budget:</span>
                  <span className="text-sm text-slate-200 font-mono">
                    {formatCurrency(qmhq.budget_amount)} {qmhq.budget_currency}
                  </span>
                </div>
                {qmhq.budget_exchange_rate !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Exchange Rate:</span>
                    <span className="text-sm text-slate-300 font-mono">
                      {qmhq.budget_exchange_rate.toFixed(4)}
                    </span>
                  </div>
                )}
                {qmhq.budget_amount_eusd !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">EUSD:</span>
                    <span className="text-sm text-amber-400 font-mono font-semibold">
                      ${qmhq.budget_amount_eusd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500 italic">No budget specified</p>
            )}
          </div>
        )}
      </div>

      {/* Description (collapsible) */}
      {qmhq.description && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Description
          </p>
          <p
            className={cn(
              'text-sm text-slate-300 whitespace-pre-wrap',
              !isDescriptionExpanded && 'line-clamp-4'
            )}
          >
            {qmhq.description}
          </p>
          {qmhq.description.length > 200 && (
            <button
              onClick={() => setIsDescriptionExpanded(prev => !prev)}
              className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {isDescriptionExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Notes (collapsible) */}
      {qmhq.notes && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Notes
          </p>
          <p
            className={cn(
              'text-sm text-slate-300 whitespace-pre-wrap',
              !isNotesExpanded && 'line-clamp-4'
            )}
          >
            {qmhq.notes}
          </p>
          {qmhq.notes.length > 200 && (
            <button
              onClick={() => setIsNotesExpanded(prev => !prev)}
              className="flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {isNotesExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>
      )}
    </>
  );
}
