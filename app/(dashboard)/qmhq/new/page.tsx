"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  FileText,
  Users,
  ClipboardList,
  Package,
  Wallet,
  ShoppingCart,
  Check,
  AlertCircle,
  Lock,
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
import { InlineCreateSelect } from "@/components/forms/inline-create-select";
import type { StatusConfig, Category, ContactPerson, User as UserType, QMRL } from "@/types/database";

// Route type configuration
const routeOptions = [
  {
    value: "item",
    label: "Item Route",
    icon: Package,
    color: "blue",
    description: "Request items from warehouse inventory",
    details: ["Select item from catalog", "Specify quantity needed", "Check warehouse availability"],
  },
  {
    value: "expense",
    label: "Expense Route",
    icon: Wallet,
    color: "emerald",
    description: "Direct money in/out transactions",
    details: ["Track money received", "Record expenses paid", "Automatic EUSD conversion"],
  },
  {
    value: "po",
    label: "PO Route",
    icon: ShoppingCart,
    color: "purple",
    description: "Procurement via Purchase Orders",
    details: ["Set budget allocation", "Create Purchase Orders", "Track balance in hand"],
  },
];

function NewQMHQContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isQmrlLocked, setIsQmrlLocked] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    line_name: "",
    description: "",
    notes: "",
    qmrl_id: "",
    category_id: "",
    status_id: "",
    contact_person_id: "",
    assigned_to: "",
    route_type: "",
  });

  // Reference data
  const [qmrls, setQmrls] = useState<Pick<QMRL, "id" | "request_id" | "title">[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<StatusConfig[]>([]);
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);

  useEffect(() => {
    // Check if QMRL is pre-selected from query param (coming from QMRL detail page)
    const qmrlParam = searchParams.get("qmrl");

    // Load any saved draft data from sessionStorage (when navigating back from step 2)
    const savedDraft = sessionStorage.getItem("qmhq_draft");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        // If there's a qmrl param, it takes precedence and locks the field
        if (qmrlParam) {
          setFormData({ ...parsed, qmrl_id: qmrlParam });
          setIsQmrlLocked(true);
        } else {
          setFormData(parsed);
        }
      } catch (e) {
        // Invalid data, ignore
        if (qmrlParam) {
          setFormData((prev) => ({ ...prev, qmrl_id: qmrlParam }));
          setIsQmrlLocked(true);
        }
      }
    } else if (qmrlParam) {
      // No draft, but qmrl param exists - pre-fill and lock
      setFormData((prev) => ({ ...prev, qmrl_id: qmrlParam }));
      setIsQmrlLocked(true);
    }

    fetchReferenceData();
  }, [searchParams]);

  const fetchReferenceData = async () => {
    setIsLoading(true);
    const supabase = createClient();

    const [qmrlRes, categoryRes, statusRes, contactRes, userRes] = await Promise.all([
      supabase
        .from("qmrl")
        .select("id, request_id, title")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100),
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
        .select("id, full_name, role")
        .neq("is_active", false)
        .order("full_name"),
    ]);

    if (qmrlRes.data) setQmrls(qmrlRes.data);
    if (categoryRes.data) setCategories(categoryRes.data as Category[]);
    if (statusRes.data) {
      setStatuses(statusRes.data as StatusConfig[]);
      const defaultStatus = statusRes.data.find((s) => s.is_default);
      if (defaultStatus) {
        setFormData((prev) => ({ ...prev, status_id: defaultStatus.id }));
      }
    }
    if (contactRes.data) setContactPersons(contactRes.data as ContactPerson[]);
    if (userRes.data) setUsers(userRes.data as UserType[]);

    setIsLoading(false);
  };

  const handleNext = () => {
    // Validation
    if (!formData.line_name) {
      toast({
        title: "Validation Error",
        description: "Please enter a line name.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.qmrl_id) {
      toast({
        title: "Validation Error",
        description: "Please select a parent QMRL.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.route_type) {
      toast({
        title: "Validation Error",
        description: "Please select a route type.",
        variant: "destructive",
      });
      return;
    }

    // Store form data in sessionStorage for page 2
    sessionStorage.setItem("qmhq_draft", JSON.stringify(formData));

    // Navigate to route-specific page
    router.push(`/qmhq/new/${formData.route_type}`);
  };

  const getRouteCardClasses = (routeValue: string) => {
    const isSelected = formData.route_type === routeValue;
    const route = routeOptions.find((r) => r.value === routeValue);

    const baseClasses =
      "relative p-5 rounded-lg border-2 cursor-pointer transition-all duration-200 group";

    if (isSelected) {
      switch (route?.color) {
        case "blue":
          return `${baseClasses} border-blue-500 bg-blue-500/10`;
        case "emerald":
          return `${baseClasses} border-emerald-500 bg-emerald-500/10`;
        case "purple":
          return `${baseClasses} border-purple-500 bg-purple-500/10`;
        default:
          return `${baseClasses} border-amber-500 bg-amber-500/10`;
      }
    }

    return `${baseClasses} border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50`;
  };

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
        <Link href="/qmhq">
          <Button variant="ghost" size="icon" className="mt-1 hover:bg-amber-500/10 hover:text-amber-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
                Step 1 of 2
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-200">
            Create QMHQ Line
          </h1>
          <p className="mt-1 text-slate-400">
            Basic information and route selection
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="section-header">
            <FileText className="h-4 w-4 text-amber-500" />
            <h2>Basic Information</h2>
          </div>

          <div className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="line_name" className="data-label">
                Line Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="line_name"
                value={formData.line_name}
                onChange={(e) => setFormData({ ...formData, line_name: e.target.value })}
                placeholder="Enter a descriptive name for this QMHQ line"
                className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 text-slate-200"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="qmrl_id" className="data-label flex items-center gap-2">
                Parent QMRL <span className="text-red-400">*</span>
                {isQmrlLocked && (
                  <span className="flex items-center gap-1 text-xs text-amber-500 font-normal">
                    <Lock className="h-3 w-3" />
                    Locked
                  </span>
                )}
              </Label>
              <Select
                value={formData.qmrl_id}
                onValueChange={(value) => setFormData({ ...formData, qmrl_id: value })}
                disabled={isQmrlLocked}
              >
                <SelectTrigger className={`bg-slate-800/50 border-slate-700 ${isQmrlLocked ? "opacity-70 cursor-not-allowed" : ""}`}>
                  <SelectValue placeholder="Select parent request letter" />
                </SelectTrigger>
                <SelectContent>
                  {qmrls.map((qmrl) => (
                    <SelectItem key={qmrl.id} value={qmrl.id}>
                      <div className="flex items-center gap-2">
                        <code className="text-amber-400 text-xs">{qmrl.request_id}</code>
                        <span className="text-slate-300 truncate max-w-[300px]">
                          {qmrl.title}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                {isQmrlLocked
                  ? "This QMHQ is being created from the parent QMRL"
                  : "This QMHQ will be linked to the selected QMRL"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label htmlFor="category" className="data-label">Category</Label>
                <InlineCreateSelect
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  options={categories}
                  onOptionsChange={setCategories}
                  placeholder="Select category"
                  entityType="qmhq"
                  createType="category"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status" className="data-label">Initial Status</Label>
                <InlineCreateSelect
                  value={formData.status_id}
                  onValueChange={(value) => setFormData({ ...formData, status_id: value })}
                  options={statuses}
                  onOptionsChange={setStatuses}
                  placeholder="Select status"
                  entityType="qmhq"
                  createType="status"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Assignment */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="section-header">
            <Users className="h-4 w-4 text-amber-500" />
            <h2>Assignment</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="grid gap-2">
              <Label htmlFor="contact_person_id" className="data-label">Contact Person</Label>
              <Select
                value={formData.contact_person_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, contact_person_id: value === "none" ? "" : value })}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select contact person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-slate-400">None selected</span>
                  </SelectItem>
                  {contactPersons.map((cp) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-200">{cp.name}</span>
                        {cp.position && <span className="text-slate-400">— {cp.position}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assigned_to" className="data-label">Assigned To</Label>
              <Select
                value={formData.assigned_to || "none"}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value === "none" ? "" : value })}
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700">
                  <SelectValue placeholder="Select responsible person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-slate-400">None selected</span>
                  </SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="text-slate-200">{u.full_name}</span>
                      {u.role && <span className="text-slate-400 ml-2">— {u.role}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 3: Description */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "300ms" }}>
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
                placeholder="Detailed description of this line item..."
                className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 min-h-[100px] text-slate-200"
                rows={4}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes" className="data-label">Internal Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes for internal reference..."
                className="bg-slate-800/50 border-slate-700 focus:border-amber-500/50 text-slate-200"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Route Selection */}
        <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "400ms" }}>
          <div className="section-header">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <h2>Select Route Type <span className="text-red-400">*</span></h2>
          </div>

          <p className="text-sm text-slate-400 mb-6">
            Choose how this QMHQ line will be processed. This determines the workflow and fields available.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {routeOptions.map((route) => {
              const Icon = route.icon;
              const isSelected = formData.route_type === route.value;

              return (
                <div
                  key={route.value}
                  onClick={() => setFormData({ ...formData, route_type: route.value })}
                  className={getRouteCardClasses(route.value)}
                >
                  {/* Selection indicator */}
                  {isSelected && (
                    <div
                      className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center ${
                        route.color === "blue"
                          ? "bg-blue-500"
                          : route.color === "emerald"
                          ? "bg-emerald-500"
                          : "bg-purple-500"
                      }`}
                    >
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                      route.color === "blue"
                        ? "bg-blue-500/20"
                        : route.color === "emerald"
                        ? "bg-emerald-500/20"
                        : "bg-purple-500/20"
                    }`}
                  >
                    <Icon
                      className={`h-6 w-6 ${
                        route.color === "blue"
                          ? "text-blue-400"
                          : route.color === "emerald"
                          ? "text-emerald-400"
                          : "text-purple-400"
                      }`}
                    />
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-slate-200 mb-2">{route.label}</h3>

                  {/* Description */}
                  <p className="text-sm text-slate-400 mb-4">{route.description}</p>

                  {/* Details list */}
                  <ul className="space-y-1.5">
                    {route.details.map((detail, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-slate-400">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            route.color === "blue"
                              ? "bg-blue-500"
                              : route.color === "emerald"
                              ? "bg-emerald-500"
                              : "bg-purple-500"
                          }`}
                        />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 animate-slide-up" style={{ animationDelay: "500ms" }}>
          <Link href="/qmhq">
            <Button type="button" variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-300">
              Cancel
            </Button>
          </Link>

          <Button
            onClick={handleNext}
            disabled={!formData.line_name || !formData.qmrl_id || !formData.route_type}
            className="min-w-[160px] bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
          >
            Next: Route Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewQMHQPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>}>
      <NewQMHQContent />
    </Suspense>
  );
}
