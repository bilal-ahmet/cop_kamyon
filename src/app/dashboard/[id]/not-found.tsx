import Link from 'next/link';

export default function VehicleNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">Araç bulunamadı</h1>
      <p className="text-sm text-zinc-500">
        Bu araç size atanmamış olabilir ya da mevcut değil.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Araçlara dön
      </Link>
    </div>
  );
}
