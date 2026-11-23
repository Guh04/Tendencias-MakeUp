"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { PointOfSale } from "@/components/sales/PointOfSale";
import { SalesHistory } from "@/components/sales/SalesHistory";

export default function VendasPage() {
  const [tab, setTab] = useState<"nova" | "historico">("nova");
  return (
    <div className="animate-fade-up">
      <PageHeader title="Vendas" subtitle="Registre vendas e consulte o histórico" />
      <Tabs
        tabs={[
          { id: "nova", label: "Nova venda" },
          { id: "historico", label: "Histórico" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "nova" ? <PointOfSale /> : <SalesHistory />}
    </div>
  );
}
