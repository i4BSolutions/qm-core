import { View, Text } from "@react-pdf/renderer";
import { format } from "date-fns";
import { darkThemeStyles } from "../styles";

export function PDFFooter() {
  const timestamp = format(new Date(), "yyyy-MM-dd HH:mm");

  return (
    <View style={darkThemeStyles.footer} fixed>
      <Text>QM System | Generated on: {timestamp}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
