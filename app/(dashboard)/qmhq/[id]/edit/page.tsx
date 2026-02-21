"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  Package,
  Wallet,
  ShoppingCart,
  FileText,
  Users,
} from "lucide-react";

// Note: Package, Wallet, ShoppingCart are used in routeConfig for displaying route type badge
import { createClient } from "@/lib/supabase/client";
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
import { useAuth } from "@/components/providers/auth-provider";
import { InlineCreateSelect } from "@/components/forms/inline-create-select";
import { FormSection, FormField, PageHeader } from "@/components/composite";
import type {
  QMHQ,
  StatusConfig,
  Category,
  ContactPerson,
  User as UserType,
} from "@/types/database";

// Route type configuration
const routeConfig: Record<string, { icon: typeof Package; label: string; color: string; bgColor: string }> = {
  item: { icon: Package, label: "Item", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
  expense: { icon: Wallet, label: "Expense", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  po: { icon: ShoppingCart, label: "PO", color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
};

export default function EditQMHQPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const qmhqId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [qmhq, setQmhq] = useState<QMHQ | null>(null);

  // Form state (only editable fields - route details are not editable)
  const [formData, setFormData] = useState({
    line_name: "",
    description: "",
    notes: "",
    category_id: "",
    status_id: "",
    contact_person_id: "",
    assigned_to: "",
  });

  // Reference data
  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch QMHQ data
    const { data: qmhqData, error: qmhqError } = await supabase
      .from("qmhq")
      .select("*")
      .eq("id", qmhqId)
      .single();

    if (qmhqError || !qmhqData) {
      toast({
        title: "Error",
        description: "Failed to load QMHQ data.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setQmhq(qmhqData);

    // Set form data from QMHQ (only editable fields)
    setFormData({
      line_name: qmhqData.line_name || "",
      description: qmhqData.description || "",
      notes: qmhqData.notes || "",
      category_id: qmhqData.category_id || "",
      status_id: qmhqData.status_id || "",
      contact_person_id: qmhqData.contact_person_id || "",
      assigned_to: qmhqData.assigned_to || "",
    });

    // Fetch reference data
    const [categoryRes, statusRes, contactRes, userRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, color, display_order")
        .eq("entity_type", "qmhq")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("status_config")
        .select("id, name, color, status_group, display_order, is_default")
        .eq("entity_type", "qmhq")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("contact_persons")
        .select("id, name, position")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("users")
        // TODO Phase 62: role column dropped in Phase 60 — remove from select
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name"),
    ]);

    if (categoryRes.data) setCategories(categoryRes.data as Category[]);
    if (statusRes.data) setStatuses(statusRes.data as StatusConfig[]);
    if (contactRes.data) setContactPersons(contactRes.data as ContactPerson[]);
    if (userRes.data) setUsers(userRes.data as UserType[]);

    setIsLoading(false);
  }, [qmhqId, toast]);

  useEffect(() => {
    if (qmhqId) {
      fetchData();
    }
  }, [qmhqId, fetchData]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.line_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Line name is required.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    // Build update object (route-specific fields are not editable)
    const updateData: Record<string, unknown> = {
      line_name: formData.line_name.trim(),
      description: formData.description.trim() || null,
      notes: formData.notes.trim() || null,
      category_id: formData.category_id || null,
      status_id: formData.status_id || null,
      contact_person_id: formData.contact_person_id || null,
      assigned_to: formData.assigned_to || null,
      updated_by: user?.id,
    };

    const { error } = await supabase
      .from("qmhq")
      .update(updateData)
      .eq("id", qmhqId);

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update QMHQ.",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    toast({
      title: "Success",
      description: "QMHQ updated successfully.",
      variant: "success",
    });

    router.push(`/qmhq/${qmhqId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading QMHQ data...
          </p>
        </div>
      </div>
    );
  }

  if (!qmhq) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-slate-400">QMHQ not found.</p>
        <Link href="/qmhq">
          <Button variant="outline">Back to QMHQ List</Button>
        </Link>
      </div>
    );
  }

  const RouteIcon = routeConfig[qmhq.route_type]?.icon || Package;
  const routeColors = routeConfig[qmhq.route_type];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/qmhq/${qmhqId}`}>
          <Button variant="ghost" size="icon" className="hover:bg-amber-500/10 hover:text-amber-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader
          title="Edit QMHQ"
          description={<code className="text-amber-400">{qmhq.request_id}</code>}
          badge={
            <div className={`flex items-center gap-2 px-3 py-1 rounded border ${routeColors?.bgColor}`}>
              <RouteIcon className={`h-4 w-4 ${routeColors?.color}`} />
              <span className={`text-xs font-semibold uppercase tracking-widest ${routeColors?.color}`}>
                {routeColors?.label}
              </span>
            </div>
          }
        />
      </div>

      {/* Basic Information */}
      <FormSection
        title="Basic Information"
        icon={<FileText className="h-5 w-5 text-amber-400" />}
      >
        <FormField
          label="Line Name"
          htmlFor="line_name"
          required
        >
          <Input
            id="line_name"
            value={formData.line_name}
            onChange={(e) => handleInputChange("line_name", e.target.value)}
            placeholder="Enter line name"
            className="bg-slate-800/50 border-slate-700 text-slate-200"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Category"
          >
            <InlineCreateSelect
              value={formData.category_id}
              onValueChange={(v) => handleInputChange("category_id", v)}
              options={categories}
              onOptionsChange={setCategories}
              placeholder="Select category"
              entityType="qmhq"
              createType="category"
            />
          </FormField>

          <FormField
            label="Status"
          >
            <InlineCreateSelect
              value={formData.status_id}
              onValueChange={(v) => handleInputChange("status_id", v)}
              options={statuses}
              onOptionsChange={setStatuses}
              placeholder="Select status"
              entityType="qmhq"
              createType="status"
            />
          </FormField>
        </div>

        <FormField
          label="Description"
          htmlFor="description"
        >
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange("description", e.target.value)}
            placeholder="Enter description"
            className="bg-slate-800/50 border-slate-700 text-slate-200"
            rows={3}
          />
        </FormField>

        <FormField
          label="Notes"
          htmlFor="notes"
        >
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder="Additional notes"
            className="bg-slate-800/50 border-slate-700 text-slate-200"
            rows={2}
          />
        </FormField>
      </FormSection>

      {/* Assignment */}
      <FormSection
        title="Assignment"
        icon={<Users className="h-5 w-5 text-amber-400" />}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Contact Person"
          >
            <Select
              value={formData.contact_person_id || "none"}
              onValueChange={(v) => handleInputChange("contact_person_id", v === "none" ? "" : v)}
            >
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Select contact person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contact person</SelectItem>
                {contactPersons.map((cp) => (
                  <SelectItem key={cp.id} value={cp.id}>
                    {cp.name} {cp.position && `(${cp.position})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="Assigned To"
          >
            <Select
              value={formData.assigned_to || "none"}
              onValueChange={(v) => handleInputChange("assigned_to", v === "none" ? "" : v)}
            >
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </FormSection>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Link href={`/qmhq/${qmhqId}`}>
          <Button variant="outline" className="border-slate-700 text-slate-300">
            Cancel
          </Button>
        </Link>
        <Button
          onClick={handleSubmit}
          disabled={isSaving || !formData.line_name.trim()}
          className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
