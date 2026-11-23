export type PaymentMethod = "dinheiro" | "pix" | "credito" | "debito";
export type SaleStatus = "pendente" | "paga" | "cancelada" | "devolvida_parcial" | "devolvida";
export type SaleChannel = "presencial" | "ecommerce";

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  description: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  supplierId: string | null;
  imageUrl: string | null;
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

export type SaleOrigin = "admin" | "pdv" | "ecommerce";

export interface SaleItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  unitCost: number;
  returnedQty: number;
}

export interface SalePayment {
  method: PaymentMethod;
  amount: number;
  received: number;
  change: number;
}

export interface Sale {
  id: string;
  number: number;
  /** Data do pagamento (ou da criação, se ainda pendente). */
  date: string;
  status: SaleStatus;
  channel: SaleChannel;
  /** Aplicativo onde a venda foi registrada. */
  origin: SaleOrigin;
  clientId: string | null;
  operatorId: string | null;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  /** Total já devolvido ao cliente. */
  refunded: number;
  payments: SalePayment[];
  cancelReason: string | null;
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
  maxOperatorDiscountPct: number;
}

export interface Operator {
  id: string;
  name: string;
}

export interface AppState {
  products: Product[];
  clients: Client[];
  suppliers: Supplier[];
  /** Somente vendas que contam como faturamento (pagas, total ou parcialmente devolvidas). */
  sales: Sale[];
  /** Todas as vendas, inclusive canceladas e pendentes (histórico). */
  allSales: Sale[];
  transactions: Transaction[];
  settings: Settings;
  operators: Operator[];
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
