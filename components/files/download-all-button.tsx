'use client';

/**
 * Download All Button Component
 *
 * Downloads all attached files as a single ZIP archive.
 * Uses JSZip for archive generation and file-saver for downloading.
 * Shows progress indicator during download process.
 */

import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFileUrl, type FileAttachmentWithUploader } from '@/lib/actions/files';
import { toast } from '@/components/ui/use-toast';

interface DownloadAllButtonProps {
  files: FileAttachmentWithUploader[];
  entityId: string; // Display ID like "QMRL-2025-00001"
}

/**
 * Button component for downloading all files as a ZIP archive.
 *
 * Features:
 * - Sequential file fetching to avoid server overload
 * - Progress percentage display during download
 * - Partial failure handling with appropriate toast messages
 * - Disabled state when no files or download in progress
 *
 * @param files - Array of file attachments to download
 * @param entityId - Display ID for ZIP naming (e.g., QMRL-2025-00001)
 *
 * @example
 * <DownloadAllButton
 *   files={attachments}
 *   entityId="QMRL-2025-00001"
 * />
 */
export function DownloadAllButton({
  files,
  entityId,
}: DownloadAllButtonProps) {
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

      // Process files sequentially to avoid overwhelming server
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

          // Add to ZIP
          const blob = await response.blob();
          zip.file(file.filename, blob);
          successCount++;
        } catch {
          failCount++;
        }

        // Update progress
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // Handle results
      if (successCount === 0) {
        toast({
          variant: 'destructive',
          title: 'Download failed',
          description:
            'Could not download any files. Try downloading them individually.',
        });
      } else {
        // Generate and download ZIP
        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, `${entityId}-attachments.zip`);

        // Show appropriate toast based on results
        if (failCount > 0) {
          toast({
            title: 'Partial download',
            description: `Downloaded ${successCount} file${successCount !== 1 ? 's' : ''}, ${failCount} failed.`,
          });
        }
        // Success with all files - no toast needed, file download is feedback
      }
    } catch (error) {
      console.error('Download all failed:', error);
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsDownloading(false);
      setProgress(0);
    }
  }, [files, entityId]);

  return (
    <Button
      variant="outline"
      onClick={handleDownloadAll}
      disabled={isDownloading || files.length === 0}
      className="gap-2"
    >
      {isDownloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Downloading... {progress}%
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download All
        </>
      )}
    </Button>
  );
}
