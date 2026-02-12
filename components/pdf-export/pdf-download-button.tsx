"use client";

import dynamic from "next/dynamic";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// CRITICAL: The inner component that uses PDFDownloadLink
// This must be dynamically imported with ssr: false
function PDFDownloadButtonInner({
  document,
  fileName,
  label = "Download PDF",
  variant = "default",
  className,
}: {
  document: React.ReactElement;
  fileName: string;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  // Import PDFDownloadLink dynamically (only in browser)
  const PDFDownloadLink = require("@react-pdf/renderer").PDFDownloadLink;

  return (
    <PDFDownloadLink document={document} fileName={fileName}>
      {({ loading }: { loading: boolean }) =>
        loading ? (
          <Button disabled variant={variant} className={className}>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Preparing PDF...
          </Button>
        ) : (
          <Button variant={variant} className={className}>
            <Download className="h-4 w-4 mr-2" />
            {label}
          </Button>
        )
      }
    </PDFDownloadLink>
  );
}

// Dynamic wrapper for Next.js (prevents SSR issues)
const DynamicPDFButton = dynamic(() => Promise.resolve(PDFDownloadButtonInner), {
  ssr: false,
  loading: () => (
    <Button disabled>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Loading...
    </Button>
  ),
});

// Exported component
export function PDFDownloadButton(props: {
  document: React.ReactElement;
  fileName: string;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  return <DynamicPDFButton {...props} />;
}
