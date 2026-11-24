"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  History,
  Lock,
  LockOpen,
  LogOut,
  PackagePlus,
  ScanBarcode,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth, type Profile } from "@/hooks/useAuth";
import type { Catalog } from "@/hooks/useCatalog";
import type { CashSession } from "@/lib/types";
import { brl } from "@/lib/money";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { CashMovementModal } from "./CashMovementModal";
import { ClientPicker } from "./ClientPicker";
import { CloseCashModal } from "./CloseCashModal";
import { HistoryModal } from "./HistoryModal";
import { NewProductModal } from "./NewProductModal";
import { OpenCashModal } from "./OpenCash";
import { PriceLookupModal, type LookupFilter } from "./PriceLookupModal";

interface Summary {
  sales_count: number;
  sales_total_cents: number;
  expected_cash_cents: number;
  pending_sales: number;
}

type ModalName = null | "open" | "product" | "lookup" | "clients" | "history" | "move" | "close";

interface Tile {
  key: string;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  needsCash?: boolean;
  modal: Exclude<ModalName, null>;
}

const TILES: Tile[] = [
  { key: "1", label: "Cadastrar produto", hint: "Novo item no estoque", icon: PackagePlus, modal: "product" },
  { key: "2", label: "Consultar produtos", hint: "Preço, estoque e código", icon: Search, modal: "lookup" },
  { key: "3", label: "Clientes", hint: "Buscar e cadastrar", icon: Users, modal: "clients" },
  { key: "4", label: "Histórico de vendas", hint: "Reimprimir, cancelar, devolver", icon: History, modal: "history" },
  { key: "5", label: "Sangria / Suprimento", hint: "Retirar ou colocar dinheiro", icon: ArrowLeftRight, needsCash: true, modal: "move" },
  { key: "6", label: "Fechar caixa", hint: "Conferir a gaveta e encerrar", icon: Lock, needsCash: true, modal: "close" },
];

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Home({
  session,
  profile,
  catalog,
  onStartSales,
  onSessionChanged,
}: {
  session: CashSession | null;
  profile: Profile;
  catalog: Catalog;
  onStartSales: () => void;
  onSessionChanged: () => void;
}) {
  const { signOut } = useAuth();
  const toast = useToast();
  const { products, settings, reload } = catalog;
  const [now, setNow] = useState(() => new Date());
  const [modal, setModal] = useState<ModalName>(null);
  const [lookupFilter, setLookupFilter] = useState<LookupFilter>("todos");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const sessionId = session?.id ?? null;
  const loadSummary = useCallback(async () => {
    if (!sessionId) {
      setSummary(null);
      return;
    }
    const { data } = await createClient().rpc("cash_session_summary", { p_session_id: sessionId });
    if (data) setSummary(data as Summary);
  }, [sessionId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSummary();
  }, [loadSummary]);

  const close = useCallback(() => {
    setModal(null);
    void loadSummary();
  }, [loadSummary]);

  const openTile = useCallback(
    (t: Tile) => {
      if (t.needsCash && !session) return toast.error("Abra o caixa primeiro.");
      setLookupFilter("todos");
      setModal(t.modal);
    },
    [session, toast],
  );

  // atalhos: Enter = acao principal, 1-6 = cartoes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modal) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Enter" || e.key === "F2") {
        if (e.key === "Enter" && (e.target as HTMLElement | null)?.tagName === "BUTTON") return; // deixa o botao focado agir
        e.preventDefault();
        if (session) onStartSales();
        else setModal("open");
        return;
      }
      const t = TILES.find((x) => x.key === e.key);
      if (t) openTile(t);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, session, onStartSales, openTile]);

  const outOfStock = products.filter((p) => p.stock === 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 3).length;
  const staleSession = !!session && new Date(session.openedAt).toDateString() !== now.toDateString();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-nude-50 via-white to-brand-50">
      <header className="flex items-center gap-3 border-b border-nude-200 bg-white/80 px-6 py-3 backdrop-blur">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-white ring-2 ring-gold-300 ring-offset-2">
          <ScanBarcode className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-lg font-semibold text-brand-800">{settings.storeName}</p>
          <p className="text-[10px] tracking-[0.2em] text-gold-600 uppercase">PDV · Ponto de venda</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <p className="hidden text-sm text-ink-500 sm:block">
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })} ·{" "}
            {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="font-display text-3xl font-semibold text-ink-900">
          {greeting(now)}, {profile.full_name.split(" ")[0]}!
        </h1>
        <p className="mt-1 text-sm text-ink-500">O que você quer fazer agora?</p>

        {/* Situacao do caixa */}
        <section className={`mt-6 rounded-2xl border bg-white p-5 shadow-soft ${session ? "border-emerald-200" : "border-nude-300"}`}>
          <div className="flex flex-wrap items-center gap-5">
            <div
              className={`flex size-14 items-center justify-center rounded-2xl ${session ? "bg-emerald-50 text-emerald-600" : "bg-nude-100 text-ink-500"}`}
            >
              {session ? <LockOpen className="size-7" /> : <Lock className="size-7" />}
            </div>
            <div className="min-w-0 flex-1">
              {session ? (
                <>
                  <p className="font-display text-xl font-semibold text-ink-900">Caixa nº {session.number} aberto</p>
                  <p className="text-sm text-ink-500">
                    Desde {new Date(session.openedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · fundo de caixa{" "}
                    {brl(session.openingCents)}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl font-semibold text-ink-900">Caixa fechado</p>
                  <p className="text-sm text-ink-500">Abra o caixa para começar a vender. Cadastros e consultas já podem ser feitos.</p>
                </>
              )}
            </div>
            {session ? (
              <Button className="h-14 px-8 text-base" onClick={onStartSales}>
                <ShoppingCart className="size-5" /> Iniciar vendas <kbd className="rounded bg-white/20 px-1.5 text-xs">Enter</kbd>
              </Button>
            ) : (
              <Button className="h-14 px-8 text-base" onClick={() => setModal("open")}>
                <LockOpen className="size-5" /> Abrir caixa <kbd className="rounded bg-white/20 px-1.5 text-xs">Enter</kbd>
              </Button>
            )}
          </div>

          {session && summary && (
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-nude-100 pt-4 text-sm">
              <div>
                <dt className="text-xs text-ink-500">Vendas neste caixa</dt>
                <dd className="font-display text-2xl font-semibold text-ink-900">{summary.sales_count}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Total vendido</dt>
                <dd className="font-display text-2xl font-semibold text-brand-700">{brl(summary.sales_total_cents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Dinheiro esperado na gaveta</dt>
                <dd className="font-display text-2xl font-semibold text-ink-900">{brl(summary.expected_cash_cents)}</dd>
              </div>
            </dl>
          )}
        </section>

        {/* Avisos */}
        {(staleSession || !!summary?.pending_sales || outOfStock > 0 || lowStock > 0) && (
          <section className="mt-4 space-y-2">
            {staleSession && (
              <p className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
                <AlertTriangle className="size-4 shrink-0" /> Este caixa foi aberto em outro dia. Confira se não é preciso fechá-lo e abrir um novo.
              </p>
            )}
            {!!summary?.pending_sales && (
              <p className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
                <AlertTriangle className="size-4 shrink-0" /> Há {summary.pending_sales} venda(s) pendente(s) neste caixa. Conclua ou cancele no histórico.
              </p>
            )}
            {(outOfStock > 0 || lowStock > 0) && (
              <button
                onClick={() => {
                  setLookupFilter("baixo");
                  setModal("lookup");
                }}
                className="flex w-full items-center gap-2 rounded-xl bg-gold-300/25 px-4 py-2.5 text-left text-sm text-gold-600 hover:bg-gold-300/40"
              >
                <AlertTriangle className="size-4 shrink-0" />
                <span>
                  {outOfStock > 0 && <strong>{outOfStock} produto(s) sem estoque</strong>}
                  {outOfStock > 0 && lowStock > 0 && " · "}
                  {lowStock > 0 && <strong>{lowStock} com estoque baixo</strong>} — clique para ver
                </span>
              </button>
            )}
          </section>
        )}

        {/* Acoes */}
        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => {
            const locked = !!t.needsCash && !session;
            return (
              <button
                key={t.key}
                onClick={() => openTile(t)}
                disabled={locked}
                className="group flex items-center gap-4 rounded-2xl border border-nude-200 bg-white p-4 text-left transition hover:border-brand-400 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-nude-200 disabled:hover:shadow-none"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-enabled:group-hover:bg-brand-600 group-enabled:group-hover:text-white">
                  <t.icon className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink-900">{t.label}</span>
                  <span className="block text-xs text-ink-500">{locked ? "Requer caixa aberto" : t.hint}</span>
                </span>
                <kbd className="rounded bg-nude-100 px-1.5 py-0.5 text-[10px] text-ink-500">{t.key}</kbd>
              </button>
            );
          })}
        </section>
      </main>

      <OpenCashModal
        open={modal === "open"}
        operator={profile.full_name}
        onClose={close}
        onOpened={() => {
          setModal(null);
          onSessionChanged();
        }}
      />
      <NewProductModal
        open={modal === "product"}
        initialBarcode=""
        onClose={close}
        onCreated={() => {
          setModal(null);
          void reload();
        }}
      />
      <PriceLookupModal open={modal === "lookup"} products={products} initialFilter={lookupFilter} onClose={close} />
      <ClientPicker open={modal === "clients"} manage onClose={close} />
      <HistoryModal open={modal === "history"} profile={profile} settings={settings} onClose={close} onChanged={() => void reload()} />
      {session && <CashMovementModal open={modal === "move"} sessionId={session.id} onClose={close} />}
      {session && (
        <CloseCashModal
          open={modal === "close"}
          session={session}
          operator={profile.full_name}
          settings={settings}
          onClose={close}
          onClosed={() => {
            setModal(null);
            onSessionChanged();
          }}
        />
      )}
    </div>
  );
}
