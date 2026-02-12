// PDF Document Types
export type PDFDocumentType = "invoice" | "stock_out" | "money_out";

// PDF Header Props
export interface PDFHeaderProps {
  title: string;
  documentNumber: string;
  status: string;
  statusColor?: string;
  date?: string;
  exchangeRate?: number;
  currency?: string;
}

// PDF Table Column Definition
export interface PDFTableColumn {
  header: string;
  key: string;
  width: string;
  align?: "left" | "right" | "center";
}

// Dual Currency Display Props
export interface DualCurrencyProps {
  label?: string;
  amount: number;
  currency: string;
  amountEusd: number;
}
