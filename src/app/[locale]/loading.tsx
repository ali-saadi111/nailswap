import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[640px] px-6 pt-6" aria-busy="true">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-4 w-72" />
      <Skeleton className="mt-2 w-56" />
      <div className="mt-10 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3.5">
            <Skeleton circle className="size-11" />
            <div className="flex-1">
              <Skeleton className="w-40" />
              <Skeleton className="mt-2 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
