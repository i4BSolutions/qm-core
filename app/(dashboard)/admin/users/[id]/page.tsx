"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Pencil,
  Shield,
  UserX,
  RotateCcw,
  Mail,
  Phone,
  Building2,
  Calendar,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { useResourcePermissions } from "@/lib/hooks/use-permissions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DetailPageLayout } from "@/components/composite";
import { UserDialog } from "../user-dialog";
import { DeactivateUserDialog } from "../deactivate-user-dialog";
import { PermissionsTab } from "../permissions-tab";
import type { User as UserType, Department } from "@/types/database";

type UserWithDepartment = UserType & {
  departments: Pick<Department, "id" | "name"> | null;
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { canEdit } = useResourcePermissions();
  const [userData, setUserData] = useState<UserWithDepartment | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const canUpdate = canEdit("admin");
  const canDelete = canEdit("admin");
  const isSelf = userData?.id === currentUser?.id;

  const fetchUser = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const [userRes, deptsRes] = await Promise.all([
      supabase
        .from("users")
        .select(
          "id, email, full_name, department_id, phone, is_active, created_at, updated_at, departments:departments!department_id(id, name)"
        )
        .eq("id", params.id as string)
        .single(),
      supabase
        .from("departments")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (userRes.error || !userRes.data) {
      toast({
        title: "Error",
        description: "User not found.",
        variant: "destructive",
      });
      router.push("/admin/users");
      return;
    }

    setUserData(userRes.data as UserWithDepartment);
    if (deptsRes.data) setDepartments(deptsRes.data as Department[]);
    setIsLoading(false);
  }, [params.id, toast, router]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleDeactivate = async (reason?: string) => {
    if (!userData) return;
    setIsDeactivating(true);

    try {
      const response = await fetch("/api/admin/deactivate-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userData.id,
          reason: reason || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to deactivate user");

      toast({
        title: "Success",
        description: "User deactivated successfully.",
        variant: "success",
      });
      setDeactivateDialogOpen(false);
      fetchUser();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to deactivate user.",
        variant: "destructive",
      });
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivate = async () => {
    if (!userData) return;
    if (!window.confirm(`Reactivate ${userData.full_name}? They will be able to log in again.`)) return;

    try {
      const response = await fetch("/api/admin/reactivate-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userData.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to reactivate user");

      toast({
        title: "Success",
        description: "User reactivated successfully.",
        variant: "success",
      });
      fetchUser();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reactivate user.",
        variant: "destructive",
      });
    }
  };

  const handleEditClose = (refresh?: boolean) => {
    setEditDialogOpen(false);
    if (refresh) fetchUser();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full max-w-2xl" />
        <Skeleton className="h-64 w-full max-w-4xl" />
      </div>
    );
  }

  if (!userData) return null;

  const isInactive = !userData.is_active;

  return (
    <>
      <DetailPageLayout
        backHref="/admin/users"
        backLabel="Back to Users"
        header={
          <div>
            <div className="flex items-center gap-3">
              <UserAvatar fullName={userData.full_name || "?"} size={48} />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-200">
                    {userData.full_name}
                  </h1>
                  {isInactive ? (
                    <Badge variant="outline" className="text-red-400 border-red-500/30">
                      Inactive
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400">{userData.email}</p>
              </div>
            </div>
          </div>
        }
        actions={
          canUpdate && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              {canDelete && !isInactive && !isSelf && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => setDeactivateDialogOpen(true)}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
              )}
              {canDelete && isInactive && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={handleReactivate}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reactivate
                </Button>
              )}
            </div>
          )
        }
      >
        <Tabs defaultValue="details" className="animate-slide-up">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="permissions">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Permissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <div className="command-panel corner-accents p-6 max-w-2xl">
              <div className="space-y-5">
                <DetailRow
                  icon={<Mail className="h-4 w-4 text-slate-500" />}
                  label="Email"
                  value={userData.email}
                />
                <DetailRow
                  icon={<Phone className="h-4 w-4 text-slate-500" />}
                  label="Phone"
                  value={userData.phone || "Not set"}
                  muted={!userData.phone}
                />
                <DetailRow
                  icon={<Building2 className="h-4 w-4 text-slate-500" />}
                  label="Department"
                  value={userData.departments?.name || "No department"}
                  muted={!userData.departments}
                />
                <DetailRow
                  icon={<Calendar className="h-4 w-4 text-slate-500" />}
                  label="Created"
                  value={
                    userData.created_at
                      ? new Date(userData.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Unknown"
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="mt-4">
            <div className="command-panel corner-accents p-6 max-w-4xl">
              <PermissionsTab
                userId={userData.id}
                userName={userData.full_name}
                isSelf={isSelf}
                onClose={() => {}}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DetailPageLayout>

      <UserDialog
        open={editDialogOpen}
        onClose={handleEditClose}
        user={userData}
        departments={departments}
        isCreateMode={false}
      />

      <DeactivateUserDialog
        open={deactivateDialogOpen}
        onOpenChange={setDeactivateDialogOpen}
        userName={userData.full_name || ""}
        onConfirm={handleDeactivate}
        isLoading={isDeactivating}
      />
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
  muted = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-sm ${muted ? "text-slate-500 italic" : "text-slate-200"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
