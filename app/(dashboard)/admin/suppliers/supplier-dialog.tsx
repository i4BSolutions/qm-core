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
import type { Supplier } from "@/types/database";

interface SupplierDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  supplier: Supplier | null;
}

export function SupplierDialog({ open, onClose, supplier }: SupplierDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
      });
    }
  }, [supplier, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const data = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
    };

    if (supplier) {
      const { error } = await supabase
        .from("suppliers")
        .update(data)
        .eq("id", supplier.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update supplier.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Supplier updated.",
          variant: "success",
        });
        onClose(true);
      }
    } else {
      const { error } = await supabase.from("suppliers").insert(data);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create supplier.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Supplier created.",
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
            {supplier ? "Edit Supplier" : "Add Supplier"}
          </DialogTitle>
          <DialogDescription>
            {supplier
              ? "Update the supplier details."
              : "Add a new supplier to the system."}
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
                placeholder="Supplier name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="email@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+95 9..."
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
              {isLoading ? "Saving..." : supplier ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
