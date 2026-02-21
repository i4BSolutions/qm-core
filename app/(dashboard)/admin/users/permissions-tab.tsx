"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import {
  PERMISSION_RESOURCES,
  PERMISSION_LEVEL_LABELS,
} from "@/types/database";
import type { PermissionResource, PermissionLevel, UserPermission } from "@/types/database";

// Default block permissions used when a row is missing from DB
const DEFAULT_LEVEL: PermissionLevel = "block";

function buildDefaultPermissions(): Record<PermissionResource, PermissionLevel> {
  const perms = {} as Record<PermissionResource, PermissionLevel>;
  for (const resource of PERMISSION_RESOURCES) {
    perms[resource] = DEFAULT_LEVEL;
  }
  return perms;
}

function buildPermissionsFromRows(
  rows: Pick<UserPermission, "resource" | "level">[]
): Record<PermissionResource, PermissionLevel> {
  const perms = buildDefaultPermissions();
  for (const row of rows) {
    perms[row.resource] = row.level;
  }
  return perms;
}

interface PermissionsTabProps {
  userId: string;
  userName: string;
  /** True when the current admin is editing their own permissions */
  isSelf: boolean;
  onClose: () => void;
}

export function PermissionsTab({ userId, userName, isSelf, onClose }: PermissionsTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [initialPermissions, setInitialPermissions] = useState<Record<PermissionResource, PermissionLevel>>(
    buildDefaultPermissions()
  );
  const [currentPermissions, setCurrentPermissions] = useState<Record<PermissionResource, PermissionLevel>>(
    buildDefaultPermissions()
  );
  const { toast } = useToast();

  // Compute dirty resources by comparing initial vs current
  const dirtyResources = new Set<PermissionResource>();
  for (const resource of PERMISSION_RESOURCES) {
    if (currentPermissions[resource] !== initialPermissions[resource]) {
      dirtyResources.add(resource);
    }
  }

  // Lock admin resource when editing own profile
  const disabledResources = isSelf ? new Set<PermissionResource>(["admin"]) : new Set<PermissionResource>();

  // Fetch permissions on mount
  const fetchPermissions = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("user_permissions")
      .select("resource, level")
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load permissions.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const perms = buildPermissionsFromRows(
      (data || []) as Pick<UserPermission, "resource" | "level">[]
    );
    setInitialPermissions(perms);
    setCurrentPermissions(perms);
    setIsLoading(false);
  }, [userId, toast]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Warn before leaving if there are unsaved changes
  useEffect(() => {
    if (dirtyResources.size === 0) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyResources.size]);

  const handleChange = (resource: PermissionResource, level: PermissionLevel) => {
    // Lockout prevention: never allow removing own admin access
    if (isSelf && resource === "admin") return;
    setCurrentPermissions((prev) => ({ ...prev, [resource]: level }));
  };

  const handleSetAll = (level: PermissionLevel) => {
    const confirmed = window.confirm(
      `Set all 16 resources to "${PERMISSION_LEVEL_LABELS[level]}"? This will overwrite all current selections.`
    );
    if (!confirmed) return;

    setCurrentPermissions((prev) => {
      const next = { ...prev };
      for (const resource of PERMISSION_RESOURCES) {
        // Skip disabled resources (lockout prevention)
        if (disabledResources.has(resource)) continue;
        next[resource] = level;
      }
      return next;
    });
  };

  const handleSaveAll = async () => {
    if (dirtyResources.size === 0) return;

    setIsSaving(true);
    const supabase = createClient();

    // Build upsert payload for all 16 resources
    const rows = PERMISSION_RESOURCES.map((resource) => ({
      user_id: userId,
      resource,
      level: currentPermissions[resource],
    }));

    const { error } = await supabase
      .from("user_permissions")
      .upsert(rows, { onConflict: "user_id,resource" });

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to save permissions.",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    toast({
      title: "Success",
      description: `Permissions updated for ${userName}.`,
      variant: "success",
    });

    // Reset dirty state
    setInitialPermissions({ ...currentPermissions });
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-slate-400">Loading permissions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isSelf && (
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
          <span className="mt-0.5">&#9888;</span>
          <span>
            You are editing your own permissions. The Admin resource is locked to prevent
            accidental lockout.
          </span>
        </div>
      )}

      <PermissionMatrix
        permissions={currentPermissions}
        onChange={handleChange}
        onSetAll={handleSetAll}
        dirtyResources={dirtyResources}
        disabledResources={disabledResources}
        disabledTooltip="You cannot remove your own admin access"
        mode="edit"
      />

      <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
        <div className="text-xs text-slate-500">
          {dirtyResources.size > 0 ? (
            <span className="text-amber-400">
              {dirtyResources.size} unsaved change{dirtyResources.size !== 1 ? "s" : ""}
            </span>
          ) : (
            <span>No unsaved changes</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={dirtyResources.size === 0 || isSaving}
          >
            {isSaving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>
    </div>
  );
}
