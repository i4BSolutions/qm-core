"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { InlineCreateSelect } from "@/components/forms/inline-create-select";
import { ImageIcon, X, Loader2 } from "lucide-react";
import type { Item, Category, StandardUnit } from "@/types/database";

interface ItemDialogProps {
  open: boolean;
  onClose: (refresh?: boolean, newItem?: Item) => void;
  item: Item | null;
}

export function ItemDialog({ open, onClose, item }: ItemDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [standardUnits, setStandardUnits] = useState<StandardUnit[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    standard_unit_id: "",
    price_reference: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch categories and standard units on mount
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("*")
        .eq("entity_type", "item")
        .eq("is_active", true)
        .order("display_order");

      if (categoriesData) {
        setCategories(categoriesData);
      }

      // Fetch standard units
      const { data: unitsData } = await supabase
        .from("standard_units" as any)
        .select("id, name, display_order")
        .order("display_order");

      if (unitsData) {
        setStandardUnits(unitsData as unknown as StandardUnit[]);
      }
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || "",
        category_id: item.category_id || "",
        standard_unit_id: item.standard_unit_id || "",
        price_reference: item.price_reference || "",
      });
      setExistingPhotoUrl(item.photo_url || null);
      setPhotoPreview(item.photo_url || null);
      setPhotoFile(null);
    } else {
      setFormData({
        name: "",
        category_id: "",
        standard_unit_id: "",
        price_reference: "",
      });
      setExistingPhotoUrl(null);
      setPhotoPreview(null);
      setPhotoFile(null);
    }
    setHasChanges(false);
  }, [item, open]);

  // Track changes
  useEffect(() => {
    if (!open) return;

    const initialEmpty = !item && !formData.name && !formData.category_id && !formData.standard_unit_id && !formData.price_reference && !photoFile;
    const hasEdits = !!(formData.name || formData.category_id || formData.standard_unit_id || formData.price_reference || photoFile);

    setHasChanges(!initialEmpty && hasEdits);
  }, [formData, photoFile, item, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Invalid File",
          description: "Please select an image file (JPG, PNG, etc.)",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      setPhotoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setExistingPhotoUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return existingPhotoUrl;

    const formData = new FormData();
    formData.append("file", photoFile);
    formData.append("folder", "items");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to upload photo");
    }

    const data = await response.json();
    return data.url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const supabase = createClient();

    try {
      // Upload photo if new file selected
      let photoUrl: string | null = existingPhotoUrl;
      if (photoFile) {
        photoUrl = await uploadPhoto();
      } else if (!photoPreview) {
        // Photo was removed
        photoUrl = null;
      }

      const data = {
        name: formData.name,
        category_id: formData.category_id || null,
        standard_unit_id: formData.standard_unit_id,
        photo_url: photoUrl,
        price_reference: formData.price_reference || null,
      };

      if (item) {
        const { error } = await supabase
          .from("items")
          .update(data)
          .eq("id", item.id);

        if (error) {
          toast({
            title: "Error",
            description: "Failed to update item.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Item updated.",
            variant: "success",
          });
          onClose(true);
        }
      } else {
        const { data: newItem, error } = await supabase
          .from("items")
          .insert(data)
          .select()
          .single();

        if (error) {
          toast({
            title: "Error",
            description: error.message || "Failed to create item.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Item created.",
            variant: "success",
          });
          onClose(true, newItem as Item);
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred.",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    if (hasChanges && !isLoading) {
      const confirmed = window.confirm("You have unsaved changes. Discard them?");
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add Item"}</DialogTitle>
          <DialogDescription>
            {item
              ? "Update the item details."
              : "Add a new item to the inventory system."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">
                Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Item name"
                required
              />
            </div>

            {/* Standard Unit */}
            <div className="grid gap-2">
              <Label>
                Standard Unit <span className="text-red-400">*</span>
              </Label>
              <InlineCreateSelect
                value={formData.standard_unit_id}
                onValueChange={(value) => setFormData({ ...formData, standard_unit_id: value })}
                options={standardUnits}
                onOptionsChange={setStandardUnits}
                placeholder="Select unit"
                entityType="item"
                createType="standard_unit"
              />
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <Label>
                Category {!item && <span className="text-red-400">*</span>}
              </Label>
              <InlineCreateSelect
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value })
                }
                options={categories}
                onOptionsChange={setCategories}
                placeholder="Select category"
                entityType="item"
                createType="category"
              />
            </div>

            {/* Price Reference */}
            <div className="grid gap-2">
              <Label htmlFor="price_reference">
                Price Reference {!item && <span className="text-red-400">*</span>}
              </Label>
              <Input
                id="price_reference"
                value={formData.price_reference}
                onChange={(e) =>
                  setFormData({ ...formData, price_reference: e.target.value })
                }
                placeholder="e.g., $50-75 retail, bulk discount available"
                maxLength={100}
              />
              <p className="text-xs text-slate-400">
                {formData.price_reference.length}/100 characters - helps purchasing team
              </p>
            </div>

            {/* Item Code (SKU - read-only, shown for existing items) */}
            {item?.sku && (
              <div className="grid gap-2">
                <Label>Item Code</Label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800/70 border border-slate-700">
                  <code className="text-lg font-mono font-semibold text-brand-400">
                    {item.sku}
                  </code>
                </div>
                <p className="text-xs text-slate-400">
                  Auto-generated based on category
                </p>
              </div>
            )}

            {/* Photo Upload */}
            <div className="grid gap-2 min-w-0">
              <Label>Photo</Label>
              {photoPreview ? (
                <div className="relative w-full min-w-0">
                  <div className="relative rounded-lg border border-slate-700 bg-slate-800/30 h-40 w-full overflow-hidden">
                    <Image
                      src={photoPreview}
                      alt="Item preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors z-10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {photoFile && (
                    <p className="text-xs text-slate-400 mt-1 truncate">{photoFile.name}</p>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/20 hover:border-slate-600 hover:bg-slate-800/40 cursor-pointer transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-300">Click to upload</p>
                    <p className="text-xs text-slate-500">JPG, PNG up to 5MB</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name || !formData.standard_unit_id || !formData.price_reference || (!item && !formData.category_id)}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : item ? (
                "Update"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
