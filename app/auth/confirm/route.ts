import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  const redirectUrl = new URL(request.url);
  redirectUrl.pathname = next;
  redirectUrl.search = "";
  redirectUrl.hash = "";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/restaurant/forgot-password?error=invalid-link", request.url)
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    console.error("Auth confirmation error:", error);

    return NextResponse.redirect(
      new URL("/restaurant/forgot-password?error=invalid-link", request.url)
    );
  }

  return NextResponse.redirect(redirectUrl);
}
