import { Font, StyleSheet } from "@react-pdf/renderer";

// Register Pyidaungsu font for Myanmar script support (U+1000-U+109F)
// Pyidaungsu is the official Myanmar Unicode font from Myanmar Computer Federation (MCF).
// Served from /public/fonts/ as a local asset — more reliable than Google Fonts CDN URLs.
// Font files: public/fonts/Pyidaungsu-Regular.ttf and public/fonts/Pyidaungsu-Bold.ttf
// Myanmar shaping requires fontkit patch (patches/fontkit+2.0.4.patch) which maps
// mym2/mymr script tags to UniversalShaper, enabling GSUB features (abvs, blwf, blws, etc).
Font.register({
  family: "Pyidaungsu",
  fonts: [
    {
      src: "/fonts/Pyidaungsu-Regular.ttf",
      fontWeight: "normal",
      fontStyle: "normal",
    },
    {
      src: "/fonts/Pyidaungsu-Bold.ttf",
      fontWeight: "bold",
      fontStyle: "normal",
    },
  ],
});

// Dark theme colors matching app aesthetic
export const darkThemeStyles = StyleSheet.create({
  // Page layout
  page: {
    backgroundColor: "#0F172A", // slate-900
    color: "#F8FAFC", // slate-50
    padding: 40,
    fontSize: 10,
    fontFamily: "Pyidaungsu",
  },

  // Header
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: "2 solid #334155", // slate-700
  },

  // Footer (fixed on every page)
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTop: "1 solid #334155", // slate-700
    fontSize: 8,
    color: "#94A3B8", // slate-400
    flexDirection: "row",
    justifyContent: "space-between",
  },

  // Content area (flex to avoid footer overlap)
  content: {
    flex: 1,
    marginBottom: 50, // Space for fixed footer
  },

  // Section
  section: {
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#F59E0B", // amber-500 accent
    marginBottom: 8,
    borderBottom: "1 solid #1E293B", // slate-800
    paddingBottom: 4,
  },

  // Table
  table: {
    width: "100%",
    marginTop: 10,
    marginBottom: 10,
  },

  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #1E293B", // slate-800
    paddingVertical: 6,
  },

  tableHeader: {
    backgroundColor: "#1E293B", // slate-800
    borderBottom: "2 solid #475569", // slate-600
    fontWeight: "bold",
    paddingVertical: 8,
  },

  tableCell: {
    fontSize: 9,
    color: "#E2E8F0", // slate-200
    paddingHorizontal: 4,
  },

  tableCellHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#F8FAFC", // slate-50
    paddingHorizontal: 4,
  },

  // Status badge
  statusBadge: {
    backgroundColor: "#1E293B", // slate-800
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "bold",
    alignSelf: "flex-start",
  },

  // Amount display
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },

  label: {
    fontSize: 10,
    color: "#94A3B8", // slate-400 muted text
  },

  amount: {
    fontSize: 10,
    color: "#F8FAFC", // slate-50
    fontFamily: "Courier", // Monospace for alignment (numbers only, safe with Courier)
  },
});
