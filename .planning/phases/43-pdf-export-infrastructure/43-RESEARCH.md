# Phase 43: PDF Export Infrastructure - Research

**Researched:** 2026-02-12
**Domain:** PDF generation with @react-pdf/renderer in Next.js 14
**Confidence:** MEDIUM-HIGH

## Summary

Phase 43 implements professional PDF receipt generation for invoices, stock-out requests, and QMHQ money-out transactions using `@react-pdf/renderer`. The project already has `react-pdf` installed (for viewing PDFs), but needs `@react-pdf/renderer` (for generating PDFs) as a separate package.

Key insight: @react-pdf/renderer uses React components to declaratively define PDF structure with CSS-like styling, but has specific compatibility requirements with Next.js 14. Server-side rendering in Next.js App Router route handlers is problematic; the recommended approach is client-side generation with `PDFDownloadLink` or API routes using the Pages API with `renderToStream`.

The user has specified a dark tactical/military theme for PDFs (not traditional white backgrounds), dual currency display (original + EUSD), and a shared template architecture across all three document types.

**Primary recommendation:** Use client-side PDF generation with `PDFDownloadLink` component wrapped in dynamic import with `ssr: false`, triggered by a "Download PDF" button on detail pages. Generate PDFs in the browser with immediate download, using shared template components for consistent styling.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**PDF Layout & Branding:**
- Logo + company name in header (use dummy placeholder logo for now — user will provide real logo later)
- Match app theme aesthetic (dark tactical/military style — not traditional white-background invoice)
- A4 portrait paper size
- Footer: "QM System | Generated on: YYYY-MM-DD HH:MM | Page X of Y"

**Financial Display:**
- Dual display always: every amount shows original currency AND EUSD equivalent (e.g., 500,000 MMK / 250.00 EUSD)
- Exchange rate shown in header area alongside document info
- Money-Out: show original amount and EUSD amounts, no calculation breakdown

**Line Item Tables:**
- Full detail: item name, SKU, qty, unit price, line total, received qty (where applicable)
- Notes section included conditionally (only when record has notes)

**Status Display:**
- Prominent status badge/label near document number (e.g., COMPLETED, VOIDED)
- Voided documents: status badge only, no diagonal watermark
- No blocking of PDF export for voided documents

**Progress Summary:**
- Include received progress summary section on Invoice PDFs (ordered vs invoiced vs received quantities)

**Supplier/Contact Info:**
- Full supplier block on Invoice PDFs: company name, contact person, email, phone

**Shared Template Architecture:**
- All 3 PDF types share the same visual template (header, footer, styling)
- Content sections vary per document type
- No per-type accent colors — unified styling

**Invoice PDF Specifics:**
- Include full PO summary: PO number, supplier, PO total, and how much of the PO this invoice covers

**Stock-Out Receipt Specifics:**
- SOR-level summary: group by SOR number, show all line items with warehouse, quantities, approval status
- Full approval chain: who requested, who approved, approval date (audit trail)

**Money-Out Receipt Specifics:**
- Include full parent QMHQ context: request ID, line name, and the financial transaction details

**Export UX:**
- "Download PDF" button on each detail page (in actions area beside Void/Edit buttons)
- Direct download — no preview modal, immediate browser download on click
- Filename format: `Type_NUMBER_YYYY-MM-DD.pdf` (e.g., `Invoice_INV-2026-00001_2026-02-12.pdf`)
- Toast notification: "Generating PDF..." during generation, then auto-download when ready
- No signature lines on any document type

### Claude's Discretion

- Exact spacing, typography, and dark theme color values
- Table column widths and alignment
- How progress summary is visually presented (bar vs numbers vs table)
- Dummy logo design/placeholder
- Loading/error edge cases

### Deferred Ideas (OUT OF SCOPE)

