export function dmKeyForUsers(a: string, b: string) {
  const A = String(a || "").trim();
  const B = String(b || "").trim();
  if (!A || !B) throw new Error("INVALID_USER_IDS");
  return A < B ? `dm:${A}-${B}` : `dm:${B}-${A}`;
}
