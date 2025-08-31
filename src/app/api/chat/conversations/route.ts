import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/server";
import { getSenderDisplayName } from "@/lib/names";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function normalizeAvatarUrl(raw: string | null | undefined, supabase: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.includes("/storage/v1/object/public/avatars/") || s.includes("/object/public/avatars/")) return s;
  const path = s.replace(/^avatars\//, "");
  try {
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  if (process.env.FEATURE_CHAT_V2_ENABLED !== "true") {
    return NextResponse.json(
      {
        error: "CHAT_DESHABILITADO",
        message: "El sistema de chat v2 está temporalmente deshabilitado.",
      },
      { status: 410 }
    );
  }

  try {
    const supabase = createRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const includeHidden = (url.searchParams.get("includeHidden") || "").toLowerCase() === "true";

    const { data, error } = await supabase.rpc("chat_list_conversations", {
      p_user: user.id,
      p_include_hidden: includeHidden,
    });
    if (error) {
      return NextResponse.json({ error: "RPC_ERROR", message: error.message }, { status: 500 });
    }

    // Normalización básica desde RPC
    const conversationsBase = (Array.isArray(data) ? data : []).map((row: any) => ({
      id: row.id,
      counterparty_id: row.counterparty_id as string | null,
      counterparty_name: (row.counterparty_name ?? null) as string | null,
      counterparty_avatar_url: normalizeAvatarUrl(row.counterparty_avatar_url, supabase),
      last_created_at: row.last_created_at as string | null,
      preview: row.preview as string | null,
      unread_count: row.unread_count as number | null,
      hidden_at: row.hidden_at as string | null,
    }));

    // Enriquecer desde profiles cuando falte nombre o avatar
    const counterpartIds = Array.from(
      new Set(
        conversationsBase
          .map((c) => c.counterparty_id)
          .filter((v): v is string => typeof v === "string" && !!v)
      )
    );

    let profilesMap: Record<string, { company?: string | null; full_name?: string | null; first_name?: string | null; last_name?: string | null; avatar_url?: string | null }> = {};
    if (counterpartIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id, company, full_name, first_name, last_name, avatar_url")
        .in("id", counterpartIds);
      if (!profErr && Array.isArray(profs)) {
        profilesMap = Object.fromEntries(
          profs.map((p: any) => [
            p.id,
            {
              company: p.company ?? null,
              full_name: p.full_name ?? null,
              first_name: p.first_name ?? null,
              last_name: p.last_name ?? null,
              avatar_url: p.avatar_url ?? null,
            },
          ])
        );
      }
    }

    let conversations = conversationsBase.map((c) => {
      const prof = c.counterparty_id ? profilesMap[c.counterparty_id] : undefined;
      // Usar nombres enriquecidos (company/full_name/first+last) y caer al nombre del RPC si corresponde.
      const finalName = getSenderDisplayName(
        prof
          ? {
              company: prof.company ?? null,
              full_name: prof.full_name ?? null,
              first_name: prof.first_name ?? null,
              last_name: prof.last_name ?? null,
            }
          : undefined,
        (c.counterparty_name || undefined) as any
      );
      const finalAvatar = c.counterparty_avatar_url || normalizeAvatarUrl(prof?.avatar_url || null, supabase);
      return {
        ...c,
        counterparty_name: finalName,
        counterparty_avatar_url: finalAvatar ?? null,
      };
    });

    // Enriquecer las conversaciones que aún no tengan counterparty_id o nombre resuelto
    const needEnrich = conversations
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => !c.counterparty_id || !String(c.counterparty_name || "").trim());

    if (needEnrich.length > 0) {
      const updates = await Promise.all(
        needEnrich.map(async ({ c, idx }) => {
          try {
            // Obtener el otro miembro de la conversación
            const { data: mems } = await supabase
              .from("chat_conversation_members")
              .select("user_id")
              .eq("conversation_id", c.id);
            const otherId = (mems || [])
              .map((m: any) => m.user_id)
              .find((id: string) => String(id) !== String(user.id));
            if (!otherId) return null;

            // Cargar perfil del otro miembro
            const { data: prof } = await supabase
              .from("profiles")
              .select("id, company, full_name, first_name, last_name, avatar_url")
              .eq("id", otherId)
              .maybeSingle();

            const name = getSenderDisplayName(
              prof
                ? {
                    company: prof.company ?? null,
                    full_name: prof.full_name ?? null,
                    first_name: prof.first_name ?? null,
                    last_name: prof.last_name ?? null,
                  }
                : undefined,
              undefined
            );
            const avatar = normalizeAvatarUrl(prof?.avatar_url ?? null, supabase);

            return { idx, patch: { counterparty_id: otherId, counterparty_name: name, counterparty_avatar_url: avatar ?? null } };
          } catch {
            return null;
          }
        })
      );

      for (const u of updates) {
        if (u && u.patch) {
          conversations[u.idx] = { ...conversations[u.idx], ...u.patch } as any;
        }
      }
    }

    return NextResponse.json({ conversations });
  } catch (e: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: e?.message || String(e) }, { status: 500 });
  }
}
