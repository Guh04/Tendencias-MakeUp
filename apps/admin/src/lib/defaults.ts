import type { AppState, Settings } from "@tendencias/core/types";

export const DEFAULT_SETTINGS: Settings = {
  storeName: "Tendencias MakeUp",
  logo: "",
  phone: "",
  email: "",
  address: "",
  cnpj: "",
  owner: "",
  instagram: "",
  defaultMinStock: 5,
  defaultPayment: "pix",
  lowStockAlerts: true,
  maxOperatorDiscountPct: 10,
};

export function createEmptyState(): AppState {
  return {
    products: [],
    clients: [],
    suppliers: [],
    sales: [],
    allSales: [],
    transactions: [],
    settings: { ...DEFAULT_SETTINGS },
    operators: [],
  };
}
