import { cn } from '@/lib/utils'

/** Skeleton met vaste hoogtes, zodat er geen layout shift ontstaat. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-tile bg-line/70', className)} aria-hidden />
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-card border border-line bg-card p-4">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-4 h-4 w-24" />
          <Skeleton className="mt-3 h-5 w-full" />
          <Skeleton className="mt-2 h-16 w-full" />
          <Skeleton className="mt-4 h-9 w-32" />
        </div>
      ))}
    </div>
  )
}
