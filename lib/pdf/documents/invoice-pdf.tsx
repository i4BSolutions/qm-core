import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { PDFTemplate } from "../components/template";
import { PDFTable } from "../components/table";
import { DualCurrency } from "../components/dual-currency";
import { darkThemeStyles } from "../styles";
import type { PDFTableColumn } from "../types";

// Props interface
interface InvoicePDFProps {
  invoice: {
    invoice_number: string;
    invoice_date: string | null;
    currency: string;
    exchange_rate: number;
    total_amount: number;
    total_amount_eusd: number;
    status: string;
    is_voided: boolean;
    void_reason?: string | null;
    notes?: string | null;
  };
  lineItems: Array<{
    item_name?: string;
    item_sku?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    line_total_eusd?: number;
    received_quantity?: number;
    po_unit_price?: number;
  }>;
  purchaseOrder?: {
    po_number: string;
    total_amount: number;
    total_amount_eusd: number;
    currency: string;
  } | null;
  supplier?: {
    company_name?: string;
    name: string;
    email?: string;
    phone?: string;
  } | null;
}

// Inline helper for formatting amounts
const formatAmount = (amount: number): string => {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Inline helper for formatting date
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Local styles
const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: "#F59E0B", // amber-500
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  sectionContent: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 9,
    color: "#94A3B8", // slate-400
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 10,
    color: "#F8FAFC", // slate-50
  },
  infoValueMono: {
    fontSize: 10,
    color: "#F8FAFC",
    fontFamily: "Courier",
  },
  infoValueBold: {
    fontSize: 10,
    color: "#F8FAFC",
    fontWeight: 600,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155", // slate-700
  },
  totalsLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#F8FAFC",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  totalsAmount: {
    fontSize: 14,
    fontWeight: 700,
    color: "#10B981", // emerald-500
    fontFamily: "Courier",
  },
  totalsAmountEusd: {
    fontSize: 11,
    color: "#6EE7B7", // emerald-300
    fontFamily: "Courier",
    marginTop: 2,
  },
  notesText: {
    fontSize: 9,
    color: "#CBD5E1", // slate-300
    lineHeight: 1.5,
  },
  progressTable: {
    flexDirection: "column",
    gap: 4,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#1E293B", // slate-800
    borderRadius: 4,
  },
  progressLabel: {
    fontSize: 9,
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  progressValue: {
    fontSize: 10,
    color: "#F8FAFC",
    fontFamily: "Courier",
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: 600,
    color: "#10B981", // emerald-500
    marginTop: 8,
    textAlign: "center",
  },
});

