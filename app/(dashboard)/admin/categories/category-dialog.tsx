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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import type { Category } from "@/types/database";

interface CategoryDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  category: Category | null;
}

const colorPresets = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EF4444", label: "Red" },
  { value: "#6B7280", label: "Gray" },
  { value: "#EC4899", label: "Pink" },
  { value: "#14B8A6", label: "Teal" },
];

export function CategoryDialog({ open, onClose, category }: CategoryDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    entity_type: "qmrl" as "qmrl" | "qmhq",
    description: "",
    color: "#3B82F6",
    display_order: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name || "",
        entity_type: category.entity_type as "qmrl" | "qmhq",
        description: category.description || "",
        color: category.color || "#3B82F6",
        display_order: category.display_order || 0,
      });
    } else {
      setFormData({
        name: "",
        entity_type: "qmrl",
        description: "",
        color: "#3B82F6",
        display_order: 0,
      });
    }
  }, [category, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const data = {
      name: formData.name,
      entity_type: formData.entity_type,
      description: formData.description || null,
      color: formData.color,
      display_order: formData.display_order,
    };

    if (category) {
      const { error } = await supabase
        .from("categories")
        .update(data)
        .eq("id", category.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update category.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Category updated.",
          variant: "success",
        });
        onClose(true);
      }
    } else {
      const { error } = await supabase.from("categories").insert(data);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create category.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Category created.",
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
          <DialogTitle>{category ? "Edit Category" : "Add Category"}</DialogTitle>
          <DialogDescription>
            {category
              ? "Update the category configuration."
              : "Add a new category option."}
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
                placeholder="Category name"
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
                  disabled={!!category}
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
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                  className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description..."
                rows={2}
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
            <Button type="submit" disabled={isLoading || !formData.name}>
              {isLoading ? "Saving..." : category ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
