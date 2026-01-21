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
import { useToast } from "@/components/ui/use-toast";
import type { Warehouse } from "@/types/database";

interface WarehouseDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  warehouse: Warehouse | null;
}

export function WarehouseDialog({ open, onClose, warehouse }: WarehouseDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    capacity_notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name || "",
        location: warehouse.location || "",
        description: warehouse.description || "",
        capacity_notes: warehouse.capacity_notes || "",
      });
    } else {
      setFormData({
        name: "",
        location: "",
        description: "",
        capacity_notes: "",
      });
    }
  }, [warehouse, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const data = {
      name: formData.name,
      location: formData.location,
      description: formData.description || null,
      capacity_notes: formData.capacity_notes || null,
    };

    if (warehouse) {
      const { error } = await supabase
        .from("warehouses")
        .update(data)
        .eq("id", warehouse.id);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to update warehouse.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Warehouse updated.",
          variant: "success",
        });
        onClose(true);
      }
    } else {
      const { error } = await supabase.from("warehouses").insert(data);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create warehouse.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Warehouse created.",
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
          <DialogTitle>
            {warehouse ? "Edit Warehouse" : "Add Warehouse"}
          </DialogTitle>
          <DialogDescription>
            {warehouse
              ? "Update the warehouse details."
              : "Add a new warehouse to the system."}
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
                placeholder="Warehouse name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="e.g., Building A, Floor 1"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Warehouse description..."
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="capacity_notes">Capacity Notes</Label>
              <Textarea
                id="capacity_notes"
                value={formData.capacity_notes}
                onChange={(e) =>
                  setFormData({ ...formData, capacity_notes: e.target.value })
                }
                placeholder="Notes about storage capacity, restrictions, etc."
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
            <Button type="submit" disabled={isLoading || !formData.name || !formData.location}>
              {isLoading ? "Saving..." : warehouse ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
