"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

interface QmhqLinkedTransactionsProps {
  qmhqId: string;
  qmhqRequestId: string;
}

interface LinkedTransaction {
  id: string;
  quantity: number;
  status: string;
  transaction_date: string | null;
  created_at: string;
  item?: {
    name: string;
    sku: string | null;
  } | null;
  warehouse?: {
    name: string;
  } | null;
  stock_out_approval?: {
    approval_number: string | null;
    line_item?: {
      request?: {
        id: string;
        request_number: string;
      } | null;
    } | null;
  } | null;
}

export function QmhqLinkedTransactions({
  qmhqId,
  qmhqRequestId,
}: QmhqLinkedTransactionsProps) {
  const [transactions, setTransactions] = useState<LinkedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      const supabase = createClient();

      const { data, error } = await supabase
        .from("inventory_transactions")
        .select(`
          id, quantity, status, transaction_date, created_at,
          item:items(name, sku),
          warehouse:warehouses(name),
          stock_out_approval:stock_out_approvals(
            approval_number,
            line_item:stock_out_line_items(
              request:stock_out_requests(id, request_number)
            )
          )
        `)
        .eq("qmhq_id", qmhqId)
        .eq("movement_type", "inventory_out")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (data) {
        setTransactions(data as unknown as LinkedTransaction[]);
      }

      setIsLoading(false);
    };

    fetchTransactions();
  }, [qmhqId]);

  if (isLoading) {
    return (
      <div className="command-panel corner-accents p-6">
        <div className="text-center text-slate-400">
          Loading transactions...
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="command-panel corner-accents p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-slate-500 opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-slate-500 mb-2">
            No stock-out transactions linked to this QMHQ yet
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="command-panel corner-accents p-6">
      <div className="section-header mb-6">
        <Package className="h-4 w-4 text-slate-400" />
        <h3>Linked Stock-Out Transactions</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Reference
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Item
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Quantity
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const request = transaction.stock_out_approval?.line_item?.request;
              const approvalNumber = transaction.stock_out_approval?.approval_number;

              return (
                <tr
                  key={transaction.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      {/* Primary: Approval number */}
                      {approvalNumber && request ? (
                        <Link
                          href={`/inventory/stock-out-requests/${request.id}`}
                          className="font-mono text-sm text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 transition-colors"
                        >
                          {approvalNumber}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ) : (
                        <span className="font-mono text-sm text-slate-500">
                          No approval
                        </span>
                      )}
                      {/* Secondary: via QMHQ (not a link since user is already on this page) */}
                      <div className="text-xs text-slate-400 font-mono">
                        via{" "}
                        <span className="text-blue-400">
                          {qmhqRequestId}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <div className="text-sm text-slate-200">
                        {transaction.item?.name || "Unknown Item"}
                      </div>
                      {transaction.item?.sku && (
                        <div className="text-xs font-mono text-slate-400">
                          {transaction.item.sku}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono text-slate-200">
                      {transaction.quantity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        transaction.status === "completed" ? "default" : "secondary"
                      }
                    >
                      {transaction.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-400">
                      {new Date(
                        transaction.transaction_date || transaction.created_at
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
