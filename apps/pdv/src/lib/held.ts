/** Vendas em espera: guardadas neste computador (sobrevivem a fechar o programa). Nao mexem no estoque. */
export interface HeldSale {
  id: string;
  createdAt: string;
  items: { productId: string; qty: number }[];
  discountText: string;
  discountMode: "valor" | "percent";
  client: { id: string; name: string; phone: string } | null;
}

const KEY = "pdv-held-sales";

export function loadHeld(): HeldSale[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as HeldSale[]) : [];
    return Array.isArray(list) ? list.filter((h) => Array.isArray(h?.items) && h.items.length > 0) : [];
  } catch {
    return [];
  }
}

export function saveHeld(list: HeldSale[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* sem armazenamento: a lista fica so em memoria */
  }
}
