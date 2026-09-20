import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const cancellableStatuses = ["pending", "accepted"];

async function razorpayRequest(path: string, method: string, body?: unknown) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay configuration is missing on the server.");
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.description || "Razorpay request failed.";
    throw new Error(message);
  }
  return data;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const orderId = Number(body.orderId);
    const reason = String(body.reason || "").trim().slice(0, 500);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,customer_id,restaurant_id,status,payment_status,total_amount,razorpay_payment_id,razorpay_refund_id,refund_status,refund_amount")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    let actor: "customer" | "restaurant" | null = null;
    if (order.customer_id === user.id) actor = "customer";
    else {
      const { data: restaurant } = await supabase.from("restaurants").select("id").eq("id", order.restaurant_id).eq("owner_id", user.id).eq("is_active", true).maybeSingle();
      if (restaurant) actor = "restaurant";
    }
    if (!actor) return NextResponse.json({ error: "You are not allowed to cancel this order." }, { status: 403 });
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json({ error: "This order can no longer be cancelled." }, { status: 409 });
    }

    const admin = createAdminClient();
    let paymentStatus = order.payment_status;
    let refundStatus = order.refund_status;
    let refundId = order.razorpay_refund_id;
    let refundAmount = Number(order.refund_amount || 0);
    let refundedAt: string | null = null;
    let refundError: string | null = null;

    if (order.payment_status === "paid") {
      if (!order.razorpay_payment_id) {
        return NextResponse.json({ error: "Paid order has no Razorpay payment reference. Please contact support." }, { status: 409 });
      }

      const amountPaise = Math.round(Number(order.total_amount) * 100);
      const payment = await razorpayRequest(`payments/${encodeURIComponent(order.razorpay_payment_id)}`, "GET");
      if (!payment || !["captured", "refunded"].includes(payment.status)) {
        return NextResponse.json({ error: "Razorpay payment is not eligible for refund yet." }, { status: 409 });
      }
      if (Number(payment.amount) !== amountPaise || String(payment.currency || "") !== "INR") {
        return NextResponse.json({ error: "Payment amount does not match the order total." }, { status: 409 });
      }

      if (payment.status === "refunded" || Number(payment.amount_refunded || 0) >= amountPaise) {
        refundStatus = "processed";
        paymentStatus = "refunded";
        refundAmount = Number(payment.amount_refunded || amountPaise) / 100;
        refundId = refundId || null;
        refundedAt = new Date().toISOString();
      } else {
        const refunds = await razorpayRequest(`payments/${encodeURIComponent(order.razorpay_payment_id)}/refunds?count=100`, "GET");
        const existing = (refunds?.items || []).find((item: any) =>
          Number(item.amount) === amountPaise && item.status !== "failed"
        );
        const refund = existing || await razorpayRequest(`payments/${encodeURIComponent(order.razorpay_payment_id)}/refund`, "POST", {
          amount: amountPaise,
          receipt: String(order.order_number).slice(0, 40),
          notes: { dineup_order_id: String(order.id), cancellation_reason: reason || "Order cancelled" },
        });
        refundId = refund?.id || refundId;
        refundStatus = refund?.status === "processed" ? "processed" : "requested";
        refundAmount = amountPaise / 100;
        paymentStatus = refundStatus === "processed" ? "refunded" : "paid";
        refundedAt = refundStatus === "processed" ? new Date().toISOString() : null;
      }
    } else {
      refundStatus = null;
      refundAmount = 0;
    }

    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update({
        status: "cancelled",
        cancellation_reason: reason || `${actor === "customer" ? "Customer" : "Restaurant"} cancelled the order.`,
        payment_status: paymentStatus,
        razorpay_refund_id: refundId,
        refund_status: refundStatus,
        refund_amount: refundAmount,
        refunded_at: refundedAt,
        refund_error: refundError,
      })
      .eq("id", order.id)
      .eq("status", order.status)
      .select("id,order_number,status,payment_status,refund_status,refund_amount,refunded_at")
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Cancellation could not be saved. Please retry." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: updated,
      refund: order.payment_status === "paid"
        ? { status: refundStatus, amount: refundAmount }
        : null,
    });
  } catch (error) {
    console.error("order cancellation failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to cancel order." }, { status: 502 });
  }
}
