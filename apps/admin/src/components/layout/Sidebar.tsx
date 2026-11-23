"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  UserCog,
  Users,
  LogOut,
  Landmark,
  ArrowLeftRight,
  ScrollText,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAppState } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";

export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag },
  { href: "/produtos", label: "Produtos e estoque", icon: Boxes },
  { href: "/caixas", label: "Caixas", icon: Landmark },
  { href: "/estoque", label: "Mov. de estoque", icon: ArrowLeftRight },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/fornecedores", label: "Fornecedores", icon: Truck },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/usuarios", label: "Usuários", icon: UserCog },
  { href: "/logs", label: "Atividades", icon: ScrollText },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { settings } = useAppState();
  const { state: auth, signOut } = useAuth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-nude-200 bg-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-nude-100 px-5 py-5">
          {settings.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logo}
              alt="Logo da loja"
              className="size-10 rounded-xl border border-gold-300 object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-600 text-white ring-2 ring-gold-300 ring-offset-2">
              <Sparkles className="size-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight font-semibold text-brand-800">
              {settings.storeName}
            </p>
            <p className="text-[10px] tracking-[0.2em] text-gold-600 uppercase">BeautyPro</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-nude-100 lg:hidden"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-500 hover:bg-nude-100 hover:text-ink-900"
                }`}
              >
                <Icon className={`size-[18px] ${active ? "text-brand-500" : ""}`} />
                {label}
                {active && <span className="ml-auto h-4 w-0.5 rounded bg-gold-500" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-nude-100 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {(auth.profile?.full_name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{auth.profile?.full_name}</p>
              <p className="text-xs text-ink-500">Administrador</p>
            </div>
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-ink-500 hover:bg-nude-100 hover:text-brand-700"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
