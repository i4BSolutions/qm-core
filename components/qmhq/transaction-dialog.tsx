"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { DatePicker } from "@/components/ui/date-picker";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { AmountInput } from "@/components/ui/amount-input";
import { ExchangeRateInput } from "@/components/ui/exchange-rate-input";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Calculator,
  Upload,
  X,
  ImageIcon,
  Lock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Currency options
const currencies = [
  { value: "MMK", label: "MMK - Myanmar Kyat" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "THB", label: "THB - Thai Baht" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
];

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qmhqId: string;
  routeType: "expense" | "po";
  userId: string;
  onSuccess: () => void;
}

export function TransactionDialog({
  open,
  onOpenChange,
  qmhqId,
  routeType,
  userId,
  onSuccess,
}: TransactionDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QMHQ data for currency inheritance
  const [qmhqData, setQmhqData] = useState<{
    currency: string;
    exchange_rate: number;
    balance_in_hand: number;
  } | null>(null);
  const [isLoadingQmhq, setIsLoadingQmhq] = useState(false);

  // Form state
  const [transactionType, setTransactionType] = useState<"money_in" | "money_out">("money_in");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("MMK");
  const [exchangeRate, setExchangeRate] = useState("");
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  // Calculate EUSD with proper rounding
  const calculatedEusd = useMemo(() => {
    const amountNum = parseFloat(amount) || 0;
    const rateNum = parseFloat(exchangeRate) || 1;
    if (rateNum <= 0) return 0;
    return Math.round((amountNum / rateNum) * 100) / 100;
  }, [amount, exchangeRate]);

  // Fetch QMHQ data when dialog opens for currency inheritance
  useEffect(() => {
    if (open && qmhqId) {
      const fetchQmhqData = async () => {
        setIsLoadingQmhq(true);
        const supabase = createClient();
        const { data } = await supabase
          .from("qmhq")
          .select("currency, exchange_rate, balance_in_hand")
          .eq("id", qmhqId)
          .single();

        if (data) {
          setQmhqData({
            currency: data.currency || "MMK",
            exchange_rate: data.exchange_rate || 1,
            balance_in_hand: data.balance_in_hand || 0,
          });
          const inheritedCurrency = data.currency || "MMK";
          setCurrency(inheritedCurrency);
          // Auto-lock USD rate to 1.0 per database constraint
          setExchangeRate(inheritedCurrency === 'USD' ? '1' : String(data.exchange_rate || 1));
        }
        setIsLoadingQmhq(false);
      };
      fetchQmhqData();
    }
  }, [open, qmhqId]);

  const resetForm = () => {
    setTransactionType("money_in");
    setAmount("");
    setCurrency("MMK");
    setExchangeRate("");
    setTransactionDate(new Date());
    setNotes("");
    setAttachmentFile(null);
    setAttachmentPreview(null);
    setQmhqData(null);
  };

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

      setAttachmentFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachmentFile) return null;

    const formData = new FormData();
    formData.append("file", attachmentFile);
    formData.append("folder", `transactions/${qmhqId}`);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to upload attachment");
    }

    const data = await response.json();
    return data.url;
  };

  const handleSubmit = async () => {
    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid exchange rate.",
        variant: "destructive",
      });
      return;
    }

    // Balance warning for money-out (warning only, not block)
    if (transactionType === "money_out" && qmhqData) {
      const availableBalance = qmhqData.balance_in_hand ?? 0;
      if (calculatedEusd > availableBalance) {
        const excessAmount = Math.round((calculatedEusd - availableBalance) * 100) / 100;
        const formattedAvailable = Math.round(availableBalance * 100) / 100;

        toast({
          title: "Balance Warning",
          description: `Amount exceeds balance by ${formatCurrency(excessAmount)} EUSD (Available: ${formatCurrency(formattedAvailable)} EUSD)`,
          variant: "warning",
        });
        // Note: Intentionally NOT returning - per user decision, this is a warning, not a block
      }
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      // Upload attachment if exists
      let attachmentUrl: string | null = null;
      if (attachmentFile) {
        attachmentUrl = await uploadAttachment();
      }

      const { error } = await supabase.from("financial_transactions").insert({
        qmhq_id: qmhqId,
        transaction_type: transactionType,
        amount: parseFloat(amount),
        currency: currency,
        exchange_rate: parseFloat(exchangeRate),
        transaction_date: transactionDate.toISOString().split("T")[0],
        notes: notes || null,
        attachment_url: attachmentUrl,
        created_by: userId,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create transaction.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      toast({
        title: "Success",
        description: `${transactionType === "money_in" ? "Money In" : "Money Out"} transaction recorded.`,
        variant: "success",
      });

      resetForm();
      setIsSubmitting(false);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create transaction.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-slate-200">Add Transaction</DialogTitle>
          <DialogDescription className="text-slate-400">
            Record a {routeType === "po" ? "Money In" : "Money In or Money Out"} transaction for this QMHQ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Transaction Type */}
          <div className="grid gap-2">
            <Label className="text-slate-300">Transaction Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTransactionType("money_in")}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  transactionType === "money_in"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                }`}
              >
                <TrendingUp
                  className={`h-6 w-6 ${
                    transactionType === "money_in" ? "text-emerald-400" : "text-slate-400"
                  }`}
                />
                <span
                  className={`font-medium ${
                    transactionType === "money_in" ? "text-emerald-400" : "text-slate-300"
                  }`}
                >
                  Money In
                </span>
                <span className="text-xs text-slate-400">Funds received</span>
              </button>

              <button
                type="button"
                onClick={() => routeType === "expense" && setTransactionType("money_out")}
                disabled={routeType === "po"}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                  routeType === "po"
                    ? "border-slate-700 bg-slate-800/20 opacity-50 cursor-not-allowed"
                    : transactionType === "money_out"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                }`}
              >
                <TrendingDown
                  className={`h-6 w-6 ${
                    transactionType === "money_out" && routeType === "expense"
                      ? "text-amber-400"
                      : "text-slate-400"
                  }`}
                />
                <span
                  className={`font-medium ${
                    transactionType === "money_out" && routeType === "expense"
                      ? "text-amber-400"
                      : "text-slate-300"
                  }`}
                >
                  Money Out
                </span>
                <span className="text-xs text-slate-400">
                  {routeType === "po" ? "Disabled for PO" : "Funds disbursed"}
                </span>
              </button>
            </div>
          </div>

          {/* Amount, Currency, Exchange Rate */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount" className="text-slate-300">
                Amount <span className="text-red-400">*</span>
              </Label>
              <AmountInput
                id="amount"
                value={amount}
                onValueChange={setAmount}
                className="bg-slate-800/50 border-slate-700 text-slate-200"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="currency" className="text-slate-300 flex items-center gap-1.5">
                Currency
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="h-3 w-3 text-amber-500 cursor-default" />
                    </TooltipTrigger>
                    <TooltipContent>Inherited from QMHQ</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Select value={currency} onValueChange={() => {}} disabled={true}>
                <SelectTrigger className="bg-slate-800/50 border-slate-700 opacity-70 cursor-not-allowed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exchange_rate" className="text-slate-300">
                Exchange Rate <span className="text-red-400">*</span>
              </Label>
              <ExchangeRateInput
                id="exchange_rate"
                value={exchangeRate}
                onValueChange={setExchangeRate}
                disabled={currency === 'USD'}
                className="bg-slate-800/50 border-slate-700 text-slate-200"
              />
              <p className="text-xs text-slate-500 mt-1">
                {currency === 'USD' ? 'USD rate is always 1.0' : `1 EUSD = ${exchangeRate || '1'} ${currency}`}
              </p>
            </div>
          </div>

          {/* EUSD Calculation */}
          <div
            className={`p-3 rounded-lg flex items-center justify-between ${
              transactionType === "money_in"
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : "bg-amber-500/10 border border-amber-500/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <Calculator
                className={`h-4 w-4 ${
                  transactionType === "money_in" ? "text-emerald-400" : "text-amber-400"
                }`}
              />
              <span className="text-sm text-slate-300">EUSD Amount</span>
            </div>
            <span
              className={`text-lg font-mono font-bold ${
                transactionType === "money_in" ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {formatCurrency(calculatedEusd)} EUSD
            </span>
          </div>

          {/* Balance Display - Money Out only */}
          {transactionType === "money_out" && qmhqData && (
            <div className="p-3 rounded-lg bg-slate-800/30 border border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Available Balance</span>
                <span className="text-lg font-mono text-purple-400">
                  {formatCurrency(qmhqData.balance_in_hand ?? 0)} EUSD
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Current Balance in Hand from money received
              </p>
            </div>
          )}

          {/* Transaction Date */}
          <div className="grid gap-2">
            <Label className="text-slate-300">
              Transaction Date
            </Label>
            <DatePicker
              date={transactionDate}
              onDateChange={(date) => date && setTransactionDate(date)}
            />
          </div>

          {/* Attachment Upload */}
          <div className="grid gap-2 min-w-0">
            <Label className="text-slate-300">Attachment</Label>
            {attachmentPreview ? (
              <div className="relative w-full min-w-0">
                <div className="relative rounded-lg border border-slate-700 bg-slate-800/30 h-40 w-full overflow-hidden">
                  <Image
                    src={attachmentPreview}
                    alt="Attachment preview"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors z-10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {attachmentFile && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{attachmentFile.name}</p>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-slate-700 bg-slate-800/20 hover:border-slate-600 hover:bg-slate-800/40 cursor-pointer transition-all"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-300">Click to upload image</p>
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

          {/* Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes" className="text-slate-300">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="bg-slate-800/50 border-slate-700 text-slate-200 min-h-[80px]"
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="border-slate-700 text-slate-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
            className={
              transactionType === "money_in"
                ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
                : "bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {transactionType === "money_in" ? (
                  <TrendingUp className="mr-2 h-4 w-4" />
                ) : (
                  <TrendingDown className="mr-2 h-4 w-4" />
                )}
                Record {transactionType === "money_in" ? "Money In" : "Money Out"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
