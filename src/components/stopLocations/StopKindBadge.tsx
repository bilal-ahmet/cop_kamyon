import type { StopLocationKind } from '@/lib/types';

const KIND_STYLES: Record<Exclude<StopLocationKind, 'stop'>, { label: string; cls: string }> = {
  start: { label: 'Başlangıç', cls: 'bg-emerald-100 text-emerald-700' },
  end: { label: 'Bitiş', cls: 'bg-red-100 text-red-700' },
};

/** Lokasyon türü rozeti. Sıradan duraklarda ("stop") hiçbir şey göstermez. */
export default function StopKindBadge({ kind }: { kind: StopLocationKind | null | undefined }) {
  if (kind !== 'start' && kind !== 'end') return null;
  const { label, cls } = KIND_STYLES[kind];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
  );
}
