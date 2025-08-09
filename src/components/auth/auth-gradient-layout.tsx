"use client";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient";
import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";

type Props = {
  title: string;
  subtitle?: string;
  bottomSlot?: React.ReactNode;
  children: React.ReactNode;
  gradientProps?: {
    blending?: "screen" | "overlay" | "lighten";
    colors?: string[];
  };
};

export default function AuthGradientLayout({
  title,
  subtitle,
  bottomSlot,
  children,
  gradientProps,
}: Props) {
  return (
    <BackgroundGradientAnimation blending={gradientProps?.blending} colors={gradientProps?.colors}>
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center gap-8 px-4">
        {/* Lado izquierdo: marca y frase */}
        <div className="hidden w-1/2 flex-col text-foreground/90 md:flex">
          <Link href="/" className="mb-10 text-lg font-semibold tracking-tight text-foreground/90">
            Mercado Productivo
          </Link>
          <blockquote className="mt-auto max-w-md text-balance text-lg leading-relaxed text-foreground/80">
            “La plataforma que conecta productores con compradores de manera sencilla y eficiente.”
            <footer className="mt-3 text-sm text-muted-foreground">Equipo de Mercado Productivo</footer>
          </blockquote>
        </div>

        {/* Card */}
        <div className="mx-auto w-full md:w-1/2">
          <div className={cn(
            "relative rounded-2xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-md md:p-8",
            "ring-1 ring-border"
          )}>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            )}
            <div className="mt-6">{children}</div>

            {bottomSlot && <div className="mt-8 border-t border-border pt-6 text-center text-sm text-foreground/80">{bottomSlot}</div>}
          </div>
        </div>
      </div>
    </BackgroundGradientAnimation>
  );
}
