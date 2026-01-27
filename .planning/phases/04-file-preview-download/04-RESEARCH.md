# Phase 4: File Preview & Download - Research

**Researched:** 2026-01-28
**Domain:** File preview (images, PDFs) and bulk ZIP download in React/Next.js
**Confidence:** HIGH

## Summary

This phase implements file preview and bulk download functionality for the attachments system built in Phase 3. Users click file cards to open a modal with image/PDF preview or download fallback for other file types. A "Download All" button generates a ZIP archive containing all attached files.

The research evaluated PDF viewing libraries (react-pdf is the clear choice for MIT-licensed viewer), image zoom libraries (react-zoom-pan-pinch for controlled zoom), and ZIP generation approaches (client-side with JSZip for simplicity, though server-side with Edge Functions is an option for very large files). The existing codebase already has Radix Dialog for modals and signed URL generation for file access.

**Primary recommendation:** Use react-pdf with dynamic import (ssr: false) for PDF viewing, react-zoom-pan-pinch for image zoom with fixed scale levels, JSZip + file-saver for client-side ZIP generation, and extend the existing Radix Dialog component for the preview modal.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-pdf | ^10.x | PDF viewing and rendering | MIT-licensed, uses pdf.js, simple Document/Page API, 1000+ npm dependents |
| react-zoom-pan-pinch | ^3.7.x | Image zoom/pan controls | useControls hook for programmatic zoom, CSS transforms, mobile gesture support |
| jszip | ^3.10.x | ZIP file generation | De facto standard, MIT/GPL dual license, works in browser |
| file-saver | ^2.0.x | Trigger file downloads | Simple saveAs API, handles browser quirks |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dialog | ^1.1.15 | Preview modal | Extend existing Dialog for preview overlay |
| lucide-react | ^0.447.0 | Icons | Zoom +/-, download, close, page navigation |
| @/components/ui/skeleton | Existing | Loading states | While PDF/image loads |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-pdf | @react-pdf-viewer/core | Commercial license, more features but overkill |
| react-pdf | pdf.js directly | More control but more boilerplate |
| react-zoom-pan-pinch | Custom CSS transforms | More work, need to handle gestures manually |
| JSZip (client) | Edge Function (server) | Server-side handles large files better but adds complexity |

**Installation:**
```bash
npm install react-pdf react-zoom-pan-pinch jszip file-saver
npm install -D @types/file-saver
```

Note: react-pdf types are bundled; no @types/react-pdf needed.

## Architecture Patterns

### Recommended Project Structure
```
components/
  files/
    file-card.tsx            # Existing - make clickable
    file-preview-modal.tsx   # NEW - preview container with metadata sidebar
    image-preview.tsx        # NEW - image with zoom controls
    pdf-preview.tsx          # NEW - PDF viewer with page navigation
    download-all-button.tsx  # NEW - ZIP generation + download
    attachments-tab.tsx      # Existing - add preview modal + download button
lib/
  utils/
    file-validation.ts       # Existing - use for file type detection
```

### Pattern 1: Dynamic Import for react-pdf (SSR Avoidance)
**What:** react-pdf uses browser APIs (canvas) that break SSR
**When to use:** Any component using Document/Page from react-pdf
**Example:**
```typescript
// Source: https://github.com/wojtekmaj/react-pdf + Next.js docs
"use client";

import dynamic from "next/dynamic";

// Dynamic import with SSR disabled
const PDFViewer = dynamic(() => import("./pdf-preview"), {
  ssr: false,
  loading: () => <PDFViewerSkeleton />,
});
```

### Pattern 2: PDF.js Worker Configuration
**What:** Configure web worker for PDF parsing performance
**When to use:** In the file that imports react-pdf components
**Example:**
```typescript
// Source: react-pdf documentation
import { pdfjs } from 'react-pdf';

// Set up worker (do this once, in the component file)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
```

### Pattern 3: Controlled Zoom with Fixed Levels
**What:** Use TransformWrapper with controlled scale instead of free zoom
**When to use:** Image and PDF preview per CONTEXT.md (50%, 100%, 150%, 200%)
**Example:**
```typescript
// Source: react-zoom-pan-pinch docs + CONTEXT.md decisions
import { TransformWrapper, TransformComponent, useControls } from "react-zoom-pan-pinch";

const ZOOM_LEVELS = [0.5, 1, 1.5, 2]; // 50%, 100%, 150%, 200%

function ZoomableImage({ src }: { src: string }) {
  const [zoomIndex, setZoomIndex] = useState(1); // Start at 100%

  const handleZoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomIndex(zoomIndex + 1);
    }
  };

  const handleZoomOut = () => {
    if (zoomIndex > 0) {
      setZoomIndex(zoomIndex - 1);
    }
  };

  return (
    <TransformWrapper
      initialScale={ZOOM_LEVELS[zoomIndex]}
      minScale={0.5}
      maxScale={2}
      disabled // Disable free zoom, use buttons only
    >
      {({ setTransform }) => (
        <>
          <ZoomControls
            level={ZOOM_LEVELS[zoomIndex]}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
          <TransformComponent>
            <img src={src} alt="Preview" />
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );
}
```

