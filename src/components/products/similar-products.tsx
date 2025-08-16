"use client";

import { useState } from "react";
import ProductsGrid from "@/components/marketplace/products-grid";
import type { ProductFilters } from "@/components/marketplace/product-filters";

interface SimilarProductsProps {
  category: string;
  excludeProductId: string;
  excludeSellerId: string;
}

export default function SimilarProducts({ category, excludeProductId, excludeSellerId }: SimilarProductsProps) {
  const [filters] = useState<ProductFilters>({
    search: "",
    category: category || "all",
    minPrice: 0,
    maxPrice: 999999999,
    location: "all",
    sortBy: "random",
    onlyFeatured: false,
  });

  const [totalProducts, setTotalProducts] = useState(0);

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Productos similares</h2>
          <p className="text-sm text-gray-500">
          </p>
        </div>
      </div>

      <ProductsGrid
        filters={filters}
        onProductsCountChange={setTotalProducts}
        excludeProductId={excludeProductId}
        excludeSellerId={excludeSellerId}
        pageSize={5}
        showPagination={false}
        variant="compact"
      />
    </section>
  );
}
