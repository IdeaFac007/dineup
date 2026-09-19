export function safeGoogleMapsUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw;
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const isGoogleMapsHost =
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "maps.app.goo.gl";
    const hasCredentials = Boolean(url.username || url.password);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      isGoogleMapsHost &&
      !hasCredentials
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

export function googleMapsSearchUrl(
  restaurantName: string | null | undefined,
  address: string | null | undefined,
  city: string | null | undefined,
) {
  const name = restaurantName?.replace(/\s+/g, " ").trim() || "";
  const context = [address, city]
    .map((value) => value?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean)
    .join(", ");
  const query = context ? [name, context].filter(Boolean).join(", ") : name;
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : "https://www.google.com/maps";
}
