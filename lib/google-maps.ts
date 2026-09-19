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
      host === "maps.app.goo.gl" ||
      host === "goo.gl";
    return (url.protocol === "http:" || url.protocol === "https:") && isGoogleMapsHost
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}
