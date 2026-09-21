import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2, WifiOff } from "lucide-react";

/**
 * Async UI states shared by the dashboards. Skeletons mirror the layout of
 * the content they stand in for, so nothing jumps when data lands.
 */

/** Stat-card row skeleton (matches QuickStat / DashStat footprints). */
export function StatSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-hairline rounded-md bg-surface p-4 md:p-5">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-7 w-14" />
        </div>
      ))}
    </div>
  );
}

/** Portrait-card grid skeleton (matches EventCard / VendorCard). */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-hairline rounded-md bg-surface overflow-hidden">
          <Skeleton className="aspect-[3/4] rounded-none" />
          <div className="p-5 space-y-3">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <div className="pt-4 border-t border-hairline flex justify-between">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Horizontal booking/ticket card skeleton (two-up grid). */
export function BookingRowsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-hairline rounded-md bg-surface p-4">
          <div className="flex gap-4">
            <Skeleton className="w-20 h-20 shrink-0" />
            <div className="flex-1 space-y-2.5 py-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dashboard table skeleton (rows with leading thumbnail). */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="border border-hairline rounded-md bg-surface overflow-hidden mb-12" aria-hidden="true">
      <div className="flex items-center justify-between p-5 md:p-6 border-b border-hairline">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-52" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="divide-y divide-hairline">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <Skeleton className="w-10 h-10 rounded-md hidden sm:block" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline page-header skeleton (eyebrow + title + rule). */
export function HeaderSkeleton({ bare = false }: { bare?: boolean }) {
  return (
    <div className={bare ? "pt-2" : "mb-10 pt-2"} aria-hidden="true">
      <Skeleton className="h-3 w-20 mb-4" />
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-0.5 w-16 mt-4" />
      <Skeleton className="h-4 w-80 max-w-full mt-4" />
    </div>
  );
}

/** Compact gold spinner for small in-place waits. */
export function InlineSpinner({ label }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2.5 py-6 text-muted-ink"
      role="status"
    >
      <Loader2 className="w-4 h-4 animate-spin text-gold" aria-hidden="true" />
      <span className="text-sm">{label || "Loading"}</span>
    </div>
  );
}

/**
 * Honest error state: names what failed, offers retry, never blames the user.
 * `compact` renders a slim panel for use inside a section.
 */
export function LoadError({
  title,
  message,
  onRetry,
  compact = false,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={
        "border border-hairline rounded-md bg-surface text-center " +
        (compact ? "p-6" : "p-8")
      }
      role="alert"
    >
      <WifiOff
        className={"text-muted-ink/30 mx-auto mb-3 " + (compact ? "w-7 h-7" : "w-9 h-9")}
        aria-hidden="true"
      />
      <h3 className="font-display text-lg font-bold text-ink mb-1.5">{title}</h3>
      {message && <p className="text-sm text-muted-ink mb-5 max-w-sm mx-auto">{message}</p>}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="press border-hairline text-ink hover:bg-surface-2 hover:text-gold font-medium rounded-md"
        >
          Try again
        </Button>
      )}
    </div>
  );
}
