"use client";

import { X } from "lucide-react";

export interface FilterChip {
  key: string; // Filter key (e.g., 'fromDate', 'warehouseId')
  label: string; // Display label (e.g., 'From: 01/01/2026')
}

export interface FilterChipsProps {
  chips: FilterChip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
}

export function FilterChips({
  chips,
  onRemove,
  onClearAll,
}: FilterChipsProps) {
  // Return null if no chips
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <div
          key={chip.key}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm text-amber-400"
        >
          <span>{chip.label}</span>
          <button
            onClick={() => onRemove(chip.key)}
            className="hover:text-amber-300 transition-colors"
            aria-label={`Remove ${chip.label} filter`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {chips.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-sm text-slate-400 hover:text-amber-400 transition-colors px-2"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
