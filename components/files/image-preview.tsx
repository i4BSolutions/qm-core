'use client';

/**
 * Image Preview Component
 *
 * Image viewer with fixed zoom levels for the file preview modal.
 * Uses react-zoom-pan-pinch for zoom and pan functionality.
 */

import { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent, useControls } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Fixed zoom levels: 50%, 100%, 150%, 200%
 */
const ZOOM_LEVELS = [0.5, 1, 1.5, 2] as const;

interface ImagePreviewProps {
  url: string;
  filename: string;
  onError: () => void;
}

/**
 * Zoom Controls Component
 *
 * Toolbar with zoom in/out buttons and current zoom level display.
 * Uses TransformWrapper context to control zoom.
 */
function ZoomControls({
  zoomIndex,
  onZoomIn,
  onZoomOut,
}: {
  zoomIndex: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const { setTransform } = useControls();

  const handleZoomOut = () => {
    if (zoomIndex > 0) {
      const newScale = ZOOM_LEVELS[zoomIndex - 1];
      setTransform(0, 0, newScale, 200, 'easeOut');
      onZoomOut();
    }
  };

  const handleZoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      const newScale = ZOOM_LEVELS[zoomIndex + 1];
      setTransform(0, 0, newScale, 200, 'easeOut');
      onZoomIn();
    }
  };

  const zoomPercentage = Math.round(ZOOM_LEVELS[zoomIndex] * 100);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-lg bg-slate-800/90 border border-slate-700 p-1 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomOut}
        disabled={zoomIndex <= 0}
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
        disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
        className="h-8 w-8 text-slate-300 hover:text-slate-100 disabled:opacity-50"
        title="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Image Preview Component
 *
 * Displays an image with zoom controls and pan functionality.
 * Features:
 * - Fixed zoom levels: 50%, 100%, 150%, 200%
 * - Initial zoom at 100%
 * - Panning only when zoomed in (scale > 1)
 * - No scroll wheel zoom (per context requirements)
 * - Checkerboard background for transparent PNGs
 * - Loading spinner while image loads
 *
 * @param url - Signed URL for the image
 * @param filename - Original filename (used to detect PNG for transparency)
 * @param onError - Callback when image fails to load
 *
 * @example
 * <ImagePreview
 *   url={signedUrl}
 *   filename="screenshot.png"
 *   onError={() => {
 *     closeModal();
 *     toast({ title: 'Failed to load image' });
 *   }}
 * />
 */
export function ImagePreview({ url, filename, onError }: ImagePreviewProps) {
  const [zoomIndex, setZoomIndex] = useState(1); // Start at 100%
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Detect PNG for checkerboard background
  const isPng = filename.toLowerCase().endsWith('.png');

  // Reset state when URL changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setZoomIndex(1);
  }, [url]);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
    onError();
  };

  const handleZoomIn = () => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  };

  const handleZoomOut = () => {
    setZoomIndex((prev) => Math.max(prev - 1, 0));
  };

  if (hasError) {
    return null;
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      )}

      <TransformWrapper
        initialScale={ZOOM_LEVELS[zoomIndex]}
        minScale={0.5}
        maxScale={2}
        wheel={{ disabled: true }}
        panning={{ disabled: ZOOM_LEVELS[zoomIndex] <= 1 }}
        centerOnInit
        limitToBounds
      >
        <ZoomControls
          zoomIndex={zoomIndex}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
        />
        <TransformComponent
          wrapperClass="w-full h-full"
          contentClass={cn(
            'w-full h-full flex items-center justify-center',
            isPng && 'bg-checkerboard rounded-lg'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={url}
            alt={filename}
            className={cn(
              'max-w-none object-contain transition-opacity duration-200',
              isLoading ? 'opacity-0' : 'opacity-100'
            )}
            style={{
              maxHeight: 'calc(90vh - 120px)',
              maxWidth: 'calc(90vw - 400px)',
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
