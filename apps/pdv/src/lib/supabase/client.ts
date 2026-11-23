import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador. Cookie proprio (sb-pdv) para nao misturar a sessao com a do ADMIN. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: { name: "sb-pdv" } },
  );
}
