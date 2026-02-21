"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useResourcePermissions } from "@/lib/hooks/use-permissions";
import type { PermissionResource as DbPermissionResource } from "@/types/database";
import { useAuth } from "@/components/providers/auth-provider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusChangeDialog } from "./status-change-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import type { StatusConfig } from "@/types/database";

interface ClickableStatusBadgeProps {
  status: StatusConfig;
  entityType: "qmrl" | "qmhq";
  entityId: string;
  onStatusChange?: () => void;
  isClickable?: boolean;
}

export function ClickableStatusBadge({
  status,
  entityType,
  entityId,
  onStatusChange,
  isClickable = true,
}: ClickableStatusBadgeProps) {
  const { canEdit } = useResourcePermissions();
  const { user } = useAuth();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<StatusConfig | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const canUpdate = canEdit(entityType as DbPermissionResource);

  // Fetch all statuses for this entity type
  useEffect(() => {
    const fetchStatuses = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("status_config")
        .select("*")
        .eq("entity_type", entityType)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (data) {
        setStatuses(data as StatusConfig[]);
      }
    };

    if (isOpen) {
      fetchStatuses();
    }
  }, [entityType, isOpen]);

  const handleStatusSelect = (statusId: string) => {
    if (statusId === status.id) {
      setIsOpen(false);
      return;
    }

    const newStatus = statuses.find((s) => s.id === statusId);
    if (newStatus) {
      setSelectedStatus(newStatus);
      setIsDialogOpen(true);
      setIsOpen(false);
    }
  };

  const handleConfirm = async (note: string) => {
    if (!selectedStatus || !user || isUpdating) return;

    setIsUpdating(true);

    try {
      const supabase = createClient();

      // Use RPC function to update status with note
      const { data, error } = await supabase.rpc('update_status_with_note', {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_new_status_id: selectedStatus.id,
        p_note: note || null,
        p_user_id: user.id
      });

      if (error) {
        throw error;
      }

      // Check for application-level errors in response
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to update status');
      }

      toast({
        title: "Status Updated",
        description: `Status changed to ${selectedStatus.name}`,
        variant: "default",
      });

      setIsDialogOpen(false);
      setSelectedStatus(null);

      // Trigger callback to refetch data
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status. Please try again.",
        variant: "destructive",
      });
      // Don't close dialog on error - keep note preserved
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  // If user cannot update or isClickable is false, render non-clickable badge
  if (!canUpdate || !isClickable) {
    return (
      <Badge
        variant="outline"
        className="font-mono uppercase tracking-wider text-xs"
        style={{
          borderColor: status.color || undefined,
          color: status.color || undefined,
          backgroundColor: `${status.color}15` || "transparent",
        }}
      >
        {status.name}
      </Badge>
    );
  }

  // Group statuses by status_group
  const groupedStatuses = statuses.reduce((acc, s) => {
    const group = s.status_group;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(s);
    return acc;
  }, {} as Record<string, StatusConfig[]>);

  const groupLabels: Record<string, string> = {
    to_do: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };

  return (
    <>
      <Select value={status.id} onValueChange={handleStatusSelect} open={isOpen} onOpenChange={setIsOpen}>
        <SelectTrigger
          disabled={isUpdating}
          className="h-auto w-auto border-0 bg-transparent px-0 hover:bg-transparent focus:ring-0 focus:ring-offset-0 [&>svg]:hidden"
        >
          <Badge
            variant="outline"
            className="font-mono uppercase tracking-wider text-xs cursor-pointer transition-all hover:scale-105 hover:shadow-md"
            style={{
              borderColor: status.color || undefined,
              color: status.color || undefined,
              backgroundColor: `${status.color}15` || "transparent",
            }}
          >
            {isUpdating ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {status.name}
              </span>
            ) : (
              status.name
            )}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(groupedStatuses).map(([group, groupStatuses]) => (
            <SelectGroup key={group}>
              <SelectLabel className="text-amber-400 uppercase text-xs">
                {groupLabels[group] || group}
              </SelectLabel>
              {groupStatuses.map((s) => (
                <SelectItem
                  key={s.id}
                  value={s.id}
                  disabled={s.id === status.id}
                  className={s.id === status.id ? "opacity-50" : ""}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color || "#64748b" }}
                    />
                    <span>{s.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {selectedStatus && (
        <StatusChangeDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          currentStatus={status}
          newStatus={selectedStatus}
          entityType={entityType}
          entityId={entityId}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