### Pattern 4: Client-Side ZIP Generation
**What:** Fetch files, add to JSZip, download as blob
**When to use:** "Download All" functionality
**Example:**
```typescript
// Source: JSZip docs + file-saver docs
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

async function downloadAllAsZip(
  files: FileAttachment[],
  entityId: string,
  onProgress: (percent: number) => void
) {
  const zip = new JSZip();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const signedUrl = await getFileUrl(file.storage_path);
    if (!signedUrl.success) continue;

    // Fetch file content
    const response = await fetch(signedUrl.data);
    const blob = await response.blob();

    // Add to ZIP with original filename
    zip.file(file.filename, blob);

    // Report progress
    onProgress(Math.round(((i + 1) / files.length) * 100));
  }

  // Generate and download
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${entityId}-attachments.zip`);
}
```

### Pattern 5: Large Modal with Metadata Sidebar
**What:** Override default Dialog size for full preview experience
**When to use:** File preview modal
**Example:**
```typescript
// Source: Existing Dialog component + CONTEXT.md decisions
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full p-0 overflow-hidden">
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center bg-slate-950 overflow-auto">
        {isImage && <ImagePreview src={url} />}
        {isPdf && <PDFPreview src={url} />}
        {!isPreviewable && <NonPreviewablePlaceholder file={file} />}
      </div>

      {/* Collapsible metadata sidebar */}
      {sidebarVisible && (
        <div className="w-80 border-l border-slate-700 bg-slate-900 p-4">
          <FileMetadata file={file} />
          <DownloadButton url={url} filename={file.filename} />
        </div>
      )}
    </div>
  </DialogContent>
</Dialog>
```

### Anti-Patterns to Avoid
- **Importing react-pdf without dynamic import:** Will crash Next.js SSR with "DOMMatrix is not defined"
- **Not setting PDF.js worker:** Defaults to inline worker which is slower
- **Free-form zoom without limits:** CONTEXT.md specifies fixed levels (50%, 100%, 150%, 200%)
- **Downloading all files before showing progress:** Fetch sequentially with progress updates
- **Opening multiple preview modals:** One file at a time per CONTEXT.md

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF rendering | Canvas-based PDF parser | react-pdf (pdf.js) | PDF is complex; font subsetting, encryption, forms |
| Image zoom/pan | Custom transform math | react-zoom-pan-pinch | Touch gestures, bounds checking, momentum |
| ZIP creation | Manual file concatenation | JSZip | ZIP format has compression, CRC, headers |
| File download trigger | window.location.href | file-saver saveAs | Handles blob URLs, browser quirks, filenames |
| Checkerboard pattern | CSS grid of squares | CSS background-image | Simple repeating pattern with CSS |

**Key insight:** PDF parsing alone is thousands of lines of code handling fonts, encryption, forms, and rendering. react-pdf wraps Mozilla's pdf.js which is battle-tested.

## Common Pitfalls

### Pitfall 1: react-pdf SSR Crash
**What goes wrong:** "DOMMatrix is not defined" or "Cannot read properties of undefined (reading 'createObjectURL')"
**Why it happens:** react-pdf uses canvas and browser APIs not available during SSR
**How to avoid:** Always use `dynamic(() => import(...), { ssr: false })` for react-pdf components
**Warning signs:** Error appears during `next build` or when refreshing page

### Pitfall 2: PDF Worker Not Loading
**What goes wrong:** PDFs don't render, or render very slowly
**Why it happens:** Worker source not configured correctly
**How to avoid:** Set `pdfjs.GlobalWorkerOptions.workerSrc` in the same file as PDF components
**Warning signs:** Console warnings about worker, slow PDF rendering

### Pitfall 3: Memory Leaks from Blob URLs
**What goes wrong:** Browser memory grows when viewing many files
**Why it happens:** Signed URLs from Supabase are external; but if creating local blob URLs for preview, need cleanup
**How to avoid:** For react-pdf, pass URL directly; it handles cleanup. For images, use signed URLs directly
**Warning signs:** Browser tab memory increasing over time

### Pitfall 4: ZIP Download Hangs on Large Files
**What goes wrong:** UI freezes or browser shows unresponsive warning
**Why it happens:** Fetching many large files blocks main thread
**How to avoid:** Fetch files sequentially (not parallel) with progress indicator
**Warning signs:** No progress feedback during ZIP generation

### Pitfall 5: Password-Protected PDF Infinite Loop
**What goes wrong:** Password prompt keeps appearing after cancel
**Why it happens:** Known issue in react-pdf's onPassword handling
**How to avoid:** Handle onPassword callback with explicit error state, show download fallback
**Warning signs:** Password modal reopens immediately after dismissal

### Pitfall 6: CORS Errors Fetching Files for ZIP
**What goes wrong:** Cannot fetch files to add to ZIP
**Why it happens:** Signed URLs may have CORS restrictions
**How to avoid:** Use server action to fetch files, or ensure Supabase Storage CORS allows frontend origin
**Warning signs:** Network errors in console during ZIP generation

## Code Examples

Verified patterns from official sources and project patterns:

### PDF Preview Component
```typescript
// Source: react-pdf docs + CONTEXT.md decisions
"use client";

import { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const ZOOM_LEVELS = [0.5, 1, 1.5, 2]; // 50%, 100%, 150%, 200%

interface PDFPreviewProps {
  url: string;
  onError: () => void;
  onPasswordRequired: () => void;
}

export function PDFPreview({ url, onError, onPasswordRequired }: PDFPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(1); // Start at 100%
  const [isLoading, setIsLoading] = useState(true);
  const [pageInput, setPageInput] = useState('1');

  const scale = ZOOM_LEVELS[zoomIndex];

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF load error:', error);
    onError();
  }

  function onPassword(callback: (password: string) => void, reason: number) {
    // reason: 1 = need password, 2 = wrong password
    onPasswordRequired();
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= numPages) {
      setPageNumber(page);
      setPageInput(page.toString());
    }
  }

  function handlePageInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPageInput(e.target.value);
  }

  function handlePageInputBlur() {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page)) {
      goToPage(page);
    } else {
      setPageInput(pageNumber.toString());
    }
  }

  function handlePageInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800">
        {/* Page Navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(pageNumber - 1)}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm text-slate-300">
            <span>Page</span>
            <Input
              value={pageInput}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              onKeyDown={handlePageInputKeyDown}
              className="w-12 h-7 text-center p-1"
            />
            <span>of {numPages}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => goToPage(pageNumber + 1)}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoomIndex(Math.max(0, zoomIndex - 1))}
            disabled={zoomIndex <= 0}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-300 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setZoomIndex(Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1))}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 p-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading PDF...</span>
          </div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          onPassword={onPassword}
          loading={null}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}
```

### Image Preview with Zoom Controls
```typescript
// Source: react-zoom-pan-pinch docs + CONTEXT.md decisions
"use client";

import { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ZOOM_LEVELS = [0.5, 1, 1.5, 2]; // 50%, 100%, 150%, 200%

interface ImagePreviewProps {
  url: string;
  alt: string;
  isTransparent?: boolean; // Show checkerboard for PNG with alpha
}

export function ImagePreview({ url, alt, isTransparent }: ImagePreviewProps) {
  const [zoomIndex, setZoomIndex] = useState(1); // Start at 100%
  const [isLoading, setIsLoading] = useState(true);

  const scale = ZOOM_LEVELS[zoomIndex];

  const handleZoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomIndex(zoomIndex + 1);
    }
  };

  const handleZoomOut = () => {
    if (zoomIndex > 0) {
      setZoomIndex(zoomIndex - 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-center px-4 py-2 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoomIndex <= 0}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-300 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image Content */}
      <div
        className={`flex-1 overflow-auto flex items-center justify-center ${
          isTransparent ? 'bg-checkerboard' : 'bg-slate-950'
        }`}
      >
        {isLoading && (
          <div className="absolute flex items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading image...</span>
          </div>
        )}
        <TransformWrapper
          initialScale={scale}
          minScale={0.5}
          maxScale={2}
          panning={{ disabled: scale <= 1 }}
          wheel={{ disabled: true }} // No scroll wheel zoom per CONTEXT.md
        >
          {({ setTransform }) => {
            // Update transform when zoom level changes
            setTransform(0, 0, scale, 0);
            return (
              <TransformComponent>
                <img
                  src={url}
                  alt={alt}
                  onLoad={() => setIsLoading(false)}
                  className="max-w-none"
                  style={{ display: isLoading ? 'none' : 'block' }}
                />
              </TransformComponent>
            );
          }}
        </TransformWrapper>
      </div>
    </div>
  );
}
```

### Download All as ZIP
```typescript
// Source: JSZip docs + file-saver docs + CONTEXT.md decisions
"use client";

import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFileUrl, type FileAttachmentWithUploader } from '@/lib/actions/files';
import { toast } from '@/components/ui/use-toast';

interface DownloadAllButtonProps {
  files: FileAttachmentWithUploader[];
  entityId: string; // e.g., "QMRL-2025-00001"
}

