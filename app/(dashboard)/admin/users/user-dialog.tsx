"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import {
  PERMISSION_RESOURCES,
  PERMISSION_LEVEL_LABELS,
} from "@/types/database";
import type {
  User as UserType,
  Department,
  PermissionResource,
  PermissionLevel,
} from "@/types/database";

type UserWithDepartment = UserType & {
  departments: Pick<Department, "id" | "name"> | null;
};

interface UserDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  user: UserWithDepartment | null;
  departments: Department[];
  isCreateMode: boolean;
}

export function UserDialog({ open, onClose, user, departments, isCreateMode }: UserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    department_id: "",
    phone: "",
  });
  // Partial record — missing keys = unset (not yet configured)
  const [permissions, setPermissions] = useState<Partial<Record<PermissionResource, PermissionLevel>>>({});
  const { toast } = useToast();

  const configuredCount = PERMISSION_RESOURCES.filter(
    (r) => permissions[r] !== undefined
  ).length;

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || "",
        full_name: user.full_name || "",
        department_id: user.department_id || "",
        phone: user.phone || "",
      });
    } else {
      setFormData({
        email: "",
        full_name: "",
        department_id: "",
        phone: "",
      });
    }
    // Reset permissions when dialog opens
    setPermissions({});
  }, [user, open]);

  const handlePermissionChange = (resource: PermissionResource, level: PermissionLevel) => {
    setPermissions((prev) => ({ ...prev, [resource]: level }));
  };

  const handleSetAll = (level: PermissionLevel) => {
    const confirmed = window.confirm(
      `Set all 16 resources to "${PERMISSION_LEVEL_LABELS[level]}"? This will overwrite all current selections.`
    );
    if (confirmed) {
      const all: Partial<Record<PermissionResource, PermissionLevel>> = {};
      for (const resource of PERMISSION_RESOURCES) {
        all[resource] = level;
      }
      setPermissions(all);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    try {
      if (isCreateMode) {
        // Build permissions array from state
        const permissionsArray = PERMISSION_RESOURCES.map((resource) => ({
          resource,
          level: permissions[resource] as PermissionLevel,
        }));

        const response = await fetch("/api/admin/invite-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            full_name: formData.full_name,
            department_id: formData.department_id || null,
            phone: formData.phone || null,
            permissions: permissionsArray,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to create user");
        }

        toast({
          title: "Success",
          description: `Invitation sent to "${formData.email}". They will receive an email to set up their account.`,
          variant: "success",
        });
        onClose(true);
      } else if (user) {
        // Update existing user
        const { error } = await supabase
          .from("users")
          .update({
            full_name: formData.full_name,
            department_id: formData.department_id || null,
            phone: formData.phone || null,
          })
          .eq("id", user.id);

        if (error) {
          throw error;
        }

        toast({
          title: "Success",
          description: "User updated.",
          variant: "success",
        });
        onClose(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save user.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isCreateSubmitDisabled =
    isLoading ||
    !formData.email ||
    !formData.full_name ||
    configuredCount < 16;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent
        className={
          isCreateMode
            ? "sm:max-w-[700px] max-h-[80vh] overflow-y-auto"
            : "sm:max-w-[500px]"
        }
      >
        <DialogHeader>
          <DialogTitle>{isCreateMode ? "Create User" : "Edit User"}</DialogTitle>
          <DialogDescription>
            {isCreateMode
              ? "Create a new user account. Set all 16 permissions below before saving."
              : "Update the user's information."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="user@example.com"
                required
                disabled={!isCreateMode}
              />
              {!isCreateMode && (
                <p className="text-xs text-slate-400">Email cannot be changed</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, department_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 234 567 890"
              />
            </div>

            {/* Permission matrix — create mode only */}
            {isCreateMode && (
              <div className="grid gap-3 pt-2">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Permissions
                </h3>
                <PermissionMatrix
                  mode="create"
                  permissions={permissions}
                  onChange={handlePermissionChange}
                  onSetAll={handleSetAll}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center gap-2">
            {isCreateMode && (
              <span
                className={`text-xs mr-auto ${
                  configuredCount === 16 ? "text-emerald-400" : "text-slate-400"
                }`}
              >
                {configuredCount}/16 configured
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreateMode ? isCreateSubmitDisabled : isLoading || !formData.email || !formData.full_name}
            >
              {isLoading ? "Saving..." : isCreateMode ? "Create User" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
