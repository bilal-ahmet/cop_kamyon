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

/**
 * Formun taşıdığı "hangi kullanıcı adına" bilgisi (admin müşteri çalışma alanı).
 * Alan yoksa undefined döner = oturum sahibi kendi adına çalışıyor.
 *
 * Bu değer istemciden geldiği için yetki kanıtı DEĞİLDİR; sadece hedefi taşır.
 * Backend `X-Acting-User-Id` başlığını yalnızca token'daki rol admin ise dikkate
 * alır, müşterinin gönderdiğini yok sayar.
 */
export function actingUserFrom(formData: FormData): number | undefined {
  const n = numOrNull(formData.get('acting_user_id'));
  return n != null && n > 0 ? n : undefined;
}
