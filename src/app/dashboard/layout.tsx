import Link from 'next/link';
import { getCurrentUser } from '@/lib/api';
import LogoutButton from '@/components/LogoutButton';
import ProfileModal from '@/components/users/ProfileModal';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Token yoksa/geçersizse apiFetch otomatik /login'e yönlendirir.
  const user = await getCurrentUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-semibold text-zinc-900">
            Çöp Kamyonu Takip
          </Link>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <span className="text-sm text-zinc-600">{user.full_name ?? user.username}</span>
                <ProfileModal user={user} />
              </>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
