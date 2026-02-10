"use client";

import { useState } from "react";
import { AlertTriangle, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface DeactivateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  onConfirm: (reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export function DeactivateUserDialog({
  open,
  onOpenChange,
  userName,
  onConfirm,
  isLoading = false,
}: DeactivateUserDialogProps) {
  const [reason, setReason] = useState("");

  const handleConfirm = async () => {
    try {
      await onConfirm(reason.trim() || undefined);
      setReason("");
      onOpenChange(false);
    } catch (err) {
      // Error handling is done in parent component
      console.error("Deactivation error:", err);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setReason("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-slate-100">Deactivate User</DialogTitle>
              <DialogDescription className="text-slate-400">
                This action will immediately block login
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded bg-red-500/10 border border-red-500/30">
            <p className="text-sm text-red-400">
              This will immediately sign out{" "}
              <span className="font-semibold">{userName}</span> from all active
              sessions and prevent future login.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deactivate-reason" className="text-slate-300">
              Why are you deactivating this user?{" "}
              <span className="text-slate-500">(optional)</span>
            </Label>
            <Textarea
              id="deactivate-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter an optional reason for deactivation..."
              disabled={isLoading}
              className="min-h-[100px] bg-slate-800 border-slate-700 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Deactivating...
              </>
            ) : (
              <>
                <UserX className="h-4 w-4 mr-2" />
                Deactivate User
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
