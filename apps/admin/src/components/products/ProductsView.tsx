"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Boxes, Pencil, PackagePlus, Plus, Trash2, PackageSearch } from "lucide-react";
import type { Product } from "@tendencias/core/types";
import { CATEGORIES, formatBRL, formatPercent } from "@tendencias/core/format";
import { isLowStock, margin } from "@tendencias/core/metrics";
import { actions, useAppState } from "@/lib/store";
import { useConfirm, useToast } from "@/hooks/useFeedback";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, SearchInput } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProductForm } from "./ProductForm";
import { StockModal } from "./StockModal";

export function ProductsView() {
  const state = useAppState();
  const params = useSearchParams();
  const confirm = useConfirm();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(params.get("filtro") === "baixo");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [stockFor, setStockFor] = useState<Product | null>(null);

  const supplierName = useMemo(
    () => new Map(state.suppliers.map((s) => [s.id, s.name])),
    [state.suppliers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!lowOnly || isLowStock(p)) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)),
    );
  }, [state.products, search, category, lowOnly]);

  const lowCount = state.products.filter(isLowStock).length;

  async function remove(p: Product) {
    const yes = await confirm({
      title: "Arquivar produto",
      message: `Deseja arquivar "${p.name}"? Ele deixa de aparecer nas listas e nas vendas, mas o histórico de vendas e de estoque é mantido.`,
      confirmLabel: "Arquivar",
      danger: true,
    });
    if (!yes) return;
    const res = await actions.archiveProduct(p.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Produto arquivado.");
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Produtos e estoque"
        subtitle={`${state.products.length} produtos cadastrados`}
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" /> Novo produto
          </Button>
        }
      />

      {lowCount > 0 && (
        <button
          onClick={() => setLowOnly((v) => !v)}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-gold-300 bg-gold-300/20 px-4 py-3 text-left text-sm text-ink-700 hover:bg-gold-300/30"
        >
          <AlertTriangle className="size-4 shrink-0 text-gold-600" />
          <span>
            <strong>{lowCount}</strong> produto(s) com estoque baixo ou esgotado.{" "}
            <span className="text-brand-600 underline">
              {lowOnly ? "Mostrar todos" : "Mostrar apenas estes"}
            </span>
          </span>
        </button>
      )}

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-nude-100 p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome, SKU ou marca"
            className="min-w-56 flex-1"
          />
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full sm:w-52"
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>

        {state.products.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Nenhum produto cadastrado"
            description="Cadastre seu primeiro produto para começar a controlar o estoque e registrar vendas."
            action={
              <Button onClick={openNew}>
                <Plus className="size-4" /> Cadastrar produto
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="Nada encontrado"
            description="Ajuste a busca ou os filtros para ver outros produtos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-3 py-3 font-medium">Categoria</th>
                  <th className="px-3 py-3 text-right font-medium">Custo</th>
                  <th className="px-3 py-3 text-right font-medium">Venda</th>
                  <th className="px-3 py-3 text-right font-medium">Margem</th>
                  <th className="px-3 py-3 text-center font-medium">Estoque</th>
                  <th className="px-5 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-nude-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">{p.name}</p>
                      <p className="text-xs text-ink-500">
                        {p.sku} · {p.barcode}{p.brand ? ` · ${p.brand}` : ""}
                        {p.supplierId && supplierName.get(p.supplierId)
                          ? ` · ${supplierName.get(p.supplierId)}`
                          : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{p.category}</td>
                    <td className="px-3 py-3 text-right text-ink-500">{formatBRL(p.costPrice)}</td>
                    <td className="px-3 py-3 text-right font-medium text-ink-900">{formatBRL(p.salePrice)}</td>
                    <td className="px-3 py-3 text-right">
                      <Badge tone={margin(p) >= 40 ? "green" : margin(p) >= 20 ? "gold" : "red"}>
                        {formatPercent(margin(p))}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {p.stock === 0 ? (
                        <Badge tone="red">Esgotado</Badge>
                      ) : isLowStock(p) ? (
                        <Badge tone="gold">{p.stock} · baixo</Badge>
                      ) : (
                        <span className="font-medium text-ink-700">{p.stock}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <IconButton aria-label={`Ajustar estoque de ${p.name}`} title="Ajustar estoque" onClick={() => setStockFor(p)}>
                          <PackagePlus className="size-4" />
                        </IconButton>
                        <IconButton
                          aria-label={`Editar ${p.name}`}
                          title="Editar"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </IconButton>
                        <IconButton aria-label={`Arquivar ${p.name}`} title="Arquivar" onClick={() => remove(p)} className="hover:text-red-600">
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

      <ProductForm open={formOpen} product={editing} onClose={() => setFormOpen(false)} />
      <StockModal product={stockFor} onClose={() => setStockFor(null)} />
    </div>
  );
}
