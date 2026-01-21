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
import type { Department, User } from "@/types/database";

interface DepartmentWithHead extends Department {
  head?: Pick<User, "id" | "full_name"> | null;
}

interface DepartmentDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  department: DepartmentWithHead | null;
}

export function DepartmentDialog({ open, onClose, department }: DepartmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<Pick<User, "id" | "full_name">[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    head_id: "",
  });
  const { toast } = useToast();

  // Fetch users for department head select
  useEffect(() => {
    const fetchUsers = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("id, full_name")
        .neq("is_active", false)
        .order("full_name")
        .limit(200);

      if (data) {
        setUsers(data);
      }
    };

    if (open) {
      fetchUsers();
    }
  }, [open]);

  useEffect(() => {
    if (department) {
      setFormData({
        name: department.name || "",
        code: department.code || "",
        head_id: department.head_id || "",
      });
    } else {
      setFormData({
        name: "",
        code: "",
        head_id: "",
      });
    }
  }, [department, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const data = {
      name: formData.name,
      code: formData.code || null,
      head_id: formData.head_id || null,
    };

    if (department) {
      const { error } = await supabase
        .from("departments")
        .update(data)
        .eq("id", department.id);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to update department.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Department updated.",
          variant: "success",
        });
        onClose(true);
      }
    } else {
      const { error } = await supabase.from("departments").insert(data);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create department.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Department created.",
          variant: "success",
        });
        onClose(true);
      }
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {department ? "Edit Department" : "Add Department"}
          </DialogTitle>
          <DialogDescription>
            {department
              ? "Update the department details."
              : "Add a new department to the system."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name <span className="text-red-400">*</span></Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Department name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="code">Department Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g., HQ, FIN, LOG"
                className="font-mono uppercase"
              />
              <p className="text-xs text-slate-400">
                Short unique code for the department
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="head">Department Head</Label>
              <Select
                value={formData.head_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, head_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department head" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No head assigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={isLoading || !formData.name}>
              {isLoading ? "Saving..." : department ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
