import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { PDFTemplate } from "../components/template";
import { PDFTable } from "../components/table";
import { darkThemeStyles } from "../styles";
import type { PDFTableColumn } from "../types";

interface StockOutPDFProps {
  request: {
    request_number: string;
    status: string;
    reason: string;
    notes?: string | null;
    requester_name: string;
    created_at: string;
    qmhq_reference?: string | null;
    qmhq_line_name?: string | null;
  };
  lineItems: Array<{
    item_name: string;
    item_sku?: string | null;
    requested_quantity: number;
    conversion_rate?: number;
    status: string;
    total_approved_quantity: number;
    total_rejected_quantity: number;
  }>;
  approvals: Array<{
    approval_number?: string | null;
    item_name: string;
    item_sku?: string | null;
    approved_quantity: number;
    conversion_rate?: number;
    decision: string;
    rejection_reason?: string | null;
    decided_by_name: string;
    decided_at: string;
  }>;
  standardUnitName?: string;
}

// Status label mapping
const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partially_approved: "Partially Approved",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  partially_executed: "Partially Fulfilled",
  executed: "Fulfilled",
};

// Reason label mapping
const REASON_LABELS: Record<string, string> = {
  request: "Fulfillment Request",
  consumption: "Direct Consumption",
  damage: "Damaged Goods",
  lost: "Lost Items",
  transfer: "Warehouse Transfer",
  adjustment: "Inventory Adjustment",
};

// Line item status colors
const LINE_STATUS_COLORS: Record<string, string> = {
  approved: "#10B981", // emerald
  rejected: "#EF4444", // red
  pending: "#F59E0B", // amber
  executed: "#10B981", // emerald
  cancelled: "#64748B", // slate
};

