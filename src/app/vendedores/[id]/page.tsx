import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Award, Package, CalendarDays, ArrowLeft } from "lucide-react";
import SellerProducts from "@/components/sellers/seller-products";
import { SiGooglemaps } from "react-icons/si";

function planCodeToLabel(code?: string | null) {
  const c = String(code || "").toLowerCase();
  if (c === "free" || c === "basic") return "Básico";
  if (c === "plus" || c === "enterprise") return "Plus";
  if (c === "premium" || c === "pro") return "Premium";
  return "Básico";
}

function sellerDisplayName(row: any) {
  return (row?.company || row?.full_name || `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.trim() || "Vendedor").toString();
}

function formatDate(date?: string | null) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const baseUrl = host ? `${proto}://${host}` : "";
  const apiUrl = `${baseUrl}/api/public/sellers/${id}`;
  const res = await fetch(apiUrl, { cache: "no-store" });
  if (!res.ok) return notFound();
  const payload = await res.json();
  const profile = payload?.seller;
  if (!profile) return notFound();
  const productsCount = profile.products_count ?? 0;

  return (
    <div className="min-h-screen bg-white py-10 sm:py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/vendedores" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver a Vendedores
          </Link>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-5">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url || undefined} alt={sellerDisplayName(profile)} />
                <AvatarFallback>{sellerDisplayName(profile)?.[0]?.toUpperCase?.() || "V"}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{sellerDisplayName(profile)}</h1>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className="bg-orange-500 hover:bg-orange-600">
                    <Award className="h-3.5 w-3.5 mr-1" />
                    {planCodeToLabel(profile.plan_code)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-md">
                <Package className="h-5 w-5 text-amber-500" />
                <div>
                  <div className="text-gray-900 font-semibold">{productsCount || 0}</div>
                  <div className="text-gray-500 text-sm">Productos publicados</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-md">
                <CalendarDays className="h-5 w-5 text-sky-600" />
                <div>
                  <div className="text-gray-900 font-semibold">{formatDate(profile.joined_at ?? profile.created_at)}</div>
                  <div className="text-gray-500 text-sm">Alta</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-md">
                <SiGooglemaps className="h-5 w-5 text-[#4285F4]" />
                <div>
                  <div className="text-gray-900 font-semibold">{profile.city || profile.province ? `${profile.city ?? ""}${profile.city && profile.province ? ", " : ""}${profile.province ?? ""}` : "Ubicación no especificada"}</div>
                  <div className="text-gray-500 text-sm">Ubicación</div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <Link href="/" className="inline-block text-sm rounded-md px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100">
                Ver productos del marketplace
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Productos del vendedor */}
        <SellerProducts sellerId={id} />
      </div>
    </div>
  );
}
