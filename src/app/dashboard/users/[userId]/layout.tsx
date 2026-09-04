import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUserById } from '@/lib/api';
import { getSession } from '@/lib/session';
import CustomerTabNav from '@/components/users/CustomerTabNav';

/**
 * Admin'in "bir müşterinin hesabına girdiği" çalışma alanı.
 *
 * Hedef kullanıcı URL segmentinde taşınır; gizli bir "şu an X'in hesabındasın"
 * durumu tutulmaz. Böylece sayfa yenilense, link paylaşılsa veya iki sekme
 * açılsa da hangi müşteri adına çalışıldığı belirsiz kalmaz.
 *
 * Yetki kararı backend'e aittir: müşteri bu adresi açsa bile backend
 * X-Acting-User-Id'yi yok sayar. Buradaki redirect yalnızca gezinme kolaylığı.
 */
export default async function CustomerWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}) {
  const [session, { userId }] = await Promise.all([getSession(), params]);
  if (session?.user.role !== 'admin') redirect('/dashboard');

  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const user = await getUserById(id);
  if (!user) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← Kullanıcılara dön
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold text-zinc-900">
            {user.full_name ?? user.username}
          </h1>
          <span className="text-sm text-zinc-500">@{user.username}</span>
          {!user.is_active && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              Pasif
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Bu sayfalarda yapılan kayıtlar bu müşterinin hesabına işlenir.
        </p>
      </div>

      <CustomerTabNav userId={id} />

      <div>{children}</div>
    </div>
  );
}
