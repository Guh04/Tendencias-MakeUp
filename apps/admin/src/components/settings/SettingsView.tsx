"use client";

import { useRef, useState } from "react";
import { Database, Download, ImagePlus } from "lucide-react";
import type { PaymentMethod, Settings } from "@tendencias/core/types";
import { PAYMENT_LABELS, PAYMENT_METHODS, parseNumber } from "@tendencias/core/format";
import { isValidEmail, isValidPhone, maskPhone } from "@tendencias/core/validation";
import { actions, useAppState } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select, hasErrors, type Errors } from "@/components/ui/Form";
import { PageHeader } from "@/components/ui/PageHeader";

type Key = "storeName" | "phone" | "email" | "defaultMinStock" | "maxOperatorDiscountPct";
const MAX_LOGO_BYTES = 300 * 1024;

export function SettingsView() {
  const state = useAppState();
  // Remonta o formulário quando as configurações mudam (ex.: salvas por outro administrador).
  return <SettingsForm key={JSON.stringify(state.settings)} />;
}

function SettingsForm() {
  const state = useAppState();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Settings>(state.settings);
  const [minStock, setMinStock] = useState(String(state.settings.defaultMinStock));
  const [maxDiscount, setMaxDiscount] = useState(String(state.settings.maxOperatorDiscountPct).replace(".", ","));
  const [errors, setErrors] = useState<Errors<Key>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function onLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem.");
    if (file.size > MAX_LOGO_BYTES) return toast.error("A logo deve ter no máximo 300 KB.");
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result));
    reader.onerror = () => toast.error("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Errors<Key> = {};
    if (form.storeName.trim().length < 2) e.storeName = "Informe o nome da loja.";
    if (form.phone.trim() && !isValidPhone(form.phone)) e.phone = "Telefone inválido.";
    if (form.email.trim() && !isValidEmail(form.email)) e.email = "E-mail inválido.";
    const min = Number(minStock);
    if (!Number.isInteger(min) || min < 0) e.defaultMinStock = "Use um número inteiro maior ou igual a zero.";
    const disc = parseNumber(maxDiscount);
    if (!Number.isFinite(disc) || disc < 0 || disc > 100) e.maxOperatorDiscountPct = "Informe um valor entre 0 e 100.";
    setErrors(e);
    if (hasErrors(e)) return;

    setBusy(true);
    const res = await actions.updateSettings({
      ...form,
      storeName: form.storeName.trim(),
      defaultMinStock: min,
      maxOperatorDiscountPct: disc,
    });
    setBusy(false);
    if (res.ok) toast.success("Configurações salvas.");
    else toast.error(res.error);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tendencias-makeup-dados-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo exportado.");
  }

  return (
    <div className="animate-fade-up max-w-4xl space-y-6">
      <PageHeader title="Configurações" subtitle="Dados da loja e preferências do sistema" />

      <form onSubmit={submit} noValidate className="space-y-6">
        <Card>
          <CardHeader title="Identidade da loja" />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              {form.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo} alt="Logo" className="size-20 rounded-2xl border border-gold-300 object-cover" />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-2xl border border-dashed border-gold-400 bg-nude-100 text-ink-400">
                  <ImagePlus className="size-6" />
                </div>
              )}
              <div className="space-y-2">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    Enviar logo
                  </Button>
                  {form.logo && (
                    <Button variant="ghost" size="sm" onClick={() => set("logo", "")}>
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-ink-400">PNG ou JPG, até 300 KB.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome da loja" required error={errors.storeName}>
                <Input value={form.storeName} onChange={(e) => set("storeName", e.target.value)} invalid={!!errors.storeName} />
              </Field>
              <Field label="Responsável">
                <Input value={form.owner} onChange={(e) => set("owner", e.target.value)} />
              </Field>
              <Field label="Telefone" error={errors.phone}>
                <Input inputMode="tel" value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} invalid={!!errors.phone} />
              </Field>
              <Field label="E-mail" error={errors.email}>
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
              </Field>
              <Field label="Endereço" className="sm:col-span-2">
                <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <Field label="CNPJ">
                <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
              </Field>
              <Field label="Instagram">
                <Input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Preferências" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Estoque mínimo padrão" error={errors.defaultMinStock} hint="Sugerido ao cadastrar novos produtos.">
              <Input inputMode="numeric" value={minStock} onChange={(e) => setMinStock(e.target.value)} invalid={!!errors.defaultMinStock} />
            </Field>
            <Field label="Forma de pagamento padrão" hint="Selecionada ao iniciar uma venda.">
              <Select value={form.defaultPayment} onChange={(e) => set("defaultPayment", e.target.value as PaymentMethod)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Desconto máximo do operador (%)"
              error={errors.maxOperatorDiscountPct}
              hint="Acima disso, só um administrador pode conceder."
            >
              <Input inputMode="decimal" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} invalid={!!errors.maxOperatorDiscountPct} />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader title="Dados e armazenamento" />
        <div className="space-y-4 p-5">
          <div className="flex gap-3 rounded-xl bg-nude-100 p-4 text-sm text-ink-700">
            <Database className="mt-0.5 size-4 shrink-0 text-gold-600" />
            <p>
              Os dados ficam no banco central da loja e são compartilhados em tempo real com o PDV.
              Vendas, movimentações de estoque e registros financeiros não são apagados: cancelamentos
              e devoluções ficam registrados no histórico.
            </p>
          </div>
          <Button variant="secondary" onClick={exportBackup}>
            <Download className="size-4" /> Exportar cópia dos dados (JSON)
          </Button>
        </div>
      </Card>
    </div>
  );
}
