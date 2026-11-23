export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const digitsOnly = (v: string) => v.replace(/\D/g, "");

export function isValidPhone(v: string) {
  const d = digitsOnly(v);
  return d.length >= 10 && d.length <= 13;
}

/** Máscara simples de telefone brasileiro: (11) 91234-5678. */
export function maskPhone(v: string) {
  const d = digitsOnly(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
