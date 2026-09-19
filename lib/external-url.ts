export function safeExternalUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return "";
  try {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw;
    const url = new URL(candidate);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    const hasCredentials = Boolean(url.username || url.password);
    return isHttp && !hasCredentials ? url.toString() : "";
  } catch {
    return "";
  }
}
