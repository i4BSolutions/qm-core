"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, FileText, Building2, Users, ClipboardList, AlertCircle, Paperclip } from "lucide-react";
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
import { useStagedFiles } from "@/lib/hooks/use-staged-files";
import { FileDropzonePreview } from "@/components/files/file-dropzone-preview";
import { uploadFile } from "@/lib/actions/files";
import { FormSection, FormField, PageHeader } from "@/components/composite";
import type { StatusConfig, Category, Department, ContactPerson, User as UserType } from "@/types/database";

type ContactPersonWithDepartment = ContactPerson & {
  departments: Pick<Department, "id" | "name"> | null;
};

const priorities = [
  { value: "low", label: "Low", class: "priority-tactical priority-tactical-low" },
  { value: "medium", label: "Medium", class: "priority-tactical priority-tactical-medium" },
  { value: "high", label: "High", class: "priority-tactical priority-tactical-high" },
  { value: "critical", label: "Critical", class: "priority-tactical priority-tactical-critical" },
];

export default function NewQMRLPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    request_letter_no: "",
    category_id: "",
    priority: "medium",
    department_id: "",
    contact_person_id: "",
    assigned_to: "",
    status_id: "",
    description: "",
    notes: "",
  });
  const [requestDate, setRequestDate] = useState<Date | undefined>(new Date());

  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [contactPersons, setContactPersons] = useState<ContactPersonWithDepartment[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);

  // Staged files for upload after QMRL creation
  const { files: stagedFiles, addFiles, removeFile, getFilesForUpload } = useStagedFiles();

  // Get the selected contact person's department
  const selectedContactPerson = contactPersons.find(cp => cp.id === formData.contact_person_id);
  const selectedDepartment = selectedContactPerson?.departments;

  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data: categoryData } = await supabase
      .from("categories")
      .select("*")
      .eq("entity_type", "qmrl")
      .eq("is_active", true)
      .order("display_order");

    const { data: statusData } = await supabase
      .from("status_config")
      .select("*")
      .eq("entity_type", "qmrl")
      .eq("is_active", true)
      .order("display_order");

    // Fetch contact persons WITH their department info
    const { data: contactData } = await supabase
      .from("contact_persons")
      .select("*, departments(id, name)")
      .eq("is_active", true)
      .order("name");

    const { data: userData } = await supabase
      .from("users")
      .select("*")
      .eq("is_active", true)
      .order("full_name");

    if (categoryData) setCategories(categoryData);
    if (statusData) {
      setStatuses(statusData);
      const defaultStatus = statusData.find((s) => s.is_default);
      if (defaultStatus) {
        setFormData((prev) => ({ ...prev, status_id: defaultStatus.id }));
      }
    }
    if (contactData) setContactPersons(contactData as ContactPersonWithDepartment[]);
    if (userData) setUsers(userData);

    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.contact_person_id) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Title and Contact Person).",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create a request.",
        variant: "destructive",
      });
      return;
    }

    // Get department_id from selected contact person
    const contactPerson = contactPersons.find(cp => cp.id === formData.contact_person_id);
    const departmentId = contactPerson?.department_id;

    if (!departmentId) {
      toast({
        title: "Validation Error",
        description: "Selected contact person has no department assigned.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    const insertData = {
      title: formData.title,
      request_letter_no: formData.request_letter_no || null,
      category_id: formData.category_id || null,
      priority: formData.priority,
      department_id: departmentId,
      contact_person_id: formData.contact_person_id,
      request_date: requestDate ? requestDate.toISOString().split("T")[0] : null,
      assigned_to: formData.assigned_to || null,
      status_id: formData.status_id || null,
      description: formData.description || null,
      notes: formData.notes || null,
      requester_id: user.id,
      created_by: user.id,
    };

    const { data, error } = await supabase
      .from("qmrl")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to create request.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    // Upload staged files (non-blocking, graceful degradation)
    const filesToUpload = getFilesForUpload();
    if (filesToUpload.length > 0) {
      // Store intent for feedback on detail page
      sessionStorage.setItem(`pending-uploads-${data.id}`, JSON.stringify({
        total: filesToUpload.length,
        completed: 0,
        failed: 0,
      }));

      // Start uploads in background (don't await - navigate immediately)
      uploadStagedFilesSequentially(filesToUpload, data.id);
    }

    toast({
      title: "Success",
      description: filesToUpload.length > 0
        ? "Request letter created. Uploading files..."
        : "Request letter created successfully.",
      variant: "success",
    });

    router.push(`/qmrl/${data.id}`);
  };

  /**
   * Uploads files sequentially in background after QMRL creation.
   * Updates sessionStorage with progress for the detail page to read.
   */
  async function uploadStagedFilesSequentially(files: File[], entityId: string) {
    let completed = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await uploadFile(formData, 'qmrl', entityId);

        if (result.success) {
          completed++;
        } else {
          failed++;
          console.error(`Upload failed for ${file.name}:`, result.error);
        }
      } catch (error) {
        failed++;
        console.error(`Upload error for ${file.name}:`, error);
      }

      // Update sessionStorage with progress (detail page will read this)
      sessionStorage.setItem(`pending-uploads-${entityId}`, JSON.stringify({
        total: files.length,
        completed,
        failed,
      }));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading systems...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 relative">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

      {/* Header */}
      <div className="relative flex items-start gap-4 animate-fade-in">
        <Link href="/qmrl">
          <Button variant="ghost" size="icon" className="mt-1 hover:bg-amber-500/10 hover:text-amber-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader
          title="Create Request Letter"
          description="Initialize a new QMRL entry in the system"
          badge={
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <Plus className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
                New Entry
              </span>
            </div>
          }
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <FormSection
          title="Basic Information"
          icon={<FileText className="h-5 w-5 text-amber-400" />}
          animationDelay="100ms"
        >
          <FormField
            label="Request Title"
            htmlFor="title"
            required
          >
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter a clear, descriptive title for this request"
              className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 text-slate-200"
              required
            />
          </FormField>

          <FormField
            label="Request Letter No"
            htmlFor="request_letter_no"
            hint="External/physical request letter reference number"
          >
            <Input
              id="request_letter_no"
              value={formData.request_letter_no}
              onChange={(e) => setFormData({ ...formData, request_letter_no: e.target.value })}
              placeholder="External reference number (e.g., RL-2024-001)"
              className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 text-slate-200 max-w-md"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-6">
            <FormField
              label="Category"
              htmlFor="category"
              hint="Classification only — click [+] to create new"
            >
              <InlineCreateSelect
                value={formData.category_id}
                onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                options={categories}
                onOptionsChange={setCategories}
                placeholder="Select category"
                entityType="qmrl"
                createType="category"
              />
            </FormField>

            <FormField
              label="Priority Level"
              htmlFor="priority"
              required
            >
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <AlertCircle className={`h-3 w-3 ${
                          p.value === "critical" ? "text-red-400" :
                          p.value === "high" ? "text-amber-400" :
                          p.value === "medium" ? "text-blue-400" : "text-slate-400"
                        }`} />
                        {p.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </FormSection>

        {/* Section 2: Contact & Department */}
        <FormSection
          title="Contact & Department"
          icon={<Users className="h-5 w-5 text-amber-400" />}
          animationDelay="200ms"
        >
          <div className="grid grid-cols-2 gap-6">
            <FormField
              label="Contact Person"
              htmlFor="contact_person"
              required
              hint="Department will be set automatically"
            >
              <Select
                value={formData.contact_person_id}
                onValueChange={(value) => setFormData({ ...formData, contact_person_id: value })}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select contact person" />
                </SelectTrigger>
                <SelectContent>
                  {contactPersons.map((cp) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      <div className="flex items-center gap-2">
                        <span>{cp.name}</span>
                        {cp.position && <span className="text-slate-400">— {cp.position}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Department"
              hint="Based on contact person"
            >
              <div className="flex items-center h-10 px-3 rounded-lg border border-slate-700 bg-slate-800/30">
                {selectedDepartment ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-500" />
                    <span className="text-slate-200">{selectedDepartment.name}</span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">Select a contact person</span>
                )}
              </div>
            </FormField>
          </div>

          <FormField
            label="Request Date"
            htmlFor="request_date"
            required
            hint="Backdates allowed for late entries"
          >
            <div className="max-w-xs">
              <DatePicker
                date={requestDate}
                onDateChange={setRequestDate}
                placeholder="Select request date"
              />
            </div>
          </FormField>
        </FormSection>

        {/* Section 3: Assignment & Status */}
        <FormSection
          title="Assignment & Status"
          icon={<ClipboardList className="h-5 w-5 text-amber-400" />}
          animationDelay="300ms"
        >
          <div className="grid grid-cols-2 gap-6">
            <FormField
              label="Assigned To"
              htmlFor="assigned_to"
              hint="Current responsible person"
            >
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select responsible person" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}
                      {/* TODO Phase 62: role display replaced with permission label */}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Initial Status"
              htmlFor="status"
              hint="Click [+] to create new status"
            >
              <InlineCreateSelect
                value={formData.status_id}
                onValueChange={(value) => setFormData({ ...formData, status_id: value })}
                options={statuses}
                onOptionsChange={setStatuses}
                placeholder="Select status"
                entityType="qmrl"
                createType="status"
              />
            </FormField>
          </div>
        </FormSection>

        {/* Section 4: Description */}
        <FormSection
          title="Description & Notes"
          icon={<FileText className="h-5 w-5 text-amber-400" />}
          animationDelay="400ms"
        >
          <FormField
            label="Description"
            htmlFor="description"
          >
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide detailed description of the request, including specific requirements, quantities, or specifications..."
              className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 min-h-[120px]"
              rows={5}
            />
          </FormField>

          <FormField
            label="Internal Notes"
            htmlFor="notes"
          >
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes, references, or comments for internal use..."
              className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50"
              rows={3}
            />
          </FormField>
        </FormSection>

        {/* Section 5: Attachments */}
        <FormSection
          title="Attachments"
          icon={<Paperclip className="h-5 w-5 text-amber-400" />}
          animationDelay="500ms"
        >
          {stagedFiles.length > 0 && (
            <p className="text-xs text-slate-400">
              {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} selected
            </p>
          )}
          <FileDropzonePreview
            files={stagedFiles}
            onFilesAdd={addFiles}
            onFileRemove={removeFile}
            disabled={isSubmitting}
          />
          <p className="text-xs text-slate-400">
            Files will be uploaded after the request is created
          </p>
        </FormSection>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4 animate-slide-up" style={{ animationDelay: "600ms" }}>
          <Link href="/qmrl">
            <Button type="button" variant="outline" disabled={isSubmitting} className="border-slate-700 hover:bg-slate-800">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting || !formData.title || !formData.contact_person_id}
            className="min-w-[140px] bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create QMRL
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
