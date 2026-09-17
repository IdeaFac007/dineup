import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "../../../lib/supabase/server";

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const tokenHash = formData.get("token_hash");
  const type = formData.get("type");
  const next = safeNextPath(formData.get("next"));

  if (typeof tokenHash !== "string" || type !== "recovery") {
    return NextResponse.redirect(
      new URL("/restaurant/forgot-password?error=invalid-link", request.url),
      303
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error) {
    console.error("Password recovery verification error:", error);

    return NextResponse.redirect(
      new URL("/restaurant/forgot-password?error=invalid-link", request.url),
      303
    );
  }

  return NextResponse.redirect(new URL(next, request.url), 303);
}
