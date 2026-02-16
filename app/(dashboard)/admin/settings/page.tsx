"use client";

import { Settings } from "lucide-react";
import { PageHeader } from "@/components/composite";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Configure system-wide settings"
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-violet-500/10 border border-violet-500/20">
            <Settings className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-500">
              Admin
            </span>
          </div>
        }
      />

      {/* Info Card */}
      <div className="command-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-slate-200">
            No Configurable Settings
          </h2>
        </div>

        <p className="text-sm text-slate-400">
          System-wide settings are currently managed through entity-specific admin pages.
          Standard units and other configurations can be accessed from the Admin menu.
        </p>
      </div>
    </div>
  );
}
