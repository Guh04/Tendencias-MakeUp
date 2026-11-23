import type {
  Client,
  PaymentMethod,
  Product,
  Sale,
  SaleChannel,
  SaleOrigin,
  SaleStatus,
  Settings,
  Supplier,
  Transaction,
} from "@tendencias/core/types";

/** Linhas como vêm do banco (valores em centavos). */
type One<T> = T | T[] | null;

export interface ProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  brand: string;
  description: string;
  price_cents: number;
  stock: number;
  min_stock: number;
  supplier_id: string | null;
  image_url: string | null;
  created_at: string;
  product_costs: One<{ cost_cents: number }>;
}

export interface SaleRow {
  id: string;
  number: number;
  channel: SaleChannel;
  origin: SaleOrigin;
  status: SaleStatus;
  operator_id: string | null;
  client_id: string | null;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  created_at: string;
  paid_at: string | null;
  cancel_reason: string | null;
  sale_items: {
    id: string;
    product_id: string;
    name: string;
    sku: string;
    qty: number;
    unit_price_cents: number;
    returned_qty: number;
    sale_item_costs: One<{ unit_cost_cents: number }>;
  }[];
  sale_payments: { method: PaymentMethod; amount_cents: number; received_cents: number; change_cents: number }[];
  returns: { refund_cents: number }[];
}

export interface TransactionRow {
  id: string;
  occurred_on: string;
  type: "entrada" | "saida";
  category: string;
  description: string;
  amount_cents: number;
}

export interface SettingsRow {
  store_name: string;
  logo_url: string | null;
  phone: string;
  email: string;
  address: string;
  cnpj: string;
  owner: string;
  instagram: string;
  default_min_stock: number;
  default_payment: PaymentMethod;
  low_stock_alerts: boolean;
  max_operator_discount_pct: number;
}

export const toReais = (cents: number) => cents / 100;
export const toCents = (reais: number) => Math.round(reais * 100);

function one<T>(value: One<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export function mapProduct(r: ProductRow): Product {
  return {
    id: r.id,
    sku: r.sku,
    barcode: r.barcode ?? "",
    name: r.name,
    category: r.category,
    brand: r.brand,
    description: r.description,
    costPrice: toReais(one(r.product_costs)?.cost_cents ?? 0),
    salePrice: toReais(r.price_cents),
    stock: r.stock,
    minStock: r.min_stock,
    supplierId: r.supplier_id,
    imageUrl: r.image_url,
    createdAt: r.created_at,
  };
}

export function mapSale(r: SaleRow): Sale {
  return {
    id: r.id,
    number: r.number,
    date: r.paid_at ?? r.created_at,
    status: r.status,
    channel: r.channel,
    origin: r.origin,
    clientId: r.client_id,
    operatorId: r.operator_id,
    items: r.sale_items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.name,
      sku: i.sku,
      qty: i.qty,
      unitPrice: toReais(i.unit_price_cents),
      unitCost: toReais(one(i.sale_item_costs)?.unit_cost_cents ?? 0),
      returnedQty: i.returned_qty,
    })),
    subtotal: toReais(r.subtotal_cents),
    discount: toReais(r.discount_cents),
    total: toReais(r.total_cents),
    refunded: toReais(r.returns.reduce((s, x) => s + x.refund_cents, 0)),
    payments: r.sale_payments.map((p) => ({
      method: p.method,
      amount: toReais(p.amount_cents),
      received: toReais(p.received_cents),
      change: toReais(p.change_cents),
    })),
    cancelReason: r.cancel_reason,
  };
}

export const mapClient = (r: { id: string; name: string; phone: string; email: string; created_at: string }): Client => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  createdAt: r.created_at,
});

export const mapSupplier = (r: Supplier): Supplier => ({
  id: r.id,
  name: r.name,
  contact: r.contact,
  phone: r.phone,
  email: r.email,
  notes: r.notes,
});

export function mapTransaction(r: TransactionRow): Transaction {
  const [y, m, d] = r.occurred_on.split("-").map(Number);
  return {
    id: r.id,
    date: new Date(y, m - 1, d, 12, 0, 0).toISOString(),
    type: r.type,
    category: r.category,
    description: r.description,
    amount: toReais(r.amount_cents),
  };
}

export function mapSettings(r: SettingsRow): Settings {
  return {
    storeName: r.store_name,
    logo: r.logo_url ?? "",
    phone: r.phone,
    email: r.email,
    address: r.address,
    cnpj: r.cnpj,
    owner: r.owner,
    instagram: r.instagram,
    defaultMinStock: r.default_min_stock,
    defaultPayment: r.default_payment,
    lowStockAlerts: r.low_stock_alerts,
    maxOperatorDiscountPct: Number(r.max_operator_discount_pct),
  };
}

/** Traduz erros técnicos do banco em mensagens claras. */
export function friendlyError(message: string): string {
  if (message.includes("products_sku_key")) return "Já existe um produto com este código/SKU.";
  if (message.includes("products_barcode_key")) return "Já existe um produto com este código de barras.";
  if (/permission denied|row-level security/i.test(message)) return "Você não tem permissão para esta operação.";
  if (/Failed to fetch|NetworkError|network/i.test(message)) return "Sem conexão com o servidor. Verifique a internet.";
  return message;
}
