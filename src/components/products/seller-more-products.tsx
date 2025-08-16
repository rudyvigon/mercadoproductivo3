"use client";

import { useState } from "react";
import ProductsGrid from "@/components/marketplace/products-grid";
import type { ProductFilters } from "@/components/marketplace/product-filters";

interface SellerMoreProductsProps {
  sellerId: string;
  excludeProductId: string;
}

export default function SellerMoreProducts({ sellerId, excludeProductId }: SellerMoreProductsProps) {
  const [filters] = useState<ProductFilters>({
    search: "",
    category: "all",
    minPrice: 0,
    maxPrice: 999999999,
    location: "all",
    sortBy: "newest",
    onlyFeatured: false,
  });

  const [totalProducts, setTotalProducts] = useState(0);

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Más del vendedor</h2>
          <p className="text-sm text-gray-500">
            Otras ofertas
          </p>
        </div>
      </div>

      <ProductsGrid
        filters={filters}
        onProductsCountChange={setTotalProducts}
        sellerId={sellerId}
        excludeProductId={excludeProductId}
        variant="compact"
        pageSize={5}
        showPagination={false}
      />
    </section>
  );
}
