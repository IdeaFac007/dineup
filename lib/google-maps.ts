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
  const normalize = (value: string | null | undefined) =>
    value?.replace(/\s+/g, " ").trim() || "";
  const name = normalize(restaurantName);
  const contextParts = [normalize(address), normalize(city)].filter(Boolean);
  const seen = new Set<string>();
  const context = contextParts
    .filter((value) => {
      const key = value.toLocaleLowerCase("en-IN");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
  const query = [name, context].filter(Boolean).join(", ");
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : "https://www.google.com/maps";
}
export function googleMapsDirectionsUrl(
  restaurantName: string | null | undefined,
  address: string | null | undefined,
  city: string | null | undefined,
) {
  const normalize = (value: string | null | undefined) =>
    value?.replace(/\\s+/g, " ").trim() || "";
  const destination = [restaurantName, address, city]
    .map(normalize)
    .filter(Boolean)
    .join(", ");
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
    : "https://www.google.com/maps";
}
