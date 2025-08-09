import AuthCard from "@/components/auth/auth-card";
import Link from "next/link";

export const metadata = {
  title: "Verifica tu correo | Mercado Productivo",
};

export default function Page({ searchParams }: { searchParams?: { email?: string } }) {
  const email = searchParams?.email;
  return (
    <AuthCard
      title="Verifica tu correo"
      subtitle={
        email
          ? `Hemos enviado un correo de verificación a ${email}. Revisa tu bandeja de entrada y sigue las instrucciones.`
          : "Hemos enviado un correo de verificación. Revisa tu bandeja de entrada y sigue las instrucciones."
      }
      bottomSlot={
        <div className="space-y-3">
          <div className="text-sm">
            ¿No lo recibiste? <Link className="text-primary underline-offset-4 hover:underline" href="/auth/resend-verification">Reenviar verificación</Link>
          </div>
          <div>
            <Link className="text-primary underline-offset-4 hover:underline" href="/auth/login">Volver al inicio de sesión</Link>
          </div>
        </div>
      }
    >
      {/* No hay contenido adicional en el cuerpo para esta pantalla */}
      <></>
    </AuthCard>
  );
}
