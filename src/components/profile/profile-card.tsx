"use client"

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PlanBadge from "@/components/badges/plan-badge";
import { Package, CalendarDays, Heart } from "lucide-react";

function formatDate(date?: string | null) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

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

export type ProfileCardProps = {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  planCode?: string | null;
  planLabel?: string | null;
  joinedAt?: string | null;
  productsCount?: number | null;
  likesCount?: number | null;
  href: string;
  ctaLabel?: string;
  className?: string;
  fallbackInitial?: string;
};

export default function ProfileCard({
  name,
  avatarUrl,
  planCode,
  planLabel,
  joinedAt,
  productsCount,
  likesCount,
  href,
  ctaLabel = "Ver perfil",
  className,
  fallbackInitial,
}: ProfileCardProps) {
  const paid = isPaidPlan(planCode);
  const initial = (name?.[0]?.toUpperCase?.() || fallbackInitial || "P");

  return (
    <Card className={`group relative hover:shadow-xl transition-all duration-300 border-0 shadow-md overflow-hidden h-full ${className || ""}`.trim()}>
      {/* Borde superior en gradiente */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600" />

      <CardContent className="p-5 h-full flex flex-col">
        {/* Header: Avatar + Nombre + Plan */}
        <div className="flex items-center gap-4 mb-3">
          <Avatar className="h-14 w-14 ring-1 ring-orange-200">
            <AvatarImage src={avatarUrl || undefined} alt={name} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg text-gray-900 truncate group-hover:text-orange-600 transition-colors">
              {name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <PlanBadge planLabel={planLabel || undefined} planCode={planCode || undefined} />
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-1 gap-4 my-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-amber-500" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {(productsCount ?? 0)} {(productsCount ?? 0) === 1 ? "producto" : "productos"}
              </div>
            </div>
          </div>

          {paid && (
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-600" />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {likesCount ?? 0} {(likesCount ?? 0) === 1 ? "like" : "likes"}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-sky-600" />
            <div>
              <div className="text-sm font-medium text-gray-900">{formatDate(joinedAt)}</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={href}
          className="mt-auto block text-center text-sm rounded-md py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100"
        >
          {ctaLabel}
        </Link>
      </CardContent>
    </Card>
  );
}
