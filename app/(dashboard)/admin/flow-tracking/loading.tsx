import { Skeleton } from "@/components/ui/skeleton";

export default function FlowTrackingLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
        <Skeleton className="h-5 w-80" />
      </div>

      {/* Search bar skeleton */}
      <div className="command-panel">
        <Skeleton className="h-10 w-full max-w-2xl" />
      </div>

      {/* Results skeleton - chain timeline placeholder */}
      <div className="command-panel corner-accents space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-16 w-11/12 ml-6" />
        <Skeleton className="h-16 w-10/12 ml-12" />
        <Skeleton className="h-16 w-10/12 ml-12" />
      </div>
    </div>
  );
}
