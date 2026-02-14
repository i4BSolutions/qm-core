"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  Building2,
  Lock,
  AlertTriangle,
  Edit,
  ShoppingCart,
  Users,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/providers/auth-provider";
import { FormSection, FormField, PageHeader } from "@/components/composite";
import { updatePO } from "@/lib/actions/po-actions";
import type {
  PurchaseOrder,
  Supplier,
  ContactPerson,
  QMHQ,
} from "@/types/database";

// Extended types
interface POWithRelations extends PurchaseOrder {
  supplier?: Supplier | null;
  qmhq?: Pick<QMHQ, "id" | "request_id" | "line_name"> | null;
}

export default function EditPOPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const poId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [po, setPO] = useState<POWithRelations | null>(null);

  // Form state (only editable fields)
  const [formData, setFormData] = useState({
    supplier_id: "",
    expected_delivery_date: null as Date | null,
    notes: "",
    contact_person_name: "",
    sign_person_name: "",
    authorized_signer_name: "",
  });

  // Reference data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [contactPersons, setContactPersons] = useState<ContactPerson[]>([]);
  const [lineItemCount, setLineItemCount] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch PO data
    const { data: poData, error: poError } = await supabase
      .from("purchase_orders")
      .select(`
        *,
        supplier:suppliers(id, name, company_name),
        qmhq:qmhq!purchase_orders_qmhq_id_fkey(id, request_id, line_name)
      `)
      .eq("id", poId)
      .single();

    if (poError || !poData) {
      toast({
        title: "Error",
        description: "Failed to load PO data.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    setPO(poData as unknown as POWithRelations);

    // Set form data from PO
    setFormData({
      supplier_id: poData.supplier_id || "",
      expected_delivery_date: poData.expected_delivery_date
        ? new Date(poData.expected_delivery_date)
        : null,
      notes: poData.notes || "",
      contact_person_name: poData.contact_person_name || "",
      sign_person_name: poData.sign_person_name || "",
      authorized_signer_name: poData.authorized_signer_name || "",
    });

    // Fetch reference data
    const [supplierRes, contactRes, lineItemRes] = await Promise.all([
      supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("contact_persons")
        .select("id, name, position")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("po_line_items")
        .select("id", { count: "exact", head: true })
        .eq("po_id", poId)
        .eq("is_active", true),
    ]);

    if (supplierRes.data) setSuppliers(supplierRes.data as Supplier[]);
    if (contactRes.data) setContactPersons(contactRes.data as ContactPerson[]);
    if (lineItemRes.count !== null) setLineItemCount(lineItemRes.count);

    setIsLoading(false);
  }, [poId, toast]);

  useEffect(() => {
    if (poId) {
      fetchData();
    }
  }, [poId, fetchData]);

  const handleInputChange = (field: string, value: string | Date | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSaving(true);

    // Prepare data for server action
    const updateData: {
      supplier_id?: string;
      notes?: string;
      expected_delivery_date?: string | null;
      contact_person_name?: string | null;
      sign_person_name?: string | null;
      authorized_signer_name?: string | null;
    } = {
      supplier_id: formData.supplier_id || undefined,
      notes: formData.notes || undefined,
      expected_delivery_date: formData.expected_delivery_date
        ? formData.expected_delivery_date.toISOString().split("T")[0]
        : null,
      contact_person_name: formData.contact_person_name || null,
      sign_person_name: formData.sign_person_name || null,
      authorized_signer_name: formData.authorized_signer_name || null,
    };

    const result = await updatePO(poId, updateData);

    if (result.success) {
      toast({
        title: "PO Updated",
        description: `${result.data.poNumber} updated successfully`,
        variant: "success",
      });
      router.push(`/po/${poId}`);
    } else {
      toast({
        title: "Update Failed",
        description: result.error,
        variant: "destructive",
      });
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
            Loading PO data...
          </p>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <h2 className="text-xl font-semibold text-slate-200">Purchase Order Not Found</h2>
        <p className="text-slate-400">The requested PO could not be found.</p>
        <Link href="/po">
          <Button variant="outline" className="border-slate-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to PO List
          </Button>
        </Link>
      </div>
    );
  }

  // Guard check: Block editing for closed/cancelled POs
  if (po.status === "closed" || po.status === "cancelled") {
    const statusText = po.status === "closed" ? "closed" : "cancelled";
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/po/${poId}`}>
            <Button variant="ghost" size="icon" className="hover:bg-amber-500/10 hover:text-amber-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <PageHeader
            title="Edit Purchase Order"
            description={<code className="text-amber-400">{po.po_number}</code>}
            badge={
              <div className="flex items-center gap-2 px-3 py-1 rounded border bg-red-500/10 border-red-500/20">
                <Edit className="h-4 w-4 text-red-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-red-400">
                  Edit
                </span>
              </div>
            }
          />
        </div>

        {/* Block Message */}
        <div className="command-panel corner-accents border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400 mb-2">
                Cannot Edit {statusText.charAt(0).toUpperCase() + statusText.slice(1)} PO
              </h3>
              <p className="text-slate-300 mb-4">
                This PO cannot be edited because it is {statusText}.
                {po.status === "closed" && " Only administrators can unlock closed POs for corrections."}
              </p>
              <Link href={`/po/${poId}`}>
                <Button variant="outline" className="border-slate-700">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to PO Details
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/po/${poId}`}>
          <Button variant="ghost" size="icon" className="hover:bg-amber-500/10 hover:text-amber-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <PageHeader
          title="Edit Purchase Order"
          description={<code className="text-amber-400">{po.po_number}</code>}
          badge={
            <div className="flex items-center gap-2 px-3 py-1 rounded border bg-amber-500/10 border-amber-500/20">
              <Edit className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Edit
              </span>
            </div>
          }
        />
      </div>

      {/* Editable Fields */}
      <FormSection
        title="Editable Fields"
        icon={<Building2 className="h-5 w-5 text-amber-400" />}
      >
        <FormField label="Supplier" required>
          <Select
            value={formData.supplier_id}
            onValueChange={(v) => handleInputChange("supplier_id", v)}
          >
            <SelectTrigger className="bg-slate-800/50 border-slate-700">
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.company_name || supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Expected Delivery Date">
          <DatePicker
            date={formData.expected_delivery_date || undefined}
            onDateChange={(date) => handleInputChange("expected_delivery_date", date || null)}
            placeholder="Select delivery date"
          />
        </FormField>

        <FormField label="Notes">
          <Textarea
            value={formData.notes}
            onChange={(e) => handleInputChange("notes", e.target.value)}
            placeholder="Additional notes"
            className="bg-slate-800/50 border-slate-700 text-slate-200"
            rows={3}
          />
        </FormField>
      </FormSection>

      {/* Signer Information */}
      <FormSection
        title="Signer Information"
        icon={<Users className="h-5 w-5 text-amber-400" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Contact Person">
            <Select
              value={formData.contact_person_name || "none"}
              onValueChange={(v) => handleInputChange("contact_person_name", v === "none" ? "" : v)}
            >
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Select contact person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contact person</SelectItem>
                {contactPersons.map((cp) => (
                  <SelectItem key={cp.id} value={cp.name}>
                    {cp.name} {cp.position && `(${cp.position})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Sign Person">
            <Select
              value={formData.sign_person_name || "none"}
              onValueChange={(v) => handleInputChange("sign_person_name", v === "none" ? "" : v)}
            >
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Select sign person" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No sign person</SelectItem>
                {contactPersons.map((cp) => (
                  <SelectItem key={cp.id} value={cp.name}>
                    {cp.name} {cp.position && `(${cp.position})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Authorized Signer">
            <Select
              value={formData.authorized_signer_name || "none"}
              onValueChange={(v) => handleInputChange("authorized_signer_name", v === "none" ? "" : v)}
            >
              <SelectTrigger className="bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Select authorized signer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No authorized signer</SelectItem>
                {contactPersons.map((cp) => (
                  <SelectItem key={cp.id} value={cp.name}>
                    {cp.name} {cp.position && `(${cp.position})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </FormSection>

      {/* Read-Only Information */}
      <FormSection
        title="Read-Only Information"
        icon={<Lock className="h-5 w-5 text-amber-400" />}
      >
        <div className="mb-3">
          <p className="text-xs text-slate-400 uppercase tracking-wider">
            These fields cannot be changed after PO creation
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 opacity-70">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">PO Number</p>
            <code className="text-amber-400 text-sm">{po.po_number}</code>
          </div>

          {po.qmhq && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">QMHQ Reference</p>
              <Link href={`/qmhq/${po.qmhq.id}`} className="text-amber-400 hover:text-amber-300 text-sm">
                {po.qmhq.request_id}
              </Link>
            </div>
          )}

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">PO Date</p>
            <p className="text-slate-200 text-sm">
              {po.po_date ? new Date(po.po_date).toLocaleDateString() : "—"}
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Currency</p>
            <p className="text-slate-200 text-sm">{po.currency || "MMK"}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Exchange Rate</p>
            <p className="text-slate-200 text-sm font-mono">{po.exchange_rate ?? 1}</p>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Amount</p>
            <CurrencyDisplay
              amount={po.total_amount}
              currency={po.currency || "MMK"}
              amountEusd={po.total_amount_eusd}
              size="sm"
            />
          </div>

          <div className="col-span-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Line Items</p>
            <p className="text-slate-200 text-sm">
              {lineItemCount} line item{lineItemCount !== 1 ? "s" : ""} — not editable
            </p>
          </div>
        </div>
      </FormSection>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4">
        <Link href={`/po/${poId}`}>
          <Button variant="outline" className="border-slate-700 text-slate-300">
            Cancel
          </Button>
        </Link>
        <Button
          onClick={handleSubmit}
          disabled={isSaving || !formData.supplier_id}
          className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
