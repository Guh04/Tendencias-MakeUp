"use client";

import { useState } from "react";
import type { Supplier } from "@tendencias/core/types";
import { isValidEmail, isValidPhone, maskPhone } from "@tendencias/core/validation";
import { actions } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, hasErrors, type Errors } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";

type Key = "name" | "contact" | "phone" | "email" | "notes";

export function SupplierForm({
  open,
  supplier,
  onClose,
}: {
  open: boolean;
  supplier: Supplier | null;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={supplier ? "Editar fornecedor" : "Novo fornecedor"}>
      {open && <Body key={supplier?.id ?? "new"} supplier={supplier} onClose={onClose} />}
    </Modal>
  );
}

function Body({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Record<Key, string>>({
    name: supplier?.name ?? "",
    contact: supplier?.contact ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    notes: supplier?.notes ?? "",
  });
  const [errors, setErrors] = useState<Errors<Key>>({});

  const set = (k: Key, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Errors<Key> = {};
    if (form.name.trim().length < 2) e.name = "Informe o nome da empresa.";
    if (!form.contact.trim()) e.contact = "Informe o nome do contato.";
    if (!isValidPhone(form.phone)) e.phone = "Informe um telefone válido com DDD.";
    if (form.email.trim() && !isValidEmail(form.email)) e.email = "E-mail inválido.";
    setErrors(e);
    if (hasErrors(e)) return;

    const input = {
      name: form.name.trim(),
      contact: form.contact.trim(),
      phone: form.phone,
      email: form.email.trim(),
      notes: form.notes.trim(),
    };
    setBusy(true);
    const res = supplier ? await actions.updateSupplier(supplier.id, input) : await actions.addSupplier(input);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(supplier ? "Fornecedor atualizado." : "Fornecedor cadastrado com sucesso.");
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Nome da empresa" required error={errors.name}>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contato" required error={errors.contact}>
          <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} invalid={!!errors.contact} />
        </Field>
        <Field label="Telefone" required error={errors.phone}>
          <Input inputMode="tel" value={form.phone} onChange={(e) => set("phone", maskPhone(e.target.value))} invalid={!!errors.phone} />
        </Field>
      </div>
      <Field label="E-mail" error={errors.email}>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
      </Field>
      <Field label="Observações">
        <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {supplier ? "Salvar" : "Cadastrar fornecedor"}
        </Button>
      </div>
    </form>
  );
}
