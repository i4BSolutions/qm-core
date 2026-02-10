"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, X, Lock, AlertCircle, Info } from "lucide-react";
import Link from "next/link";
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
import type { StockOutReason } from "@/types/database";

interface QMHQData {
  id: string;
  request_id: string | null;
  line_name: string | null;
  item_id: string | null;
  quantity: number | null;
  route_type: string | null;
  item?: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
  qmhq_items?: Array<{
    item_id: string;
    quantity: number;
    item: {
      id: string;
      name: string;
      sku: string | null;
    };
  }>;
}

interface LineItem {
  id: string; // temporary client-side ID
  categoryId: string;
  itemId: string;
  quantity: string;
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
    { id: crypto.randomUUID(), categoryId: "", itemId: "", quantity: "" },
  ]);
  const [reason, setReason] = useState<StockOutReason>("request");
  const [notes, setNotes] = useState("");

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
            id, request_id, line_name, item_id, quantity, route_type,
            item:items!qmhq_item_id_fkey(id, name, sku),
            qmhq_items(item_id, quantity, item:items(id, name, sku))
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
          const qmhqItem = data.qmhq_items[0]; // Take first item for QMHQ-linked (enforced as single item)
          setLineItems([
            {
              id: crypto.randomUUID(),
              categoryId: "", // Will be filled by CategoryItemSelector
              itemId: qmhqItem.item_id,
              quantity: String(qmhqItem.quantity || 0),
            },
          ]);
        } else if (data.item_id && data.quantity) {
          setLineItems([
            {
              id: crypto.randomUUID(),
              categoryId: "",
              itemId: data.item_id,
              quantity: String(data.quantity),
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
    setLineItems([
      ...lineItems,
      { id: crypto.randomUUID(), categoryId: "", itemId: "", quantity: "" },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length === 1) return; // Keep at least one
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const handleLineItemChange = (
    id: string,
    field: keyof LineItem,
    value: string
  ) => {
    setLineItems(
      lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item))
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
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/inventory/stock-out-requests">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            New Stock-Out Request
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Request items to be issued from warehouse
          </p>
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
        <div className="command-panel bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <div className="corner-accent top-0 left-0" />
          <div className="corner-accent top-0 right-0" />
          <div className="corner-accent bottom-0 left-0" />
          <div className="corner-accent bottom-0 right-0" />

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Line Items</h2>
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
                      <CategoryItemSelector
                        categoryId={item.categoryId}
                        itemId={item.itemId}
                        onCategoryChange={(categoryId) =>
                          handleLineItemChange(item.id, "categoryId", categoryId)
                        }
                        onItemChange={(itemId) =>
                          handleLineItemChange(item.id, "itemId", itemId)
                        }
                        disabled={!!qmhqId}
                      />
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
        </div>

        {/* Reason Section */}
        <div className="command-panel bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <div className="corner-accent top-0 left-0" />
          <div className="corner-accent top-0 right-0" />
          <div className="corner-accent bottom-0 left-0" />
          <div className="corner-accent bottom-0 right-0" />

          <h2 className="text-lg font-semibold text-white mb-4">Reason *</h2>

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
        </div>

        {/* Notes Section */}
        <div className="command-panel bg-slate-900/50 border border-slate-800 rounded-lg p-6">
          <div className="corner-accent top-0 left-0" />
          <div className="corner-accent top-0 right-0" />
          <div className="corner-accent bottom-0 left-0" />
          <div className="corner-accent bottom-0 right-0" />

          <h2 className="text-lg font-semibold text-white mb-4">
            Notes <span className="text-slate-500 font-normal">(Optional)</span>
          </h2>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional notes or instructions..."
            rows={4}
          />
        </div>
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
  );
}
