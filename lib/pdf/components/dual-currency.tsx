import { View, Text } from "@react-pdf/renderer";
import { darkThemeStyles } from "../styles";

interface DualCurrencyProps {
  label?: string;
  amount: number;
  currency: string;
  amountEusd: number;
  size?: "sm" | "md" | "lg";
}

// Simple currency formatter for PDF (can't use DOM-dependent utils)
function formatAmount(value: number): string {
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function DualCurrency({
  label,
  amount,
  currency,
  amountEusd,
  size = "md",
}: DualCurrencyProps) {
  const formattedAmount = formatAmount(amount);
  const formattedEusd = formatAmount(amountEusd);

  const fontSize = size === "sm" ? 8 : size === "lg" ? 12 : 10;

  if (label) {
    // Row layout with label on left, amounts on right
    return (
      <View style={darkThemeStyles.amountRow}>
        <Text style={{ ...darkThemeStyles.label, fontSize }}>{label}:</Text>
        <Text style={{ ...darkThemeStyles.amount, fontSize }}>
          {formattedAmount} {currency} / {formattedEusd} EUSD
        </Text>
      </View>
    );
  }

  // Just the amounts
  return (
    <Text style={{ ...darkThemeStyles.amount, fontSize }}>
      {formattedAmount} {currency} / {formattedEusd} EUSD
    </Text>
  );
}
