import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeRoleFromMetadata } from "@/lib/auth/role";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Esto refresca la sesión si es necesario (rotación de tokens)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Proteger rutas del dashboard y perfil
  if (
    !session &&
    (req.nextUrl.pathname.startsWith("/dashboard") ||
      req.nextUrl.pathname.startsWith("/profile"))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Restringir /dashboard a usuarios con rol seller
  if (session && req.nextUrl.pathname.startsWith("/dashboard")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const role = normalizeRoleFromMetadata(user?.user_metadata || {});
    if (role !== "seller") {
      const url = req.nextUrl.clone();
      url.pathname = "/profile";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Evitar acceso a login/register si ya hay sesión iniciada
  if (
    session &&
    (req.nextUrl.pathname === "/auth/login" || req.nextUrl.pathname === "/auth/register")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/"; // Inicio
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/auth/callback",
    "/auth/login",
    "/auth/register",
  ],
};
