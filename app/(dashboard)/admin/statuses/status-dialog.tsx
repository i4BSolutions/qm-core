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
import type { StatusConfig } from "@/types/database";

interface StatusDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  status: StatusConfig | null;
}

const colorPresets = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EF4444", label: "Red" },
  { value: "#9CA3AF", label: "Gray" },
  { value: "#EC4899", label: "Pink" },
  { value: "#14B8A6", label: "Teal" },
];

export function StatusDialog({ open, onClose, status }: StatusDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    entity_type: "qmrl" as "qmrl" | "qmhq",
    status_group: "to_do" as "to_do" | "in_progress" | "done",
    color: "#3B82F6",
    display_order: 0,
    is_default: false,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (status) {
      setFormData({
        name: status.name || "",
        entity_type: status.entity_type as "qmrl" | "qmhq",
        status_group: status.status_group as "to_do" | "in_progress" | "done",
        color: status.color || "#3B82F6",
        display_order: status.display_order || 0,
        is_default: status.is_default || false,
      });
    } else {
      setFormData({
        name: "",
        entity_type: "qmrl",
        status_group: "to_do",
        color: "#3B82F6",
        display_order: 0,
        is_default: false,
      });
    }
  }, [status, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const data = {
      name: formData.name,
      entity_type: formData.entity_type,
      status_group: formData.status_group,
      color: formData.color,
      display_order: formData.display_order,
      is_default: formData.is_default,
    };

    if (status) {
      const { error } = await supabase
        .from("status_config")
        .update(data)
        .eq("id", status.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update status.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Status updated.",
          variant: "success",
        });
        onClose(true);
      }
    } else {
      const { error } = await supabase.from("status_config").insert(data);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create status.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Status created.",
          variant: "success",
        });
        onClose(true);
      }
    }

    setIsLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{status ? "Edit Status" : "Add Status"}</DialogTitle>
          <DialogDescription>
            {status
              ? "Update the status configuration."
              : "Add a new status option."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Status name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="entity_type">Entity Type *</Label>
                <Select
                  value={formData.entity_type}
                  onValueChange={(value: "qmrl" | "qmhq") =>
                    setFormData({ ...formData, entity_type: value })
                  }
                  disabled={!!status}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qmrl">QMRL</SelectItem>
                    <SelectItem value="qmhq">QMHQ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status_group">Status Group *</Label>
                <Select
                  value={formData.status_group}
                  onValueChange={(value: "to_do" | "in_progress" | "done") =>
                    setFormData({ ...formData, status_group: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_do">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        To Do
                      </div>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        In Progress
                      </div>
                    </SelectItem>
                    <SelectItem value="done">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Done
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color.value
                        ? "border-white scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
                className="max-w-[100px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-xs text-slate-400">
                Lower numbers appear first
              </p>
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
              {isLoading ? "Saving..." : status ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
