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
import type { ContactPerson, Department } from "@/types/database";

interface ContactPersonDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  contact: ContactPerson | null;
  departments: Department[];
}

export function ContactPersonDialog({
  open,
  onClose,
  contact,
  departments,
}: ContactPersonDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    department_id: "",
    position: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || "",
        department_id: contact.department_id || "",
        position: contact.position || "",
        phone: contact.phone || "",
        email: contact.email || "",
        address: contact.address || "",
        notes: contact.notes || "",
      });
    } else {
      setFormData({
        name: "",
        department_id: "",
        position: "",
        phone: "",
        email: "",
        address: "",
        notes: "",
      });
    }
  }, [contact, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    if (contact) {
      // Update
      const { error } = await supabase
        .from("contact_persons")
        .update({
          name: formData.name,
          department_id: formData.department_id,
          position: formData.position || null,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          notes: formData.notes || null,
        })
        .eq("id", contact.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update contact person.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Contact person updated.",
          variant: "success",
        });
        onClose(true);
      }
    } else {
      // Create
      const { error } = await supabase.from("contact_persons").insert({
        name: formData.name,
        department_id: formData.department_id,
        position: formData.position || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        notes: formData.notes || null,
      });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create contact person.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Contact person created.",
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
            {contact ? "Edit Contact Person" : "Add Contact Person"}
          </DialogTitle>
          <DialogDescription>
            {contact
              ? "Update the contact person details."
              : "Add a new contact person to the system."}
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
                placeholder="Full name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, department_id: value })
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                placeholder="Office address"
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
            <Button type="submit" disabled={isLoading || !formData.name || !formData.department_id}>
              {isLoading ? "Saving..." : contact ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
