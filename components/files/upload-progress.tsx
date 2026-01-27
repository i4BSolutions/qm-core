'use client';

/**
 * Upload Progress Component
 *
 * Displays overall progress for batch file uploads.
 * Shows completion status, error count, and cancel option.
 */

import { Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadProgressProps {
  completed: number;
  total: number;
  failed: number;
  onCancel?: () => void;
}

/**
 * Upload progress indicator for batch file uploads.
 *
 * Features:
 * - Visual status indicator (loading, success, partial success)
 * - Completion count display
 * - Cancel button during upload
 * - Conditional styling based on state
 *
 * @param completed - Number of successfully uploaded files
 * @param total - Total number of files in batch
 * @param failed - Number of failed uploads
 * @param onCancel - Callback to cancel remaining uploads
 *
 * @example
 * <UploadProgress
 *   completed={3}
 *   total={5}
 *   failed={0}
 *   onCancel={() => cancelUploads()}
 * />
 */
export function UploadProgress({
  completed,
  total,
  failed,
  onCancel,
}: UploadProgressProps) {
  const isComplete = completed + failed >= total;
  const hasErrors = failed > 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border',
        isComplete &&
          !hasErrors &&
          'bg-emerald-500/10 border-emerald-500/30',
        isComplete && hasErrors && 'bg-amber-500/10 border-amber-500/30',
        !isComplete && 'bg-slate-800/50 border-slate-700'
      )}
    >
      {/* Status Icon */}
      {!isComplete ? (
        <Loader2 className="h-5 w-5 text-amber-400 animate-spin flex-shrink-0" />
      ) : hasErrors ? (
        <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
      ) : (
        <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
      )}

      {/* Progress Text */}
      <div className="flex-1">
        <p className="text-sm text-slate-200">
          {!isComplete
            ? `Uploading ${completed + 1} of ${total} files...`
            : hasErrors
              ? `${completed} uploaded, ${failed} failed`
              : `${completed} files uploaded successfully`}
        </p>
      </div>

      {/* Cancel Button */}
      {!isComplete && onCancel && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-200 h-auto p-1"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
