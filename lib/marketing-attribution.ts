import { createClient } from "./supabase/client";

const KEY = "dineup_marketing_session";
const COOKIE = "dineup_marketing_session";

function sessionId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `${crypto.randomUUID()}-${Date.now()}`;
    localStorage.setItem(KEY, id);
  }
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  return id;
}

function params() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    source: p.get("utm_source"), medium: p.get("utm_medium"), campaign: p.get("utm_campaign"),
    content: p.get("utm_content"), term: p.get("utm_term"),
  };
}

export async function trackMarketingEvent(eventType: string, restaurantId?: number, metadata: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const supabase = createClient();
    const u = new URL(window.location.href);
    const q = params();
    await supabase.rpc("track_marketing_event", {
      p_session_id: sessionId(), p_event_type: eventType,
      p_source: q.source || null, p_medium: q.medium || null, p_campaign: q.campaign || null,
      p_content: q.content || null, p_term: q.term || null,
      p_landing_path: u.pathname, p_referrer: document.referrer || null,
      p_restaurant_id: restaurantId || null, p_metadata: metadata,
    });
  } catch (e) { console.warn("Marketing attribution failed", e); }
}
