'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from '@/actions/_shared';

/**
 * Onay isteyen yıkıcı işlem butonu (sil / devre dışı bırak / atamayı sonlandır).
 * hidden: forma eklenecek gizli alanlar (id, vehicle_id vb.).
 * Hata olursa buton altında gösterilir.
 */
export default function ConfirmButton({
  action,
  hidden,
  label,
  confirmText,
  className,
}: {
  action: (prev: ActionState | undefined, formData: FormData) => Promise<ActionState>;
  hidden: Record<string, string | number>;
  label: string;
  confirmText: string;
  className: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={className}>
        {pending ? '…' : label}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
