import { getSession } from '@/lib/session';
import LogoutButton from '@/components/LogoutButton';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold text-zinc-900">Çöp Kamyonu Takip</span>
          <div className="flex items-center gap-4">
            {session && (
              <span className="text-sm text-zinc-600">{session.user.full_name}</span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
