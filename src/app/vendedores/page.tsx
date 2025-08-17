import Link from "next/link";
import { headers } from "next/headers";
import type React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Package, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import PlanBadge from "@/components/badges/plan-badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";

const PAGE_SIZE = 20; // 4 x 5

function formatDate(date?: string | null) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export default async function VendedoresPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  const apiUrl = `${baseUrl}/api/public/sellers?page=${page}&page_size=${PAGE_SIZE}`;
  const res = await fetch(apiUrl, { cache: "no-store" });
  if (!res.ok) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-2xl font-semibold mb-2">Vendedores</h1>
        <p className="text-red-600">No se pudieron cargar los vendedores.</p>
      </div>
    );
  }
  const payload = await res.json();
  const sellers = (payload?.items || []) as Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    plan_code: string | null;
    plan_label: string;
    joined_at: string | null;
    products_count: number;
  }>;
  const total = payload?.total || 0;
  const totalPages = payload?.total_pages || Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="min-h-screen bg-white py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Vendedores</h1>
          <div className="w-24 h-1 bg-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Conoce a los vendedores y empresas que ofrecen sus productos en el Marketplace.</p>
        </div>

        {/* Grid 4x5 en escritorio (20 por página) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sellers.map((seller) => (
            <Card key={seller.id} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden">
              <CardContent className="p-5">
                {/* Header: Avatar + Nombre + Plan */}
                <div className="flex items-center gap-4 mb-3">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={seller.avatar_url || undefined} alt={seller.name} />
                    <AvatarFallback>
                      {seller.name?.[0]?.toUpperCase?.() || "V"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 truncate group-hover:text-orange-600 transition-colors">
                      {seller.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-sm">
                      <PlanBadge planLabel={seller.plan_label} planCode={seller.plan_code} />
                    </div>
                  </div>
                </div>

                {/* Métricas tipo MercadoLibre */}
                <div className="grid grid-cols-2 gap-4 my-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-500" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{(seller.products_count ?? 0)} {(seller.products_count ?? 0) === 1 ? "producto" : "productos"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-sky-600" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(seller.joined_at)}</div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/vendedores/${seller.id}`}
                  className="block text-center text-sm rounded-md py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100"
                >
                  Ver perfil
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {/* Paginación (shadcn) */}
        {totalPages >= 1 && (
          <Pagination className="mt-16 sm:mt-20 lg:mt-24">
            <PaginationContent className="bg-white border rounded-full p-1 shadow-sm">
              <PaginationItem>
                <PaginationLink
                  href={hasPrev ? `/vendedores?page=${page - 1}` : "#"}
                  className={!hasPrev ? "pointer-events-none opacity-50" : "gap-1 pl-2.5 pr-3 rounded-full"}
                  size="default"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </PaginationLink>
              </PaginationItem>

              {/* Números con elipsis */}
              {(() => {
                const items: React.ReactNode[] = [];
                const pushPage = (p: number) =>
                  items.push(
                    <PaginationItem key={p}>
                      <PaginationLink
                        href={`/vendedores?page=${p}`}
                        isActive={p === page}
                        size="icon"
                        className={p === page ? "bg-orange-500 text-white hover:bg-orange-600 border-orange-500" : ""}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );

                // Siempre mostrar página 1
                pushPage(1);

                // Elipsis después de 1
                const start = Math.max(2, page - 1);
                const end = Math.min(totalPages - 1, page + 1);
                if (start > 2) {
                  items.push(
                    <PaginationItem key="start-ellipsis">
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                // Ventana alrededor de la actual
                for (let p = start; p <= end; p++) {
                  pushPage(p);
                }

                // Elipsis antes del final
                if (end < totalPages - 1) {
                  items.push(
                    <PaginationItem key="end-ellipsis">
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                // Última página si es mayor a 1
                if (totalPages > 1) {
                  pushPage(totalPages);
                }

                return items;
              })()}

              <PaginationItem>
                <PaginationLink
                  href={hasNext ? `/vendedores?page=${page + 1}` : "#"}
                  className={!hasNext ? "pointer-events-none opacity-50" : "gap-1 pr-2.5 pl-3 rounded-full"}
                  size="default"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
