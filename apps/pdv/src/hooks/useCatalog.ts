"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PosProduct, PosSettings } from "@/lib/types";

interface Row {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  price_cents: number;
  stock: number;
  image_url: string | null;
}

const DEFAULT_SETTINGS: PosSettings = {
  storeName: "Tendencias MakeUp",
  phone: "",
  address: "",
  cnpj: "",
  maxOperatorDiscountPct: 10,
};

/** Catalogo completo em memoria (busca instantanea e leitor de codigo de barras) com atualizacao em tempo real. */
export function useCatalog(enabled: boolean) {
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [settings, setSettings] = useState<PosSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    const db = createClient();
    try {
      const rows: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from("products")
          .select("id, sku, barcode, name, category, price_cents, stock, image_url")
          .eq("active", true)
          .order("name")
          .range(from, from + 999);
        if (error) throw new Error(error.message);
        rows.push(...((data ?? []) as Row[]));
        if ((data?.length ?? 0) < 1000) break;
      }
      setProducts(
        rows.map((r) => ({
          id: r.id,
          sku: r.sku,
          barcode: r.barcode ?? "",
          name: r.name,
          category: r.category,
          priceCents: r.price_cents,
          stock: r.stock,
          imageUrl: r.image_url,
        })),
      );
      setStatus("ready");
    } catch {
      setStatus((s) => (s === "ready" ? "ready" : "error"));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const db = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void db
      .from("settings")
      .select("store_name, phone, address, cnpj, max_operator_discount_pct")
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setSettings({
            storeName: data.store_name,
            phone: data.phone,
            address: data.address,
            cnpj: data.cnpj,
            maxOperatorDiscountPct: Number(data.max_operator_discount_pct),
          });
      });
    const channel = db
      .channel("pdv-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => void load(), 300);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void db.removeChannel(channel);
    };
  }, [enabled, load]);

  return { products, settings, status, reload: load };
}
