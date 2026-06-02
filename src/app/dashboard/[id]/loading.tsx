export default function VehicleDetailLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-96 animate-pulse rounded-lg bg-zinc-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
