// Backup dos dados da loja: exporta todas as tabelas para arquivos JSON numa pasta datada.
// Uso:  node backup.mjs [pasta-destino]      (padrao: ./backups)
// Le as credenciais de backup.env (nesta pasta) ou das variaveis de ambiente.
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, "backup.env");
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    )
  : {};
const cfg = (k) => process.env[k] || fileEnv[k] || "";
const URL = cfg("SUPABASE_URL");
const KEY = cfg("SUPABASE_SECRET_KEY");
if (!URL || !KEY) {
  console.error("Faltam SUPABASE_URL e SUPABASE_SECRET_KEY (veja backup.env.exemplo).");
  process.exit(1);
}
const KEEP_DAYS = Number(cfg("KEEP_DAYS") || 60);
const destRoot = resolve(process.argv[2] || cfg("BACKUP_DIR") || join(here, "backups"));

const TABLES = [
  "settings", "profiles", "suppliers", "clients", "products", "product_costs", "stock_movements",
  "cash_sessions", "cash_movements", "sales", "sale_items", "sale_item_costs", "sale_payments",
  "returns", "return_items", "transactions", "audit_logs",
];

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function dump(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
const dir = join(destRoot, `tendencias-backup-${stamp}`);
mkdirSync(dir, { recursive: true });

const manifest = { criadoEm: now.toISOString(), tabelas: {} };
try {
  for (const t of TABLES) {
    const rows = await dump(t);
    writeFileSync(join(dir, `${t}.json`), JSON.stringify(rows));
    manifest.tabelas[t] = rows.length;
    console.log(`  ${t}: ${rows.length}`);
  }
  // usuarios (sem senhas): para saber quem existia
  const { data: users, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`usuarios: ${error.message}`);
  const list = users.users.map((u) => ({ id: u.id, email: u.email, criado: u.created_at, papel: u.app_metadata?.role ?? null }));
  writeFileSync(join(dir, "usuarios.json"), JSON.stringify(list));
  manifest.tabelas.usuarios = list.length;
  writeFileSync(join(dir, "LEIAME.txt"), "Backup da Tendencias MakeUp. Os arquivos .json contem os dados de cada tabela.\nSenhas nao fazem parte do backup (os usuarios precisam de nova senha em uma restauracao).\n");
  writeFileSync(join(dir, "manifesto.json"), JSON.stringify(manifest, null, 2));
  console.log(`Backup concluido: ${dir}`);
} catch (e) {
  rmSync(dir, { recursive: true, force: true });
  console.error("BACKUP FALHOU:", e.message);
  process.exit(1);
}

// rotacao: apaga backups com mais de KEEP_DAYS dias
for (const name of readdirSync(destRoot)) {
  if (!name.startsWith("tendencias-backup-")) continue;
  const p = join(destRoot, name);
  if (Date.now() - statSync(p).mtimeMs > KEEP_DAYS * 86400000) rmSync(p, { recursive: true, force: true });
}
