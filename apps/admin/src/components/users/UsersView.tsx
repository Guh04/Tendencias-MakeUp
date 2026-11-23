"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, ShieldCheck, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createUserAction, resetPasswordAction } from "@/app/usuarios/actions";
import { useAuth, type Profile } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useFeedback";
import { isValidEmail } from "@tendencias/core/validation";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, hasErrors, type Errors } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";

type PermKey = "can_cancel_sales" | "can_refund" | "can_override_stock";
const PERMS: { key: PermKey; label: string }[] = [
  { key: "can_cancel_sales", label: "Cancelar vendas" },
  { key: "can_refund", label: "Registrar devoluções" },
  { key: "can_override_stock", label: "Vender acima do estoque" },
];

export function UsersView() {
  const { state: auth } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<Profile[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("profiles")
      .select("id, full_name, role, active, can_cancel_sales, can_refund, can_override_stock")
      .order("created_at");
    if (error) toast.error("Não foi possível carregar os usuários.");
    else setUsers(data as Profile[]);
  }, [toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function update(u: Profile, patch: Partial<Profile>) {
    const { error } = await createClient().from("profiles").update(patch).eq("id", u.id);
    if (error) return toast.error("Não foi possível salvar a alteração.");
    setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, ...patch } : x)) ?? null);
    toast.success("Alteração salva.");
  }

  const me = auth.profile?.id;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Usuários"
        subtitle="Quem acessa o sistema e o que cada pessoa pode fazer"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Novo usuário
          </Button>
        }
      />

      <Card>
        {!users ? (
          <p className="p-6 text-sm text-ink-500">Carregando...</p>
        ) : users.length === 0 ? (
          <EmptyState icon={UserCog} title="Nenhum usuário" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-nude-100 text-left text-xs tracking-wide text-ink-500 uppercase">
                  <th className="px-5 py-3 font-medium">Usuário</th>
                  <th className="px-3 py-3 font-medium">Perfil</th>
                  <th className="px-3 py-3 font-medium">Permissões do operador</th>
                  <th className="px-3 py-3 text-center font-medium">Ativo</th>
                  <th className="px-5 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-nude-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-nude-50">
                    <td className="px-5 py-3 font-medium text-ink-900">
                      {u.full_name} {u.id === me && <span className="text-xs text-ink-400">(você)</span>}
                    </td>
                    <td className="px-3 py-3">
                      {u.role === "admin" ? (
                        <Badge tone="rose">
                          <ShieldCheck className="mr-1 size-3" /> Administrador
                        </Badge>
                      ) : (
                        <Badge>Operador de caixa</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {u.role === "admin" ? (
                        <span className="text-xs text-ink-400">Acesso completo</span>
                      ) : (
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {PERMS.map((p) => (
                            <label key={p.key} className="flex items-center gap-1.5 text-xs text-ink-700">
                              <input
                                type="checkbox"
                                checked={u[p.key]}
                                onChange={(e) => update(u, { [p.key]: e.target.checked })}
                                className="size-3.5 accent-brand-600"
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Ativar ${u.full_name}`}
                        checked={u.active}
                        disabled={u.id === me}
                        onChange={(e) => update(u, { active: e.target.checked })}
                        className="size-4 accent-brand-600"
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <IconButton aria-label={`Redefinir senha de ${u.full_name}`} title="Redefinir senha" onClick={() => setResetFor(u)}>
                        <KeyRound className="size-4" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-ink-500">
        Operadores vendem, cadastram produtos e operam o próprio caixa. Não veem custos nem financeiro,
        não alteram configurações e não excluem registros. Cancelar, devolver e vender acima do estoque
        só com a permissão marcada.
      </p>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          void load();
        }}
      />
      <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />
    </div>
  );
}

type CreateKey = "fullName" | "email" | "password";

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Novo usuário" size="sm">
      {open && <CreateForm onClose={onClose} onCreated={onCreated} />}
    </Modal>
  );
}

function CreateForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "operator" as "admin" | "operator" });
  const [errors, setErrors] = useState<Errors<CreateKey>>({});
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Errors<CreateKey> = {};
    if (form.fullName.trim().length < 2) e.fullName = "Informe o nome.";
    if (!isValidEmail(form.email)) e.email = "E-mail inválido.";
    if (form.password.length < 8) e.password = "Mínimo de 8 caracteres.";
    setErrors(e);
    if (hasErrors(e)) return;
    setBusy(true);
    const res = await createUserAction(form);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Usuário criado. Informe a senha provisória a ele em mãos.");
    onCreated();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Nome" required error={errors.fullName}>
        <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} invalid={!!errors.fullName} autoFocus />
      </Field>
      <Field label="E-mail" required error={errors.email}>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={!!errors.email} />
      </Field>
      <Field label="Senha provisória" required error={errors.password} hint="A pessoa poderá trocá-la depois.">
        <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} invalid={!!errors.password} />
      </Field>
      <Field label="Perfil" required>
        <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "operator" })}>
          <option value="operator">Operador de caixa</option>
          <option value="admin">Administrador</option>
        </Select>
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Criando..." : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}

function ResetPasswordModal({ user, onClose }: { user: Profile | null; onClose: () => void }) {
  return (
    <Modal open={!!user} onClose={onClose} title="Redefinir senha" size="sm">
      {user && <ResetForm key={user.id} user={user} onClose={onClose} />}
    </Modal>
  );
}

function ResetForm({ user, onClose }: { user: Profile; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (password.length < 8) return setError("Mínimo de 8 caracteres.");
    setBusy(true);
    const res = await resetPasswordAction(user.id, password);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Senha redefinida.");
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-ink-700">Nova senha para <strong>{user.full_name}</strong>.</p>
      <Field label="Nova senha" error={error}>
        <Input type="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} invalid={!!error} autoFocus />
      </Field>
      <div className="flex justify-end gap-2 border-t border-nude-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          Redefinir
        </Button>
      </div>
    </form>
  );
}
