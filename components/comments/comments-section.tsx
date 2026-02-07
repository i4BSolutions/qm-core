"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { CommentCard } from "./comment-card";
import { CommentInput } from "./comment-input";
import { DeleteCommentDialog } from "./delete-comment-dialog";
import { CommentsSkeleton } from "./comments-skeleton";
import type { CommentWithAuthor, CommentWithReplies, CommentEntityType } from "@/types/database";

interface CommentsSectionProps {
  entityType: CommentEntityType;
  entityId: string;
}

export function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommentWithAuthor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchComments = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .select(`*, author:users!comments_author_id_fkey(id, full_name, avatar_url)`)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch comments:", error);
      setIsLoading(false);
      return;
    }

    // Group into parent + replies structure
    const grouped = (data as CommentWithAuthor[])?.reduce((acc, comment) => {
      if (!comment.parent_id) {
        acc.push({ ...comment, replies: [] });
      } else {
        const parent = acc.find(c => c.id === comment.parent_id);
        if (parent) parent.replies.push(comment);
      }
      return acc;
    }, [] as CommentWithReplies[]) || [];

    setComments(grouped);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchComments();
  }, [entityType, entityId]);

  const handleDeleteClick = (comment: CommentWithAuthor) => {
    setDeleteTarget(comment);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);

    const supabase = createClient();
    // Use RPC function to bypass RLS issues with UPDATE
    const { error } = await supabase
      .rpc("soft_delete_comment", { comment_id: deleteTarget.id });

    if (error) {
      console.error("Failed to delete comment:", error);
    } else {
      // Update local state
      if (deleteTarget.parent_id) {
        // It's a reply - remove from parent's replies array
        setComments(prev => prev.map(c => ({
          ...c,
          replies: c.replies.filter(r => r.id !== deleteTarget.id)
        })));
      } else {
        // It's a parent - remove entirely
        setComments(prev => prev.filter(c => c.id !== deleteTarget.id));
      }
    }

    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const handleReplyClick = (commentId: string) => {
    setReplyingTo(commentId);
  };

  const handleNewComment = (newComment: CommentWithAuthor) => {
    if (newComment.parent_id) {
      // It's a reply - add to parent's replies array
      setComments(prev => prev.map(c =>
        c.id === newComment.parent_id
          ? { ...c, replies: [...c.replies, newComment] }
          : c
      ));
    } else {
      // It's a new parent comment
      setComments(prev => [...prev, { ...newComment, replies: [] }]);
    }
  };

  const totalCommentCount = comments.reduce((count, comment) => {
    return count + 1 + comment.replies.length;
  }, 0);

  return (
    <div className="command-panel corner-accents">
      {/* Section header with count */}
      <div className="section-header mb-4">
        <MessageSquare className="h-4 w-4 text-amber-500" />
        <h3>Comments ({totalCommentCount})</h3>
      </div>

      {/* Comment list with threading */}
      {isLoading ? (
        <CommentsSkeleton />
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No comments yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id}>
              <CommentCard
                comment={comment}
                onReply={() => handleReplyClick(comment.id)}
                onDelete={() => handleDeleteClick(comment)}
                canDelete={user?.id === comment.author_id}
                hasReplies={comment.replies.length > 0}
              />
              {/* Indented replies with connecting line */}
              {comment.replies.length > 0 && (
                <div className="ml-8 mt-2 border-l-2 border-slate-700 pl-4 space-y-2">
                  {comment.replies.map(reply => (
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      onDelete={() => handleDeleteClick(reply)}
                      canDelete={user?.id === reply.author_id}
                      hasReplies={false}
                      isReply={true}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add comment input at bottom */}
      <div className="mt-4 pt-4 border-t border-slate-700">
        <CommentInput
          entityType={entityType}
          entityId={entityId}
          parentId={replyingTo}
          replyingToName={replyingTo
            ? comments.find(c => c.id === replyingTo)?.author.full_name
            : undefined
          }
          onCancel={() => setReplyingTo(null)}
          onSubmit={handleNewComment}
        />
      </div>

      {/* Delete confirmation dialog */}
      <DeleteCommentDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />
    </div>
  );
}
