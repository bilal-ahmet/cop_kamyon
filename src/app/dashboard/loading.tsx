export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-4 h-7 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
