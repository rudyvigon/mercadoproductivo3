import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import AppShell from "@/components/layout/app-shell";
import GlobalMobileMenu from "@/components/layout/global-mobile-menu";

export const metadata: Metadata = {
  title: "Mercado Productivo",
  description: "Plataforma que conecta vendedores con compradores",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`min-h-screen antialiased ${inter.className}`}>
        <ThemeProvider>
          <AppShell>
            {children}
            <GlobalMobileMenu />
          </AppShell>
          {/* Toaster mobile: arriba a la derecha, con offset para no tapar el header */}
          <div className="sm:hidden">
            <Toaster richColors theme="light" position="top-right" offset={64} />
          </div>
          {/* Toaster desktop: abajo a la derecha */}
          <div className="hidden sm:block">
            <Toaster richColors theme="light" position="bottom-right" offset={24} />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
