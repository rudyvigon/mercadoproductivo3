import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  // Restringir en producción salvo que se habilite explícitamente
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_CREATE_USER !== "true") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const emailRaw = body?.email;
    const passwordRaw = body?.password;
    const fullNameRaw = body?.full_name ?? body?.fullName;
    const avatarUrlRaw = body?.avatar_url ?? body?.avatarUrl;

    const email = typeof emailRaw === "string" ? emailRaw.trim() : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : "";
    const full_name = typeof fullNameRaw === "string" ? fullNameRaw : undefined;
    const avatar_url = typeof avatarUrlRaw === "string" ? avatarUrlRaw : undefined;

    if (!email || !password) {
      return NextResponse.json({ error: "MISSING_EMAIL_OR_PASSWORD" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Helper: buscar usuario por email con paginación limitada
    const findUserByEmail = async (emailToFind: string) => {
      let page = 1;
      const perPage = 200;
      while (page <= 10) {
        const { data, error } = await (admin as any).auth.admin.listUsers({ page, perPage });
        if (error) break;
        const users = (data as any)?.users || [];
        const found = users.find((u: any) => (u.email || '').toLowerCase() === emailToFind.toLowerCase());
        if (found) return found;
        if (users.length < perPage) break;
        page++;
      }
      return null as any;
    };

    // Primero: verificar si ya existe
    const already = await findUserByEmail(email);
    if (already?.id) {
      await admin.from("profiles").upsert({ id: already.id, mp_payer_email: email }, { onConflict: "id" } as any);
      return NextResponse.json({ id: already.id, email, existed: true });
    }

    // Crear usuario en Auth con email confirmado
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, avatar_url },
    } as any);

    if (createErr || !created?.user) {
      // Fallback: intentamos recuperar el usuario por email en caso de condición de carrera
      const maybeExisting = await findUserByEmail(email);
      if (!maybeExisting) {
        return NextResponse.json(
          { error: "CREATE_USER_FAILED", details: createErr?.message ?? "User not found after failure" },
          { status: 500 }
        );
      }

      const existingUserId = maybeExisting.id;
      await admin.from("profiles").upsert({ id: existingUserId, mp_payer_email: email }, { onConflict: "id" } as any);
      return NextResponse.json({ id: existingUserId, email, existed: true });
    }

    const user = created.user;

    // Asegurar perfil y setear mp_payer_email = email
    await admin
      .from("profiles")
      .upsert({ id: user.id, mp_payer_email: email }, { onConflict: "id" } as any);

    return NextResponse.json({ id: user.id, email });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected Error" }, { status: 500 });
  }
}

