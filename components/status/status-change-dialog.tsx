"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";
import type { StatusConfig } from "@/types/database";

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: StatusConfig;
  newStatus: StatusConfig;
  entityType: "qmrl" | "qmhq";
  entityId: string;
  onConfirm: (note: string) => Promise<void>;
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  currentStatus,
  newStatus,
  entityType,
  entityId,
  onConfirm,
}: StatusChangeDialogProps) {
  const [note, setNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm(note);
      // Reset note after successful confirmation
      setNote("");
    } catch (error) {
      // Error handling is done in parent component
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Status</DialogTitle>
          <DialogDescription>
            Are you sure you want to change the status of this {entityType.toUpperCase()}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status preview */}
          <div className="flex items-center justify-center gap-3">
            <Badge
              variant="outline"
              className="font-mono uppercase tracking-wider"
              style={{
                borderColor: currentStatus.color || undefined,
                color: currentStatus.color || undefined,
                backgroundColor: `${currentStatus.color}15` || "transparent",
              }}
            >
              {currentStatus.name}
            </Badge>
            <ArrowRight className="h-5 w-5 text-slate-400" />
            <Badge
              variant="outline"
              className="font-mono uppercase tracking-wider"
              style={{
                borderColor: newStatus.color || undefined,
                color: newStatus.color || undefined,
                backgroundColor: `${newStatus.color}15` || "transparent",
              }}
            >
              {newStatus.name}
            </Badge>
          </div>

          {/* Optional note field */}
          <div className="space-y-2">
            <label htmlFor="note" className="text-sm text-slate-400">
              Add Note (Optional)
            </label>
            <Textarea
              id="note"
              placeholder="Why are you changing the status?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={256}
              disabled={isConfirming}
            />
            <p className="text-xs text-slate-500">
              {note.length}/256 characters • Notes are stored in the audit log
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isConfirming}
            className="border-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
          >
            {isConfirming ? "Updating..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
