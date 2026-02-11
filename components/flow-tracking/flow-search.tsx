"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

interface FlowSearchProps {
  defaultValue?: string;
}

export function FlowSearch({ defaultValue = "" }: FlowSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = value.trim();
    if (trimmedValue) {
      router.push(
        `/admin/flow-tracking?qmrl_id=${encodeURIComponent(trimmedValue)}`
      );
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Auto-uppercase for QMRL ID format
    setValue(e.target.value.toUpperCase());
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Enter QMRL ID (e.g., QMRL-2026-00001)"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
        />
      </div>
    </form>
  );
}
