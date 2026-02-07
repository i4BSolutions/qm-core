"use client";

import { format } from "date-fns";
import { User, Reply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CommentWithAuthor } from "@/types/database";

interface CommentCardProps {
  comment: CommentWithAuthor;
  onReply?: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  hasReplies: boolean;
  isReply?: boolean;
}

export function CommentCard({
  comment,
  onReply,
  onDelete,
  canDelete,
  hasReplies,
  isReply = false,
}: CommentCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 shadow-soft">
      <div className="flex items-start gap-3">
        {/* User Avatar */}
        <div className="h-8 w-8 flex-shrink-0 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <User className="h-4 w-4 text-amber-500" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Author name and timestamp */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-200">
              {comment.author.full_name}
            </span>
            <span className="text-xs text-slate-400">
              {format(new Date(comment.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>

          {/* Plain text content */}
          <p className="mt-1 text-slate-300 whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-2">
            {/* Reply button - only on parent comments */}
            {!isReply && onReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReply}
                className="text-slate-400 hover:text-amber-500"
              >
                <Reply className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}

            {/* Delete button with tooltip when disabled */}
            {canDelete && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        disabled={hasReplies}
                        className="text-slate-400 hover:text-red-400 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {hasReplies && (
                    <TooltipContent>
                      Cannot delete: has replies
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
