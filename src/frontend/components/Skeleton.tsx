/**
 * Loading placeholders. Purely visual, no timers, they disappear the moment
 * real data arrives (nothing is ever delayed to show them).
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card p-4 sm:p-5 ${className}`}>{children}</div>;
}

function Title({ w = "w-40" }: { w?: string }) {
  return <Skeleton className={`h-5 ${w} mb-4`} />;
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-9 w-36" />
    </div>
  );
}

export function KpiGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardShell key={i}>
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-28" />
        </CardShell>
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ title = "w-40", height = "h-56" }: { title?: string; height?: string }) {
  return (
    <CardShell>
      <Title w={title} />
      <Skeleton className={`${height} w-full`} />
    </CardShell>
  );
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading dashboard">
      <PageHeaderSkeleton />
      <KpiGridSkeleton count={8} />
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCardSkeleton height="h-44" />
        <ChartCardSkeleton height="h-44" />
      </div>
      <ChartCardSkeleton height="h-56" />
    </div>
  );
}

export function TransactionsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading transactions">
      <PageHeaderSkeleton />
      <Skeleton className="h-10 w-full" />
      <CardShell>
        <RowsSkeleton rows={8} />
      </CardShell>
    </div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading analytics">
      <PageHeaderSkeleton />
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  );
}

export function StatementsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading statements">
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-full max-w-md" />
      <KpiGridSkeleton count={4} />
      <CardShell>
        <Title w="w-56" />
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardShell>
    </div>
  );
}

export function AccountsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading accounts">
      <PageHeaderSkeleton />
      <div className="grid sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardShell key={i}>
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-7 w-32" />
          </CardShell>
        ))}
      </div>
    </div>
  );
}
