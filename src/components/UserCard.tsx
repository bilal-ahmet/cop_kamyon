import Link from 'next/link';
import type { UserProfile } from '@/lib/types';
import { formatDateTime } from '@/lib/format';

export default function UserCard({ user }: { user: UserProfile }) {
  return (
    <Link
      href={`/dashboard/users/${user.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-zinc-900">{user.username}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            user.role === 'admin'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-zinc-100 text-zinc-600'
          }`}
        >
          {user.role === 'admin' ? 'Admin' : 'Müşteri'}
        </span>
      </div>

      {user.full_name && (
        <p className="mt-1 text-sm text-zinc-600">{user.full_name}</p>
      )}
      <p className="mt-0.5 text-xs text-zinc-500">{user.email}</p>

      <p className="mt-2 text-xs text-zinc-400">
        Son giriş: {formatDateTime(user.last_login)}
      </p>
    </Link>
  );
}
