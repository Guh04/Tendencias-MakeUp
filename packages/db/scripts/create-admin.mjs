// Cria (ou promove) o primeiro administrador. A senha e digitada aqui, sem eco, e nunca e exibida.
// Uso: node packages/db/scripts/create-admin.mjs email@dominio.com "Nome Completo"
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const [email, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ").trim();
if (!email || !fullName) {
  console.error('Uso: node packages/db/scripts/create-admin.mjs email@dominio.com "Nome Completo"');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, "../../../apps/admin/.env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error("Preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY em apps/admin/.env.local");
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolveAnswer) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolveAnswer(value);
        }
        if (ch === "\u0003") process.exit(1);
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const password = await askHidden("Senha (min. 8 caracteres, nao aparece ao digitar): ");
const confirm = await askHidden("Repita a senha: ");
if (password !== confirm) {
  console.error("As senhas nao conferem.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("A senha precisa ter ao menos 8 caracteres.");
  process.exit(1);
}

const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await service.auth.admin.createUser({
  email: email.trim().toLowerCase(),
  password,
  email_confirm: true,
  app_metadata: { role: "admin" },
  user_metadata: { full_name: fullName },
});
if (error) {
  console.error("Nao foi possivel criar o usuario:", error.message);
  process.exit(1);
}
await service.from("profiles").update({ full_name: fullName }).eq("id", data.user.id);
console.log(`Administrador criado: ${email.trim().toLowerCase()}`);
