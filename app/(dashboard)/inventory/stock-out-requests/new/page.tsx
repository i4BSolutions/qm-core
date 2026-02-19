"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, X, Lock, AlertCircle, Info, Pencil } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/components/providers/auth-provider";
import { CategoryItemSelector } from "@/components/forms/category-item-selector";
import { STOCK_OUT_REASON_CONFIG } from "@/lib/utils/inventory";
import { ConversionRateInput } from "@/components/ui/conversion-rate-input";
import type { StockOutReason } from "@/types/database";
import { FormSection, FormField, PageHeader } from "@/components/composite";
import { ContextSlider } from "@/components/context-slider/context-slider";
import { QmrlSliderContent } from "@/components/context-slider/qmrl-slider-content";
import { QmhqSliderContent } from "@/components/context-slider/qmhq-slider-content";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getFileUrl, type FileAttachmentWithUploader } from "@/lib/actions/files";
import { FilePreviewModal } from "@/components/files/file-preview-modal";
import { ImagePreview } from "@/components/files/image-preview";
import { cn } from "@/lib/utils";

// Dynamic import for PDF preview
const PDFPreview = dynamic(
  () => import("@/components/files/pdf-preview").then((mod) => mod.PDFPreview),
  { ssr: false }
);

interface QMHQData {
  id: string;
  request_id: string | null;
  line_name: string | null;
  item_id: string | null;
  quantity: number | null;
  route_type: string | null;
  qmrl_id: string | null;
  item?: {
    id: string;
    name: string;
    sku: string | null;
    category_id: string | null;
  } | null;
  qmhq_items?: Array<{
    item_id: string;
    quantity: number;
    item: {
      id: string;
      name: string;
      sku: string | null;
      category_id: string | null;
    };
  }>;
}

interface LineItem {
  id: string; // temporary client-side ID
  categoryId: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  quantity: string;
  conversionRate: string;
}

