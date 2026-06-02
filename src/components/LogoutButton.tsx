import { logout } from '@/actions/auth';

/** Çıkış Server Action'ını tetikleyen basit form butonu. */
export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
      >
        Çıkış
      </button>
    </form>
  );
}
