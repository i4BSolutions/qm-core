"use client";

import { PDFDownloadButton } from "@/components/pdf-export/pdf-download-button";
import { StockOutPDF } from "@/lib/pdf/documents/stock-out-pdf";
import { format } from "date-fns";

interface StockOutPDFButtonProps {
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
    unit_name?: string;
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
    unit_name?: string;
  }>;
}

export function StockOutPDFButton({
  request,
  lineItems,
  approvals,
}: StockOutPDFButtonProps) {
  return (
    <PDFDownloadButton
      document={
        <StockOutPDF
          request={request}
          lineItems={lineItems}
          approvals={approvals}
        />
      }
      fileName={`StockOut_${request.request_number}_${format(new Date(), "yyyy-MM-dd")}.pdf`}
    />
  );
}
