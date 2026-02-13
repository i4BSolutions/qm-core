"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowChain } from "@/types/flow-tracking";
import { FlowQMRLNode } from "./flow-qmrl-node";
import { FlowQMHQNode } from "./flow-qmhq-node";
import { FlowPONode } from "./flow-po-node";
import { FlowInvoiceNode } from "./flow-invoice-node";
import { FlowStockNode } from "./flow-stock-node";
import { FlowFinancialNode } from "./flow-financial-node";
import { FlowSORNode } from "./flow-sor-node";

/**
 * Accordion wrapper for a flow node with collapsible children.
 * Shows a chevron toggle on the left and renders children when open.
 */
function AccordionItem({
  children,
  content,
  childCount,
  defaultOpen = true,
  indent = true,
}: {
  children: React.ReactNode; // The node card (header)
  content: React.ReactNode; // The collapsible children
  childCount: number;
  defaultOpen?: boolean;
  indent?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (childCount === 0) {
    return <>{children}</>;
  }

  return (
    <div>
      {/* Node card with toggle */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-8 z-10 flex h-5 w-5 items-center justify-center rounded bg-slate-800 border border-slate-600 hover:border-amber-500/50 hover:bg-slate-700 transition-all"
          title={isOpen ? "Collapse" : "Expand"}
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 text-slate-400 transition-transform duration-200",
              isOpen && "rotate-90"
            )}
          />
        </button>
        {children}
      </div>

      {/* Collapsible children */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {indent ? (
          <div className="ml-8 border-l-2 border-slate-700 pl-6 space-y-0">
            {content}
          </div>
        ) : (
          content
        )}
      </div>
    </div>
  );
}

interface FlowChainTimelineProps {
  chain: FlowChain;
}

export function FlowChainTimeline({ chain }: FlowChainTimelineProps) {
  return (
    <div className="mt-8 space-y-0 pl-10">
      {/* QMRL root with QMHQ children as accordion */}
      <AccordionItem
        childCount={chain.qmhqs.length}
        content={
          chain.qmhqs.length > 0 ? (
            chain.qmhqs.map((qmhq) => {
              // Count children based on route type
              const childCount =
                qmhq.route_type === "item"
                  ? qmhq.stock_out_requests.length + qmhq.stock_transactions.length
                  : qmhq.route_type === "expense"
                    ? qmhq.financial_transactions.length
                    : qmhq.pos.length;

              return (
                <AccordionItem
                  key={qmhq.id}
                  childCount={childCount}
                  content={
                    <>
                      {/* Item route: SOR nodes + stock transactions */}
                      {qmhq.route_type === "item" && (
                        <>
                          {qmhq.stock_out_requests.map((sor) => (
                            <FlowSORNode key={sor.id} sor={sor} />
                          ))}
                          {qmhq.stock_transactions.map((st) => (
                            <FlowStockNode key={st.id} stock={st} />
                          ))}
                        </>
                      )}

                      {/* Expense route: financial transactions */}
                      {qmhq.route_type === "expense" &&
                        qmhq.financial_transactions.map((ft) => (
                          <FlowFinancialNode key={ft.id} transaction={ft} />
                        ))}

                      {/* PO route: POs -> Invoices -> Stock */}
                      {qmhq.route_type === "po" &&
                        qmhq.pos.map((po) => (
                          <AccordionItem
                            key={po.id}
                            childCount={po.invoices.length}
                            content={po.invoices.map((inv) => (
                              <AccordionItem
                                key={inv.id}
                                childCount={inv.stock_transactions.length}
                                content={inv.stock_transactions.map((st) => (
                                  <FlowStockNode key={st.id} stock={st} />
                                ))}
                              >
                                <FlowInvoiceNode invoice={inv} />
                              </AccordionItem>
                            ))}
                          >
                            <FlowPONode po={po} />
                          </AccordionItem>
                        ))}
                    </>
                  }
                >
                  <FlowQMHQNode qmhq={qmhq} />
                </AccordionItem>
              );
            })
          ) : (
            <div className="py-4 text-sm text-slate-500">No linked QMHQs</div>
          )
        }
      >
        <FlowQMRLNode qmrl={chain} />
      </AccordionItem>
    </div>
  );
}
