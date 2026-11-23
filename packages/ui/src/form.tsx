import type { ComponentProps, ReactNode } from "react";
import { Search } from "lucide-react";

const base =
  "w-full rounded-xl border bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-400 focus:outline-2 focus:outline-brand-100 disabled:bg-nude-100";

export function Field({
  label,
  error,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-ink-700">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>
      )}
    </label>
  );
}

type InputProps = ComponentProps<"input"> & { invalid?: boolean };
export function Input({ invalid, className = "", ...rest }: InputProps) {
  return (
    <input
      className={`${base} h-10 ${invalid ? "border-red-300" : "border-nude-300"} ${className}`}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className = "",
  ...rest
}: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={`${base} h-10 ${invalid ? "border-red-300" : "border-nude-300"} ${className}`}
      {...rest}
    />
  );
}

export function Textarea({
  invalid,
  className = "",
  ...rest
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      rows={3}
      className={`${base} py-2 ${invalid ? "border-red-300" : "border-nude-300"} ${className}`}
      {...rest}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Pesquisar...",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

/** Valida o formulário: retorna mapa campo → mensagem (vazio = válido). */
export type Errors<T extends string = string> = Partial<Record<T, string>>;
export const hasErrors = (e: Errors) => Object.keys(e).length > 0;