- GRN (Goods Received Note) PDF — noted in v1.9 research as deferred to v2
- Admin-configurable logo upload via settings page — future enhancement
- Batch PDF export (export multiple documents at once) — not in scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | ^4.3.2 | PDF generation from React components | Industry standard for React-based PDF generation, 1.3M weekly downloads, declarative API |
| file-saver | ^2.0.5 | Client-side file download | Already installed, simple API for triggering downloads |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | ^3.6.0 | Date formatting | Already installed, use for timestamp formatting in PDF footers |
| @types/file-saver | ^2.0.7 | TypeScript types for file-saver | Already installed for type safety |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | jsPDF | jsPDF is imperative (manual positioning), less React-friendly |
| @react-pdf/renderer | Puppeteer | Puppeteer requires headless browser (heavy, slow, server-side only) |
| Client-side generation | Server-side API route | Next.js 14 App Router has issues with server-side PDF rendering; Pages API works but adds complexity |

**Installation:**
```bash
npm install @react-pdf/renderer
npm install --save-dev @types/react  # Ensure React 18 types are available
```

**Note:** The project already has `react-pdf` (for viewing PDFs). `@react-pdf/renderer` is a separate library for generating PDFs.

**React 18 Compatibility:** @react-pdf/renderer officially supports React 16-19. For React 18, add to package.json if needed:
```json
{
  "overrides": {
    "@react-pdf/renderer": {
      "react": "^18.3.1",
      "react-dom": "^18.3.1"
    }
  }
}
```

## Architecture Patterns

### Recommended Project Structure

```
lib/
├── pdf/
│   ├── components/          # Shared PDF components
│   │   ├── template.tsx     # Base template (header, footer, page layout)
│   │   ├── header.tsx       # Document header with logo & branding
│   │   ├── footer.tsx       # Page footer with timestamp & page numbers
│   │   ├── status-badge.tsx # Status badge component
│   │   └── table.tsx        # Reusable table layout
│   ├── documents/           # Document type components
│   │   ├── invoice-pdf.tsx  # Invoice document
│   │   ├── stock-out-pdf.tsx# Stock-out receipt document
│   │   └── money-out-pdf.tsx# Money-out receipt document
│   ├── styles.ts            # Shared PDF styles (dark theme)
│   └── types.ts             # PDF-specific types
components/
├── pdf-export/
│   ├── pdf-download-button.tsx  # Reusable download button wrapper
│   └── pdf-export-client.tsx    # Client component wrapper (dynamic import target)
```

### Pattern 1: Client-Side PDF Generation with Dynamic Import

**What:** Generate PDFs in the browser using `PDFDownloadLink` with dynamic import to avoid SSR issues

**When to use:** Default pattern for all three document types (recommended approach)

**Example:**
```typescript
// components/pdf-export/pdf-download-button.tsx
"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Dynamic import to avoid SSR (CRITICAL: ssr: false)
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <Button disabled><Loader2 className="animate-spin" /></Button> }
);

interface PDFDownloadButtonProps {
  document: React.ReactElement;
  fileName: string;
}

export function PDFDownloadButton({ document, fileName }: PDFDownloadButtonProps) {
  return (
    <PDFDownloadLink
      document={document}
      fileName={fileName}
    >
      {({ loading }) =>
        loading ? (
          <Button disabled>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Generating PDF...
          </Button>
        ) : (
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        )
      }
    </PDFDownloadLink>
  );
}
```

### Pattern 2: Shared Template Architecture

**What:** Base template component that all document types extend

**When to use:** All three PDFs to ensure consistent header, footer, and styling

**Example:**
```typescript
// lib/pdf/components/template.tsx
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { PDFHeader } from "./header";
import { PDFFooter } from "./footer";
import { darkThemeStyles } from "../styles";

interface PDFTemplateProps {
  title: string;
  documentNumber: string;
  status: string;
  children: React.ReactNode;
}

export function PDFTemplate({ title, documentNumber, status, children }: PDFTemplateProps) {
  return (
    <Document>
      <Page size="A4" style={darkThemeStyles.page}>
        <PDFHeader title={title} documentNumber={documentNumber} status={status} />
        <View style={darkThemeStyles.content}>
          {children}
        </View>
        <PDFFooter />
      </Page>
    </Document>
  );
}
```

