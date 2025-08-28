export function emailSlug(email?: string | null) {
  return (
    String(email || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 64) || "anonymous"
  );
}
