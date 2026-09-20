import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "../../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const orderId = Number(body.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Invalid order ID." }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,restaurant_id,customer_id,total_amount,payment_status,status,razorpay_order_id")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "This order is already paid." }, { status: 409 });
    if (["cancelled", "completed"].includes(String(order.status))) {
      return NextResponse.json({ error: "This order cannot be paid now." }, { status: 409 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return NextResponse.json({ error: "Razorpay is not configured on the server." }, { status: 500 });

    if (order.razorpay_order_id) {
      return NextResponse.json({
        success: true,
        keyId,
        orderId: order.razorpay_order_id,
        amount: Math.round(Number(order.total_amount) * 100),
        currency: "INR",
        customerOrderId: Number(order.id),
        orderNumber: order.order_number,
      });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(Number(order.total_amount) * 100),
      currency: "INR",
      receipt: String(order.order_number).slice(0, 40),
      notes: {
        dineup_order_id: String(order.id),
        order_number: String(order.order_number),
        restaurant_id: String(order.restaurant_id),
        user_id: user.id,
      },
    });

    const { data: saved, error: saveError } = await supabase
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.id, payment_error: null })
      .eq("id", order.id)
      .eq("customer_id", user.id)
      .eq("payment_status", "pending")
      .select("id,razorpay_order_id")
      .maybeSingle();

    if (saveError || !saved) return NextResponse.json({ error: "Unable to attach Razorpay order." }, { status: 500 });

    return NextResponse.json({
      success: true,
      keyId,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      customerOrderId: Number(order.id),
      orderNumber: order.order_number,
    });
  } catch (error) {
    console.error("customer order Razorpay create failed:", error);
    return NextResponse.json({ error: "Unable to create payment order." }, { status: 500 });
  }
}
