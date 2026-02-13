"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useDebouncedValue } from "@/lib/hooks/use-search";

interface QmrlSuggestion {
  id: string;
  request_id: string;
  title: string;
  priority: string;
  status: { name: string; color: string } | null;
}

interface FlowSearchProps {
  defaultValue?: string;
}

export function FlowSearch({ defaultValue = "" }: FlowSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const debouncedValue = useDebouncedValue(value, 300);
  const [suggestions, setSuggestions] = useState<QmrlSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useCallback(
    (requestId: string) => {
      setShowDropdown(false);
      router.push(
        `/admin/flow-tracking?qmrl_id=${encodeURIComponent(requestId)}`
      );
    },
    [router]
  );

  // Fetch suggestions on debounced value change
  useEffect(() => {
    const query = debouncedValue.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;

    const fetchSuggestions = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("qmrl")
        .select(
          "id, request_id, title, priority, status:status_config(name, color)"
        )
        .eq("is_active", true)
        .or(`request_id.ilike.%${query}%,title.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(8);

      if (cancelled) return;

      setIsLoading(false);
      if (error) {
        console.error("Error fetching suggestions:", error);
        setSuggestions([]);
        return;
      }

      const results = (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        request_id: row.request_id as string,
        title: row.title as string,
        priority: row.priority as string,
        status: row.status as { name: string; color: string } | null,
      }));

      setSuggestions(results);
      setShowDropdown(true);
      setHighlightedIndex(-1);
    };

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [debouncedValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value.toUpperCase());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) navigate(trimmed);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          navigate(suggestions[highlightedIndex].request_id);
        } else {
          const trimmed = value.trim();
          if (trimmed) navigate(trimmed);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0 && value.trim().length >= 2) {
      setShowDropdown(true);
    }
  };

  const isSearching = value !== debouncedValue && value.trim().length >= 2;

  return (
    <div className="command-panel">
      <div className="relative flex-1 max-w-2xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {(isLoading || isSearching) && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400 animate-spin" />
        )}
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="Search QMRL by ID or title..."
          className="pl-10 pr-10 bg-slate-800/50 border-slate-700 focus:border-amber-500/50 font-mono text-sm"
          autoComplete="off"
        />

        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full rounded-md border border-slate-700 bg-slate-800 shadow-lg overflow-hidden"
          >
            {suggestions.length === 0 && !isLoading ? (
              <div className="px-4 py-3 text-sm text-slate-400">
                No matching QMRLs found
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {suggestions.map((item, index) => (
                  <li
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                      index === highlightedIndex
                        ? "bg-slate-700"
                        : "hover:bg-slate-700/50"
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(item.request_id);
                    }}
                  >
                    <span className="font-mono text-sm text-amber-400 shrink-0">
                      {item.request_id}
                    </span>
                    <span className="text-sm text-slate-300 truncate flex-1">
                      {item.title}
                    </span>
                    {item.status && (
                      <Badge
                        variant="outline"
                        className="font-mono uppercase tracking-wider text-[10px] shrink-0"
                        style={{
                          borderColor: item.status.color || undefined,
                          color: item.status.color || undefined,
                          backgroundColor: `${item.status.color}15`,
                        }}
                      >
                        {item.status.name}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
