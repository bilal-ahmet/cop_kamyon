'use client';

import { useState, type ReactNode } from 'react';

/**
 * Tetik butonuna basınca açılan basit modal.
 * children bir render-prop'tur: (close) => içerik. Form başarılı olunca close() çağrılır.
 */
export default function Modal({
  triggerLabel,
  triggerClassName,
  title,
  children,
}: {
  triggerLabel: ReactNode;
  triggerClassName: string;
  title: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={close}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
              <button
                type="button"
                onClick={close}
                className="text-xl leading-none text-zinc-400 hover:text-zinc-700"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>
            {children(close)}
          </div>
        </div>
      )}
    </>
  );
}
