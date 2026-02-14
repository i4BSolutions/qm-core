"use client";

import { useEffect, useState, useCallback } from "react";
import { Ruler, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/composite";
import { useUser } from "@/components/providers/auth-provider";

export default function AdminSettingsPage() {
  const [unitName, setUnitName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { can } = usePermissions();
  const { user } = useUser();

  // Permission check: use "update" on "statuses" as proxy for admin-only access
  const canUpdate = can("update", "statuses");

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "standard_unit_name")
      .single();

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load configuration.",
        variant: "destructive",
      });
    } else if (data) {
      setUnitName(data.value);
    }

    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("system_config")
      .update({
        value: unitName,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("key", "standard_unit_name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save configuration.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Standard unit name updated successfully.",
        variant: "success",
      });
    }

    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure system-wide settings"
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-violet-500/10 border border-violet-500/20">
            <Ruler className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-500">
              Admin
            </span>
          </div>
        }
      />

      {/* Standard Unit Configuration Card */}
      <div className="command-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <Ruler className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-slate-200">
            Standard Unit Configuration
          </h2>
        </div>

        <p className="text-sm text-slate-400 mb-6">
          Configure the display name for the system-wide standard unit. This name appears
          alongside all quantity displays (e.g., &quot;Standard Units&quot;, &quot;SU&quot;, &quot;Base Units&quot;).
        </p>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-10 bg-slate-800 animate-pulse rounded" />
            <div className="h-10 bg-slate-800 animate-pulse rounded w-32" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unit-name">Standard Unit Name</Label>
              <Input
                id="unit-name"
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="e.g., Standard Units, SU, Base Units"
                disabled={!canUpdate}
                className="max-w-md"
              />
            </div>

            {/* Preview */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-slate-300 font-medium mb-1">Preview</p>
                <p className="text-sm text-slate-400">
                  Quantities will display as:{" "}
                  <span className="font-mono text-slate-200">120.00 {unitName || "—"}</span>
                </p>
              </div>
            </div>

            {/* Save Button */}
            {canUpdate ? (
              <Button
                onClick={handleSave}
                disabled={isSaving || !unitName.trim()}
                className="mt-2"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Info className="h-4 w-4" />
                <span>You do not have permission to modify settings.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
