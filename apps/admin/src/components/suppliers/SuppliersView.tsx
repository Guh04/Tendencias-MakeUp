"use client";

import { useMemo, useState } from "react";
import { Mail, Pencil, Phone, Plus, Trash2, Truck, User } from "lucide-react";
import type { Supplier } from "@tendencias/core/types";
import { actions, useAppState } from "@/lib/store";
import { useConfirm, useToast } from "@/hooks/useFeedback";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { SupplierForm } from "./SupplierForm";

export function SuppliersView() {
  const state = useAppState();
  const confirm = useConfirm();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.suppliers
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.contact.toLowerCase().includes(q))
      .map((s) => ({ supplier: s, products: state.products.filter((p) => p.supplierId === s.id) }));
  }, [state.suppliers, state.products, search]);

  async function remove(s: Supplier) {
    const yes = await confirm({
      title: "Excluir fornecedor",
      message: `Excluir "${s.name}"? Os produtos vinculados ficarão sem fornecedor.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!yes) return;
    actions.deleteSupplier(s.id);
    toast.success("Fornecedor excluído.");
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Fornecedores"
        subtitle={`${state.suppliers.length} fornecedores cadastrados`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Novo fornecedor
          </Button>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Buscar fornecedor ou contato" className="mb-4 max-w-md" />

      {state.suppliers.length === 0 ? (
        <Card>
          <EmptyState icon={Truck} title="Nenhum fornecedor cadastrado" description="Cadastre fornecedores para vincular aos produtos." />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={Truck} title="Nenhum fornecedor encontrado" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ supplier: s, products }) => (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-ink-900">{s.name}</h3>
                <div className="flex shrink-0">
                  <IconButton
                    aria-label={`Editar ${s.name}`}
                    onClick={() => {
                      setEditing(s);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton aria-label={`Excluir ${s.name}`} onClick={() => remove(s)} className="hover:text-red-600">
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
                <li className="flex items-center gap-2">
                  <User className="size-4 text-gold-500" /> {s.contact}
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-gold-500" /> {s.phone}
                </li>
                {s.email && (
                  <li className="flex items-center gap-2 break-all">
                    <Mail className="size-4 shrink-0 text-gold-500" /> {s.email}
                  </li>
                )}
              </ul>
              <div className="mt-4 border-t border-nude-100 pt-3">
                <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">
                  Produtos fornecidos ({products.length})
                </p>
                {products.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-400">Nenhum produto vinculado.</p>
                ) : (
                  <p className="mt-1 line-clamp-3 text-sm text-ink-700">
                    {products.map((p) => p.name).join(" · ")}
                  </p>
                )}
              </div>
              {s.notes && <p className="mt-3 rounded-lg bg-nude-100 p-2.5 text-xs text-ink-500">{s.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <SupplierForm open={formOpen} supplier={editing} onClose={() => setFormOpen(false)} />
    </div>
  );
}
