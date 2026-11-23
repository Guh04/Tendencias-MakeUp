"use client";

import { useState } from "react";
import type { Client } from "@tendencias/core/types";
import { isValidEmail, isValidPhone, maskPhone } from "@tendencias/core/validation";
import { actions } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/Button";
import { Field, Input, hasErrors, type Errors } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";

type Key = "name" | "phone" | "email";

export function ClientForm({
  open,
  client,
  onClose,
}: {
  open: boolean;
  client: Client | null;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={client ? "Editar cliente" : "Novo cliente"} size="sm">
      {open && <Body key={client?.id ?? "new"} client={client} onClose={onClose} />}
    </Modal>
  );
}

function Body({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
  });
  const [errors, setErrors] = useState<Errors<Key>>({});

  const set = (k: Key, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Errors<Key> = {};
    if (form.name.trim().length < 2) e.name = "Informe o nome completo.";
    if (!isValidPhone(form.phone)) e.phone = "Informe um telefone válido com DDD.";
    if (form.email.trim() && !isValidEmail(form.email)) e.email = "E-mail inválido.";
    setErrors(e);
    if (hasErrors(e)) return;

    const input = { name: form.name.trim(), phone: form.phone, email: form.email.trim() };
    if (client) actions.updateClient(client.id, input);
    else actions.addClient(input);
    toast.success(client ? "Cliente atualizado." : "Cliente cadastrado com sucesso.");
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Nome" required error={errors.name}>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} autoFocus />
      </Field>
      <Field label="Telefone" required error={errors.phone}>
        <Input
          inputMode="tel"
          value={form.phone}
          onChange={(e) => set("phone", maskPhone(e.target.value))}
          invalid={!!errors.phone}
          placeholder="(11) 91234-5678"
        />
      </Field>
      <Field label="E-mail" error={errors.email}>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit">{client ? "Salvar" : "Cadastrar cliente"}</Button>
      </div>
    </form>
  );
}
