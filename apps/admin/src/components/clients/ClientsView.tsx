"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2, Users } from "lucide-react";
import type { Client } from "@tendencias/core/types";
import { formatBRL, formatDate, formatDateTime, paymentSummary } from "@tendencias/core/format";
import { clientStats } from "@tendencias/core/metrics";
import { actions, useAppState } from "@/lib/store";
import { useConfirm, useToast } from "@/hooks/useFeedback";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClientForm } from "./ClientForm";

export function ClientsView() {
  const state = useAppState();
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [detail, setDetail] = useState<Client | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.clients
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.email.toLowerCase().includes(q),
      )
      .map((c) => ({ client: c, stats: clientStats(c, state.sales) }));
  }, [state.clients, state.sales, search]);

  async function remove(c: Client) {
    const yes = await confirm({
      title: "Excluir cliente",
      message: `Excluir "${c.name}"? As vendas dela permanecem no histórico, como "não identificado".`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!yes) return;
    const res = await actions.deleteClient(c.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Cliente excluído.");
  }

  const detailStats = detail ? clientStats(detail, state.sales) : null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Clientes"
        subtitle={`${state.clients.length} clientes cadastrados`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Novo cliente
          </Button>
        }
      />

      <Card>
        <div className="border-b border-nude-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, telefone ou e-mail" className="max-w-md" />
        </div>
        {state.clients.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum cliente cadastrado" description="Cadastre clientes para acompanhar o histórico de compras." />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum cliente encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-3 py-3 font-medium">Cadastro</th>
                  <th className="px-3 py-3 text-center font-medium">Compras</th>
                  <th className="px-3 py-3 text-right font-medium">Total comprado</th>
                  <th className="px-3 py-3 font-medium">Última compra</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {rows.map(({ client: c, stats }) => (
                  <tr key={c.id} className="hover:bg-nude-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">{c.name}</p>
                      <p className="text-xs text-ink-500">
                        {c.phone}
                        {c.email && ` · ${c.email}`}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{formatDate(c.createdAt)}</td>
                    <td className="px-3 py-3 text-center">{stats.count}</td>
                    <td className="px-3 py-3 text-right font-semibold text-brand-700">{formatBRL(stats.total)}</td>
                    <td className="px-3 py-3 text-ink-700">{stats.last ? formatDate(stats.last) : "—"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton aria-label={`Ver histórico de ${c.name}`} title="Histórico" onClick={() => setDetail(c)}>
                          <Eye className="size-4" />
                        </IconButton>
                        <IconButton
                          aria-label={`Editar ${c.name}`}
                          title="Editar"
                          onClick={() => {
                            setEditing(c);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton aria-label={`Excluir ${c.name}`} title="Excluir" onClick={() => remove(c)} className="hover:text-red-600">
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ClientForm open={formOpen} client={editing} onClose={() => setFormOpen(false)} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} size="md">
        {detail && detailStats && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ["Compras", String(detailStats.count)],
                ["Total", formatBRL(detailStats.total)],
                ["Última", detailStats.last ? formatDate(detailStats.last) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-nude-100 p-3">
                  <p className="text-xs text-ink-500">{k}</p>
                  <p className="font-display text-lg font-semibold text-brand-700">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-ink-500">
              {detail.phone}
              {detail.email && ` · ${detail.email}`} · cliente desde {formatDate(detail.createdAt)}
            </p>
            {detailStats.sales.length === 0 ? (
              <EmptyState icon={Users} title="Sem compras registradas" />
            ) : (
              <ul className="divide-y divide-nude-100 rounded-xl border border-nude-200">
                {detailStats.sales.map((s) => (
                  <li key={s.id} className="px-4 py-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        #{String(s.number).padStart(4, "0")} · {formatDateTime(s.date)}
                      </span>
                      <span className="font-semibold text-brand-700">{formatBRL(s.total)}</span>
                    </div>
                    <p className="text-xs text-ink-500">
                      {s.items.map((i) => `${i.qty}× ${i.name}`).join(", ")} · {paymentSummary(s.payments)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
