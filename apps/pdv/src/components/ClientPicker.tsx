"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, UserX } from "lucide-react";
import { isValidPhone, maskPhone } from "@tendencias/core/validation";
import { createClient } from "@/lib/supabase/client";
import { friendly } from "@/lib/money";
import { useToast } from "@tendencias/ui/feedback";
import { Button } from "@tendencias/ui/button";
import { EmptyState } from "@tendencias/ui/empty-state";
import { Field, Input } from "@tendencias/ui/form";
import { Modal } from "@tendencias/ui/modal";

export interface PosClient {
  id: string;
  name: string;
  phone: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Selecao de cliente na venda; com `manage`, serve so para consultar e cadastrar clientes (tela inicial). */
export function ClientPicker({
  open,
  onClose,
  onPick,
  manage = false,
}: {
  open: boolean;
  onClose: () => void;
  onPick?: (client: PosClient | null) => void;
  manage?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={manage ? "Clientes" : "Cliente da venda"} size="md">
      {open && <Body onClose={onClose} onPick={onPick ?? (() => {})} manage={manage} />}
    </Modal>
  );
}

function Body({ onClose, onPick, manage }: { onClose: () => void; onPick: (c: PosClient | null) => void; manage: boolean }) {
  const toast = useToast();
  const [clients, setClients] = useState<PosClient[] | null>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows: PosClient[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await createClient().from("clients").select("id, name, phone").order("name").range(from, from + 999);
        rows.push(...((data ?? []) as PosClient[]));
        if ((data?.length ?? 0) < 1000) break;
      }
      if (!cancelled) setClients(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const t = norm(q.trim());
    const digits = q.replace(/\D/g, "");
    return (clients ?? [])
      .filter((c) => !t || norm(c.name).includes(t) || (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)))
      .slice(0, 40);
  }, [clients, q]);

  async function create(ev: React.FormEvent) {
    ev.preventDefault();
    const e: { name?: string; phone?: string } = {};
    if (name.trim().length < 2) e.name = "Informe o nome.";
    if (phone.trim() && !isValidPhone(phone)) e.phone = "Telefone inválido (com DDD).";
    setErrors(e);
    if (e.name || e.phone) return;
    setBusy(true);
    const { data, error } = await createClient()
      .from("clients")
      .insert({ name: name.trim(), phone: phone.trim(), email: "" })
      .select("id, name, phone")
      .single();
    setBusy(false);
    if (error) return toast.error(friendly(error.message));
    toast.success("Cliente cadastrado.");
    if (manage) {
      setClients((list) => [...(list ?? []), data as PosClient].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setName("");
      setPhone("");
      setCreating(false);
      return;
    }
    onPick(data as PosClient);
    onClose();
  }

  if (creating)
    return (
      <form onSubmit={create} noValidate className="space-y-4">
        <Field label="Nome" required error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} invalid={!!errors.name} autoFocus />
        </Field>
        <Field label="Telefone (opcional)" error={errors.phone}>
          <Input inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} invalid={!!errors.phone} placeholder="(11) 91234-5678" />
        </Field>
        <div className="flex justify-end gap-2 border-t border-nude-100 pt-3">
          <Button variant="ghost" onClick={() => setCreating(false)}>
            Voltar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : manage ? "Cadastrar cliente" : "Cadastrar e selecionar"}
          </Button>
        </div>
      </form>
    );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou telefone" className="pl-9" autoFocus aria-label="Buscar cliente" />
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
          <UserPlus className="size-4" /> Novo cliente
        </Button>
        {!manage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onPick(null);
              onClose();
            }}
          >
            <UserX className="size-4" /> Sem cliente
          </Button>
        )}
      </div>
      {!clients ? (
        <p className="p-4 text-center text-ink-500">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserPlus} title="Nenhum cliente encontrado" description="Cadastre um novo cliente." />
      ) : (
        <ul className="max-h-72 divide-y divide-nude-100 overflow-y-auto rounded-xl border border-nude-200">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => {
                  if (manage) return;
                  onPick(c);
                  onClose();
                }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${manage ? "cursor-default" : "hover:bg-nude-50"}`}
              >
                <span className="font-medium text-ink-900">{c.name}</span>
                <span className="text-xs text-ink-500">{c.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
