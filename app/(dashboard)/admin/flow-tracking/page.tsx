import { createClient } from "@/lib/supabase/server";
import { fetchFlowChain } from "@/lib/supabase/flow-tracking-queries";
import { FlowSearch } from "@/components/flow-tracking/flow-search";
import { FlowChainTimeline } from "@/components/flow-tracking/flow-chain-timeline";

interface FlowTrackingPageProps {
  searchParams: Promise<{ qmrl_id?: string }>;
}

export default async function FlowTrackingPage({
  searchParams,
}: FlowTrackingPageProps) {
  const params = await searchParams;
  const qmrlId = params.qmrl_id;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Flow Tracking</h1>
        <p className="text-sm text-slate-400">
          Trace the complete downstream chain of any QMRL request
        </p>
      </div>

      <FlowSearch defaultValue={qmrlId} />

      {!qmrlId ? (
        <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/50 p-8 text-center">
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
      <div className="mt-4 rounded-lg border border-red-900/50 bg-red-900/20 p-4">
        <p className="text-sm text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-4 rounded-lg border border-amber-900/50 bg-amber-900/20 p-4">
        <p className="text-sm text-amber-400">
          No QMRL found with ID: {qmrlId}
        </p>
      </div>
    );
  }

  return <FlowChainTimeline chain={data} />;
}
