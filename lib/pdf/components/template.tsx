import { Document, Page, View } from "@react-pdf/renderer";
import { PDFHeader } from "./header";
import { PDFFooter } from "./footer";
import { darkThemeStyles } from "../styles";
import type { PDFHeaderProps } from "../types";

interface PDFTemplateProps extends PDFHeaderProps {
  children: React.ReactNode;
}

export function PDFTemplate({
  title,
  documentNumber,
  status,
  statusColor,
  date,
  exchangeRate,
  currency,
  children,
}: PDFTemplateProps) {
  return (
    <Document>
      <Page size="A4" style={darkThemeStyles.page}>
        <PDFHeader
          title={title}
          documentNumber={documentNumber}
          status={status}
          statusColor={statusColor}
          date={date}
          exchangeRate={exchangeRate}
          currency={currency}
        />
        <View style={darkThemeStyles.content}>{children}</View>
        <PDFFooter />
      </Page>
    </Document>
  );
}
