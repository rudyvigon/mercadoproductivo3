"use client";

import { useState } from "react";
import ProductsGrid from "@/components/marketplace/products-grid";
import type { ProductFilters } from "@/components/marketplace/product-filters";

interface SellerProductsProps {
  sellerId: string;
}

export default function SellerProducts({ sellerId }: SellerProductsProps) {
  const [filters, setFilters] = useState<ProductFilters>({
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
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Productos del vendedor
          </h2>
          <p className="text-sm text-gray-500">
            {totalProducts} producto{totalProducts !== 1 ? "s" : ""} encontrado{totalProducts !== 1 ? "s" : ""}
          </p>
        </div>
        {/* Espacio reservado por si luego agregamos filtros locales (búsqueda, orden) */}
      </div>

      <ProductsGrid
        filters={filters}
        onProductsCountChange={setTotalProducts}
        sellerId={sellerId}
      />
    </section>
  );
}
