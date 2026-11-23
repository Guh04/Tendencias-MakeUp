"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { Product } from "@tendencias/core/types";
import { CATEGORIES, formatPercent, parseNumber } from "@tendencias/core/format";
import { margin } from "@tendencias/core/metrics";
import { actions, useAppState } from "@/lib/store";
import { uploadProductImage } from "@/lib/storage";
import { useToast } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea, hasErrors, type Errors } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";

const toStr = (n: number) => String(n).replace(".", ",");

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  description: string;
  costPrice: string;
  salePrice: string;
  stock: string;
  minStock: string;
  supplierId: string;
  imageUrl: string;
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
    <Modal open={open} onClose={onClose} title={product ? "Editar produto" : "Novo produto"} size="lg">
      {open && <FormBody key={product?.id ?? "new"} product={product} onClose={onClose} />}
    </Modal>
  );
}

function FormBody({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { settings, suppliers } = useAppState();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    category: product?.category ?? CATEGORIES[0],
    brand: product?.brand ?? "",
    description: product?.description ?? "",
    costPrice: product ? toStr(product.costPrice) : "",
    salePrice: product ? toStr(product.salePrice) : "",
    stock: product ? String(product.stock) : "0",
    minStock: product ? String(product.minStock) : String(settings.defaultMinStock),
    supplierId: product?.supplierId ?? "",
    imageUrl: product?.imageUrl ?? "",
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
    if (form.barcode.trim() && !/^[0-9A-Za-z\-._]{4,30}$/.test(form.barcode.trim()))
      e.barcode = "Use de 4 a 30 caracteres (letras, números, - . _).";
    if (!Number.isFinite(cost) || cost < 0) e.costPrice = "Informe um preço de custo válido.";
    if (!Number.isFinite(price) || price <= 0) e.salePrice = "Informe um preço de venda maior que zero.";
    else if (Number.isFinite(cost) && price < cost) e.salePrice = "O preço de venda está abaixo do custo.";
    const stock = Number(form.stock);
    if (!Number.isInteger(stock) || stock < 0) e.stock = "Use um número inteiro maior ou igual a zero.";
    const min = Number(form.minStock);
    if (!Number.isInteger(min) || min < 0) e.minStock = "Use um número inteiro maior ou igual a zero.";
    return e;
  }

  async function onImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const res = await uploadProductImage(file);
    setUploading(false);
    if ("error" in res) return toast.error(res.error);
    set("imageUrl", res.url);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (hasErrors(e)) return;

    const input = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode.trim(),
      category: form.category,
      brand: form.brand.trim(),
      description: form.description.trim(),
      costPrice: cost,
      salePrice: price,
      stock: Number(form.stock),
      minStock: Number(form.minStock),
      supplierId: form.supplierId || null,
      imageUrl: form.imageUrl || null,
    };
    setBusy(true);
    const res = product ? await actions.updateProduct(product.id, input) : await actions.addProduct(input);
    setBusy(false);
    if (!res.ok) {
      if (/SKU/i.test(res.error)) setErrors({ sku: res.error });
      if (/código de barras/i.test(res.error)) setErrors({ barcode: res.error });
      return toast.error(res.error);
    }
    toast.success(product ? "Produto atualizado com sucesso." : "Produto cadastrado com sucesso.");
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="flex items-center gap-4">
        {form.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.imageUrl} alt="Imagem do produto" className="size-20 rounded-xl border border-nude-200 object-cover" />
        ) : (
          <div className="flex size-20 items-center justify-center rounded-xl border border-dashed border-gold-400 bg-nude-100 text-ink-400">
            <ImagePlus className="size-6" />
          </div>
        )}
        <div className="space-y-1">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void onImage(e.target.files?.[0])} />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Enviando..." : "Enviar imagem"}
            </Button>
            {form.imageUrl && (
              <Button variant="ghost" size="sm" onClick={() => set("imageUrl", "")}>
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-ink-400">JPG, PNG ou WebP, até 2 MB.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Código de barras" error={errors.barcode} hint="Em branco: o sistema gera um código interno.">
          <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} invalid={!!errors.barcode} inputMode="numeric" />
        </Field>
        <Field label="Código / SKU" error={errors.sku} hint="Em branco: gerado automaticamente.">
          <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} invalid={!!errors.sku} />
        </Field>
        <Field label="Marca">
          <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
        </Field>
        <Field label="Categoria" required>
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fornecedor" className="sm:col-span-2">
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
        <Field
          label={product ? "Quantidade em estoque" : "Estoque inicial"}
          required
          error={errors.stock}
          hint={product ? "Alterar aqui gera um ajuste registrado no histórico de estoque." : undefined}
        >
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
        <Button type="submit" disabled={busy || uploading}>
          {busy ? "Salvando..." : product ? "Salvar alterações" : "Cadastrar produto"}
        </Button>
      </div>
    </form>
  );
}
