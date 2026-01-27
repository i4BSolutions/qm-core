'use client';

/**
 * Delete File Dialog Component
 *
 * Confirmation dialog for file deletion with loading state.
 * Prevents accidental file deletion by requiring user confirmation.
 */

import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

/**
 * Delete confirmation dialog for file attachments.
 *
 * Features:
 * - Clear confirmation message with filename
 * - Loading state during deletion
 * - Cancel and confirm actions
 * - Destructive styling for delete button
 *
 * @param open - Whether the dialog is open
 * @param onOpenChange - Callback when dialog open state changes
 * @param filename - Name of the file to delete
 * @param onConfirm - Callback when delete is confirmed
 * @param isDeleting - Whether deletion is in progress
 *
 * @example
 * <DeleteFileDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   filename="document.pdf"
 *   onConfirm={handleDelete}
 *   isDeleting={isDeleting}
 * />
 */
export function DeleteFileDialog({
  open,
  onOpenChange,
  filename,
  onConfirm,
  isDeleting = false,
}: DeleteFileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete file</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{filename}&rdquo;? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-500 text-white"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
