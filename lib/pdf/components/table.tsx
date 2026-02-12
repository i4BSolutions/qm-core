import { View, Text } from "@react-pdf/renderer";
import { darkThemeStyles } from "../styles";
import type { PDFTableColumn } from "../types";

interface PDFTableProps {
  columns: PDFTableColumn[];
  data: Record<string, any>[];
  showRowIndex?: boolean;
}

export function PDFTable({ columns, data, showRowIndex = false }: PDFTableProps) {
  return (
    <View style={darkThemeStyles.table}>
      {/* Header Row */}
      <View style={[darkThemeStyles.tableRow, darkThemeStyles.tableHeader]}>
        {showRowIndex && (
          <View style={{ width: "5%" }}>
            <Text style={darkThemeStyles.tableCellHeader}>#</Text>
          </View>
        )}
        {columns.map((col, i) => (
          <View key={i} style={{ width: col.width }}>
            <Text
              style={{
                ...darkThemeStyles.tableCellHeader,
                textAlign: col.align || "left",
              }}
            >
              {col.header}
            </Text>
          </View>
        ))}
      </View>

      {/* Data Rows */}
      {data.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={[
            darkThemeStyles.tableRow,
            // Alternating row background
            ...(rowIndex % 2 === 1 ? [{ backgroundColor: "rgba(30, 41, 59, 0.3)" }] : []),
          ]}
        >
          {showRowIndex && (
            <View style={{ width: "5%" }}>
              <Text style={darkThemeStyles.tableCell}>{rowIndex + 1}</Text>
            </View>
          )}
          {columns.map((col, colIndex) => (
            <View key={colIndex} style={{ width: col.width }}>
              <Text
                style={{
                  ...darkThemeStyles.tableCell,
                  textAlign: col.align || "left",
                }}
              >
                {row[col.key] ?? "-"}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
