function isChatV2Enabled(): boolean {
  const val = String(process.env.NEXT_PUBLIC_FEATURE_CHAT_V2_ENABLED || "");
  return ["1", "true", "on", "yes"].includes(val.toLowerCase());
}

export async function markMessageDelivered(id: string) {
  try {
    if (isChatV2Enabled()) {
      return;
    }
    await fetch(`/api/messages/${encodeURIComponent(id)}/delivered`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    // swallow
  }
}

export async function markMessageRead(id: string) {
  try {
    if (isChatV2Enabled()) {
      return;
    }
    await fetch(`/api/messages/${encodeURIComponent(id)}/read`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    // swallow
  }
}

export async function markReplyDelivered(id: string) {
  try {
    if (isChatV2Enabled()) {
      return;
    }
    await fetch(`/api/replies/${encodeURIComponent(id)}/delivered`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    // swallow
  }
}

export async function markReplyRead(id: string) {
  try {
    if (isChatV2Enabled()) {
      return;
    }
    await fetch(`/api/replies/${encodeURIComponent(id)}/read`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    // swallow
  }
}

export async function markDeliveredAndRead(kind: "msg" | "rep", id: string) {
  if (kind === "msg") {
    await markMessageDelivered(id);
    await markMessageRead(id);
  } else {
    await markReplyDelivered(id);
    await markReplyRead(id);
  }
}

// Chat v2: marcar conversación como leída
export async function markConversationRead(conversationId: string) {
  try {
    await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    // swallow
  }
}

