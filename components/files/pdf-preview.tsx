'use client';

/**
 * PDF Preview Component
 *
 * PDF viewer with page navigation and zoom controls for the file preview modal.
 * Uses react-pdf for rendering PDF documents.
 *
 * CRITICAL: This component MUST be dynamically imported with ssr: false
 * to avoid SSR crashes from PDF.js worker initialization.
 */

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Lock,
  AlertCircle,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Required CSS for text/annotation layers
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker using CDN (compatible with Next.js build)
// Using unpkg CDN with the exact version from react-pdf's pdfjs-dist dependency
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * Fixed zoom levels: 50%, 100%, 150%, 200%
 */
const ZOOM_LEVELS = [0.5, 1, 1.5, 2] as const;

interface PDFPreviewProps {
  url: string;
  onError: () => void;
  onPasswordRequired: () => void;
  onDownload?: () => void;
}

/**
 * PDF Preview Component
 *
 * Displays a PDF document with page navigation and zoom controls.
 * Features:
 * - Page navigation with Prev/Next buttons
 * - Page input field for direct navigation
 * - Fixed zoom levels: 50%, 100%, 150%, 200%
 * - Loading spinner while PDF loads
 * - Error handling for load failures
 * - Password-protected PDF detection with download fallback
 *
 * @param url - Signed URL for the PDF file
 * @param onError - Callback when PDF fails to load
 * @param onPasswordRequired - Callback when PDF is password protected
 * @param onDownload - Optional callback for download button
 *
 * @example
 * // Must use dynamic import with ssr: false
 * const PDFPreview = dynamic(() => import('./pdf-preview'), { ssr: false });
 *
 * <PDFPreview
 *   url={signedUrl}
 *   onError={() => toast({ title: 'Failed to load PDF' })}
 *   onPasswordRequired={() => toast({ title: 'PDF is password protected' })}
 * />
 */
export function PDFPreview({
  url,
  onError,
  onPasswordRequired,
  onDownload,
}: PDFPreviewProps) {
  // State
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [zoomIndex, setZoomIndex] = useState<number>(1); // Start at 100%
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<'load' | 'password' | null>(null);

  /**
   * Handle successful PDF load
   */
  const handleLoadSuccess = useCallback(
    ({ numPages: pages }: { numPages: number }) => {
      setNumPages(pages);
      setIsLoading(false);
      setError(null);
    },
    []
  );

  /**
   * Handle PDF load error
   */
  const handleLoadError = useCallback(() => {
    setError('load');
    setIsLoading(false);
    onError();
  }, [onError]);

  /**
   * Handle password-protected PDF
   */
  const handlePassword = useCallback(() => {
    setError('password');
    setIsLoading(false);
    onPasswordRequired();
  }, [onPasswordRequired]);

  /**
   * Go to specific page (validates bounds)
   */
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= numPages) {
        setPageNumber(page);
        setPageInput(String(page));
      } else {
        // Reset input to current page if invalid
        setPageInput(String(pageNumber));
      }
    },
    [numPages, pageNumber]
  );

  /**
   * Handle page input change
   */
  const handlePageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPageInput(e.target.value);
    },
    []
  );

  /**
   * Handle page input blur - validate and navigate
   */
  const handlePageInputBlur = useCallback(() => {
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed)) {
      goToPage(parsed);
    } else {
      // Reset to current page if not a number
      setPageInput(String(pageNumber));
    }
  }, [pageInput, goToPage, pageNumber]);

  /**
   * Handle page input key down - navigate on Enter
   */
  const handlePageInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handlePageInputBlur();
      }
    },
    [handlePageInputBlur]
  );

  /**
   * Handle previous page
   */
  const handlePrevPage = useCallback(() => {
    goToPage(pageNumber - 1);
  }, [goToPage, pageNumber]);

  /**
   * Handle next page
   */
  const handleNextPage = useCallback(() => {
    goToPage(pageNumber + 1);
  }, [goToPage, pageNumber]);

  /**
   * Handle zoom in
   */
  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  /**
   * Handle zoom out
   */
  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  /**
   * Handle download
   */
  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
    } else {
      window.open(url, '_blank');
    }
  }, [url, onDownload]);

  const zoomPercentage = Math.round(ZOOM_LEVELS[zoomIndex] * 100);

  // Error state: Password protected
  if (error === 'password') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8">
        <Lock className="h-16 w-16 text-amber-500 mb-4" />
        <p className="text-slate-200 font-medium mb-2">
          This PDF is password protected
        </p>
        <p className="text-sm text-slate-500 mb-4">
          Download the file to view it with a PDF reader.
        </p>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>
    );
  }

  // Error state: Load error
  if (error === 'load') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <p className="text-slate-200 font-medium mb-2">Failed to load PDF</p>
        <p className="text-sm text-slate-500 mb-4">
          The PDF could not be displayed. Try downloading it instead.
        </p>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-2 border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm">
        {/* Page Navigation (Left) */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={pageNumber <= 1 || isLoading}
            className="h-8 w-8 text-slate-300 hover:text-slate-100 disabled:opacity-50"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm text-slate-300">
            <span>Page</span>
            <Input
              type="text"
              value={pageInput}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              onKeyDown={handlePageInputKeyDown}
              disabled={isLoading}
              className="w-12 h-7 text-center text-sm bg-slate-800 border-slate-700 text-slate-200"
            />
            <span>of {numPages || '...'}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={pageNumber >= numPages || isLoading}
            className="h-8 w-8 text-slate-300 hover:text-slate-100 disabled:opacity-50"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom Controls (Right) */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoomIndex <= 0 || isLoading}
            className="h-8 w-8 text-slate-300 hover:text-slate-100 disabled:opacity-50"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[60px] text-center text-sm font-medium text-slate-200">
            {zoomPercentage}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1 || isLoading}
            className="h-8 w-8 text-slate-300 hover:text-slate-100 disabled:opacity-50"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 p-4">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-950">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500 mb-2" />
            <span className="text-sm text-slate-400">Loading PDF...</span>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          onPassword={handlePassword}
          loading={null}
          error={null}
        >
          <Page
            pageNumber={pageNumber}
            scale={ZOOM_LEVELS[zoomIndex]}
            renderTextLayer
            renderAnnotationLayer
            className="shadow-xl"
          />
        </Document>
      </div>
    </div>
  );
}
