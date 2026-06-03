// Server Action'ların ortak dönüş tipi (useActionState ile kullanılır).
export interface ActionState {
  ok?: boolean;
  error?: string;
}

/** FormData değerini trim'ler; boşsa null döner. */
export function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

/** FormData değerini sayıya çevirir; boş/geçersizse null döner. */
export function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
