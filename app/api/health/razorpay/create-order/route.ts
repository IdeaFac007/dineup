import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "../../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Authenticated Supabase client
    // --------------------------------------------------
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // 2. Read request body
    // --------------------------------------------------
    const body = await request.json();

    const restaurantId = Number(body.restaurantId);
    const amount = Number(body.amount);

    if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
      return NextResponse.json(
        { error: "Invalid restaurant ID." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid bid amount." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Verify restaurant ownership
    // --------------------------------------------------
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select(
        "id, name, owner_id, current_bid, is_active"
      )
      .eq("id", restaurantId)
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .single();

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        {
          error:
            "Restaurant not found, inactive, or you do not have access.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 4. Bid must be higher than current bid
    // --------------------------------------------------
    if (amount <= Number(restaurant.current_bid)) {
      return NextResponse.json(
        {
          error: `Bid must be higher than the current bid of ₹${Number(
            restaurant.current_bid
          ).toLocaleString("en-IN")}.`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 5. Create pending bid through secure RPC
    // --------------------------------------------------
    const { data: bid, error: bidError } = await supabase.rpc(
      "create_pending_bid",
      {
        p_restaurant_id: restaurantId,
        p_amount: amount,
      }
    );

    if (bidError || !bid) {
      console.error("create_pending_bid error:", bidError);

      return NextResponse.json(
        {
          error: "Unable to create bid.",
          code: bidError?.code || null,
          message:
            bidError?.message ||
            "Supabase could not create the pending bid.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 6. Razorpay environment variables
    // --------------------------------------------------
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("Razorpay environment variables are missing.");

      return NextResponse.json(
        {
          error: "Razorpay is not configured on the server.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 7. Create Razorpay instance
    // --------------------------------------------------
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    // --------------------------------------------------
    // 8. Create Razorpay order
    // --------------------------------------------------
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `dineup_bid_${bid.id}`,
      notes: {
        bid_id: String(bid.id),
        restaurant_id: String(restaurant.id),
        restaurant_name: restaurant.name,
        user_id: user.id,
      },
    });

    // --------------------------------------------------
    // 9. Attach Razorpay order using secure RPC
    // --------------------------------------------------
    const {
      data: updatedBid,
      error: attachError,
    } = await supabase.rpc(
      "attach_razorpay_order_to_bid",
      {
        p_bid_id: bid.id,
        p_razorpay_order_id: order.id,
      }
    );

    if (attachError || !updatedBid) {
      console.error("attach_razorpay_order_to_bid error:", attachError);

      return NextResponse.json(
        {
          error: "Unable to attach Razorpay order to bid.",
          code: attachError?.code || null,
          message:
            attachError?.message ||
            "The bid was created but Razorpay order could not be attached.",
          bidId: bid.id,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 10. Return Razorpay checkout information
    // --------------------------------------------------
    return NextResponse.json({
      success: true,
      keyId: razorpayKeyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bidId: updatedBid.id,
      restaurantId: restaurant.id,
    });
  } catch (error: any) {
    console.error("create-order unexpected error:", error);

    return NextResponse.json(
      {
        error: "Unable to create Razorpay order.",
        message:
          error?.message ||
          "An unexpected server error occurred.",
      },
      { status: 500 }
    );
  }
}
