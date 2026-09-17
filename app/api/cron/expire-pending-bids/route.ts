import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is missing.");
    return NextResponse.json({ error: "Cron job is not configured." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: expiredCount, error } = await admin.rpc(
      "expire_stale_pending_bids",
      { p_expiry_minutes: 30 }
    );

    if (error) {
      console.error("Pending bid cleanup error:", error);
      return NextResponse.json(
        { error: "Unable to expire stale pending bids." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      expiredCount: Number(expiredCount || 0),
    });
  } catch (error) {
    console.error("Pending bid cleanup exception:", error);
    return NextResponse.json(
      { error: "Pending bid cleanup failed." },
      { status: 500 }
    );
  }
}