### Pattern 3: Dark Theme Styling

**What:** StyleSheet with dark theme colors matching app aesthetic

**When to use:** All PDF components

**Example:**
```typescript
// lib/pdf/styles.ts
import { StyleSheet } from "@react-pdf/renderer";

export const darkThemeStyles = StyleSheet.create({
  page: {
    backgroundColor: "#0F172A", // Tailwind slate-900
    color: "#F8FAFC", // Tailwind slate-50
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: "2 solid #334155", // Tailwind slate-700
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTop: "1 solid #334155",
    fontSize: 8,
    color: "#94A3B8", // Tailwind slate-400
    flexDirection: "row",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
  },
  // Table styles
  table: {
    width: "100%",
    marginTop: 10,
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #1E293B", // Tailwind slate-800
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: "#1E293B",
    borderBottom: "2 solid #475569", // Tailwind slate-600
    fontWeight: "bold",
  },
  // Status badge
  statusBadge: {
    backgroundColor: "#1E293B",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "bold",
  },
});
```

### Pattern 4: Dynamic Page Numbers in Footer

**What:** Use render function for dynamic page numbers

**When to use:** Footer component

**Example:**
```typescript
// lib/pdf/components/footer.tsx
import { View, Text } from "@react-pdf/renderer";
import { format } from "date-fns";
import { darkThemeStyles } from "../styles";

export function PDFFooter() {
  const timestamp = format(new Date(), "yyyy-MM-dd HH:mm");

  return (
    <View style={darkThemeStyles.footer} fixed>
      <Text>QM System | Generated on: {timestamp}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
```

### Anti-Patterns to Avoid

- **Using server-side rendering:** Next.js 14 App Router has issues with @react-pdf/renderer in route handlers. Always use client-side generation or Pages API.
- **Not using dynamic import:** Importing @react-pdf/renderer components without `ssr: false` will crash during build.
- **Hand-rolling table layouts:** Use flexbox patterns consistently. Create reusable table components.
- **Hardcoding colors:** Use shared StyleSheet for consistent dark theme across all PDFs.
- **Blocking voided document export:** User explicitly wants voided documents to be exportable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Table layouts | Manual row positioning | Flexbox with reusable table components | Tables require precise alignment, column widths, borders—flex patterns handle this better |
| Page numbers | Manual calculation | `render` prop with `pageNumber`/`totalPages` | Library provides this context automatically |
| Currency formatting | Custom formatters | `formatCurrency` util (already exists) | Project already has standardized formatting |
| Date formatting | String manipulation | `date-fns` (already installed) | Handles timezones, locales correctly |
| PDF logo rendering | Base64 encoding manually | `Image` component with static import | @react-pdf/renderer handles image optimization |

**Key insight:** @react-pdf/renderer's flexbox layout system handles complex positioning automatically. Don't fight it with absolute positioning unless truly necessary (e.g., fixed footers).

## Common Pitfalls

### Pitfall 1: SSR Crashes with Next.js App Router

**What goes wrong:** Importing @react-pdf/renderer components directly causes build errors: "Module not found: Can't resolve 'canvas'"

**Why it happens:** @react-pdf/renderer relies on browser APIs and Node.js modules that don't exist during SSR

**How to avoid:**
- Always use dynamic import with `ssr: false`
- Wrap PDFDownloadLink in client components marked with `"use client"`

**Warning signs:**
- Build errors mentioning `canvas`, `fs`, or `stream`
- Errors during `next build` even if dev works

**Example fix:**
```typescript
// ❌ WRONG
import { PDFDownloadLink } from "@react-pdf/renderer";

// ✅ CORRECT
const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);
```

