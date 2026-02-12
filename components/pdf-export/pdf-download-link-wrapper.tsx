"use client";

// This file is client-only and can safely import @react-pdf/renderer
import { PDFDownloadLink } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import React from "react";

export function PDFDownloadLinkWrapper({
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
