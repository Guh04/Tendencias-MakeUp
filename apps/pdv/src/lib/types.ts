import type { PaymentMethod } from "@tendencias/core/types";

/** No PDV todos os valores trafegam em centavos (inteiros) para evitar erro de arredondamento. */
export interface PosProduct {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
}

export interface CashSession {
  id: string;
  number: number;
  openedAt: string;
  openingCents: number;
}

export interface PosSettings {
  storeName: string;
  phone: string;
  address: string;
  cnpj: string;
  maxOperatorDiscountPct: number;
}

export interface ReceiptData {
  number: number;
  date: string;
  operator: string;
  items: { name: string; qty: number; unitCents: number }[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  payments: { method: PaymentMethod; amountCents: number; receivedCents: number; changeCents: number }[];
}
