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
import type { User as UserType, Department } from "@/types/database";

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
  const { toast } = useToast();

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
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    try {
      if (isCreateMode) {
        // Create new user via API route (uses admin invite)
        // Permission assignment for new users is handled separately (Plan 02)
        const response = await fetch("/api/admin/invite-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            full_name: formData.full_name,
            department_id: formData.department_id || null,
            phone: formData.phone || null,
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

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isCreateMode ? "Create User" : "Edit User"}</DialogTitle>
          <DialogDescription>
            {isCreateMode
              ? "Create a new user account. They will receive an email to verify their account."
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
          </div>

          <DialogFooter>
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
              disabled={isLoading || !formData.email || !formData.full_name}
            >
              {isLoading ? "Saving..." : isCreateMode ? "Create User" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
