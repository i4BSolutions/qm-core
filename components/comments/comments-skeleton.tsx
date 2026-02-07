import { Skeleton } from "@/components/ui/skeleton";

export function CommentsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          {/* Avatar skeleton */}
          <Skeleton className="h-8 w-8 rounded-full" />

          <div className="flex-1 space-y-2">
            {/* Name and timestamp skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>

            {/* Content skeleton */}
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
