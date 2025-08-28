import { headers } from "next/headers";
import type React from "react";
import ProfileCard from "@/components/profile/profile-card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";

const PAGE_SIZE = 20; // 4 x 5

export default async function ExportadoresPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const page = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  const apiUrl = `${baseUrl}/api/public/exporters?page=${page}&page_size=${PAGE_SIZE}`;
  const res = await fetch(apiUrl, { cache: "no-store" });
  if (!res.ok) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-2xl font-semibold mb-2">Exportadores</h1>
        <p className="text-red-600">No se pudieron cargar los exportadores.</p>
      </div>
    );
  }
  const payload = await res.json();
  const exporters = (payload?.items || []) as Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    plan_code: string | null;
    plan_label: string;
    joined_at: string | null;
    products_count: number;
    likes_count: number;
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Exportadores</h1>
          <div className="w-24 h-1 bg-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Encuentra aquí grandes empresas exportadoras .</p>
        </div>

        {/* Grid 4x5 en escritorio (20 por página) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {exporters.map((seller) => (
            <ProfileCard
              key={seller.id}
              name={seller.name}
              avatarUrl={seller.avatar_url}
              planCode={seller.plan_code}
              planLabel={seller.plan_label}
              joinedAt={seller.joined_at}
              productsCount={seller.products_count}
              likesCount={seller.likes_count}
              href={`/vendedores/${seller.id}?from=exportadores${page ? `&page=${page}` : ""}`}
              fallbackInitial="E"
            />
          ))}
        </div>
        
        {/* Paginación */}
        {totalPages >= 1 && (
          <Pagination className="mt-16 sm:mt-20 lg:mt-24">
            <PaginationContent className="bg-white border rounded-full p-1 shadow-sm">
              <PaginationItem>
                <PaginationLink
                  href={hasPrev ? `/exportadores?page=${page - 1}` : "#"}
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
                        href={`/exportadores?page=${p}`}
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
                  href={hasNext ? `/exportadores?page=${page + 1}` : "#"}
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
