import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gradient-to-r from-[#242F3D] via-[#2B3A4D] to-[#242F3D] bg-[length:200%_100%] animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

export function FileCardSkeleton() {
  return (
    <div className="bg-[#242F3D] rounded-xl p-5 border border-[rgba(255,255,255,0.10)]">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="w-14 h-14 rounded-xl" />
        <Skeleton className="w-8 h-8 rounded-md" />
      </div>
      <Skeleton className="h-4 w-3/4 mb-2" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function FileRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[rgba(255,255,255,0.03)]">
      <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
      <Skeleton className="h-4 flex-1 max-w-[200px]" />
      <Skeleton className="h-3 w-16 shrink-0" />
      <Skeleton className="h-3 w-24 shrink-0" />
      <Skeleton className="h-8 w-20 rounded-md shrink-0" />
    </div>
  );
}
