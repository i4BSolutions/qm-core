"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { FileAttachmentWithUploader } from "@/lib/actions/files";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Calendar,
  User,
  Building2,
  Tag,
  AlertCircle,
  FileText,
  History,
  Clock,
  Target,
  ExternalLink,
  Package,
  Wallet,
  ShoppingCart,
  Paperclip,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { QMRL, QMHQ, StatusConfig, Category, Department, ContactPerson, User as UserType } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { HistoryTab } from "@/components/history";
import { AttachmentsTab } from "@/components/files/attachments-tab";
import { ClickableStatusBadge } from "@/components/status/clickable-status-badge";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useToast } from "@/components/ui/use-toast";
import { CommentsSection } from "@/components/comments";

interface QMRLWithRelations extends QMRL {
  status?: StatusConfig | null;
  category?: Category | null;
  assigned_user?: UserType | null;
  requester?: UserType | null;
  department?: Department | null;
  contact_person?: ContactPerson | null;
}

interface QMHQWithRelations extends QMHQ {
  status?: StatusConfig | null;
  category?: Category | null;
  assigned_user?: UserType | null;
}

// Route type configuration for QMHQ display
const routeConfig: Record<string, { icon: typeof Package; label: string; color: string; bgColor: string }> = {
  item: { icon: Package, label: "Item", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
  expense: { icon: Wallet, label: "Expense", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  po: { icon: ShoppingCart, label: "PO", color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
};

const priorityConfig: Record<string, { class: string; label: string; icon: string }> = {
  low: { class: "priority-tactical priority-tactical-low", label: "LOW", icon: "slate" },
  medium: { class: "priority-tactical priority-tactical-medium", label: "MEDIUM", icon: "blue" },
  high: { class: "priority-tactical priority-tactical-high", label: "HIGH", icon: "amber" },
  critical: { class: "priority-tactical priority-tactical-critical", label: "CRITICAL", icon: "red" },
};

export default function QMRLDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { can } = usePermissions();
  const { toast } = useToast();
  const [qmrl, setQmrl] = useState<QMRLWithRelations | null>(null);
  const [relatedQmhq, setRelatedQmhq] = useState<QMHQWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fileCount, setFileCount] = useState(0);

  // Per-file delete permission check matching RLS policy
  const canDeleteFile = useCallback((file: FileAttachmentWithUploader) => {
    if (!user) return false;
    // Admin and quartermaster can delete any file
    if (user.role === 'admin' || user.role === 'quartermaster') return true;
    // Users can delete their own uploads
    return file.uploaded_by === user.id;
  }, [user]);

  const fetchQMRL = useCallback(async (id: string) => {
    setIsLoading(true);
    const supabase = createClient();

    // Fetch QMRL data
    const { data, error } = await supabase
      .from("qmrl")
      .select(`
        *,
        status:status_config(*),
        category:categories(*),
        assigned_user:users!qmrl_assigned_to_fkey(*),
        requester:users!qmrl_requester_id_fkey(*),
        department:departments(*),
        contact_person:contact_persons(*)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      router.push("/qmrl");
      return;
    }

    setQmrl(data as QMRLWithRelations);

    // Fetch related QMHQ records
    const { data: qmhqData } = await supabase
      .from("qmhq")
      .select(`
        *,
        status:status_config(*),
        category:categories(*),
        assigned_user:users!qmhq_assigned_to_fkey(id, full_name)
      `)
      .eq("qmrl_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (qmhqData) {
      setRelatedQmhq(qmhqData as unknown as QMHQWithRelations[]);
    }

    // Fetch file count for tab badge
    const { count: filesCount } = await supabase
      .from("file_attachments")
      .select("*", { count: 'exact', head: true })
      .eq("entity_type", "qmrl")
      .eq("entity_id", id)
      .is("deleted_at", null);

    setFileCount(filesCount ?? 0);

    setIsLoading(false);
  }, [router]);

  useEffect(() => {
    if (params.id) {
      fetchQMRL(params.id as string);
    }
  }, [params.id, fetchQMRL]);

  // Check for pending upload status from create page
  useEffect(() => {
    if (!qmrl?.id) return;

    const checkPendingUploads = () => {
      const pendingKey = `pending-uploads-${qmrl.id}`;
      const pending = sessionStorage.getItem(pendingKey);

      if (pending) {
        try {
          const { total, completed, failed } = JSON.parse(pending);
          sessionStorage.removeItem(pendingKey);

          if (failed > 0) {
            toast({
              title: "Some files failed to upload",
              description: `${completed} of ${total} file${total !== 1 ? 's' : ''} uploaded successfully. You can retry from the Attachments tab.`,
              variant: "destructive",
            });
          } else if (completed > 0 && completed === total) {
            toast({
              title: "Files uploaded",
              description: `${completed} file${completed !== 1 ? 's' : ''} attached successfully.`,
              variant: "success",
            });
          }

          // Refresh file count
          fetchQMRL(qmrl.id);
        } catch (e) {
          sessionStorage.removeItem(pendingKey);
        }
      }
    };

    // Check immediately and after a delay (uploads may still be in progress)
    checkPendingUploads();
    const timer = setTimeout(checkPendingUploads, 3000);

    return () => clearTimeout(timer);
  }, [qmrl?.id, toast, fetchQMRL]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-8 w-96" />
          </div>
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!qmrl) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-400">Request not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none grid-overlay opacity-30" />

      {/* Header */}
      <div className="relative flex items-start justify-between animate-fade-in">
        <div className="flex items-start gap-4">
          <Link href="/qmrl">
            <Button variant="ghost" size="icon" className="mt-1 hover:bg-amber-500/10 hover:text-amber-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            {/* Request ID Badge */}
            <div className="flex items-center gap-3 mb-3">
              <div className="request-id-badge">
                <Target className="h-4 w-4 text-amber-500" />
                <code>{qmrl.request_id}</code>
              </div>
              {qmrl.priority && (
                <span className={priorityConfig[qmrl.priority]?.class}>
                  <AlertCircle className="h-3 w-3" />
                  {priorityConfig[qmrl.priority]?.label}
                </span>
              )}
              {qmrl.status && (
                <ClickableStatusBadge
                  status={qmrl.status}
                  entityType="qmrl"
                  entityId={qmrl.id}
                  onStatusChange={() => fetchQMRL(params.id as string)}
                />
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold tracking-tight text-slate-200 mb-2">
              {qmrl.title}
            </h1>

            {/* Category & Meta */}
            <div className="flex items-center gap-4 text-sm text-slate-400">
              {qmrl.category && (
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: qmrl.category.color || "rgb(100, 116, 139)",
                    color: qmrl.category.color || "rgb(148, 163, 184)",
                  }}
                >
                  <Tag className="mr-1 h-3 w-3" />
                  {qmrl.category.name}
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(qmrl.request_date)}
              </span>
              {qmrl.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {qmrl.department.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {can("update", "qmrl") && (
            <Link href={`/qmrl/${qmrl.id}/edit`}>
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800 hover:border-amber-500/30">
                <Pencil className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Edit</span>
              </Button>
            </Link>
          )}
          <Link href={`/qmhq/new?qmrl=${qmrl.id}`}>
            <Button className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400">
              <Plus className="mr-2 h-4 w-4" />
              Add QMHQ Line
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-slate-700 p-1">
          <TabsTrigger value="details" className="data-[state=active]:bg-slate-700 data-[state=active]:text-amber-400">
            <FileText className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="qmhq" className="data-[state=active]:bg-slate-700 data-[state=active]:text-amber-400">
            <ExternalLink className="mr-2 h-4 w-4" />
            QMHQ Lines ({relatedQmhq.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-slate-700 data-[state=active]:text-amber-400">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="attachments" className="data-[state=active]:bg-slate-700 data-[state=active]:text-amber-400">
            <Paperclip className="mr-2 h-4 w-4" />
            Attachments ({fileCount})
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Department & Contact */}
              <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "100ms" }}>
                <div className="section-header">
                  <Building2 className="h-4 w-4 text-amber-500" />
                  <h3>Department & Contact</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="data-label mb-1">Department</p>
                      <p className="data-value">{qmrl.department?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="data-label mb-1">Request Date</p>
                      <p className="data-value font-mono">{formatDate(qmrl.request_date)}</p>
                    </div>
                  </div>
                  {qmrl.request_letter_no && (
                    <>
                      <div className="divider-accent" />
                      <div>
                        <p className="data-label mb-1">Request Letter No</p>
                        <p className="data-value font-mono">{qmrl.request_letter_no}</p>
                      </div>
                    </>
                  )}
                  <div className="divider-accent" />
                  <div>
                    <p className="data-label mb-1">Contact Person</p>
                    <p className="data-value">
                      {qmrl.contact_person?.name || "—"}
                      {qmrl.contact_person?.position && (
                        <span className="text-slate-400 ml-2">— {qmrl.contact_person.position}</span>
                      )}
                    </p>
                    {qmrl.contact_person?.phone && (
                      <p className="text-xs text-slate-400 mt-1 font-mono">{qmrl.contact_person.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "200ms" }}>
                <div className="section-header">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <h3>Description</h3>
                </div>
                {qmrl.description ? (
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {qmrl.description}
                  </p>
                ) : (
                  <p className="text-slate-400 italic">No description provided</p>
                )}
              </div>

              {/* Notes */}
              {qmrl.notes && (
                <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "300ms" }}>
                  <div className="section-header">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <h3>Internal Notes</h3>
                  </div>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {qmrl.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Assignment */}
              <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "150ms" }}>
                <div className="section-header">
                  <User className="h-4 w-4 text-amber-500" />
                  <h3>Assignment</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="data-label mb-1">Assigned To</p>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                        <User className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="data-value">{qmrl.assigned_user?.full_name || "Unassigned"}</p>
                        {qmrl.assigned_user?.role && (
                          <p className="text-xs text-slate-400 capitalize">{qmrl.assigned_user.role}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="divider-accent" />
                  <div>
                    <p className="data-label mb-1">Requester</p>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="data-value">{qmrl.requester?.full_name || "—"}</p>
                        {qmrl.requester?.role && (
                          <p className="text-xs text-slate-400 capitalize">{qmrl.requester.role}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              <div className="command-panel corner-accents animate-slide-up" style={{ animationDelay: "250ms" }}>
                <div className="section-header">
                  <Target className="h-4 w-4 text-amber-500" />
                  <h3>Status Information</h3>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="data-label mb-1">Current Status</p>
                      {qmrl.status ? (
                        <ClickableStatusBadge
                          status={qmrl.status}
                          entityType="qmrl"
                          entityId={qmrl.id}
                          onStatusChange={() => fetchQMRL(params.id as string)}
                        />
                      ) : (
                        <p className="data-value">—</p>
                      )}
                    </div>
                    <div>
                      <p className="data-label mb-1">Priority</p>
                      {qmrl.priority ? (
                        <span className={priorityConfig[qmrl.priority]?.class}>
                          {priorityConfig[qmrl.priority]?.label}
                        </span>
                      ) : (
                        <p className="data-value">—</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audit Info */}
              <div className="command-panel animate-slide-up" style={{ animationDelay: "350ms" }}>
                <div className="section-header">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <h3>Audit Trail</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="data-label">Created</span>
                    <span className="data-value font-mono text-xs">{formatDateTime(qmrl.created_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="data-label">Last Modified</span>
                    <span className="data-value font-mono text-xs">{formatDateTime(qmrl.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* QMHQ Lines Tab */}
        <TabsContent value="qmhq">
          <div className="command-panel corner-accents animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <div className="section-header mb-0">
                <ExternalLink className="h-4 w-4 text-amber-500" />
                <h3>QMHQ Lines</h3>
              </div>
              <Link href={`/qmhq/new?qmrl=${qmrl.id}`}>
                <Button size="sm" className="bg-gradient-to-r from-amber-600 to-amber-500">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Line
                </Button>
              </Link>
            </div>

            {relatedQmhq.length === 0 ? (
              <div className="flex h-40 items-center justify-center border border-dashed border-sidebar-border rounded-lg bg-slate-900/30">
                <div className="text-center">
                  <ExternalLink className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No QMHQ lines yet</p>
                  <p className="text-xs text-slate-400 mt-1">Click "Add Line" to create one</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {relatedQmhq.map((qmhqItem) => {
                  const RouteIcon = routeConfig[qmhqItem.route_type]?.icon || Package;
                  const routeColors = routeConfig[qmhqItem.route_type];

                  return (
                    <Link
                      key={qmhqItem.id}
                      href={`/qmhq/${qmhqItem.id}`}
                      className="block p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-amber-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {/* Route Type Icon */}
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${routeColors?.bgColor}`}>
                            <RouteIcon className={`h-5 w-5 ${routeColors?.color}`} />
                          </div>

                          <div>
                            {/* Request ID and Route Badge */}
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm font-mono text-amber-400">
                                {qmhqItem.request_id}
                              </code>
                              <span className={`text-xs px-2 py-0.5 rounded border ${routeColors?.bgColor} ${routeColors?.color}`}>
                                {routeColors?.label}
                              </span>
                              {qmhqItem.status && (
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={{
                                    borderColor: qmhqItem.status.color || undefined,
                                    color: qmhqItem.status.color || undefined,
                                  }}
                                >
                                  {qmhqItem.status.name}
                                </Badge>
                              )}
                            </div>

                            {/* Line Name */}
                            <p className="text-slate-200 font-medium">
                              {qmhqItem.line_name}
                            </p>

                            {/* Meta Info */}
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                              {qmhqItem.assigned_user && (
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {qmhqItem.assigned_user.full_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(qmhqItem.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Amount/Quantity Display */}
                        <div className="text-right">
                          {qmhqItem.route_type === "item" && qmhqItem.quantity && (
                            <p className="text-lg font-mono font-bold text-blue-400">
                              {qmhqItem.quantity} <span className="text-xs text-slate-400">units</span>
                            </p>
                          )}
                          {(qmhqItem.route_type === "expense" || qmhqItem.route_type === "po") && qmhqItem.amount && (
                            <CurrencyDisplay
                              amount={qmhqItem.amount}
                              currency={qmhqItem.currency || "USD"}
                              exchangeRate={qmhqItem.exchange_rate || 1}
                              amountEusd={qmhqItem.amount_eusd}
                              size="sm"
                              align="right"
                            />
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <div className="command-panel corner-accents animate-slide-up">
            <HistoryTab entityType="qmrl" entityId={qmrl.id} />
          </div>
        </TabsContent>

        {/* Attachments Tab */}
        <TabsContent value="attachments">
          <div className="command-panel corner-accents animate-slide-up">
            <AttachmentsTab
              entityType="qmrl"
              entityId={qmrl.id}
              entityDisplayId={qmrl.request_id}
              canDeleteFile={canDeleteFile}
              canUpload={true}
              onFileCountChange={setFileCount}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Comments Section - always visible at bottom per user decision */}
      <CommentsSection entityType="qmrl" entityId={qmrl.id} />
    </div>
  );
}
