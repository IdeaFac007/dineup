import type { SupabaseClient } from "@supabase/supabase-js";

export async function consumeAdminRateLimit(
  supabase: SupabaseClient,
  userId: string,
  options: { limit: number; windowSeconds: number }
) {
  const { data, error } = await supabase.rpc("consume_admin_api_rate_limit", {
    p_user_id: userId,
    p_limit: options.limit,
    p_window_seconds: options.windowSeconds,
  });

  if (error) {
    throw new Error("Unable to verify admin API rate limit.");
  }

  return data === true;
}
