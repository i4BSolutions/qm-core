"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dynamically import the wrapper that uses @react-pdf/renderer
// This prevents SSR issues and ESM import errors
const PDFDownloadLinkWrapper = dynamic(
  () =>
    import("./pdf-download-link-wrapper").then(
      (mod) => mod.PDFDownloadLinkWrapper
    ),
  {
    ssr: false,
    loading: () => (
      <Button disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    ),
  }
);

// Exported component
export function PDFDownloadButton(props: {
  document: React.ReactElement;
  fileName: string;
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  return <PDFDownloadLinkWrapper {...props} />;
}
