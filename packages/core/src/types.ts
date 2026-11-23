export type PaymentMethod = "dinheiro" | "pix" | "credito" | "debito";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  brand: string;
  description: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  supplierId: string | null;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
}

export interface Sale {
  id: string;
  number: number;
  date: string;
  clientId: string | null;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment: PaymentMethod;
}

/** Movimentação financeira lançada manualmente (as vendas entram automaticamente). */
export interface Transaction {
  id: string;
  date: string;
  type: "entrada" | "saida";
  category: string;
  description: string;
  amount: number;
}

export interface Settings {
  storeName: string;
  logo: string;
  phone: string;
  email: string;
  address: string;
  cnpj: string;
  owner: string;
  instagram: string;
  defaultMinStock: number;
  defaultPayment: PaymentMethod;
  lowStockAlerts: boolean;
}

export interface AppState {
  version: number;
  isDemo: boolean;
  products: Product[];
  clients: Client[];
  suppliers: Supplier[];
  sales: Sale[];
  transactions: Transaction[];
  settings: Settings;
  saleCounter: number;
}

/** Movimento unificado para o histórico financeiro. */
export interface Movement {
  id: string;
  date: string;
  type: "entrada" | "saida";
  category: string;
  description: string;
  amount: number;
  origin: "venda" | "manual";
}

export interface DateRange {
  from: Date | null;
  to: Date | null;
}
