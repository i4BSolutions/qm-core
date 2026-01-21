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
    company_name: "",
    position: "",
    phone: "",
    email: "",
    address: "",
    tax_id: "",
    payment_terms: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || "",
        company_name: supplier.company_name || "",
        position: supplier.position || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        tax_id: supplier.tax_id || "",
        payment_terms: supplier.payment_terms || "",
        notes: supplier.notes || "",
      });
    } else {
      setFormData({
        name: "",
        company_name: "",
        position: "",
        phone: "",
        email: "",
        address: "",
        tax_id: "",
        payment_terms: "",
        notes: "",
      });
    }
  }, [supplier, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    const data = {
      name: formData.name,
      company_name: formData.company_name || null,
      position: formData.position || null,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      tax_id: formData.tax_id || null,
      payment_terms: formData.payment_terms || null,
      notes: formData.notes || null,
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
      <DialogContent className="sm:max-w-[550px]">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Contact Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Contact person name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company_name">Company Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({ ...formData, company_name: e.target.value })
                  }
                  placeholder="Company / Business name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                  placeholder="Job title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) =>
                    setFormData({ ...formData, tax_id: e.target.value })
                  }
                  placeholder="Tax identification number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Business address"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(e) =>
                  setFormData({ ...formData, payment_terms: e.target.value })
                }
                placeholder="e.g., Net 30, COD, etc."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes..."
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
              {isLoading ? "Saving..." : supplier ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
