import { View, Text } from "@react-pdf/renderer";
import { PDFLogo } from "./logo";
import { PDFStatusBadge } from "./status-badge";
import { darkThemeStyles } from "../styles";
import type { PDFHeaderProps } from "../types";

export function PDFHeader({
  title,
  documentNumber,
  status,
  statusColor,
  date,
  exchangeRate,
  currency,
}: PDFHeaderProps) {
  return (
    <View style={darkThemeStyles.header}>
      {/* Row: Logo + Document Info */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {/* Left: Logo + Company Name */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <PDFLogo />
          <View>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#F8FAFC" }}>
              QM System
            </Text>
            <Text style={{ fontSize: 8, color: "#94A3B8", marginTop: 2 }}>
              Quartermaster Management
            </Text>
          </View>
        </View>

        {/* Right: Document Info */}
        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "bold",
              color: "#F59E0B",
              marginBottom: 4,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Courier",
              color: "#E2E8F0",
              marginBottom: 6,
            }}
          >
            {documentNumber}
          </Text>
          <PDFStatusBadge status={status} label={status} color={statusColor} />
          {date && (
            <Text
              style={{
                fontSize: 9,
                color: "#94A3B8",
                marginTop: 6,
              }}
            >
              Date: {date}
            </Text>
          )}
          {exchangeRate && currency && (
            <Text
              style={{
                fontSize: 8,
                color: "#94A3B8",
                marginTop: 2,
              }}
            >
              Exchange Rate: 1 EUSD = {exchangeRate.toFixed(4)} {currency}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}
