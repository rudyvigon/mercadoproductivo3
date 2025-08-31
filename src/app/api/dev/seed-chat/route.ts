import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dmKeyForUsers } from "@/lib/chat/dm";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// Protegido por secreto en cabecera para evitar ejecuciones accidentales en prod.
function assertAuthorized(req: Request) {
  const isProd = process.env.NODE_ENV === "production";
  const secret = process.env.SEED_SECRET || "";
  if (!isProd && !secret) return; // En dev, si no hay secreto, permitir.
  const header = req.headers.get("x-seed-secret") || "";
  if (!secret || header !== secret) {
    throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    assertAuthorized(req);

    const admin = createAdminClient();

    // Buscar Tester MP
    const { data: testerRow, error: testerErr } = await admin
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", "Tester MP")
      .maybeSingle();

    if (testerErr || !testerRow?.id) {
      return NextResponse.json({ error: "TESTER_NOT_FOUND" }, { status: 400 });
    }

    const testerId = testerRow.id as string;

    // Participantes existentes (excluye Tester)
    const { data: existing, error: existErr } = await admin
      .from("profiles")
      .select("id, full_name, company")
      .neq("id", testerId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(25);

    if (existErr) throw existErr;

    // Queremos 10 conversaciones.
    const target = 10;
    const participants: string[] = [];

    for (const p of existing || []) {
      if (participants.length >= target) break;
      participants.push(p.id as string);
    }

    // Crear usuarios de prueba faltantes
    const needed = Math.max(0, target - participants.length);
    const now = Date.now();
    for (let i = 1; i <= needed; i++) {
      const email = `seed+mp${now}${i}@example.com`;
      const name = `Usuario Prueba ${String(participants.length + 1).padStart(2, "0")}`;
      const created = await admin.auth.admin.createUser({
        email,
        password: "Test1234!",
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if ((created as any).error) throw (created as any).error;
      const uid = (created as any).data?.user?.id as string | undefined;
      if (!uid) throw new Error("CREATE_USER_NO_ID");

      // Upsert perfil
      const { error: profErr } = await admin.from("profiles").upsert(
        {
          id: uid,
          full_name: name,
        },
        { onConflict: "id" }
      );
      if (profErr) throw profErr;

      participants.push(uid);
    }

    // Sembrar conversaciones y mensajes
    const results: Array<{ participant: string; conversation_id: string }> = [];

    for (const otherId of participants.slice(0, target)) {
      const dmKey = dmKeyForUsers(testerId, otherId);
      // Upsert conversación
      const { data: convUpsert, error: convErr } = await admin
        .from("chat_conversations")
        .upsert({ dm_key: dmKey }, { onConflict: "dm_key" })
        .select("id")
        .single();
      if (convErr) throw convErr;
      const conversationId = convUpsert!.id as string;

      // Asegurar membresías
      const { error: memErr } = await admin
        .from("chat_conversation_members")
        .upsert(
          [
            { conversation_id: conversationId, user_id: testerId },
            { conversation_id: conversationId, user_id: otherId },
          ],
          { onConflict: "conversation_id,user_id" }
        );
      if (memErr) throw memErr;

      // Insertar mensajes (2-3)
      const bodies = [
        "Hola Tester, ¿sigues interesado?",
        "¡Hola! Sí, cuéntame más.",
        "Te envío detalles por aquí.",
      ];

      const timestamps = [
        new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // -48h
        new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // -24h
        new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // -12h
      ];

      // Mensaje 1: otro -> tester
      await admin.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: otherId,
        body: bodies[0],
        created_at: timestamps[0],
      });
      // Mensaje 2: tester -> otro
      await admin.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: testerId,
        body: bodies[1],
        created_at: timestamps[1],
      });
      // Mensaje 3 opcional: otro -> tester en la mitad de los casos (para dejar no leídos)
      const addThird = Math.random() < 0.5;
      if (addThird) {
        await admin.from("chat_messages").insert({
          conversation_id: conversationId,
          sender_id: otherId,
          body: bodies[2],
          created_at: timestamps[2],
        });
      }

      // Actualizar preview/last_message_at
      const lastTs = addThird ? timestamps[2] : timestamps[1];
      const lastBody = addThird ? bodies[2] : bodies[1];
      await admin
        .from("chat_conversations")
        .update({ preview: lastBody, last_message_at: lastTs })
        .eq("id", conversationId);

      // Ajustar contadores: dejar 1 no leído para Tester si hubo tercer mensaje
      await admin
        .from("chat_conversation_members")
        .update({ unread_count: addThird ? 1 : 0, last_read_at: addThird ? timestamps[1] : lastTs })
        .eq("conversation_id", conversationId)
        .eq("user_id", testerId);
      await admin
        .from("chat_conversation_members")
        .update({ unread_count: 0, last_read_at: lastTs })
        .eq("conversation_id", conversationId)
        .eq("user_id", otherId);

      results.push({ participant: otherId, conversation_id: conversationId });
    }

    return NextResponse.json({ ok: true, created: results.length, results });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ error: e?.message || String(e) }, { status });
  }
}
