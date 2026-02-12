"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  FileText,
  Building2,
  Users,
  AlertCircle,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { InlineCreateSelect } from "@/components/forms/inline-create-select";
import { FormSection, FormField, PageHeader } from "@/components/composite";
import type {
  QMRL,
  StatusConfig,
  Category,
  Department,
  ContactPerson,
  User as UserType,
} from "@/types/database";

type ContactPersonWithDepartment = ContactPerson & {
  departments: Pick<Department, "id" | "name"> | null;
};

const priorities = [
  { value: "low", label: "Low", class: "priority-tactical priority-tactical-low" },
  { value: "medium", label: "Medium", class: "priority-tactical priority-tactical-medium" },
  { value: "high", label: "High", class: "priority-tactical priority-tactical-high" },
  { value: "critical", label: "Critical", class: "priority-tactical priority-tactical-critical" },
];

export default function EditQMRLPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const qmrlId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [qmrl, setQmrl] = useState<QMRL | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    request_letter_no: "",
    category_id: "",
    priority: "medium",
    contact_person_id: "",
    assigned_to: "",
    status_id: "",
    description: "",
    notes: "",
  });
  const [requestDate, setRequestDate] = useState<Date | undefined>(undefined);

  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [contactPersons, setContactPersons] = useState<ContactPersonWithDepartment[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);

  // Get the selected contact person's department
  const selectedContactPerson = contactPersons.find(
    (cp) => cp.id === formData.contact_person_id
  );
  const selectedDepartment = selectedContactPerson?.departments;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch QMRL data
    const { data: qmrlData, error: qmrlError } = await supabase
      .from("qmrl")
      .select("*")
      .eq("id", qmrlId)
      .single();

    if (qmrlError || !qmrlData) {
      toast({
        title: "Error",
        description: "Failed to load QMRL data.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setQmrl(qmrlData);

    // Set form data from QMRL
    setFormData({
      title: qmrlData.title || "",
      request_letter_no: qmrlData.request_letter_no || "",
      category_id: qmrlData.category_id || "",
      priority: qmrlData.priority || "medium",
      contact_person_id: qmrlData.contact_person_id || "",
      assigned_to: qmrlData.assigned_to || "",
      status_id: qmrlData.status_id || "",
      description: qmrlData.description || "",
      notes: qmrlData.notes || "",
    });

    if (qmrlData.request_date) {
      setRequestDate(new Date(qmrlData.request_date));
    }

    // Fetch reference data
    const [categoryRes, statusRes, contactRes, userRes] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("entity_type", "qmrl")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("status_config")
        .select("*")
        .eq("entity_type", "qmrl")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("contact_persons")
        .select("*, departments(id, name)")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("users")
        .select("*")
        .eq("is_active", true)
        .order("full_name"),
    ]);

    if (categoryRes.data) setCategories(categoryRes.data);
    if (statusRes.data) setStatuses(statusRes.data);
    if (contactRes.data)
      setContactPersons(contactRes.data as ContactPersonWithDepartment[]);
    if (userRes.data) setUsers(userRes.data);

    setIsLoading(false);
  }, [qmrlId, toast]);

  useEffect(() => {
    if (qmrlId) {
      fetchData();
    }
  }, [qmrlId, fetchData]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Title is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.contact_person_id) {
      toast({
        title: "Validation Error",
        description: "Contact Person is required.",
        variant: "destructive",
      });
      return;
    }

    // Get department_id from selected contact person
    const contactPerson = contactPersons.find(
      (cp) => cp.id === formData.contact_person_id
    );
    const departmentId = contactPerson?.department_id;

    if (!departmentId) {
      toast({
        title: "Validation Error",
        description: "Selected contact person has no department assigned.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    const updateData = {
      title: formData.title.trim(),
      request_letter_no: formData.request_letter_no.trim() || null,
      category_id: formData.category_id || null,
      priority: formData.priority,
      department_id: departmentId,
      contact_person_id: formData.contact_person_id,
      request_date: requestDate ? requestDate.toISOString().split("T")[0] : null,
      assigned_to: formData.assigned_to || null,
      status_id: formData.status_id || null,
      description: formData.description.trim() || null,
      notes: formData.notes.trim() || null,
      updated_by: user?.id,
    };

    const { error } = await supabase
      .from("qmrl")
      .update(updateData)
      .eq("id", qmrlId);

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update QMRL.",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    toast({
      title: "Success",
      description: "Request letter updated successfully.",
      variant: "success",
    });

    router.push(`/qmrl/${qmrlId}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading QMRL data...
          </p>
        </div>
      </div>
    );
  }

  if (!qmrl) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-slate-400">QMRL not found.</p>
        <Link href="/qmrl">
          <Button variant="outline">Back to QMRL List</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/qmrl/${qmrlId}`}>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-amber-500/10 hover:text-amber-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader
          title="Edit Request Letter"
          description={<code className="text-amber-400">{qmrl.request_id}</code>}
        />
      </div>

      {/* Basic Information */}
      <FormSection
        title="Basic Information"
        icon={<FileText className="h-5 w-5 text-amber-400" />}
      >
        <FormField
          label="Title"
          htmlFor="title"
          required
        >
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange("title", e.target.value)}
            placeholder="Enter request title"
            className="bg-slate-800/50 border-slate-700 text-slate-200"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Request Letter No."
            htmlFor="request_letter_no"
          >
            <Input
              id="request_letter_no"
              value={formData.request_letter_no}
              onChange={(e) =>
                handleInputChange("request_letter_no", e.target.value)
              }
              placeholder="e.g., RL-2026-001"
              className="bg-slate-800/50 border-slate-700 text-slate-200 font-mono"
            />
          </FormField>

          <FormField
            label="Request Date"
          >
            <DatePicker
              date={requestDate}
              onDateChange={setRequestDate}
              placeholder="Select date"
            />
          </FormField>
        </div>

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
              entityType="qmrl"
              createType="category"
            />
          </FormField>

          <FormField
            label="Priority"
          >
            <Select
              value={formData.priority}
              onValueChange={(v) => handleInputChange("priority", v)}
            >
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <div className="flex items-center gap-2">
                      <span className={p.class}>{p.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>

        <FormField
          label="Status"
        >
          <InlineCreateSelect
            value={formData.status_id}
            onValueChange={(v) => handleInputChange("status_id", v)}
            options={statuses}
            onOptionsChange={setStatuses}
            placeholder="Select status"
            entityType="qmrl"
            createType="status"
          />
        </FormField>

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

      {/* Department & Contact */}
      <FormSection
        title="Department & Contact"
        icon={<Building2 className="h-5 w-5 text-amber-400" />}
      >
        <FormField
          label="Contact Person"
          required
        >
          <Select
            value={formData.contact_person_id || "none"}
            onValueChange={(v) =>
              handleInputChange("contact_person_id", v === "none" ? "" : v)
            }
          >
            <SelectTrigger className="bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Select contact person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select contact person</SelectItem>
              {contactPersons.map((cp) => (
                <SelectItem key={cp.id} value={cp.id}>
                  {cp.name} {cp.position && `(${cp.position})`}
                  {cp.departments && (
                    <span className="text-slate-400 ml-2">
                      - {cp.departments.name}
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {selectedDepartment && (
          <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">
              Department (auto-filled)
            </p>
            <Badge variant="outline" className="text-slate-300">
              <Building2 className="mr-1 h-3 w-3" />
              {selectedDepartment.name}
            </Badge>
          </div>
        )}
      </FormSection>

      {/* Assignment */}
      <FormSection
        title="Assignment"
        icon={<Users className="h-5 w-5 text-amber-400" />}
      >
        <FormField
          label="Assigned To"
        >
          <Select
            value={formData.assigned_to || "none"}
            onValueChange={(v) =>
              handleInputChange("assigned_to", v === "none" ? "" : v)
            }
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
      </FormSection>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Link href={`/qmrl/${qmrlId}`}>
          <Button variant="outline" className="border-slate-700 text-slate-300">
            Cancel
          </Button>
        </Link>
        <Button
          onClick={handleSubmit}
          disabled={isSaving || !formData.title.trim() || !formData.contact_person_id}
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
