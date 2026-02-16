"use client";

import { PDFDownloadButton } from "@/components/pdf-export/pdf-download-button";
import { InvoicePDF } from "@/lib/pdf/documents/invoice-pdf";
import { format } from "date-fns";

interface InvoicePDFButtonProps {
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
    conversion_rate?: number;
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
  standardUnitName?: string;
}

export function InvoicePDFButton({
  invoice,
  lineItems,
  purchaseOrder,
  supplier,
  standardUnitName,
}: InvoicePDFButtonProps) {
  return (
    <PDFDownloadButton
      document={
        <InvoicePDF
          invoice={invoice}
          lineItems={lineItems}
          purchaseOrder={purchaseOrder}
          supplier={supplier}
          standardUnitName={standardUnitName}
        />
      }
      fileName={`Invoice_${invoice.invoice_number}_${format(new Date(), "yyyy-MM-dd")}.pdf`}
    />
  );
}
