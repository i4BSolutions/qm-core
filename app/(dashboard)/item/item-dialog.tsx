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
import type { Item, ItemCategory } from "@/types/database";

interface ItemDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  item: Item | null;
}

const categories: { value: ItemCategory; label: string }[] = [
  { value: "equipment", label: "Equipment" },
  { value: "consumable", label: "Consumable" },
  { value: "uniform", label: "Uniform" },
  { value: "other", label: "Other" },
];

const units = ["pcs", "box", "kg", "liter", "meter", "set", "pack", "roll", "unit"];

export function ItemDialog({ open, onClose, item }: ItemDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "other" as ItemCategory,
    sku: "",
    default_unit: "pcs",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || "",
        description: item.description || "",
        category: item.category || "other",
        sku: item.sku || "",
        default_unit: item.default_unit || "pcs",
      });
    } else {
      setFormData({
        name: "",
        description: "",
        category: "other",
        sku: "",
        default_unit: "pcs",
      });
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const data = {
      name: formData.name,
      description: formData.description || null,
      category: formData.category,
      sku: formData.sku || null, // Will be auto-generated if null
      default_unit: formData.default_unit,
    };

    if (item) {
      const { error } = await supabase
        .from("items")
        .update(data)
        .eq("id", item.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update item.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Item updated.",
          variant: "success",
        });
        onClose(true);
      }
    } else {
      const { error } = await supabase.from("items").insert(data);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create item.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Item created.",
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
          <DialogTitle>{item ? "Edit Item" : "Add Item"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Update the item details."
              : "Add a new item to the inventory system."}
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
                placeholder="Item name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: ItemCategory) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="default_unit">Default Unit</Label>
                <Select
                  value={formData.default_unit}
                  onValueChange={(value) =>
                    setFormData({ ...formData, default_unit: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                placeholder="Leave empty to auto-generate"
              />
              <p className="text-xs text-slate-400">
                Stock Keeping Unit. Will be auto-generated if left empty.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Item description..."
                rows={3}
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
              {isLoading ? "Saving..." : item ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