export function StockOutPDF({ request, lineItems, approvals, standardUnitName }: StockOutPDFProps) {
  const statusLabel = REQUEST_STATUS_LABELS[request.status] || request.status;
  const reasonLabel = REASON_LABELS[request.reason] || request.reason;

  // Format date helper
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Line items table columns
  const lineItemColumns: PDFTableColumn[] = standardUnitName ? [
    { header: "#", key: "index", width: "6%", align: "center" },
    { header: "Item", key: "item", width: "30%" },
    { header: "Requested", key: "requested", width: "16%", align: "right" },
    { header: "Approved", key: "approved", width: "16%", align: "right" },
    { header: "Rejected", key: "rejected", width: "16%", align: "right" },
    { header: "Status", key: "status", width: "16%", align: "center" },
  ] : [
    { header: "#", key: "index", width: "8%", align: "center" },
    { header: "Item", key: "item", width: "40%" },
    { header: "Requested", key: "requested", width: "13%", align: "right" },
    { header: "Approved", key: "approved", width: "13%", align: "right" },
    { header: "Rejected", key: "rejected", width: "13%", align: "right" },
    { header: "Status", key: "status", width: "13%", align: "center" },
  ];

  // Map line items to table data
  const lineItemData = lineItems.map((item, index) => {
    const statusColor = LINE_STATUS_COLORS[item.status] || "#94A3B8";
    const conversionRate = item.conversion_rate || 1;

    return {
      index: (index + 1).toString(),
      item: (
        <View>
          <Text style={darkThemeStyles.tableCell}>{item.item_name}</Text>
          {item.item_sku && (
            <Text style={{ fontSize: 8, color: "#94A3B8", fontFamily: "Courier", marginTop: 2 }}>
              {item.item_sku}
            </Text>
          )}
        </View>
      ),
      requested: standardUnitName ? (
        <View>
          <Text style={darkThemeStyles.tableCell}>{item.requested_quantity.toString()}</Text>
          <Text style={{ fontSize: 8, color: "#94A3B8", fontFamily: "Courier", marginTop: 2 }}>
            {(item.requested_quantity * conversionRate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {standardUnitName}
          </Text>
        </View>
      ) : item.requested_quantity.toString(),
      approved: standardUnitName ? (
        <View>
          <Text style={darkThemeStyles.tableCell}>{item.total_approved_quantity.toString()}</Text>
          <Text style={{ fontSize: 8, color: "#94A3B8", fontFamily: "Courier", marginTop: 2 }}>
            {(item.total_approved_quantity * conversionRate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {standardUnitName}
          </Text>
        </View>
      ) : item.total_approved_quantity.toString(),
      rejected: standardUnitName ? (
        <View>
          <Text style={darkThemeStyles.tableCell}>{item.total_rejected_quantity.toString()}</Text>
          <Text style={{ fontSize: 8, color: "#94A3B8", fontFamily: "Courier", marginTop: 2 }}>
            {(item.total_rejected_quantity * conversionRate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {standardUnitName}
          </Text>
        </View>
      ) : item.total_rejected_quantity.toString(),
      status: (
        <Text style={{ ...darkThemeStyles.tableCell, color: statusColor, fontSize: 9, textTransform: "capitalize" }}>
          {item.status.replace("_", " ")}
        </Text>
      ),
    };
  });

  return (
    <PDFTemplate
      title="STOCK-OUT RECEIPT"
      documentNumber={request.request_number}
      status={statusLabel}
    >
      {/* Section A: Request Summary */}
      <View style={{ marginBottom: 16 }}>
        <Text style={darkThemeStyles.sectionTitle}>REQUEST DETAILS</Text>
        <View style={{ marginTop: 8, gap: 6 }}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Requester</Text>
              <Text style={darkThemeStyles.tableCell}>{request.requester_name}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Reason</Text>
              <Text style={darkThemeStyles.tableCell}>{reasonLabel}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Created</Text>
              <Text style={darkThemeStyles.tableCell}>{formatDate(request.created_at)}</Text>
            </View>
            {request.qmhq_reference && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>QMHQ Reference</Text>
                <Text style={{ ...darkThemeStyles.tableCell, fontFamily: "Courier" }}>
                  {request.qmhq_reference}
                  {request.qmhq_line_name && ` (${request.qmhq_line_name})`}
                </Text>
              </View>
            )}
          </View>
          {request.notes && (
            <View>
              <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Notes</Text>
              <Text style={{ ...darkThemeStyles.tableCell, fontSize: 9 }}>{request.notes}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Section B: Line Items Table */}
      <View style={{ marginBottom: 16 }}>
        <Text style={darkThemeStyles.sectionTitle}>LINE ITEMS</Text>
        <View style={{ marginTop: 8 }}>
          <PDFTable columns={lineItemColumns} data={lineItemData} />
        </View>
      </View>

      {/* Section C: Approval Chain (Audit Trail) */}
      {approvals.length > 0 && (
        <View>
          <Text style={darkThemeStyles.sectionTitle}>APPROVAL HISTORY</Text>
          <View style={{ marginTop: 8, gap: 10 }}>
            {approvals.map((approval, index) => {
              const isApproved = approval.decision === "approved";
              const decisionColor = isApproved ? "#10B981" : "#EF4444";

              return (
                <View
                  key={index}
                  style={{
                    border: "1pt solid #334155",
                    borderRadius: 4,
                    padding: 10,
                    backgroundColor: "#1E293B",
                  }}
                >
                  {/* Header row with approval number and decision */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      {approval.approval_number && (
                        <Text style={{ fontSize: 9, fontFamily: "Courier", color: "#F8FAFC" }}>
                          {approval.approval_number}
                        </Text>
                      )}
                      <Text
                        style={{
                          fontSize: 8,
                          color: decisionColor,
                          borderLeft: `3pt solid ${decisionColor}`,
                          paddingLeft: 6,
                          paddingVertical: 2,
                          textTransform: "uppercase",
                          fontWeight: "bold",
                        }}
                      >
                        {approval.decision}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 8, color: "#94A3B8" }}>{formatDate(approval.decided_at)}</Text>
                  </View>

                  {/* Item and quantity info */}
                  <View style={{ flexDirection: "row", gap: 16, marginBottom: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Item</Text>
                      <Text style={{ fontSize: 10, color: "#E2E8F0" }}>{approval.item_name}</Text>
                      {approval.item_sku && (
                        <Text style={{ fontSize: 8, color: "#94A3B8", fontFamily: "Courier" }}>
                          {approval.item_sku}
                        </Text>
                      )}
                    </View>
                    {isApproved && (
                      <View style={{ width: "30%" }}>
                        <Text style={{ fontSize: 9, color: "#94A3B8", marginBottom: 2 }}>Quantity</Text>
                        <Text style={{ fontSize: 10, fontFamily: "Courier", color: "#E2E8F0" }}>
                          {approval.approved_quantity}
                        </Text>
                        {standardUnitName && approval.conversion_rate && (
                          <Text style={{ fontSize: 8, color: "#94A3B8", fontFamily: "Courier", marginTop: 2 }}>
                            {(approval.approved_quantity * approval.conversion_rate).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {standardUnitName}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Decided by */}
                  <View>
                    <Text style={{ fontSize: 9, color: "#94A3B8" }}>
                      Decided by: <Text style={{ color: "#E2E8F0" }}>{approval.decided_by_name}</Text>
                    </Text>
                  </View>

                  {/* Rejection reason (if rejected) */}
                  {!isApproved && approval.rejection_reason && (
                    <View
                      style={{
                        marginTop: 6,
                        paddingTop: 6,
                        borderTop: "1pt solid #334155",
                      }}
                    >
                      <Text style={{ fontSize: 8, color: "#94A3B8", marginBottom: 2 }}>Rejection Reason</Text>
                      <Text style={{ fontSize: 9, color: "#EF4444" }}>{approval.rejection_reason}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </PDFTemplate>
  );
}
