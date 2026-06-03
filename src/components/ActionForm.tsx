'use client';

import { useActionState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ActionState } from '@/actions/_shared';
import { primaryBtn } from './formStyles';

/**
 * Server Action'ı useActionState ile saran ortak form.
 * Başarılı olunca (state.ok) sayfayı tazeler ve onSuccess (örn. modalı kapat) çağrılır.
 * Hata olursa form içinde gösterilir.
 */
export default function ActionForm({
  action,
  submitLabel,
  onSuccess,
  children,
}: {
  action: (prev: ActionState | undefined, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  onSuccess?: () => void;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onSuccess?.();
    }
    // onSuccess kasıtlı olarak bağımlılıkta değil: her render'da yeni referans gelebilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {children}

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`mt-1 ${primaryBtn}`}>
        {pending ? 'Kaydediliyor…' : submitLabel}
      </button>
    </form>
  );
}
