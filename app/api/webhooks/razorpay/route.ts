import { NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is missing.");
      return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
    }

    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    if (!signature) {
      return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(signature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const admin = createAdminClient();

    if (event?.event === "payment.failed") {
      const payment = event?.payload?.payment?.entity;
      const paymentId = String(payment?.id || "");
      const orderId = String(payment?.order_id || "");
      const failureCode = String(payment?.error_code || "");
      const failureDescription = String(payment?.error_description || "");

      if (!paymentId || !orderId) {
        return NextResponse.json({ error: "Invalid failed payment payload." }, { status: 400 });
      }

      const { data: bid, error: bidError } = await admin
        .from("bids")
        .select("id, payment_status, razorpay_order_id")
        .eq("razorpay_order_id", orderId)
        .maybeSingle();

      if (bidError) {
        console.error("Failed-payment bid lookup error:", bidError);
        return NextResponse.json({ error: "Unable to record payment failure." }, { status: 500 });
      }

      if (!bid) {
        return NextResponse.json({ received: true, ignored: true });
      }

      const { error: failureError } = await admin.rpc(
        "record_bid_payment_failure_from_webhook",
        {
          p_bid_id: bid.id,
          p_razorpay_payment_id: paymentId,
          p_failure_code: failureCode,
          p_failure_description: failureDescription,
        }
      );

      if (failureError) {
        console.error("Failed-payment record error:", failureError);
        return NextResponse.json({ error: "Unable to record payment failure." }, { status: 500 });
      }

      // A failed payment attempt does not expire the bid immediately.
      // Razorpay can allow another attempt against the same order.
      return NextResponse.json({ received: true, recordedFailure: true });
    }

    if (event?.event !== "payment.captured") {
      return NextResponse.json({ received: true });
    }

    const payment = event?.payload?.payment?.entity;
    const paymentId = String(payment?.id || "");
    const orderId = String(payment?.order_id || "");
    const amount = Number(payment?.amount);
    const currency = String(payment?.currency || "");

    if (!paymentId || !orderId || !Number.isFinite(amount) || currency !== "INR") {
      return NextResponse.json({ error: "Invalid payment payload." }, { status: 400 });
    }

    const { data: bid, error: bidError } = await admin
      .from("bids")
      .select("id, amount, payment_status, razorpay_order_id, razorpay_payment_id")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (bidError) {
      console.error("Webhook bid lookup error:", bidError);
      return NextResponse.json({ error: "Unable to reconcile payment." }, { status: 500 });
    }

    if (!bid) {
      // Razorpay can retry delivery before the application's order record is visible.
      // Returning 200 avoids an endless retry loop for an order DineUp does not know.
      return NextResponse.json({ received: true, ignored: true });
    }

    if (Number(bid.amount) * 100 !== Math.round(amount)) {
      console.error("Webhook amount mismatch", {
        bidId: bid.id,
        expected: Number(bid.amount) * 100,
        received: amount,
      });
      return NextResponse.json({ error: "Payment amount mismatch." }, { status: 400 });
    }

    if (
      bid.payment_status === "captured" &&
      bid.razorpay_payment_id === paymentId
    ) {
      return NextResponse.json({ received: true, alreadyProcessed: true });
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json({ error: "Razorpay server configuration is missing." }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const verifiedPayment = await razorpay.payments.fetch(paymentId);

    if (
      !verifiedPayment ||
      verifiedPayment.order_id !== orderId ||
      verifiedPayment.status !== "captured" ||
      Number(verifiedPayment.amount) !== Math.round(Number(bid.amount) * 100) ||
      String(verifiedPayment.currency || "") !== "INR"
    ) {
      return NextResponse.json({ error: "Razorpay payment validation failed." }, { status: 400 });
    }

    const { data: confirmedBid, error: confirmError } = await admin.rpc(
      "confirm_paid_bid_from_webhook",
      {
        p_bid_id: bid.id,
        p_razorpay_order_id: orderId,
        p_razorpay_payment_id: paymentId,
      }
    );

    if (confirmError || !confirmedBid) {
      console.error("Webhook bid confirmation error:", confirmError);
      return NextResponse.json({ error: "Unable to confirm bid." }, { status: 500 });
    }

    return NextResponse.json({ received: true, success: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "dineup-razorpay-webhook" });
}
