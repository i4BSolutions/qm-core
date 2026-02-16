"use client";

import { useState, useMemo } from "react";
import { Plus, X, Loader2, Search, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Color presets for quick selection
const colorPresets = [
  { value: "#3B82F6", label: "Blue" },
  { value: "#10B981", label: "Green" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#8B5CF6", label: "Purple" },
  { value: "#EF4444", label: "Red" },
  { value: "#6B7280", label: "Gray" },
  { value: "#EC4899", label: "Pink" },
  { value: "#14B8A6", label: "Teal" },
];

interface BaseOption {
  id: string;
  name: string;
  color?: string | null;
}

interface InlineCreateSelectProps<T extends BaseOption> {
  value: string;
  onValueChange: (value: string) => void;
  options: T[];
  onOptionsChange: (options: T[]) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  // For creation
  entityType: "qmrl" | "qmhq" | "item";
  createType: "category" | "status" | "standard_unit";
  // For status creation only
  statusGroup?: "to_do" | "in_progress" | "done";
}

export function InlineCreateSelect<T extends BaseOption>({
  value,
  onValueChange,
  options,
  onOptionsChange,
  placeholder = "Select...",
  label,
  required,
  disabled,
  entityType,
  createType,
  statusGroup,
}: InlineCreateSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [newStatusGroup, setNewStatusGroup] = useState<"to_do" | "in_progress" | "done">(
    statusGroup || "to_do"
  );
  const { toast } = useToast();

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) => option.name.toLowerCase().includes(query));
  }, [options, searchQuery]);

  // Get selected option for display
  const selectedOption = options.find((opt) => opt.id === value);

  const handleSelect = (optionId: string) => {
    onValueChange(optionId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      if (createType === "category") {
        const { data, error } = await supabase
          .from("categories")
          .insert({
            entity_type: entityType,
            name: newName.trim(),
            color: newColor,
            display_order: options.length + 1,
          })
          .select()
          .single();

        if (error) throw error;

        // Add to options and select it
        onOptionsChange([...options, data as unknown as T]);
        onValueChange(data.id);

        toast({
          title: "Success",
          description: `Category "${newName}" created and selected`,
          variant: "success",
        });
      } else if (createType === "status") {
        // Status creation
        const { data, error } = await supabase
          .from("status_config")
          .insert({
            entity_type: entityType,
            name: newName.trim(),
            color: newColor,
            status_group: newStatusGroup,
            display_order: options.length + 1,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;

        // Add to options and select it
        onOptionsChange([...options, data as unknown as T]);
        onValueChange(data.id);

        toast({
          title: "Success",
          description: `Status "${newName}" created and selected`,
          variant: "success",
        });
      } else if (createType === "standard_unit") {
        // Standard unit creation
        // Get max display_order for auto-append
        const { data: maxOrderData } = await supabase
          .from("standard_units" as any)
          .select("display_order")
          .order("display_order", { ascending: false })
          .limit(1)
          .single();

        const nextOrder = ((maxOrderData as any)?.display_order ?? 0) + 1;

        const { data, error } = await supabase
          .from("standard_units" as any)
          .insert({
            name: newName.trim(),
            display_order: nextOrder,
          })
          .select()
          .single();

        if (error) throw error;

        // Add to options and select it
        onOptionsChange([...options, data as unknown as T]);
        onValueChange((data as any).id);

        toast({
          title: "Success",
          description: `Unit "${newName}" created and selected`,
          variant: "success",
        });
      }

      // Reset form and close
      setNewName("");
      setNewColor("#3B82F6");
      setIsCreating(false);
      setIsOpen(false);
      setSearchQuery("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || `Failed to create ${createType}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewName("");
    setNewColor("#3B82F6");
  };

  return (
    <div className="space-y-2">
      {/* Searchable Select with [+] button */}
      <div className="flex gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={isOpen}
              disabled={disabled || isCreating}
              className={cn(
                "flex-1 justify-between bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-amber-500/50",
                !value && "text-slate-400"
              )}
            >
              {selectedOption ? (
                <div className="flex items-center gap-2">
                  {selectedOption.color && (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selectedOption.color }}
                    />
                  )}
                  <span className="text-slate-200">{selectedOption.name}</span>
                </div>
              ) : (
                <span>{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0 bg-slate-900 border-slate-700" align="start">
            {/* Search Input */}
            <div className="flex items-center border-b border-slate-700 px-3">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${createType === "category" ? "category" : createType === "status" ? "status" : "unit"}...`}
                className="flex h-10 w-full bg-transparent py-3 px-2 text-sm text-slate-200 placeholder:text-slate-400 outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="max-h-[200px] overflow-y-auto p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">
                  {searchQuery ? `No ${createType} found` : `No ${createType} available`}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(option.id)}
                    className={cn(
                      "relative flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors",
                      "hover:bg-slate-800 hover:text-slate-100",
                      value === option.id
                        ? "bg-amber-500/10 text-amber-500"
                        : "text-slate-300"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.color && (
                      <span
                        className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    <span>{option.name}</span>
                  </button>
                ))
              )}
            </div>

            {/* Create New Hint */}
            <div className="border-t border-slate-700 p-2">
              <p className="text-xs text-slate-500 text-center">
                Click [+] button to create new {createType === "category" ? "category" : createType === "status" ? "status" : "unit"}
              </p>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsCreating(!isCreating)}
          disabled={disabled || isSubmitting}
          className="border-slate-700 hover:border-amber-500/50 hover:bg-amber-500/10"
          title={`Create new ${createType}`}
        >
          {isCreating ? (
            <X className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Inline creation form */}
      {isCreating && (
        <div className="p-4 rounded-lg border border-amber-500/30 bg-slate-800/50 space-y-4 animate-slide-up">
          <div className="flex items-center gap-2 text-amber-500 text-sm font-medium">
            <Plus className="h-4 w-4" />
            <span>Create New {createType === "category" ? "Category" : createType === "status" ? "Status" : "Unit"}</span>
          </div>

          <div className="grid gap-4">
            {/* Name input */}
            <div className="grid gap-2">
              <Label htmlFor="inline-name" className="text-xs text-slate-400">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="inline-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`Enter ${createType} name`}
                className="bg-slate-900/50 border-slate-700 focus:border-amber-500/50"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {/* Status group selector (only for status creation) */}
            {createType === "status" && !statusGroup && (
              <div className="grid gap-2">
                <Label className="text-xs text-slate-400">Status Group</Label>
                <Select
                  value={newStatusGroup}
                  onValueChange={(v) => setNewStatusGroup(v as typeof newStatusGroup)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_do">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        To Do
                      </div>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        In Progress
                      </div>
                    </SelectItem>
                    <SelectItem value="done">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Done
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Color picker (not for standard_unit) */}
            {createType !== "standard_unit" && (
              <div className="grid gap-2">
                <Label className="text-xs text-slate-400">Color</Label>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setNewColor(color.value)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        newColor === color.value
                          ? "border-white scale-110"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={isSubmitting || !newName.trim()}
              className="bg-amber-600 hover:bg-amber-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create & Select
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
