'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from '@/actions/_shared';

/**
 * Bildirim satırındaki tek tıklık işlem (okundu işaretle / tümünü okundu işaretle).
 * ConfirmButton'dan farkı: yıkıcı olmadığı için onay sormaz.
 */
export default function NotificationActions({
  action,
  hidden = {},
  label,
  pendingLabel = '…',
  className,
}: {
  action: (prev: ActionState | undefined, formData: FormData) => Promise<ActionState>;
  hidden?: Record<string, string | number>;
  label: string;
  pendingLabel?: string;
  className: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
