import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador (usa somente a chave publishable; o RLS protege os dados). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
