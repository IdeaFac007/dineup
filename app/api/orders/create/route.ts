import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const restaurantId = Number(body.restaurantId);
    const fulfillmentType = String(body.fulfillmentType || "pickup");
    const customerNote = typeof body.customerNote === "string" ? body.customerNote.slice(0, 500) : null;
    const offerCode = typeof body.offerCode === "string" ? body.offerCode.slice(0, 40).trim() : null;

    if (!Number.isInteger(restaurantId) || restaurantId <= 0) return NextResponse.json({ error: "Invalid restaurant ID." }, { status: 400 });

    const { data, error } = await supabase.rpc("create_order_from_cart", {
      p_restaurant_id: restaurantId,
      p_fulfillment_type: fulfillmentType,
      p_customer_note: customerNote,
      p_offer_code: offerCode,
    });

    if (error) {
      const known: Record<string, [string, number]> = {
        AUTH_REQUIRED: ["You must be logged in.", 401],
        CART_NOT_FOUND: ["Your cart is empty.", 400],
        CART_EMPTY: ["Your cart is empty or its items are unavailable.", 400],
        INVALID_FULFILLMENT_TYPE: ["Invalid order type.", 400],
        INVALID_OFFER: ["That offer code is invalid or expired.", 400],
        OFFER_MIN_ORDER_NOT_MET: ["Your order does not meet the minimum amount for this offer.", 400],
      };
      const match = known[error.message];
      return NextResponse.json({ error: match?.[0] || "Unable to create your order." }, { status: match?.[1] || 400 });
    }

    const order = Array.isArray(data) ? data[0] : data;
    if (!order?.id) return NextResponse.json({ error: "Order creation returned no order." }, { status: 500 });

    return NextResponse.json({
      success: true,
      order: {
        id: Number(order.id),
        orderNumber: order.order_number,
        restaurantId: Number(order.restaurant_id),
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discount_amount),
        totalAmount: Number(order.total_amount),
        status: order.status,
        paymentStatus: order.payment_status,
        fulfillmentType: order.fulfillment_type,
      },
    });
  } catch (error) {
    console.error("checkout order creation failed:", error);
    return NextResponse.json({ error: "Unable to create your order." }, { status: 500 });
  }
}
