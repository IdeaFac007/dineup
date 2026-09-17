import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/restaurant/dashboard/:path*",
    "/restaurant/bid/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
