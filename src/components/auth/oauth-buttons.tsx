"use client";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Github, Mail, ShieldAlert } from "lucide-react";
import { useState } from "react";

export default function OAuthButtons() {
  const supabase = createClient();
  const [loading, setLoading] = useState<"google" | "github" | null>(null);

  async function signInWith(provider: "google" | "github") {
    setLoading(provider);
    try {
      const redirectTo = typeof window !== "undefined"
        ? `${location.origin}/auth/callback?next=/dashboard`
        : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: { prompt: "consent" }
        },
      });
      if (error) throw error;
    } catch (e: any) {
      // Podríamos usar sonner si está disponible en el layout
      console.error(e);
      alert(e?.message ?? "Error al iniciar sesión con OAuth");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" className="w-full" disabled={loading !== null}
        onClick={() => signInWith("google")}
      >
        <ShieldAlert size={16} className="mr-2" />
        {loading === "google" ? "Redirigiendo..." : "Continuar con Google"}
      </Button>
      <Button type="button" variant="outline" className="w-full" disabled={loading !== null}
        onClick={() => signInWith("github")}
      >
        <Github size={16} className="mr-2" />
        {loading === "github" ? "Redirigiendo..." : "Continuar con GitHub"}
      </Button>
    </div>
  );
}
