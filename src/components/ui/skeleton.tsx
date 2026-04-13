'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-dark-700/50',
        className
      )}
    />
  );
}

function SkeletonLine({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-4 w-full', className)} />;
}

function SkeletonCircle({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />;
}

function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dark-700 bg-dark-800 p-5 space-y-3',
        className
      )}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

function SkeletonTableRow({ columns = 6, className }: SkeletonProps & { columns?: number }) {
  return (
    <div className={cn('flex items-center gap-4 py-3 px-4', className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === 0 ? 'w-16' : i === 1 ? 'w-28' : 'w-20'
          )}
        />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonLine, SkeletonCircle, SkeletonCard, SkeletonTableRow };