export function DownloadAllButton({ files, entityId }: DownloadAllButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDownloadAll = useCallback(async () => {
    if (files.length === 0) return;

    setIsDownloading(true);
    setProgress(0);

    try {
      const zip = new JSZip();
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        try {
          // Get signed URL
          const urlResult = await getFileUrl(file.storage_path);
          if (!urlResult.success) {
            failCount++;
            continue;
          }

          // Fetch file content
          const response = await fetch(urlResult.data);
          if (!response.ok) {
            failCount++;
            continue;
          }

          const blob = await response.blob();

          // Add to ZIP with original filename
          zip.file(file.filename, blob);
          successCount++;
        } catch {
          failCount++;
        }

        // Update progress
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      if (successCount === 0) {
        toast({
          variant: 'destructive',
          title: 'Download failed',
          description: 'Could not download any files. Try downloading them individually.',
        });
        return;
      }

      // Generate ZIP
      const content = await zip.generateAsync({ type: 'blob' });

      // Download with entity-based name
      const zipName = `${entityId}-attachments.zip`;
      saveAs(content, zipName);

      // Show result
      if (failCount > 0) {
        toast({
          title: 'Partial download',
          description: `Downloaded ${successCount} files. ${failCount} failed.`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'An error occurred. Try downloading files individually.',
      });
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  }, [files, entityId]);

  return (
    <Button
      onClick={handleDownloadAll}
      disabled={isDownloading || files.length === 0}
      className="gap-2"
    >
      {isDownloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Downloading... {progress}%</span>
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          <span>Download All</span>
        </>
      )}
    </Button>
  );
}
```

### Checkerboard CSS for Transparent Images
```css
/* Source: Standard CSS pattern for transparency indication */
.bg-checkerboard {
  background-color: #1e293b; /* slate-800 */
  background-image:
    linear-gradient(45deg, #334155 25%, transparent 25%),
    linear-gradient(-45deg, #334155 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #334155 75%),
    linear-gradient(-45deg, transparent 75%, #334155 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pdf.js with manual React bindings | react-pdf v10 with hooks | 2024 | Simpler API, better TypeScript |
| Custom zoom with CSS transforms | react-zoom-pan-pinch v3 | 2023 | Built-in gesture support, controlled zoom |
| Server-side ZIP generation | Client-side with JSZip | Ongoing | Simpler architecture, no server load |
| Download via window.location | file-saver saveAs | Long established | Handles blob URLs, better UX |

**Deprecated/outdated:**
- react-pdf render props pattern: Use useCallback hooks instead
- @types/react-pdf: Types now bundled with react-pdf
- pdf.js worker from CDN: Use import.meta.url for proper bundling

## Open Questions

Things that couldn't be fully resolved:

1. **Very Large Files (>100MB each)**
   - What we know: Client-side ZIP can handle reasonable file sizes
   - What's unclear: At what point should we switch to server-side?
   - Recommendation: Start with client-side; add server-side Edge Function if users report issues with large file sets

2. **react-pdf Password Prompt Bug**
   - What we know: Known issue where password prompt reappears after cancel
   - What's unclear: If this is fixed in v10
   - Recommendation: Handle with explicit error state and download fallback, don't rely on native prompt

3. **CORS for ZIP Fetch**
   - What we know: Signed URLs from Supabase should work
   - What's unclear: May need explicit CORS configuration
   - Recommendation: Test early; if issues, create server action to proxy file fetches

## Sources

### Primary (HIGH confidence)
- [react-pdf GitHub](https://github.com/wojtekmaj/react-pdf) - Installation, worker setup, Next.js compatibility
- [react-zoom-pan-pinch GitHub](https://github.com/BetterTyped/react-zoom-pan-pinch) - useControls API, TransformWrapper props
- [JSZip Examples](https://stuk.github.io/jszip/documentation/examples.html) - ZIP generation, file addition
- [FileSaver.js GitHub](https://github.com/eligrey/FileSaver.js) - saveAs usage, browser support
- Existing codebase: Dialog component, file actions, file-validation utilities

### Secondary (MEDIUM confidence)
- [NextJS 14 and react-pdf integration](https://benhur-martins.medium.com/nextjs-14-and-react-pdf-integration-ccd38b1fd515) - Dynamic import pattern
- [Supabase Edge Functions ephemeral storage](https://supabase.com/docs/guides/functions/ephemeral-storage) - Server-side ZIP option
- WebSearch results for PDF password handling in react-pdf

### Tertiary (LOW confidence)
- WebSearch results for "react image zoom 2025" - general ecosystem overview

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - well-documented libraries with clear APIs
- Architecture: HIGH - patterns derived from official docs and existing codebase
- Pitfalls: HIGH - well-documented issues with react-pdf SSR and password handling
- Code examples: HIGH - verified against official documentation

**Research date:** 2026-01-28
**Valid until:** 60 days (libraries are stable; patterns are established)
