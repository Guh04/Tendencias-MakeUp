"use client";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="tablist" className="mb-5 inline-flex rounded-xl border border-nude-200 bg-white p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            value === t.id ? "bg-brand-600 text-white" : "text-ink-500 hover:bg-nude-100"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
