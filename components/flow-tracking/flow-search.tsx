"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
    <form onSubmit={handleSubmit} className="command-panel">
      <div className="relative flex-1 max-w-2xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="Enter QMRL ID (e.g., QMRL-2026-00001)"
          className="pl-10 bg-slate-800/50 border-slate-700 focus:border-amber-500/50 font-mono text-sm"
        />
      </div>
    </form>
  );
}
