import type { ReactNode } from 'react';
import { inputCls } from './formStyles';

/** Tek satır metin/sayı/tarih girişi (label + input). */
export function TextField({
  label,
  name,
  defaultValue,
  required,
  type = 'text',
  placeholder,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        step={step}
        defaultValue={defaultValue ?? undefined}
        className={inputCls}
      />
    </label>
  );
}

/** Çok satırlı metin girişi. */
export function TextareaField({
  label,
  name,
  defaultValue,
  rows = 2,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <textarea name={name} rows={rows} defaultValue={defaultValue ?? undefined} className={inputCls} />
    </label>
  );
}

/** Açılır seçim kutusu. <option>'lar children olarak verilir. */
export function SelectField({
  label,
  name,
  defaultValue,
  required,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-zinc-700">{label}</span>
      <select name={name} defaultValue={defaultValue} required={required} className={inputCls}>
        {children}
      </select>
    </label>
  );
}

/** Onay kutusu (checkbox). */
export function CheckboxField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 rounded border-zinc-300" />
      {label}
    </label>
  );
}
