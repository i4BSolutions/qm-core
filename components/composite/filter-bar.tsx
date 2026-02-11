"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export interface FilterBarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface FilterBarSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  icon?: React.ReactNode;
  width?: string;
}

function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("command-panel mb-6", className)}>
      <div className="flex flex-wrap items-center gap-4">
        {children}
      </div>
    </div>
  );
}

function FilterBarSearch({
  value,
  onChange,
  placeholder = "Search...",
}: FilterBarSearchProps) {
  return (
    <div className="relative flex-1 min-w-[240px] max-w-md">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 bg-slate-800/50 border-slate-700 focus:border-amber-500/50 font-mono text-sm"
      />
    </div>
  );
}

function FilterBarSelect({
  value,
  onChange,
  options,
  placeholder,
  icon,
  width = "w-[180px]",
}: FilterBarSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(width, "bg-slate-800/50 border-slate-700")}>
        {icon && <span className="mr-2">{icon}</span>}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

FilterBar.Search = FilterBarSearch;
FilterBar.Select = FilterBarSelect;

export { FilterBar };
