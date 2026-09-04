/**
 * Formun "hangi kullanıcı adına" bilgisini taşıyan gizli alan.
 *
 * Admin bir müşterinin çalışma alanındayken (/dashboard/users/[userId]/…)
 * doldurulur; müşteri kendi hesabındayken hiç render edilmez.
 *
 * Yetki kanıtı DEĞİLDİR: backend bu değeri yalnızca token'daki rol admin ise
 * dikkate alır (bkz. lib/api.ts → actingUserHeader).
 */
export default function ActingUserField({ userId }: { userId?: number }) {
  if (userId == null) return null;
  return <input type="hidden" name="acting_user_id" value={userId} />;
}
