import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUsers } from '@/lib/api';
import { getSession } from '@/lib/session';
import { formatDateTime } from '@/lib/format';
import UserCreateModal from '@/components/users/UserCreateModal';

export default async function UsersPage() {
  const session = await getSession();
  if (session?.user.role !== 'admin') redirect('/dashboard');

  const users = await getUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← Dashboard'a dön
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-zinc-900">Kullanıcılar</h1>
        </div>
        <UserCreateModal />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Kullanıcı adı</th>
              <th className="px-3 py-2">Ad soyad</th>
              <th className="px-3 py-2">E-posta</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2">Son giriş</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium text-zinc-900">{u.username}</td>
                <td className="px-3 py-2 text-zinc-700">{u.full_name ?? '—'}</td>
                <td className="px-3 py-2 text-zinc-700">{u.email}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.is_active ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {u.is_active ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                  {formatDateTime(u.last_login)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
