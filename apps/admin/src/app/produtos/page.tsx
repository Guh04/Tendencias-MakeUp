import { Suspense } from "react";
import { ProductsView } from "@/components/products/ProductsView";

export default function ProdutosPage() {
  return (
    <Suspense fallback={null}>
      <ProductsView />
    </Suspense>
  );
}
