import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import AppShell from "@/components/layout/app-shell";
import GlobalMobileMenu from "@/components/layout/global-mobile-menu";

export const metadata: Metadata = {
  title: "Mercado Productivo",
  description: "Plataforma que conecta productores con compradores",
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
          <Toaster richColors theme="light" position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
