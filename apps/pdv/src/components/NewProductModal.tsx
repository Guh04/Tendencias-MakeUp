"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { CATEGORIES } from "@tendencias/core/format";
import { createClient } from "@/lib/supabase/client";
import { uploadProductImage } from "@/lib/storage";
import { friendly, parseCents } from "@/lib/money";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { Field, Input, Select, Textarea, hasErrors, type Errors } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";

type Key = "name" | "barcode" | "cost" | "price" | "stock";

export function NewProductModal({
  open,
  initialBarcode,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialBarcode: string;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Novo produto" size="lg">
      {open && <Body initialBarcode={initialBarcode} onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function Body({
  initialBarcode,
  onClose,
  onCreated,
}: {
  initialBarcode: string;
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    barcode: initialBarcode,
    category: CATEGORIES[0],
    cost: "",
    price: "",
    stock: "1",
    description: "",
    imageUrl: "",
  });
  const [errors, setErrors] = useState<Errors<Key>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

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
    const cost = parseCents(form.cost);
    const price = parseCents(form.price);
    const stock = Number(form.stock);
    const e: Errors<Key> = {};
    if (form.name.trim().length < 2) e.name = "Informe o nome do produto.";
    if (form.barcode.trim() && !/^[0-9A-Za-z\-._]{4,30}$/.test(form.barcode.trim())) e.barcode = "Código inválido (4 a 30 caracteres).";
    if (!Number.isFinite(cost) || cost < 0) e.cost = "Informe o preço de custo.";
    if (!Number.isFinite(price) || price <= 0) e.price = "Informe o preço de venda.";
    else if (Number.isFinite(cost) && price < cost) e.price = "Preço de venda abaixo do custo.";
    if (!Number.isInteger(stock) || stock < 0) e.stock = "Quantidade inteira, zero ou mais.";
    setErrors(e);
    if (hasErrors(e)) return;

    setBusy(true);
    const { error } = await createClient().rpc("create_product", {
      p_name: form.name.trim(),
      p_barcode: form.barcode.trim(),
      p_category: form.category,
      p_cost_cents: cost,
      p_price_cents: price,
      p_stock: stock,
      p_description: form.description.trim(),
      p_image_url: form.imageUrl || null,
      p_origin: "pdv",
    });
    setBusy(false);
    if (error) {
      const msg = friendly(error.message);
      if (/código de barras/i.test(msg)) setErrors({ barcode: msg });
      return toast.error(msg);
    }
    toast.success("Produto cadastrado.");
    onCreated(form.name.trim());
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="flex items-center gap-4">
        {form.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.imageUrl} alt="Produto" className="size-16 rounded-xl border border-nude-200 object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-xl border border-dashed border-gold-400 bg-nude-100 text-ink-400">
            <ImagePlus className="size-5" />
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void onImage(e.target.files?.[0])} />
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? "Enviando..." : form.imageUrl ? "Trocar imagem" : "Enviar imagem"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do produto" required error={errors.name} className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Código de barras" error={errors.barcode} hint="Em branco: o sistema gera um código interno.">
          <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} invalid={!!errors.barcode} inputMode="numeric" />
        </Field>
        <Field label="Categoria" required>
          <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Preço de custo (R$)" required error={errors.cost}>
          <Input inputMode="decimal" value={form.cost} onChange={(e) => set("cost", e.target.value)} invalid={!!errors.cost} placeholder="0,00" />
        </Field>
        <Field label="Preço de venda (R$)" required error={errors.price}>
          <Input inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} invalid={!!errors.price} placeholder="0,00" />
        </Field>
        <Field label="Quantidade inicial em estoque" required error={errors.stock}>
          <Input inputMode="numeric" value={form.stock} onChange={(e) => set("stock", e.target.value)} invalid={!!errors.stock} />
        </Field>
        <Field label="Descrição" className="sm:col-span-2">
          <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-nude-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy || uploading}>
          {busy ? "Salvando..." : "Cadastrar produto"}
        </Button>
      </div>
    </form>
  );
}
