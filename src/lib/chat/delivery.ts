let _ffChecked = false;
let _ffEnabled = false;
async function ensureFF(): Promise<void> {
  if (_ffChecked) return;
  try {
    const res = await fetch(`/api/feature-flags`, { cache: "no-store" });
    if (res.ok) {
      const j = await res.json();
      _ffEnabled = Boolean(j?.chatV2Enabled);
    }
  } catch {
    // ignore
  } finally {
    _ffChecked = true;
  }
}
function isChatV2EnabledSync(): boolean {
  return _ffChecked && _ffEnabled;
}

export async function markMessageDelivered(id: string) {
  try {
    if (! _ffChecked) {
      // fire and forget
      void ensureFF();
    }
    if (isChatV2EnabledSync()) {
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
    if (! _ffChecked) {
      void ensureFF();
    }
    if (isChatV2EnabledSync()) {
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
    if (! _ffChecked) {
      void ensureFF();
    }
    if (isChatV2EnabledSync()) {
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
    if (! _ffChecked) {
      void ensureFF();
    }
    if (isChatV2EnabledSync()) {
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