### Pitfall 2: Flexbox Layout Confusion

**What goes wrong:** Elements overflow, tables misalign, or content disappears

**Why it happens:** @react-pdf/renderer uses Yoga layout (React Native's flexbox), which has subtle differences from web flexbox

**How to avoid:**
- Default `flexDirection` is `column` (not `row`)
- Use explicit widths for table columns (percentages or flex values)
- Test with wrap behavior: content automatically flows to next page

**Warning signs:**
- Tables with uneven column widths
- Content cut off at page boundaries
- Unexpected vertical spacing

**Example:**
```typescript
// Table row with proper column widths
const styles = StyleSheet.create({
  tableRow: {
    flexDirection: "row", // MUST specify for horizontal layout
  },
  col1: { width: "20%" },
  col2: { width: "30%" },
  col3: { width: "25%" },
  col4: { width: "25%" },
});
```

### Pitfall 3: Large Datasets Blocking Main Thread

**What goes wrong:** Browser freezes when generating PDFs with hundreds of line items

**Why it happens:** PDF generation is CPU-intensive and runs on main thread

**How to avoid:**
- Show loading state immediately on button click
- Use toast notification: "Generating PDF..."
- For very large datasets (>100 rows), consider pagination or warning
- Consider web workers for massive documents (user discretion)

**Warning signs:**
- UI becomes unresponsive during generation
- User clicks button multiple times thinking it didn't work

**Example:**
```typescript
// Show loading immediately
const handleDownloadClick = () => {
  toast("Generating PDF...", { duration: 2000 });
  // PDFDownloadLink handles the rest
};
```

### Pitfall 4: Image/Logo Loading Issues

**What goes wrong:** PDFs generate but logo doesn't appear or causes errors

**Why it happens:** Remote images need to be loaded as base64 or use static imports

**How to avoid:**
- For dummy logo: use SVG as static import or inline SVG in `<Svg>` component
- Make logo swappable: store in separate file or use environment variable for path
- Test PDF generation with missing logo (graceful degradation)

**Warning signs:**
- PDF generates but header is blank
- Error: "Image failed to load"

**Example:**
```typescript
// Dummy logo pattern (easy to swap later)
import { Image, Svg, Path } from "@react-pdf/renderer";

// Option 1: Placeholder SVG
export function PDFLogo() {
  return (
    <Svg width="50" height="50">
      <Path d="..." fill="#F59E0B" /> {/* Brand amber */}
    </Svg>
  );
}

// Option 2: Configurable image path
const LOGO_PATH = process.env.NEXT_PUBLIC_PDF_LOGO_PATH || "/placeholder-logo.png";
```

### Pitfall 5: Font Availability

**What goes wrong:** Text appears but uses fallback fonts, loses styling

**Why it happens:** @react-pdf/renderer only includes Helvetica, Times, and Courier by default

**How to avoid:**
- Use built-in fonts for simplicity
- If custom fonts needed, register them with `Font.register()` (user discretion)
- Test bold/italic variants separately

**Warning signs:**
- Bold text appears normal weight
- Monospace numbers don't align

**Example (using built-in fonts):**
```typescript
const styles = StyleSheet.create({
  text: {
    fontFamily: "Helvetica", // Built-in
  },
  bold: {
    fontFamily: "Helvetica-Bold", // Built-in bold variant
  },
  mono: {
    fontFamily: "Courier", // Built-in monospace
  },
});
```

## Code Examples

Verified patterns from official sources:

### Basic Document Structure

```typescript
// Source: https://react-pdf.org/advanced
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0F172A",
    padding: 40,
  },
  section: {
    margin: 10,
    padding: 10,
  },
});

function MyDocument() {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text>Invoice Receipt</Text>
        </View>
      </Page>
    </Document>
  );
}
```

### Table with Flexbox Layout

```typescript
// Source: https://github.com/diegomura/react-pdf/discussions/1107
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  table: {
    width: "100%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#334155",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#1E293B",
  },
  tableColHeader: {
    width: "25%",
    backgroundColor: "#1E293B",
    padding: 5,
  },
  tableCol: {
    width: "25%",
    padding: 5,
  },
  tableCellHeader: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#F8FAFC",
  },
  tableCell: {
    fontSize: 9,
    color: "#E2E8F0",
  },
});

function InvoiceTable({ lineItems }) {
  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={[styles.tableRow, { backgroundColor: "#1E293B" }]}>
        <View style={styles.tableColHeader}>
          <Text style={styles.tableCellHeader}>Item</Text>
        </View>
        <View style={styles.tableColHeader}>
          <Text style={styles.tableCellHeader}>Qty</Text>
        </View>
        <View style={styles.tableColHeader}>
          <Text style={styles.tableCellHeader}>Unit Price</Text>
        </View>
        <View style={styles.tableColHeader}>
          <Text style={styles.tableCellHeader}>Total</Text>
        </View>
      </View>
      {/* Rows */}
      {lineItems.map((item, i) => (
        <View style={styles.tableRow} key={i}>
          <View style={styles.tableCol}>
            <Text style={styles.tableCell}>{item.name}</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableCell}>{item.quantity}</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableCell}>{formatCurrency(item.unitPrice)}</Text>
          </View>
          <View style={styles.tableCol}>
            <Text style={styles.tableCell}>{formatCurrency(item.total)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
```

### Fixed Footer with Page Numbers

```typescript
// Source: https://react-pdf.org/advanced
import { View, Text } from "@react-pdf/renderer";
import { format } from "date-fns";

function PDFFooter() {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 30,
        left: 40,
        right: 40,
        borderTop: "1 solid #334155",
        paddingTop: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        fontSize: 8,
        color: "#94A3B8",
      }}
      fixed // CRITICAL: renders on every page
    >
      <Text>QM System | Generated on: {format(new Date(), "yyyy-MM-dd HH:mm")}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}
```

### Dual Currency Display

```typescript
// Pattern for showing original currency + EUSD
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  label: {
    fontSize: 10,
    color: "#94A3B8",
  },
  amount: {
    fontSize: 10,
    color: "#F8FAFC",
    fontFamily: "Courier", // Monospace for alignment
  },
});

interface DualCurrencyDisplayProps {
  label: string;
  amount: number;
  currency: string;
  amountEusd: number;
}

function DualCurrencyDisplay({ label, amount, currency, amountEusd }: DualCurrencyDisplayProps) {
  return (
    <View style={styles.amountRow}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={styles.amount}>
        {formatCurrency(amount, currency)} / {formatCurrency(amountEusd, "EUSD")}
      </Text>
    </View>
  );
}
```

### Status Badge Component

```typescript
// Reusable status badge for PDFs
import { View, Text, StyleSheet } from "@react-pdf/renderer";

const statusColors = {
  completed: "#10B981", // Emerald
  voided: "#EF4444",    // Red
  draft: "#9CA3AF",     // Gray
  pending: "#F59E0B",   // Amber
};

interface StatusBadgeProps {
  status: string;
  label: string;
}

function PDFStatusBadge({ status, label }: StatusBadgeProps) {
  const color = statusColors[status.toLowerCase()] || "#64748B";

  return (
    <View
      style={{
        backgroundColor: "#1E293B",
        borderLeft: `3 solid ${color}`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: "bold", color }}>{label}</Text>
    </View>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side PDF with Puppeteer | Client-side with @react-pdf/renderer | 2020+ | Lighter weight, no headless browser needed, but runs in main thread |
| Absolute positioning for layout | Flexbox with Yoga layout engine | v2.0 (2019) | More responsive, easier to maintain, automatic page breaks |
| Manual page break calculation | Automatic wrap behavior | v1.0+ | Simpler code, less error-prone |
| React 16/17 only | React 18/19 support | v4.0+ (2024) | Modern React compatibility with overrides |

**Deprecated/outdated:**
- `renderToStream` in Next.js 14 App Router: Broken in route handlers, use Pages API or client-side generation
- `renderToBuffer` in server components: Crashes due to missing Node.js APIs
- Absolute positioning for tables: Use flexbox patterns instead

## Open Questions

1. **Logo placeholder design**
   - What we know: User wants dummy logo now, real logo later
   - What's unclear: SVG inline vs PNG placeholder vs text-only header
   - Recommendation: Use simple SVG shield/badge icon with "QM" text, easy to swap via single component

2. **Large document performance**
   - What we know: Invoices could have 50+ line items
   - What's unclear: At what point does generation become too slow
   - Recommendation: Implement loading state, test with 100+ items, consider pagination if >200 rows

3. **Progress summary visualization**
   - What we know: User wants ordered vs invoiced vs received quantities on Invoice PDFs
   - What's unclear: Bar chart vs table vs simple text
   - Recommendation: Simple table with percentage columns (easier to implement, prints better than bars)

4. **Error handling for failed generation**
   - What we know: Should show toast notifications
   - What's unclear: What happens if PDF generation crashes
   - Recommendation: Wrap in try-catch, show error toast, fallback to "Contact support" message

## Sources

### Primary (HIGH confidence)

- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) - Version 4.3.2, compatibility, installation
- [React-pdf official docs](https://react-pdf.org/styling) - Styling, layout, flexbox patterns
- [React-pdf advanced features](https://react-pdf.org/advanced) - Page numbers, fixed elements, render functions
- [Next.js 14 integration (Medium)](https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515) - SSR issues, dynamic import patterns
- [PDF generation with Next.js server-side (Medium)](https://medium.com/@stanleyfok/pdf-generation-with-react-componenets-using-next-js-at-server-side-ee9c2dea06a7) - Pages API approach

### Secondary (MEDIUM confidence)

- [GitHub Discussion #2402](https://github.com/diegomura/react-pdf/discussions/2402) - Server-side rendering challenges with Next.js 13+
- [GitHub Issue #2460](https://github.com/diegomura/react-pdf/issues/2460) - renderToBuffer/renderToStream issues in App Router
- [npm-compare: @react-pdf/renderer vs react-pdf](https://npm-compare.com/@react-pdf/renderer,react-pdf) - Library differences, use cases
- [React PDF table discussion](https://github.com/diegomura/react-pdf/discussions/1107) - Table layout patterns
- [LogRocket: Generating PDFs in React](https://blog.logrocket.com/generating-pdfs-react/) - Best practices, pitfalls

### Tertiary (LOW confidence)

- [Web workers for performance](https://react-pdf.org/advanced) - Mentioned but not detailed
- [Custom fonts registration](https://react-pdf.org/fonts) - Not verified for dark theme compatibility

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @react-pdf/renderer is well-documented, version confirmed, React 18 compatibility verified
- Architecture: MEDIUM-HIGH - Client-side pattern verified, server-side issues confirmed, but edge cases not exhaustively tested
- Pitfalls: HIGH - SSR issues, flexbox confusion, and performance concerns verified from multiple sources
- Dark theme implementation: MEDIUM - No official dark theme examples found, but styling API is well-documented

**Research date:** 2026-02-12
**Valid until:** ~60 days (stable library, mature ecosystem)

**Key gaps:**
- No official dark theme examples for @react-pdf/renderer (will need custom StyleSheet)
- Limited real-world Next.js 14 App Router integration examples (most tutorials use Pages API)
- No benchmarks for PDF generation speed with large datasets

**Mitigation:**
- Use Tailwind theme colors as reference for dark theme
- Stick to client-side generation to avoid App Router issues
- Implement loading states and test with realistic data volumes
