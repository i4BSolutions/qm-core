"use client";

import type { FlowChain } from "@/types/flow-tracking";
import { FlowQMRLNode } from "./flow-qmrl-node";
import { FlowQMHQNode } from "./flow-qmhq-node";
import { FlowPONode } from "./flow-po-node";
import { FlowInvoiceNode } from "./flow-invoice-node";
import { FlowStockNode } from "./flow-stock-node";
import { FlowFinancialNode } from "./flow-financial-node";
import { FlowSORNode } from "./flow-sor-node";

interface FlowChainTimelineProps {
  chain: FlowChain;
}

export function FlowChainTimeline({ chain }: FlowChainTimelineProps) {
  return (
    <div className="mt-8 space-y-0">
      {/* QMRL root */}
      <FlowQMRLNode qmrl={chain} />

      {/* QMHQ branches - indented under QMRL */}
      {chain.qmhqs.length > 0 ? (
        <div className="ml-8 border-l-2 border-slate-700 pl-6 space-y-0">
          {chain.qmhqs.map((qmhq) => (
            <div key={qmhq.id}>
              <FlowQMHQNode qmhq={qmhq} />

              {/* Route-specific children - indented under QMHQ */}

              {/* Item route: SOR nodes + stock transactions */}
              {qmhq.route_type === "item" &&
                (qmhq.stock_out_requests.length > 0 ||
                  qmhq.stock_transactions.length > 0) && (
                  <div className="ml-8 border-l-2 border-slate-700 pl-6 space-y-0">
                    {qmhq.stock_out_requests.map((sor) => (
                      <FlowSORNode key={sor.id} sor={sor} />
                    ))}
                    {qmhq.stock_transactions.map((st) => (
                      <FlowStockNode key={st.id} stock={st} />
                    ))}
                  </div>
                )}

              {/* Expense route: financial transactions */}
              {qmhq.route_type === "expense" &&
                qmhq.financial_transactions.length > 0 && (
                  <div className="ml-8 border-l-2 border-slate-700 pl-6 space-y-0">
                    {qmhq.financial_transactions.map((ft) => (
                      <FlowFinancialNode key={ft.id} transaction={ft} />
                    ))}
                  </div>
                )}

              {/* PO route: POs -> Invoices -> Stock */}
              {qmhq.route_type === "po" && qmhq.pos.length > 0 && (
                <div className="ml-8 border-l-2 border-slate-700 pl-6 space-y-0">
                  {qmhq.pos.map((po) => (
                    <div key={po.id}>
                      <FlowPONode po={po} />

                      {/* Invoices under PO */}
                      {po.invoices.length > 0 && (
                        <div className="ml-8 border-l-2 border-slate-700 pl-6 space-y-0">
                          {po.invoices.map((inv) => (
                            <div key={inv.id}>
                              <FlowInvoiceNode invoice={inv} />

                              {/* Stock under Invoice */}
                              {inv.stock_transactions.length > 0 && (
                                <div className="ml-8 border-l-2 border-slate-700 pl-6 space-y-0">
                                  {inv.stock_transactions.map((st) => (
                                    <FlowStockNode key={st.id} stock={st} />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="ml-8 py-4 text-sm text-slate-500">No linked QMHQs</div>
      )}
    </div>
  );
}