export default function NewStockOutRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user } = useUser();

  const qmhqId = searchParams.get("qmhq");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qmhqData, setQmhqData] = useState<QMHQData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), categoryId: "", itemId: "", itemName: "", itemSku: "", quantity: "", conversionRate: "" },
  ]);
  const [reason, setReason] = useState<StockOutReason>("request");
  const [notes, setNotes] = useState("");

  // Slider data state
  const [qmrlData, setQmrlData] = useState<any>(null);
  const [qmhqFullData, setQmhqFullData] = useState<any>(null);
  const [qmrlAttachments, setQmrlAttachments] = useState<FileAttachmentWithUploader[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const [isSliderLoading, setIsSliderLoading] = useState(false);

  // Preview state
  const [previewFile, setPreviewFile] = useState<FileAttachmentWithUploader | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Fetch QMHQ data if linked
  useEffect(() => {
    const fetchQMHQ = async () => {
      if (!qmhqId) {
        setIsLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        const { data, error: fetchError } = await supabase
          .from("qmhq")
          .select(`
            id, request_id, line_name, item_id, quantity, route_type, qmrl_id,
            item:items!qmhq_item_id_fkey(id, name, sku, category_id),
            qmhq_items(item_id, quantity, item:items(id, name, sku, category_id))
          `)
          .eq("id", qmhqId)
          .single();

        if (fetchError) {
          console.error("Error fetching QMHQ:", fetchError);
          throw new Error(fetchError.message);
        }

        if (!data) {
          throw new Error("QMHQ not found");
        }

        setQmhqData(data as QMHQData);

        // Pre-fill line item from QMHQ
        // Use qmhq_items if available (multi-item), else fall back to qmhq.item_id (legacy)
        if (data.qmhq_items && data.qmhq_items.length > 0) {
          setLineItems(
            data.qmhq_items.map((qmhqItem) => ({
              id: crypto.randomUUID(),
              categoryId: qmhqItem.item.category_id || "_uncategorized",
              itemId: qmhqItem.item_id,
              itemName: qmhqItem.item.name,
              itemSku: qmhqItem.item.sku || "",
              quantity: String(qmhqItem.quantity || 0),
              conversionRate: "",
            }))
          );
        } else if (data.item_id && data.quantity && data.item) {
          setLineItems([
            {
              id: crypto.randomUUID(),
              categoryId: data.item.category_id || "_uncategorized",
              itemId: data.item_id,
              itemName: data.item.name,
              itemSku: data.item.sku || "",
              quantity: String(data.quantity),
              conversionRate: "",
            },
          ]);
        }

        // Set default reason for QMHQ-linked
        setReason("request");
      } catch (err) {
        console.error("Error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load QMHQ data";
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQMHQ();
  }, [qmhqId]);

  // Fetch slider data (QMRL + full QMHQ + attachments) when QMHQ is loaded
  useEffect(() => {
    const fetchSliderData = async () => {
      if (!qmhqData || !qmhqData.qmrl_id) {
        return;
      }

      setIsSliderLoading(true);

      try {
        const supabase = createClient();

        // Fetch full QMHQ with relations
        const { data: qmhqFull, error: qmhqError } = await supabase
          .from("qmhq")
          .select(`
            *,
            status:status_config(name, color),
            category:categories(name, color),
            assigned_user:users!qmhq_assigned_to_fkey(full_name),
            contact_person:contact_persons(name, position),
            qmhq_items(quantity, item:items(name, sku))
          `)
          .eq("id", qmhqData.id)
          .single();

        if (qmhqError) {
          console.error("Error fetching full QMHQ:", qmhqError);
        } else {
          setQmhqFullData(qmhqFull);
        }

        // Fetch QMRL with relations
        const { data: qmrl, error: qmrlError } = await supabase
          .from("qmrl")
          .select(`
            *,
            status:status_config(*),
            category:categories(*),
            department:departments(*),
            contact_person:contact_persons(*)
          `)
          .eq("id", qmhqData.qmrl_id)
          .single();

        if (qmrlError) {
          console.error("Error fetching QMRL:", qmrlError);
        } else {
          setQmrlData(qmrl);
        }

        // Fetch QMRL attachments
        const { data: attachments, error: attachmentsError } = await supabase
          .from("file_attachments")
          .select(`
            *,
            uploaded_by_user:users!uploaded_by(full_name, email)
          `)
          .eq("entity_type", "qmrl")
          .eq("entity_id", qmhqData.qmrl_id)
          .is("deleted_at", null)
          .order("uploaded_at", { ascending: false });

        if (attachmentsError) {
          console.error("Error fetching attachments:", attachmentsError);
        } else if (attachments) {
          setQmrlAttachments(attachments as FileAttachmentWithUploader[]);
          // Load thumbnails for images
          loadThumbnails(attachments as FileAttachmentWithUploader[]);
        }
      } catch (err) {
        console.error("Error fetching slider data:", err);
      } finally {
        setIsSliderLoading(false);
      }
    };

    fetchSliderData();
  }, [qmhqData]);

  // Load thumbnails for image attachments
  const loadThumbnails = async (files: FileAttachmentWithUploader[]) => {
    const newThumbnailUrls = new Map<string, string>();

    for (const file of files) {
      if (file.mime_type.startsWith("image/")) {
        const result = await getFileUrl(file.storage_path);
        if (result.success) {
          newThumbnailUrls.set(file.id, result.data);
        }
      }
    }

    setThumbnailUrls(newThumbnailUrls);
  };

  // Handle attachment click
  const handleAttachmentClick = useCallback(async (file: FileAttachmentWithUploader) => {
    setIsLoadingPreview(true);
    setPreviewFile(file);

    const result = await getFileUrl(file.storage_path);

    if (result.success) {
      setPreviewUrl(result.data);
    } else {
      setPreviewFile(null);
    }

    setIsLoadingPreview(false);
  }, []);

  // Handle preview close
  const handlePreviewClose = useCallback(() => {
    setPreviewFile(null);
    setPreviewUrl(null);
  }, []);

  // Render preview content
  const renderPreviewContent = () => {
    if (!previewFile || !previewUrl) return null;

    const isImage = previewFile.mime_type.startsWith("image/");
    const isPdf = previewFile.mime_type === "application/pdf";

    if (isImage) {
      return (
        <ImagePreview
          url={previewUrl}
          filename={previewFile.filename}
          onError={handlePreviewClose}
        />
      );
    }

    if (isPdf) {
      return (
        <PDFPreview
          url={previewUrl}
          onError={handlePreviewClose}
          onPasswordRequired={handlePreviewClose}
          onDownload={() => window.open(previewUrl, '_blank')}
        />
      );
    }

    // Non-previewable files
    return (
      <div className="flex flex-col items-center justify-center text-center p-8">
        <p className="text-slate-400 mb-4">Preview not available for this file type</p>
        <Button
          variant="outline"
          onClick={() => window.open(previewUrl, '_blank')}
        >
          Download File
        </Button>
      </div>
    );
  };

  // Handle quantity input (number only, font-mono)
  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter
    if (
      [8, 9, 27, 13, 46].includes(e.keyCode) ||
      // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (e.keyCode === 65 && e.ctrlKey === true) ||
      (e.keyCode === 67 && e.ctrlKey === true) ||
      (e.keyCode === 86 && e.ctrlKey === true) ||
      (e.keyCode === 88 && e.ctrlKey === true) ||
      // Allow: home, end, left, right
      (e.keyCode >= 35 && e.keyCode <= 39)
    ) {
      return;
    }
    // Ensure that it is a number and stop the keypress if not
    if (
      (e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
      (e.keyCode < 96 || e.keyCode > 105)
    ) {
      e.preventDefault();
    }
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), categoryId: "", itemId: "", itemName: "", itemSku: "", quantity: "", conversionRate: "" },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => {
      if (prev.length === 1) return prev; // Keep at least one
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleLineItemChange = (
    id: string,
    field: keyof LineItem,
    value: string
  ) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (lineItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one line item is required",
        variant: "destructive",
      });
      return;
    }

    for (const item of lineItems) {
      if (!item.itemId) {
        toast({
          title: "Validation Error",
          description: "All line items must have an item selected",
          variant: "destructive",
        });
        return;
      }

      const qty = parseFloat(item.quantity);
      if (!item.quantity || isNaN(qty) || qty <= 0) {
        toast({
          title: "Validation Error",
          description: "All line items must have a quantity greater than 0",
          variant: "destructive",
        });
        return;
      }

      const convRate = parseFloat(item.conversionRate);
      if (!item.conversionRate || isNaN(convRate) || convRate <= 0) {
        toast({
          title: "Validation Error",
          description: "All line items must have a conversion rate greater than 0",
          variant: "destructive",
        });
        return;
      }
    }

    if (!reason) {
      toast({
        title: "Validation Error",
        description: "Please select a reason",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "User not found. Please log in again.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Insert stock_out_request
      const { data: requestData, error: requestError } = await supabase
        .from("stock_out_requests")
        .insert({
          qmhq_id: qmhqId || null,
          reason,
          notes: notes || null,
          requester_id: user.id,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (requestError) {
        console.error("Error creating request:", requestError);
        throw new Error(requestError.message);
      }

      if (!requestData) {
        throw new Error("Failed to create request");
      }

      // Insert line items
      const lineItemsToInsert = lineItems.map((item) => ({
        request_id: requestData.id,
        item_id: item.itemId,
        requested_quantity: parseFloat(item.quantity),
        conversion_rate: parseFloat(item.conversionRate) || 1,
        created_by: user.id,
      }));

      const { error: lineItemsError } = await supabase
        .from("stock_out_line_items")
        .insert(lineItemsToInsert);

      if (lineItemsError) {
        console.error("Error creating line items:", lineItemsError);
        throw new Error(lineItemsError.message);
      }

      toast({
        title: "Stock-Out Request Created",
        description: "Your request has been submitted successfully",
      });

      router.push(`/inventory/stock-out-requests/${requestData.id}`);
    } catch (err) {
      console.error("Error submitting request:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create request";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-red-400">Error Loading Data</h3>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "p-8 space-y-6",
      qmhqId
        ? "md:grid md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_384px] md:gap-6 md:max-w-none md:space-y-0"
        : "max-w-3xl mx-auto"
    )}>
      {/* Wrap form content when grid is active */}
      <div className={qmhqId ? "space-y-6" : ""}>
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/inventory/stock-out-requests">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex-1">
            <PageHeader
              title="New Stock-Out Request"
              description="Request items to be issued from warehouse"
            />
          </div>
        </div>

      {/* QMHQ Reference Banner */}
      {qmhqData && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-400">
              Linked to QMHQ: {qmhqData.request_id || "—"}
            </h3>
            <p className="text-sm text-blue-300/80 mt-1">
              {qmhqData.line_name || "No description"}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="space-y-6">
        {/* Line Items Section */}
        <FormSection
          title={
            <div className="flex items-center justify-between w-full">
              <span>Line Items</span>
              {!qmhqId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLineItem}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              )}
            </div>
          }
        >

          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div
                key={item.id}
                className="bg-slate-800/30 border border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-4">
                    {/* Item Selector */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Item *
                        {qmhqId && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-slate-600 bg-slate-700/50 text-slate-400"
                          >
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </label>
                      {item.itemId ? (
                        /* Selected item display — same pattern as QMHQ/PO */
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded text-sm">
                            {item.itemSku && (
                              <code className="font-mono text-amber-400 mr-2">
                                {item.itemSku}
                              </code>
                            )}
                            {item.itemSku && <span className="text-slate-400 mr-2">-</span>}
                            <span className="text-slate-200">{item.itemName}</span>
                          </div>
                          {!qmhqId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                handleLineItemChange(item.id, "categoryId", "");
                                handleLineItemChange(item.id, "itemId", "");
                                handleLineItemChange(item.id, "itemName", "");
                                handleLineItemChange(item.id, "itemSku", "");
                              }}
                              className="h-8 px-2 text-slate-400 hover:text-slate-200"
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Change
                            </Button>
                          )}
                        </div>
                      ) : (
                        /* Selector shown only when no item selected */
                        <CategoryItemSelector
                          categoryId={item.categoryId}
                          itemId=""
                          onCategoryChange={(categoryId) =>
                            handleLineItemChange(item.id, "categoryId", categoryId)
                          }
                          onItemChange={(itemId) =>
                            handleLineItemChange(item.id, "itemId", itemId)
                          }
                          onItemSelect={(selected) => {
                            handleLineItemChange(item.id, "itemName", selected.name);
                            handleLineItemChange(item.id, "itemSku", selected.sku || "");
                          }}
                          disabled={!!qmhqId}
                        />
                      )}
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Quantity *
                        {qmhqId && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-slate-600 bg-slate-700/50 text-slate-400"
                          >
                            <Lock className="h-3 w-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(e) =>
                          handleLineItemChange(item.id, "quantity", e.target.value)
                        }
                        onKeyDown={handleQuantityKeyDown}
                        disabled={!!qmhqId}
                        placeholder="Enter quantity"
                        className="font-mono"
                      />
                    </div>

                    {/* Conversion Rate */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Conversion Rate *
                      </label>
                      <ConversionRateInput
                        value={item.conversionRate}
                        onValueChange={(val) =>
                          handleLineItemChange(item.id, "conversionRate", val)
                        }
                        placeholder="1.0000"
                        className="bg-slate-800/50 border-slate-700"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        To standard unit
                      </p>
                    </div>
                  </div>

                  {/* Remove button */}
                  {!qmhqId && lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveLineItem(item.id)}
                      className="mt-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </FormSection>

        {/* Reason Section */}
        <FormSection title="Reason *">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(
              Object.keys(STOCK_OUT_REASON_CONFIG) as Array<StockOutReason>
            ).map((reasonKey) => {
              const config = STOCK_OUT_REASON_CONFIG[reasonKey];
              const isSelected = reason === reasonKey;

              return (
                <button
                  key={reasonKey}
                  type="button"
                  onClick={() => setReason(reasonKey)}
                  className={`
                    p-4 rounded-lg border-2 text-left transition-all duration-200
                    ${
                      isSelected
                        ? `${config.bgColor} ${config.borderColor} ${config.color}`
                        : "bg-slate-800/30 border-slate-700 text-slate-400 hover:border-slate-600"
                    }
                  `}
                >
                  <div className="font-medium mb-1">{config.label}</div>
                  <div className="text-xs opacity-80">{config.description}</div>
                </button>
              );
            })}
          </div>
        </FormSection>

        {/* Notes Section */}
        <FormSection
          title={
            <>
              Notes <span className="text-slate-500 font-normal">(Optional)</span>
            </>
          }
        >
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes or instructions..."
            rows={4}
          />
        </FormSection>
      </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Link href="/inventory/stock-out-requests">
            <Button variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </Link>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Request"}
          </Button>
        </div>
      </div>

      {/* Context Slider - only when QMHQ-linked */}
      {qmhqId && (
        <ContextSlider
          title="Request Context"
        >
          <Tabs defaultValue="qmrl" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="qmrl">QMRL</TabsTrigger>
              <TabsTrigger value="qmhq">QMHQ</TabsTrigger>
            </TabsList>
            <TabsContent value="qmrl">
              <QmrlSliderContent
                qmrl={qmrlData}
                isLoading={isSliderLoading}
                attachments={qmrlAttachments}
                thumbnailUrls={thumbnailUrls}
                onAttachmentClick={handleAttachmentClick}
                qmhqLinesCount={0}
              />
            </TabsContent>
            <TabsContent value="qmhq">
              <QmhqSliderContent
                qmhq={qmhqFullData}
                isLoading={isSliderLoading}
              />
            </TabsContent>
          </Tabs>
        </ContextSlider>
      )}

      {/* File Preview Modal */}
      {qmhqId && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={handlePreviewClose}
          file={previewFile}
          fileUrl={previewUrl}
        >
          {renderPreviewContent()}
        </FilePreviewModal>
      )}
    </div>
  );
}
