import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

function basicAuth(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
    }

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      return NextResponse.json({ error: "Unable to verify admin access." }, { status: 500 });
    }

    if (!adminUser) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const body = await request.json();
    const bidId = Number(body.bidId);
    const requestedAmount = body.amount == null ? null : Number(body.amount);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "Admin refund";

    if (!Number.isInteger(bidId) || bidId <= 0) {
      return NextResponse.json({ error: "Invalid bid ID." }, { status: 400 });
    }

    if (requestedAmount !== null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
      return NextResponse.json({ error: "Invalid refund amount." }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay server configuration is missing." }, { status: 500 });
    }

    const { data: bid, error: bidError } = await supabase
      .from("bids")
      .select("id, restaurant_id, amount, payment_status, razorpay_payment_id")
      .eq("id", bidId)
      .maybeSingle();

    if (bidError || !bid) {
      return NextResponse.json({ error: "Bid not found." }, { status: 404 });
    }

    if (bid.payment_status !== "captured" || !bid.razorpay_payment_id) {
      return NextResponse.json({ error: "Only captured payments can be refunded." }, { status: 400 });
    }

    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(bid.razorpay_payment_id)}`,
      {
        headers: {
          Authorization: basicAuth(keyId, keySecret),
        },
        cache: "no-store",
      }
    );

    const payment = await paymentResponse.json();
    if (!paymentResponse.ok) {
      console.error("Razorpay payment fetch failed:", payment);
      return NextResponse.json({ error: "Unable to verify the payment with Razorpay." }, { status: 502 });
    }

    if (payment.status !== "captured" || payment.currency !== "INR") {
      return NextResponse.json({ error: "The payment is not refundable in its current state." }, { status: 400 });
    }

    const originalAmountPaise = Number(payment.amount);
    const refundedAmountPaise = Number(payment.amount_refunded || 0);
    const remainingPaise = originalAmountPaise - refundedAmountPaise;

    if (!Number.isFinite(remainingPaise) || remainingPaise <= 0) {
      return NextResponse.json({ error: "This payment has already been fully refunded." }, { status: 400 });
    }

    const refundAmountPaise = requestedAmount === null
      ? remainingPaise
      : Math.round(requestedAmount * 100);

    if (refundAmountPaise <= 0 || refundAmountPaise > remainingPaise) {
      return NextResponse.json({ error: "Refund amount exceeds the refundable balance." }, { status: 400 });
    }

    const refundReceipt = `dineup_refund_${bid.id}_${Date.now()}`;

    const refundResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(bid.razorpay_payment_id)}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: basicAuth(keyId, keySecret),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: refundAmountPaise,
          receipt: refundReceipt,
          notes: {
            bid_id: String(bid.id),
            restaurant_id: String(bid.restaurant_id),
            reason: reason.slice(0, 200),
          },
        }),
        cache: "no-store",
      }
    );

    const refund = await refundResponse.json();
    if (!refundResponse.ok) {
      console.error("Razorpay refund create failed:", refund);
      return NextResponse.json({ error: "Razorpay could not create the refund." }, { status: 502 });
    }

    const admin = createAdminClient();
    const { error: recordError } = await admin.rpc("record_bid_refund_from_webhook", {
      p_bid_id: bid.id,
      p_razorpay_refund_id: String(refund.id),
      p_refund_status: String(refund.status || "pending"),
      p_refund_amount: Number(refund.amount || 0) / 100,
      p_refund_reason: reason,
      p_razorpay_payment_id: bid.razorpay_payment_id,
    });

    if (recordError) {
      console.error("Refund record error:", recordError);
      return NextResponse.json({
        success: true,
        warning: "Refund created at Razorpay but DineUp reconciliation is pending.",
        refundId: refund.id,
        status: refund.status,
      });
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      status: refund.status,
      amount: Number(refund.amount || 0) / 100,
    });
  } catch (error) {
    console.error("Admin refund error:", error);
    return NextResponse.json({ error: "Refund request failed." }, { status: 500 });
  }
}
