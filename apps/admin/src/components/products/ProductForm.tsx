"use client";

import { useState } from "react";
import type { Product } from "@tendencias/core/types";
import { CATEGORIES, formatPercent, parseNumber } from "@tendencias/core/format";
import { margin } from "@tendencias/core/metrics";
import { actions, useAppState } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, hasErrors, type Errors } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";

const toStr = (n: number) => String(n).replace(".", ",");

interface FormState {
  name: string;
  sku: string;
  category: string;
  brand: string;
  description: string;
  costPrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  supplierId: string;
}

type Key = keyof FormState;

export function ProductForm({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}) {
  // O formulário é remontado a cada abertura (key), então o estado inicial é suficiente.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? "Editar produto" : "Novo produto"}
      size="lg"
    >
      {open && <FormBody key={product?.id ?? "new"} product={product} onClose={onClose} />}
    </Modal>
  );
}

function FormBody({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { settings, suppliers } = useAppState();
  const toast = useToast();
  const [form, setForm] = useState<FormState>({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    category: product?.category ?? CATEGORIES[0],
    brand: product?.brand ?? "",
    description: product?.description ?? "",
    costPrice: product ? toStr(product.costPrice) : "",
    salePrice: product ? toStr(product.salePrice) : "",
    stock: product ? String(product.stock) : "0",
    minStock: product ? String(product.minStock) : String(settings.defaultMinStock),
    supplierId: product?.supplierId ?? "",
  });
  const [errors, setErrors] = useState<Errors<Key>>({});

  const set = (k: Key, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const cost = parseNumber(form.costPrice);
  const price = parseNumber(form.salePrice);
  const previewOk = Number.isFinite(cost) && Number.isFinite(price) && price > 0;

  function validate(): Errors<Key> {
    const e: Errors<Key> = {};
    if (form.name.trim().length < 2) e.name = "Informe o nome do produto.";
    if (!form.sku.trim()) e.sku = "Informe o código/SKU.";
    if (!form.brand.trim()) e.brand = "Informe a marca.";
    if (!Number.isFinite(cost) || cost < 0) e.costPrice = "Informe um preço de custo válido.";
    if (!Number.isFinite(price) || price <= 0) e.salePrice = "Informe um preço de venda maior que zero.";
    else if (Number.isFinite(cost) && price < cost) e.salePrice = "O preço de venda está abaixo do custo.";
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0) e.stock = "Use um número inteiro maior ou igual a zero.";
    const min = Number(form.minStock);
    if (!Number.isInteger(min) || min < 0) e.minStock = "Use um número inteiro maior ou igual a zero.";
    return e;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (hasErrors(e)) return;

    const input = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      category: form.category,
      brand: form.brand.trim(),
      description: form.description.trim(),
      costPrice: cost,
      salePrice: price,
      stock: Number(form.stock),
      minStock: Number(form.minStock),
      supplierId: form.supplierId || null,
    };
    const res = product ? actions.updateProduct(product.id, input) : actions.addProduct(input);
    if (!res.ok) {
      if (res.error.includes("SKU")) setErrors({ sku: res.error });
      toast.error(res.error);
      return;
    }
    toast.success(product ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Código / SKU" required error={errors.sku}>
          <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} invalid={!!errors.sku} />
        </Field>
        <Field label="Marca" required error={errors.brand}>
          <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} invalid={!!errors.brand} />
        </Field>
        <Field label="Categoria" required>
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fornecedor">
          <Select value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
            <option value="">— Sem fornecedor —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Preço de custo (R$)" required error={errors.costPrice}>
          <Input inputMode="decimal" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} invalid={!!errors.costPrice} placeholder="0,00" />
        </Field>
        <Field
          label="Preço de venda (R$)"
          required
          error={errors.salePrice}
          hint={previewOk ? `Margem de lucro: ${formatPercent(margin({ costPrice: cost, salePrice: price }))}` : undefined}
        >
          <Input inputMode="decimal" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} invalid={!!errors.salePrice} placeholder="0,00" />
        </Field>
        <Field label="Quantidade em estoque" required error={errors.stock}>
          <Input inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value)} invalid={!!errors.stock} />
        </Field>
        <Field label="Estoque mínimo" required error={errors.minStock} hint="Abaixo ou igual a este valor, o produto entra em alerta.">
          <Input inputMode="numeric" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} invalid={!!errors.minStock} />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">{product ? "Salvar alterações" : "Cadastrar produto"}</Button>
      </div>
    </form>
  );
}
