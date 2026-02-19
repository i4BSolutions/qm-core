"use client";

import { format } from "date-fns";
import { Reply, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
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
  // author may be null at runtime when RLS blocks the users join for non-admin roles
  const authorName = (comment.author as { full_name: string } | null)?.full_name ?? "Unknown User";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 shadow-soft">
      <div className="flex items-start gap-3">
        {/* User Avatar */}
        <UserAvatar fullName={authorName} size={32} />

        <div className="flex-1 min-w-0">
          {/* Author name and timestamp */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-200">
              {authorName}
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