export default function InvoicePDF({
  invoice,
  lineItems,
  purchaseOrder,
  supplier,
}: InvoicePDFProps) {
  // Determine status display and color
  const statusDisplay = invoice.is_voided
    ? "VOIDED"
    : invoice.status.toUpperCase();
  const statusColor = invoice.is_voided ? "#EF4444" : "#10B981"; // red or green

  // Calculate received progress
  const totalOrdered = lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const totalReceived = lineItems.reduce(
    (sum, li) => sum + (li.received_quantity || 0),
    0
  );
  const receivedPercent =
    totalOrdered > 0
      ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
      : 0;

  // Prepare table columns
  const columns: PDFTableColumn[] = [
    { header: "#", key: "index", width: "5%", align: "left" },
    { header: "Item", key: "item", width: "30%", align: "left" },
    { header: "Qty", key: "quantity", width: "10%", align: "right" },
    { header: "Unit Price", key: "unit_price", width: "15%", align: "right" },
    { header: "Line Total", key: "line_total", width: "25%", align: "right" },
    { header: "Received", key: "received", width: "15%", align: "right" },
  ];

  // Prepare table data
  const tableData = lineItems.map((li, idx) => ({
    index: (idx + 1).toString(),
    item: (
      <View>
        <Text style={{ fontSize: 9, color: "#F8FAFC" }}>
          {li.item_name || "Unknown Item"}
        </Text>
        {li.item_sku && (
          <Text style={{ fontSize: 7, color: "#94A3B8", marginTop: 2 }}>
            SKU: {li.item_sku}
          </Text>
        )}
      </View>
    ),
    quantity: (
      <Text style={{ fontFamily: "Courier", fontSize: 9, color: "#F8FAFC" }}>
        {li.quantity}
      </Text>
    ),
    unit_price: (
      <Text style={{ fontFamily: "Courier", fontSize: 9, color: "#F8FAFC" }}>
        {formatAmount(li.unit_price)} {invoice.currency}
      </Text>
    ),
    line_total: (
      <View>
        <Text style={{ fontFamily: "Courier", fontSize: 9, color: "#F8FAFC" }}>
          {formatAmount(li.line_total)} {invoice.currency}
        </Text>
        {li.line_total_eusd !== undefined && (
          <Text
            style={{ fontFamily: "Courier", fontSize: 7, color: "#94A3B8", marginTop: 2 }}
          >
            {formatAmount(li.line_total_eusd)} EUSD
          </Text>
        )}
      </View>
    ),
    received: (
      <Text
        style={{
          fontFamily: "Courier",
          fontSize: 9,
          color: li.received_quantity ? "#10B981" : "#64748B",
        }}
      >
        {li.received_quantity || 0}
      </Text>
    ),
  }));

  return (
    <PDFTemplate
      title="Invoice Receipt"
      documentNumber={invoice.invoice_number}
      status={statusDisplay}
      statusColor={statusColor}
      date={formatDate(invoice.invoice_date)}
      exchangeRate={invoice.exchange_rate}
      currency={invoice.currency}
    >
      {/* Section A: PO Summary */}
      {purchaseOrder && (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Purchase Order Reference</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PO Number</Text>
            <Text style={styles.infoValueMono}>{purchaseOrder.po_number}</Text>
          </View>
          {supplier && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Supplier</Text>
              <Text style={styles.infoValue}>
                {supplier.company_name || supplier.name}
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PO Total</Text>
            <View>
              <Text style={styles.infoValueMono}>
                {formatAmount(purchaseOrder.total_amount)} {purchaseOrder.currency}
              </Text>
              <Text style={{ fontSize: 8, color: "#94A3B8", fontFamily: "Courier" }}>
                {formatAmount(purchaseOrder.total_amount_eusd)} EUSD
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 8, color: "#94A3B8" }}>
              This invoice covers {lineItems.length} line item(s)
            </Text>
          </View>
        </View>
      )}

      {/* Section B: Supplier Information */}
      {supplier && (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Supplier</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company</Text>
            <Text style={styles.infoValueBold}>
              {supplier.company_name || supplier.name}
            </Text>
          </View>
          {supplier.company_name && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Contact</Text>
              <Text style={styles.infoValue}>{supplier.name}</Text>
            </View>
          )}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            {supplier.email && (
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={{ fontSize: 8, color: "#F8FAFC" }}>
                  {supplier.email}
                </Text>
              </View>
            )}
            {supplier.phone && (
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={{ fontSize: 8, color: "#F8FAFC" }}>
                  {supplier.phone}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Section C: Line Items Table */}
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Line Items</Text>
        <PDFTable columns={columns} data={tableData} />

        {/* Totals Row */}
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Invoice Total</Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.totalsAmount}>
              {formatAmount(invoice.total_amount)} {invoice.currency}
            </Text>
            <Text style={styles.totalsAmountEusd}>
              {formatAmount(invoice.total_amount_eusd)} EUSD
            </Text>
          </View>
        </View>
      </View>

      {/* Section D: Received Progress Summary */}
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Receiving Progress</Text>
        <View style={styles.progressTable}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Ordered</Text>
            <Text style={styles.progressValue}>{totalOrdered}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Invoiced</Text>
            <Text style={styles.progressValue}>{totalOrdered}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Received</Text>
            <Text style={styles.progressValue}>{totalReceived}</Text>
          </View>
        </View>
        <Text style={styles.progressPercent}>
          Received: {totalReceived} / {totalOrdered} ({receivedPercent}%)
        </Text>
      </View>

      {/* Section E: Notes (conditional) */}
      {invoice.notes && (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{invoice.notes}</Text>
        </View>
      )}

      {/* Void Reason (if voided) */}
      {invoice.is_voided && invoice.void_reason && (
        <View style={styles.sectionContent}>
          <Text style={styles.sectionTitle}>Void Reason</Text>
          <Text style={styles.notesText}>{invoice.void_reason}</Text>
        </View>
      )}
    </PDFTemplate>
  );
}

export { InvoicePDF };
