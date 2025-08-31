import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MessagesInboxV2 from "@/components/messages/messages-inbox-v2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BuyerInboxPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mis mensajes</h1>
        <p className="text-sm text-muted-foreground sm:text-base">Bandeja de entrada</p>
      </div>
      <MessagesInboxV2 userId={user.id} />
    </div>
  );
}
