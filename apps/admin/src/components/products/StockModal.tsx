"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { Product } from "@tendencias/core/types";
import { actions } from "@/lib/store";
import { useToast } from "@/hooks/useFeedback";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";

export function StockModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <Modal open={!!product} onClose={onClose} title="Controle de estoque" size="sm">
      {product && <Body key={product.id} product={product} onClose={onClose} />}
    </Modal>
  );
}

function Body({ product, onClose }: { product: Product; onClose: () => void }) {
  const toast = useToast();
  const [qty, setQty] = useState("1");
  const [error, setError] = useState("");

  function apply(sign: 1 | -1) {
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) {
      setError("Informe uma quantidade inteira maior que zero.");
      return;
    }
    const res = actions.adjustStock(product.id, sign * n);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(`Estoque de "${product.name}" atualizado para ${res.data}.`);
    onClose();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-ink-900">{product.name}</p>
        <p className="text-sm text-ink-500">
          Estoque atual: <strong>{product.stock}</strong> · Mínimo: {product.minStock}
        </p>
      </div>
      <Field label="Quantidade" error={error}>
        <Input
          inputMode="numeric"
          value={qty}
          onChange={(e) => {
            setQty(e.target.value);
            setError("");
          }}
          invalid={!!error}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => apply(1)}>
          <Plus className="size-4" /> Entrada
        </Button>
        <Button variant="secondary" onClick={() => apply(-1)}>
          <Minus className="size-4" /> Saída
        </Button>
      </div>
      <p className="text-xs text-ink-400">
        Use para repor mercadoria ou registrar perdas/ajustes. Vendas baixam o estoque automaticamente.
      </p>
    </div>
  );
}
