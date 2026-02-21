"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PERMISSION_RESOURCES,
  PERMISSION_RESOURCE_LABELS,
  PERMISSION_LEVEL_LABELS,
} from "@/types/database";
import type { PermissionResource, PermissionLevel } from "@/types/database";

interface PermissionMatrixProps {
  /**
   * Current permission state for all resources.
   * In edit mode, all 16 resources must have a value.
   * In create mode, missing keys are treated as "unset" (no radio selected).
   */
  permissions: Record<PermissionResource, PermissionLevel> | Partial<Record<PermissionResource, PermissionLevel>>;
  /** Called when a single radio button changes */
  onChange: (resource: PermissionResource, level: PermissionLevel) => void;
  /**
   * If provided, clicking a Set All button calls this with the chosen level.
   * The parent is responsible for showing a confirmation dialog and bulk update.
   * If not provided, falls back to calling onChange for every resource.
   */
  onSetAll?: (level: PermissionLevel) => void;
  /** Resources that have been modified since last save */
  dirtyResources?: Set<PermissionResource>;
  /** Resources whose radio buttons should be disabled (lockout prevention) */
  disabledResources?: Set<PermissionResource>;
  /** Tooltip text shown on hover for disabled rows */
  disabledTooltip?: string;
  /** edit = existing user (all rows should have a value), create = new user (unset allowed) */
  mode: "edit" | "create";
}

const LEVELS: PermissionLevel[] = ["edit", "view", "block"];

export function PermissionMatrix({
  permissions,
  onChange,
  onSetAll,
  dirtyResources = new Set(),
  disabledResources = new Set(),
  disabledTooltip = "This permission cannot be changed",
  mode,
}: PermissionMatrixProps) {
  const handleSetAll = (level: PermissionLevel) => {
    if (onSetAll) {
      onSetAll(level);
    } else {
      // Fallback: call onChange for every non-disabled resource
      for (const resource of PERMISSION_RESOURCES) {
        if (!disabledResources.has(resource)) {
          onChange(resource, level);
        }
      }
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Set All buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">Set all:</span>
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => handleSetAll(level)}
              className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors
                ${
                  level === "block"
                    ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                    : level === "edit"
                    ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                    : "border-slate-600 text-slate-400 hover:bg-slate-700/50"
                }
              `}
            >
              {PERMISSION_LEVEL_LABELS[level]}
            </button>
          ))}
        </div>

        {/* Matrix table */}
        <div className="overflow-x-auto rounded-lg border border-slate-700/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider w-full">
                  Resource
                </th>
                {LEVELS.map((level) => (
                  <th
                    key={level}
                    className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-center min-w-[80px]
                      ${level === "block" ? "text-red-400" : "text-slate-400"}
                    `}
                  >
                    {PERMISSION_LEVEL_LABELS[level]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {PERMISSION_RESOURCES.map((resource) => {
                const isDirty = dirtyResources.has(resource);
                const isDisabled = disabledResources.has(resource);
                const currentLevel = permissions[resource];
                const isUnset = mode === "create" && !currentLevel;

                const row = (
                  <tr
                    key={resource}
                    className={`
                      transition-colors
                      ${isDirty ? "bg-amber-500/5 border-l-2 border-l-amber-500" : "hover:bg-slate-800/40"}
                      ${isDisabled ? "opacity-60" : ""}
                      ${isUnset ? "opacity-70" : ""}
                    `}
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-slate-300 font-medium">
                        {PERMISSION_RESOURCE_LABELS[resource]}
                      </span>
                      {isDirty && (
                        <span className="ml-2 inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
                      )}
                    </td>
                    {LEVELS.map((level) => (
                      <td key={level} className="px-4 py-2.5 text-center">
                        <input
                          type="radio"
                          name={`perm-${resource}`}
                          value={level}
                          checked={currentLevel === level}
                          onChange={() => onChange(resource, level)}
                          disabled={isDisabled}
                          className={`h-4 w-4 cursor-pointer
                            ${isDisabled ? "cursor-not-allowed opacity-50" : ""}
                            ${
                              level === "block"
                                ? "accent-red-500"
                                : level === "edit"
                                ? "accent-emerald-500"
                                : "accent-slate-400"
                            }
                          `}
                        />
                      </td>
                    ))}
                  </tr>
                );

                if (isDisabled && disabledTooltip) {
                  return (
                    <Tooltip key={resource}>
                      <TooltipTrigger asChild>
                        {row}
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        {disabledTooltip}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return row;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
