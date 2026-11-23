"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { Modal } from "./modal";
import { Button } from "./button";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (kind: ToastKind, message: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

const TOAST_STYLE: Record<ToastKind, { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  error: { icon: XCircle, cls: "border-red-200 bg-red-50 text-red-800" },
  info: { icon: Info, cls: "border-gold-300 bg-nude-100 text-ink-700" },
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(
    null,
  );
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setDialog({ ...opts, resolve });
      }),
    [],
  );

  const close = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const { icon: Icon, cls } = TOAST_STYLE[t.kind];
          return (
            <div
              key={t.id}
              className={`animate-fade-up pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-soft ${cls}`}
              role="status"
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                className="opacity-60 hover:opacity-100"
                aria-label="Fechar notificação"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>

      <Modal
        open={!!dialog}
        onClose={() => close(false)}
        title={dialog?.title ?? ""}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={dialog?.danger ? "danger" : "primary"} onClick={() => close(true)}>
              {dialog?.confirmLabel ?? "Confirmar"}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
              dialog?.danger ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-600"
            }`}
          >
            <AlertTriangle className="size-5" />
          </div>
          <p className="text-sm leading-relaxed text-ink-700">{dialog?.message}</p>
        </div>
      </Modal>
    </FeedbackContext.Provider>
  );
}

function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("FeedbackProvider ausente");
  return ctx;
}

export function useToast() {
  const { toast } = useFeedback();
  return useMemo(
    () => ({
      success: (m: string) => toast("success", m),
      error: (m: string) => toast("error", m),
      info: (m: string) => toast("info", m),
    }),
    [toast],
  );
}

export function useConfirm() {
  return useFeedback().confirm;
}
