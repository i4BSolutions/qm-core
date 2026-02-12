import { View, Text } from "@react-pdf/renderer";

// Status color mapping
const statusColorMap: Record<string, string> = {
  completed: "#10B981", // emerald-500
  voided: "#EF4444", // red-500
  draft: "#9CA3AF", // gray-400
  pending: "#F59E0B", // amber-500
  approved: "#10B981", // emerald-500
  rejected: "#EF4444", // red-500
  cancelled: "#9CA3AF", // gray-400
  closed: "#64748B", // slate-500
  executed: "#10B981", // emerald-500
  partially_approved: "#3B82F6", // blue-500
};

interface PDFStatusBadgeProps {
  status: string;
  label: string;
  color?: string;
}

export function PDFStatusBadge({ status, label, color }: PDFStatusBadgeProps) {
  const badgeColor =
    color || statusColorMap[status.toLowerCase()] || "#94A3B8"; // slate-400 default

  return (
    <View
      style={{
        backgroundColor: "#1E293B", // slate-800
        borderLeft: `3 solid ${badgeColor}`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontWeight: "bold",
          color: badgeColor,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
