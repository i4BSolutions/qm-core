import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { PDFTemplate } from "../components/template";
import { PDFTable } from "../components/table";
import { darkThemeStyles } from "../styles";
import type { PDFTableColumn } from "../types";

interface MoneyOutPDFProps {
  qmhq: {
    request_id: string;
    line_name: string;
    route_type: string;
    status_name?: string;
    status_color?: string;
    category_name?: string;
    amount?: number;
    currency?: string;
    exchange_rate?: number;
    amount_eusd?: number;
    notes?: string | null;
  };
  transactions: Array<{
    transaction_id?: string;
    transaction_type: string; // money_in or money_out
    amount: number;
    currency: string;
    exchange_rate: number;
    amount_eusd: number;
    notes?: string | null;
    transaction_date?: string | null;
    created_by_name?: string | null;
  }>;
  parentQmrl?: {
    request_id: string;
    title: string;
  } | null;
}

// Route type label mapping
const ROUTE_TYPE_LABELS: Record<string, string> = {
  expense: "Expense",
  po: "Purchase Order",
  item: "Item Request",
};

// Format amount helper
const formatAmount = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export function MoneyOutPDF({ qmhq, transactions, parentQmrl }: MoneyOutPDFProps) {
  const routeLabel = ROUTE_TYPE_LABELS[qmhq.route_type] || qmhq.route_type;

  // Format date helper
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Transaction table columns
  const transactionColumns: PDFTableColumn[] = [
    { header: "Transaction ID", key: "transaction_id", width: "15%" },
    { header: "Type", key: "type", width: "12%" },
    { header: "Amount", key: "amount", width: "18%", align: "right" },
    { header: "EUSD", key: "eusd", width: "15%", align: "right" },
    { header: "Rate", key: "rate", width: "10%", align: "right" },
    { header: "Date", key: "date", width: "15%" },
    { header: "By", key: "by", width: "15%" },
  ];

  // Map transactions to table data
  const transactionData = transactions.map((tx) => {
    const isMoneyIn = tx.transaction_type === "money_in";
    const typeColor = isMoneyIn ? "#10B981" : "#F59E0B"; // emerald or amber

    return {
      transaction_id: (
        <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier", fontSize: 8 }}>
          {tx.transaction_id || "—"}
        </Text>
      ),
      type: (
        <Text style={{ ...darkThemeStyles.tableCell, color: typeColor, fontSize: 9 }}>
          {isMoneyIn ? "Money In" : "Money Out"}
        </Text>
      ),
      amount: (
        <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier" }}>
          {formatAmount(tx.amount)} {tx.currency}
        </Text>
      ),
      eusd: (
        <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier" }}>
          {formatAmount(tx.amount_eusd)} EUSD
        </Text>
      ),
      rate: (
        <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier", fontSize: 8 }}>
          {tx.exchange_rate.toFixed(4)}
        </Text>
      ),
      date: formatDate(tx.transaction_date),
      by: tx.created_by_name || "—",
    };
  });

  // Calculate totals
  const totalMoneyIn = transactions
    .filter(tx => tx.transaction_type === "money_in")
    .reduce((sum, tx) => sum + tx.amount_eusd, 0);

  const totalMoneyOut = transactions
    .filter(tx => tx.transaction_type === "money_out")
    .reduce((sum, tx) => sum + tx.amount_eusd, 0);

  const netBalance = totalMoneyIn - totalMoneyOut;

  return (
    <PDFTemplate
      title="MONEY-OUT RECEIPT"
      documentNumber={qmhq.request_id}
      status={qmhq.status_name || routeLabel}
      statusColor={qmhq.status_color}
    >
      {/* Section A: QMHQ Context */}
      <View style={{ marginBottom: 16 }}>
        <Text style={darkThemeStyles.sectionTitle}>QMHQ DETAILS</Text>
        <View style={{ marginTop: 8, gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Request ID</Text>
              <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier", fontWeight: "bold" }}>
                {qmhq.request_id}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Route Type</Text>
              <Text style={darkThemeStyles.tableCell}>{routeLabel}</Text>
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Line Name</Text>
            <Text style={{ ...darkThemeStyles.tableCell, fontWeight: "bold" }}>{qmhq.line_name}</Text>
          </View>

          {qmhq.category_name && (
            <View>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Category</Text>
              <Text style={darkThemeStyles.tableCell}>{qmhq.category_name}</Text>
            </View>
          )}

          {parentQmrl && (
            <View>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Parent QMRL</Text>
              <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier" }}>
                {parentQmrl.request_id} - {parentQmrl.title}
              </Text>
            </View>
          )}

          {qmhq.amount !== undefined && (
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>QMHQ Amount</Text>
                <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier" }}>
                  {formatAmount(qmhq.amount)} {qmhq.currency || "MMK"}
                  {qmhq.amount_eusd !== undefined && (
                    <Text style={{ color: "#94A3B8" }}> / {formatAmount(qmhq.amount_eusd)} EUSD</Text>
                  )}
                </Text>
              </View>
              {qmhq.exchange_rate !== undefined && (
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Exchange Rate</Text>
                  <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier" }}>
                    {qmhq.exchange_rate.toFixed(4)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Section B: Financial Transactions Table */}
      <View style={{ marginBottom: 16 }}>
        <Text style={darkThemeStyles.sectionTitle}>FINANCIAL TRANSACTIONS</Text>
        <View style={{ marginTop: 8 }}>
          <PDFTable columns={transactionColumns} data={transactionData} />
        </View>

        {/* Totals Summary */}
        <View
          style={{
            marginTop: 12,
            padding: 10,
            backgroundColor: "#1E293B",
            borderRadius: 4,
            border: "1pt solid #334155",
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "bold", color: "#F59E0B", marginBottom: 6 }}>
            Summary
          </Text>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 9, color: "#94A3B8" }}>Total Money In (EUSD):</Text>
              <Text style={{ fontSize: 9, fontFamily: "Courier", color: "#10B981" }}>
                {formatAmount(totalMoneyIn)} EUSD
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 9, color: "#94A3B8" }}>Total Money Out (EUSD):</Text>
              <Text style={{ fontSize: 9, fontFamily: "Courier", color: "#F59E0B" }}>
                {formatAmount(totalMoneyOut)} EUSD
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 4,
                paddingTop: 4,
                borderTop: "1pt solid #334155",
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "bold", color: "#E2E8F0" }}>Net Balance (EUSD):</Text>
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "Courier",
                  fontWeight: "bold",
                  color: netBalance >= 0 ? "#10B981" : "#EF4444",
                }}
              >
                {formatAmount(netBalance)} EUSD
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Section C: Notes (conditional) */}
      {qmhq.notes && (
        <View>
          <Text style={darkThemeStyles.sectionTitle}>NOTES</Text>
          <Text style={{ ...darkThemeStyles.tableCell, fontSize: 9, marginTop: 4 }}>
            {qmhq.notes}
          </Text>
        </View>
      )}
    </PDFTemplate>
  );
}
