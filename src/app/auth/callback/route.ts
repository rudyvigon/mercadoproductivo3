import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createRouteClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, origin));
}

// Sincroniza la cookie de sesión desde el cliente (onAuthStateChange)
export async function POST(request: Request) {
  const supabase = createRouteClient();
  try {
    const { event, session } = await request.json();

    switch (event) {
      case "SIGNED_IN":
      case "TOKEN_REFRESHED":
      case "USER_UPDATED":
        // Establece/actualiza la cookie utilizando los tokens
        await supabase.auth.setSession({
          access_token: session?.access_token,
          refresh_token: session?.refresh_token,
        });
        break;
      case "SIGNED_OUT":
        await supabase.auth.signOut();
        break;
      default:
        // No hacer nada para otros eventos
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
