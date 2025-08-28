import BuyerMessagesInbox from "@/components/messages/buyer-messages-inbox";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BuyerInboxPage() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Mis mensajes</h1>
        <p className="text-sm text-muted-foreground">Conversaciones con vendedores. Responde desde aquí para continuar el chat.</p>
      </div>
      <BuyerMessagesInbox />
    </div>
  );
}
