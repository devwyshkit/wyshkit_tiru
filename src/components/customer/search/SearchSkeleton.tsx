import { Skeleton } from '@/components/ui/skeleton';

/**
 * WYSHKIT 2026: Search Page Skeleton
 * Swiggy 2026 Pattern: Zero CLS - Skeleton matches exact layout dimensions
 */
export function SearchSkeleton() {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header Skeleton */}
      <div className="p-4 border-b border-zinc-100 flex items-center gap-3">
        <Skeleton className="size-9 rounded-lg shrink-0" />
        <Skeleton className="flex-1 h-10 rounded-lg" />
      </div>

      {/* Results Skeleton */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Partners Section Skeleton */}
        <div>
          <Skeleton className="h-3 w-16 mb-3 rounded-full" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col space-y-3">
                <div className="relative aspect-square rounded-2xl bg-zinc-100 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
                <div className="bg-zinc-100 h-4 w-3/4 rounded-md" />
                <div className="bg-zinc-100 h-4 w-1/2 rounded-md" />
              </div>
            ))}
          </div>
        </div>

        {/* Items Section Skeleton */}
        <div>
          <Skeleton className="h-3 w-16 mb-3 rounded-full" />
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl">
                <Skeleton className="size-12 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded-full" />
                  <Skeleton className="h-3 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
