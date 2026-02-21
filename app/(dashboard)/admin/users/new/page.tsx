"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Mail, User, Building2, Phone, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/client";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { FormSection, FormField, PageHeader } from "@/components/composite";
import {
  PERMISSION_RESOURCES,
  PERMISSION_LEVEL_LABELS,
} from "@/types/database";
import type {
  Department,
  PermissionResource,
  PermissionLevel,
} from "@/types/database";
import { useEffect } from "react";

export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    department_id: "",
    phone: "",
  });

  const [permissions, setPermissions] = useState<
    Partial<Record<PermissionResource, PermissionLevel>>
  >({});

  const configuredCount = PERMISSION_RESOURCES.filter(
    (r) => permissions[r] !== undefined
  ).length;

  useEffect(() => {
    const fetchDepartments = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (data) setDepartments(data as Department[]);
    };
    fetchDepartments();
  }, []);

  const handlePermissionChange = (resource: PermissionResource, level: PermissionLevel) => {
    setPermissions((prev) => ({ ...prev, [resource]: level }));
  };

  const handleSetAll = (level: PermissionLevel) => {
    const confirmed = window.confirm(
      `Set all 16 resources to "${PERMISSION_LEVEL_LABELS[level]}"? This will overwrite all current selections.`
    );
    if (confirmed) {
      const all: Partial<Record<PermissionResource, PermissionLevel>> = {};
      for (const resource of PERMISSION_RESOURCES) {
        all[resource] = level;
      }
      setPermissions(all);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const permissionsArray = PERMISSION_RESOURCES.map((resource) => ({
        resource,
        level: permissions[resource] as PermissionLevel,
      }));

      const response = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          full_name: formData.full_name,
          department_id: formData.department_id || null,
          phone: formData.phone || null,
          permissions: permissionsArray,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

      toast({
        title: "Success",
        description: `Invitation sent to "${formData.email}". They will receive an email to set up their account.`,
        variant: "success",
      });
      router.push("/admin/users");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled =
    isSubmitting ||
    !formData.email ||
    !formData.full_name ||
    configuredCount < 16;

  return (
    <div className="space-y-6 relative">
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

      <div className="relative flex items-start justify-between animate-fade-in">
        <div className="flex items-start gap-4">
          <Link href="/admin/users">
            <Button
              variant="ghost"
              size="icon"
              className="mt-1 hover:bg-amber-500/10 hover:text-amber-500"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-200">
              Create User
            </h1>
            <p className="mt-1 text-slate-400">
              Invite a new user and configure their permissions
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        <FormSection
          title="User Information"
          icon={<User className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Email" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="user@example.com"
                required
              />
            </FormField>

            <FormField label="Full Name" htmlFor="full_name" required>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </FormField>

            <FormField label="Department" htmlFor="department">
              <Select
                value={formData.department_id || "none"}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    department_id: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Phone" htmlFor="phone">
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 234 567 890"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title={
            <span className="flex items-center gap-2">
              Permissions
              <span
                className={`text-xs font-normal ${
                  configuredCount === 16
                    ? "text-emerald-400"
                    : "text-slate-400"
                }`}
              >
                ({configuredCount}/16 configured)
              </span>
            </span>
          }
          icon={<Shield className="h-4 w-4" />}
          animationDelay="0.1s"
        >
          <p className="text-xs text-slate-400 -mt-2">
            All 16 resources must be configured before the user can be created.
          </p>
          <PermissionMatrix
            mode="create"
            permissions={permissions}
            onChange={handlePermissionChange}
            onSetAll={handleSetAll}
          />
        </FormSection>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/users")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitDisabled}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
