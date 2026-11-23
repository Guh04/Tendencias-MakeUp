import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Card({ className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-nude-200 bg-white shadow-soft ${className}`}
      {...rest}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-nude-100 px-5 py-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type Tone = "rose" | "gold" | "green" | "red" | "neutral";
const TONES: Record<Tone, string> = {
  rose: "bg-brand-50 text-brand-600",
  gold: "bg-gold-300/30 text-gold-600",
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
  neutral: "bg-nude-100 text-ink-500",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "rose",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-ink-500 uppercase">{label}</p>
          <p className="mt-2 truncate font-display text-2xl font-semibold text-ink-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
