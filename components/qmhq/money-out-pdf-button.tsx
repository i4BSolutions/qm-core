"use client";

import { PDFDownloadButton } from "@/components/pdf-export/pdf-download-button";
import { MoneyOutPDF } from "@/lib/pdf/documents/money-out-pdf";
import { format } from "date-fns";

interface MoneyOutPDFButtonProps {
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
    transaction_type: string;
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

export function MoneyOutPDFButton({
  qmhq,
  transactions,
  parentQmrl,
}: MoneyOutPDFButtonProps) {
  return (
    <PDFDownloadButton
      document={
        <MoneyOutPDF
          qmhq={qmhq}
          transactions={transactions}
          parentQmrl={parentQmrl}
        />
      }
      fileName={`MoneyOut_${qmhq.request_id || "DRAFT"}_${format(new Date(), "yyyy-MM-dd")}.pdf`}
    />
  );
}
