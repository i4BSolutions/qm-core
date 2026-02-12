import { createClient } from "@/lib/supabase/server";
import { fetchFlowChain } from "@/lib/supabase/flow-tracking-queries";
import { FlowSearch } from "@/components/flow-tracking/flow-search";
import { FlowChainTimeline } from "@/components/flow-tracking/flow-chain-timeline";
import { PageHeader } from "@/components/composite";
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
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
          <p className="text-slate-400">
            Enter a QMRL ID to view its complete downstream chain
          </p>
        </div>
      ) : (
        <FlowTrackingResults qmrlId={qmrlId} />
      )}
    </div>
  );
}

async function FlowTrackingResults({ qmrlId }: { qmrlId: string }) {
  const supabase = await createClient();
  const { data, error } = await fetchFlowChain(supabase, qmrlId);

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
        <p className="text-sm text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
        <p className="text-sm text-amber-400">
          No QMRL found with ID: {qmrlId}
        </p>
      </div>
    );
  }

  return <FlowChainTimeline chain={data} />;
}
