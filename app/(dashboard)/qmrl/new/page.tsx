"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, FileText, Building2, Users, ClipboardList, AlertCircle } from "lucide-react";
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
import type { StatusConfig, Category, Department, ContactPerson, User as UserType } from "@/types/database";

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
    category_id: "",
    priority: "medium",
    department_id: "",
    contact_person_id: "",
    request_date: new Date().toISOString().split("T")[0],
    assigned_to: "",
    status_id: "",
    description: "",
    notes: "",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);

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

    const { data: deptData } = await supabase
      .from("departments")
      .select("*")
      .eq("is_active", true)
      .order("name");

    const { data: contactData } = await supabase
      .from("contact_persons")
      .select("*")
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
    if (deptData) setDepartments(deptData);
    if (contactData) setContactPersons(contactData);
    if (userData) setUsers(userData);

    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.department_id) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
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

    setIsSubmitting(true);
    const supabase = createClient();

    const insertData = {
      title: formData.title,
      category_id: formData.category_id || null,
      priority: formData.priority,
      department_id: formData.department_id,
      contact_person_id: formData.contact_person_id || null,
      request_date: formData.request_date,
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

    toast({
      title: "Success",
      description: "Request letter created successfully.",
      variant: "success",
    });

    router.push(`/qmrl/${data.id}`);
  };

  const filteredContactPersons = formData.department_id
    ? contactPersons.filter((cp) => cp.department_id === formData.department_id)
    : contactPersons;

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
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <Plus className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
                New Entry
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-200">
            Create Request Letter
          </h1>
          <p className="mt-1 text-slate-400">
            Initialize a new QMRL entry in the system
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="section-header">
            <FileText className="h-4 w-4 text-amber-500" />
            <h2>Basic Information</h2>
          </div>

          <div className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="title" className="data-label">
                Request Title <span className="text-red-400">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter a clear, descriptive title for this request"
                className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 text-slate-200"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label htmlFor="category" className="data-label">Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          {cat.color && (
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          )}
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">Classification only</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priority" className="data-label">
                  Priority Level <span className="text-red-400">*</span>
                </Label>
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
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Department & Contacts */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="section-header">
            <Building2 className="h-4 w-4 text-amber-500" />
            <h2>Department & Contacts</h2>
          </div>

          <div className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="department" className="data-label">
                Department <span className="text-red-400">*</span>
              </Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    department_id: value,
                    contact_person_id: "",
                  })
                }
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select requesting department" />
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

            <div className="grid grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label htmlFor="contact_person" className="data-label">Contact Person</Label>
                <Select
                  value={formData.contact_person_id}
                  onValueChange={(value) => setFormData({ ...formData, contact_person_id: value })}
                  disabled={!formData.department_id}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue placeholder={formData.department_id ? "Select contact" : "Select department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredContactPersons.map((cp) => (
                      <SelectItem key={cp.id} value={cp.id}>
                        {cp.name}
                        {cp.position && <span className="text-slate-400 ml-2">— {cp.position}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="request_date" className="data-label">
                  Request Date <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="request_date"
                  type="date"
                  value={formData.request_date}
                  onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 font-mono"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Assignment & Status */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "300ms" }}>
          <div className="section-header">
            <Users className="h-4 w-4 text-amber-500" />
            <h2>Assignment & Status</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="grid gap-2">
              <Label htmlFor="assigned_to" className="data-label">Assigned To</Label>
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
                      {u.role && <span className="text-slate-400 ml-2">— {u.role}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">Current responsible person</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status" className="data-label">Initial Status</Label>
              <Select
                value={formData.status_id}
                onValueChange={(value) => setFormData({ ...formData, status_id: value })}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        {s.color && (
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        )}
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 4: Description */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "400ms" }}>
          <div className="section-header">
            <ClipboardList className="h-4 w-4 text-amber-500" />
            <h2>Description & Notes</h2>
          </div>

          <div className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="description" className="data-label">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Provide detailed description of the request, including specific requirements, quantities, or specifications..."
                className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 min-h-[120px]"
                rows={5}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes" className="data-label">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes, references, or comments for internal use..."
                className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4 animate-slide-up" style={{ animationDelay: "500ms" }}>
          <Link href="/qmrl">
            <Button type="button" variant="outline" disabled={isSubmitting} className="border-slate-700 hover:bg-slate-800">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isSubmitting || !formData.title || !formData.department_id}
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
