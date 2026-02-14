import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchFlowChain } from "@/lib/supabase/flow-tracking-queries";
import { FlowSearch } from "@/components/flow-tracking/flow-search";
import { FlowChainTimeline } from "@/components/flow-tracking/flow-chain-timeline";
import { PageHeader } from "@/components/composite";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio } from "lucide-react";

interface FlowTrackingPageProps {
  searchParams: Promise<{ qmrl_id?: string }>;
}

export default async function FlowTrackingPage({
  searchParams,
}: FlowTrackingPageProps) {
  const params = await searchParams;
  const qmrlId = params.qmrl_id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flow Tracking"
        description="Trace the complete downstream chain of any QMRL request"
        badge={
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20">
            <Radio className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-500">
              Admin
            </span>
          </div>
        }
      />

      <FlowSearch defaultValue={qmrlId} />

      {!qmrlId ? (
        <div className="command-panel corner-accents text-center">
          <p className="text-slate-400">
            Enter a QMRL ID to view its complete downstream chain
          </p>
        </div>
      ) : (
        <Suspense key={qmrlId} fallback={<FlowTrackingResultsSkeleton />}>
          <FlowTrackingResults qmrlId={qmrlId} />
        </Suspense>
      )}
    </div>
  );
}

async function FlowTrackingResults({ qmrlId }: { qmrlId: string }) {
  const supabase = await createClient();
  const { data, error } = await fetchFlowChain(supabase, qmrlId);

  if (error) {
    return (
      <div className="command-panel corner-accents border-red-500/30">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
            <span className="text-red-400 text-lg">⚠</span>
          </div>
          <div>
            <p className="font-semibold text-red-400 mb-1">Error Loading Flow Chain</p>
            <p className="text-sm text-slate-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="command-panel corner-accents border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
            <span className="text-amber-400 text-lg">ℹ</span>
          </div>
          <div>
            <p className="font-semibold text-amber-400 mb-1">No QMRL Found</p>
            <p className="text-sm text-slate-400">
              No QMRL found with ID: <code className="font-mono text-amber-400">{qmrlId}</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <FlowChainTimeline chain={data} />;
}

function FlowTrackingResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="command-panel corner-accents space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="ml-6 space-y-3">
        <div className="command-panel space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="command-panel space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    </div>
  );
}
