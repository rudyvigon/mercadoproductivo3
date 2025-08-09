"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AuthCard from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export default function Page() {
  const router = useRouter();
  const supabase = createClient();
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    // Cerrar sesión para forzar inicio con nueva contraseña
    supabase.auth.signOut().catch(() => {});

    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(id);
          router.replace("/auth/login");
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthCard
      title="Contraseña actualizada"
      subtitle={`Tu contraseña se actualizó correctamente. Serás redirigido al inicio de sesión en ${seconds} segundo${seconds === 1 ? "" : "s"}.`}
    >
      <div className="flex flex-col items-center gap-4">
        <Button onClick={() => router.replace("/auth/login")} className="w-full sm:w-auto">
          Ir a iniciar sesión ahora
        </Button>
      </div>
    </AuthCard>
  );
}
