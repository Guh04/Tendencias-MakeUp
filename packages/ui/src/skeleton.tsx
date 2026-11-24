/** Blocos cinza pulsantes no lugar do texto "Carregando...". */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-nude-200/70 ${className}`} aria-hidden />;
}

/** Linhas de tabela/lista enquanto os dados chegam. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="hidden h-4 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Grade de cartoes de produto enquanto o catalogo carrega (PDV). */
export function CardGridSkeleton({ cards = 9 }: { cards?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando produtos">
      {Array.from({ length: cards }, (_, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-nude-200 bg-white p-2.5">
          <Skeleton className="size-16 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}
