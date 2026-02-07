"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import type { CommentEntityType, CommentWithAuthor } from "@/types/database";

interface CommentInputProps {
  entityType: CommentEntityType;
  entityId: string;
  parentId?: string | null;
  replyingToName?: string;
  onCancel?: () => void;
  onSubmit: (comment: CommentWithAuthor) => void;
}

export function CommentInput({
  entityType,
  entityId,
  parentId,
  replyingToName,
  onCancel,
  onSubmit,
}: CommentInputProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setIsSubmitting(true);

    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("comments")
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        parent_id: parentId || null,
        content: content.trim(),
        author_id: userData.user?.id || "",
      })
      .select(`*, author:users!comments_author_id_fkey(id, full_name, avatar_url)`)
      .single();

    if (error) {
      toast({
        title: "Failed to add comment",
        description: error.message,
        variant: "destructive",
      });
    } else if (data) {
      setContent("");
      onSubmit(data as CommentWithAuthor);
      toast({
        title: parentId ? "Reply added" : "Comment added",
        variant: "default",
      });
      if (onCancel) onCancel(); // Close reply mode
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-2">
      {replyingToName && (
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>Replying to @{replyingToName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-6 px-2"
          >
            <X className="h-3 w-3" />
            Cancel
          </Button>
        </div>
      )}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment..."
        className="min-h-[80px] resize-none"
        disabled={isSubmitting}
      />
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!content.trim() || isSubmitting}
          size="sm"
        >
          {isSubmitting ? "Submitting..." : parentId ? "Reply" : "Comment"}
        </Button>
      </div>
    </div>
  );
}
