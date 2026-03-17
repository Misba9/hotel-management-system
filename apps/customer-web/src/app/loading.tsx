import { SkeletonCard } from "@/components/shared/skeleton-card";

export default function GlobalLoading() {
  return (
    <section className="space-y-4">
      <div className="h-10 w-52 animate-pulse rounded-xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <SkeletonCard key={idx} />
        ))}
      </div>
    </section>
  );
}
