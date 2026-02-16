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
import { useToast } from "@/components/ui/use-toast";
import type { StandardUnit } from "@/types/database";

interface UnitDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  unit: StandardUnit | null;
}

export function UnitDialog({ open, onClose, unit }: UnitDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    display_order: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (unit) {
      setFormData({
        name: unit.name || "",
        display_order: unit.display_order || 0,
      });
    } else {
      setFormData({
        name: "",
        display_order: 0,
      });
    }
  }, [unit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const data = {
      name: formData.name,
      display_order: formData.display_order,
    };

    if (unit) {
      const { error } = await supabase
        .from("standard_units" as any)
        .update(data)
        .eq("id", unit.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update unit.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Unit updated.",
          variant: "success",
        });
        onClose(true);
      }
    } else {
      const { error } = await supabase.from("standard_units" as any).insert(data);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create unit.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Unit created.",
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
          <DialogTitle>{unit ? "Edit Standard Unit" : "Add Standard Unit"}</DialogTitle>
          <DialogDescription>
            {unit
              ? "Update the unit details."
              : "Add a new unit of measurement."}
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
                placeholder="e.g., kg, pcs, box"
                required
              />
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
              {isLoading ? "Saving..." : unit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
