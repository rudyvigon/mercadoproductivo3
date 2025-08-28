import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import SellerLikeButton from "@/components/sellers/seller-like-button";
import { CalendarDays, MapPin, Package } from "lucide-react";
import WhatsAppButton from "@/components/contact/whatsapp-button";
import BuyerChatButton from "@/components/chat/buyer-chat-button";
import PlanBadge from "@/components/badges/plan-badge";

function isPaidPlan(plan?: string | null) {
  const c = String(plan || "").toLowerCase();
  return (
    c.includes("plus") ||
    c.includes("deluxe") ||
    c.includes("diamond") ||
    c === "premium" ||
    c === "pro" ||
    c === "enterprise"
  );
}

function isBasicPlan(plan?: string | null) {
  const c = String(plan || "").toLowerCase();
  return c === "free" || c === "basic" || c === "gratis";
}
// Badge de plan reutilizable importado desde @/components/badges/plan-badge

export type PublicSeller = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  company?: string | null;
  city?: string | null;
  province?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string | null;
  joined_at?: string | null;
  plan_code?: string | null;
  plan_label?: string | null;
  products_count?: number;
  likes_count?: number;
};

export default function SellerInfoCard({ seller, productTitle }: { seller: PublicSeller; productTitle?: string }) {
  const basic = isBasicPlan(seller?.plan_code);
  const paid = isPaidPlan(seller?.plan_code);
  const displayName = seller?.company || (basic ? "Usuario Básico" : "Vendedor");
  const avatarInitial = (displayName?.[0] || "V").toUpperCase();
  const location = seller?.city && seller?.province
    ? `${seller.city}, ${seller.province}`
    : seller?.location || "Ubicación no especificada";
  const joinedLabel = seller?.joined_at
    ? new Date(seller.joined_at).toLocaleDateString("es-ES", { year: "numeric", month: "long" })
    : null;

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-indigo-50" />
      <CardContent className="relative pt-8 sm:pt-9 px-7 sm:px-8">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={seller?.avatar_url || undefined} alt={displayName} />
            <AvatarFallback>{avatarInitial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="truncate font-semibold text-gray-900" data-testid="product-detail-seller-name">
                {displayName}
              </div>
              <PlanBadge planCode={seller?.plan_code} planLabel={seller?.plan_label} className="py-0.5" />
            </div>
            <div className="truncate text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex w-full flex-col items-stretch gap-2 sm:mt-5 sm:flex-row sm:items-center sm:justify-center sm:gap-4 md:gap-5">
          <BuyerChatButton
            sellerPlanCode={seller?.plan_code}
            sellerId={seller.id}
            sellerName={displayName}
            sellerAvatarUrl={seller?.avatar_url || null}
            size="sm"
            buttonLabel="Contactar"
            className="w-full sm:w-auto"
          />
          <WhatsAppButton
            sellerPlanCode={seller?.plan_code}
            sellerPhone={seller?.phone}
            productTitle={productTitle}
            currentUserName={undefined}
            size="sm"
            className="w-full sm:w-auto"
          />
          <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
            <Link href={`/vendedores/${seller.id}`}>Ver perfil</Link>
          </Button>
        </div>

        {paid && (
          <div className="mt-5 grid grid-cols-3 gap-3 rounded-md border border-gray-200 bg-white/70 p-3 text-sm">
            <div className="flex flex-col items-start">
              <div className="inline-flex items-center gap-1 text-gray-500">
                <Package className="h-4 w-4" /> Productos
              </div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">{seller?.products_count ?? 0}</div>
            </div>
            <div className="flex flex-col items-start">
              <div className="inline-flex items-center gap-1 text-gray-500">Likes</div>
              <div className="mt-0.5">
                <SellerLikeButton
                  sellerId={seller.id}
                  planCode={seller?.plan_code}
                  initialLikes={seller?.likes_count ?? 0}
                  size="sm"
                />
              </div>
            </div>
            <div className="flex flex-col items-start">
              <div className="inline-flex items-center gap-1 text-gray-500">
                <CalendarDays className="h-4 w-4" /> Miembro desde
              </div>
              <div className="mt-0.5 text-base font-semibold">{joinedLabel || "—"}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
