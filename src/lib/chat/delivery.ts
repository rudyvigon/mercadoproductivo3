export async function markMessageDelivered(id: string) {
  try {
    await fetch(`/api/messages/${encodeURIComponent(id)}/delivered`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    console.warn("[delivery] markMessageDelivered error", e);
  }
}

export async function markMessageRead(id: string) {
  try {
    await fetch(`/api/messages/${encodeURIComponent(id)}/read`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    console.warn("[delivery] markMessageRead error", e);
  }
}

export async function markReplyDelivered(id: string) {
  try {
    await fetch(`/api/replies/${encodeURIComponent(id)}/delivered`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    console.warn("[delivery] markReplyDelivered error", e);
  }
}

export async function markReplyRead(id: string) {
  try {
    await fetch(`/api/replies/${encodeURIComponent(id)}/read`, {
      method: "POST",
      cache: "no-store",
    });
  } catch (e) {
    console.warn("[delivery] markReplyRead error", e);
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
