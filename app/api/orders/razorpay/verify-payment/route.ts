import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const customerOrderId = Number(body.orderId);
    const razorpayOrderId = String(body.razorpay_order_id || "");
    const paymentId = String(body.razorpay_payment_id || "");
    const signature = String(body.razorpay_signature || "");

    if (
      !Number.isInteger(customerOrderId) ||
      customerOrderId <= 0 ||
      !razorpayOrderId ||
      !paymentId ||
      !signature
    ) {
      return NextResponse.json(
        { error: "Missing payment verification details." },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay configuration is missing on the server." },
        { status: 500 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id,order_number,total_amount,payment_status,razorpay_order_id,razorpay_payment_id"
      )
      .eq("id", customerOrderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.razorpay_order_id !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Razorpay order mismatch." },
        { status: 400 }
      );
    }

    if (
      order.payment_status === "paid" &&
      order.razorpay_payment_id === paymentId
    ) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        orderNumber: order.order_number,
      });
    }

    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${paymentId}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "utf8");
    const receivedBuffer = Buffer.from(signature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 }
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!paymentResponse.ok) {
      console.error(
        "Razorpay payment lookup failed:",
        paymentResponse.status
      );
      return NextResponse.json(
        { error: "Unable to verify payment with Razorpay." },
        { status: 502 }
      );
    }

    const payment = await paymentResponse.json();

    if (
      !payment ||
      payment.order_id !== razorpayOrderId ||
      payment.status !== "captured"
    ) {
      return NextResponse.json(
        { error: "Payment is not captured for this order." },
        { status: 400 }
      );
    }

    if (
      Number(payment.amount) !== Math.round(Number(order.total_amount) * 100) ||
      String(payment.currency || "") !== "INR"
    ) {
      return NextResponse.json(
        { error: "Payment amount does not match the order total." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: confirmed, error: confirmError } = await admin
      .from("orders")
      .update({
        payment_status: "paid",
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        paid_at: new Date().toISOString(),
        payment_error: null,
      })
      .eq("id", order.id)
      .eq("customer_id", user.id)
      .in("payment_status", ["pending", "failed"])
      .select("id,order_number,payment_status,paid_at")
      .maybeSingle();

    if (confirmError || !confirmed) {
      const { data: current } = await admin
        .from("orders")
        .select("id,order_number,payment_status,razorpay_payment_id,paid_at")
        .eq("id", order.id)
        .maybeSingle();

      if (
        current?.payment_status === "paid" &&
        current.razorpay_payment_id === paymentId
      ) {
        return NextResponse.json({
          success: true,
          alreadyProcessed: true,
          orderNumber: current.order_number,
        });
      }

      return NextResponse.json(
        { error: "Payment was verified, but order confirmation failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderNumber: confirmed.order_number,
      paidAt: confirmed.paid_at,
    });
  } catch (error) {
    console.error("customer order Razorpay verify failed:", error);
    return NextResponse.json(
      { error: "Unable to verify payment." },
      { status: 500 }
    );
  }
}
