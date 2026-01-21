"use client";

import { useEffect, useState, useRef } from "react";
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
import type { Item, Category } from "@/types/database";

interface ItemDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  item: Item | null;
}

export function ItemDialog({ open, onClose, item }: ItemDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("entity_type", "item")
        .eq("is_active", true)
        .order("display_order");

      if (data) {
        setCategories(data);
      }
    };

    if (open) {
      fetchCategories();
    }
  }, [open]);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || "",
        category_id: item.category_id || "",
      });
      setExistingPhotoUrl(item.photo_url || null);
      setPhotoPreview(item.photo_url || null);
      setPhotoFile(null);
    } else {
      setFormData({
        name: "",
        category_id: "",
      });
      setExistingPhotoUrl(null);
      setPhotoPreview(null);
      setPhotoFile(null);
    }
  }, [item, open]);

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
        photo_url: photoUrl,
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
        const { error } = await supabase.from("items").insert(data);

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
          onClose(true);
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

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
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

            {/* Category */}
            <div className="grid gap-2">
              <Label>Category</Label>
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

            {/* SKU (read-only, shown for existing items) */}
            {item?.sku && (
              <div className="grid gap-2">
                <Label htmlFor="sku">Product Code (SKU)</Label>
                <Input
                  id="sku"
                  value={item.sku}
                  readOnly
                  disabled
                  className="bg-slate-800/50 border-slate-700 font-mono text-brand-400"
                />
                <p className="text-xs text-slate-400">
                  Auto-generated product code
                </p>
              </div>
            )}

            {/* Photo Upload */}
            <div className="grid gap-2 min-w-0">
              <Label>Photo</Label>
              {photoPreview ? (
                <div className="relative w-full min-w-0">
                  <div className="relative rounded-lg border border-slate-700 bg-slate-800/30 h-40 w-full overflow-hidden">
                    <img
                      src={photoPreview}
                      alt="Item preview"
                      className="absolute inset-0 w-full h-full object-contain"
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
              onClick={() => onClose()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name}>
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
