import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check logged-in user
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

    const body = await request.json();

    const restaurantId = Number(body.restaurantId);
    const amount = Number(body.amount);

    if (!restaurantId || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid restaurant or bid amount." },
        { status: 400 }
      );
    }

    // Verify restaurant ownership
    const { data: restaurant, error: restaurantError } =
      await supabase
        .from("restaurants")
        .select("id, name, owner_id, current_bid, is_active")
        .eq("id", restaurantId)
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .single();

    if (restaurantError || !restaurant) {
      return NextResponse.json(
        {
          error:
            "You are not authorized to create a campaign for this restaurant.",
        },
        { status: 403 }
      );
    }

    // Bid must be higher than current bid
    if (amount <= Number(restaurant.current_bid || 0)) {
      return NextResponse.json(
        {
          error: `Bid must be higher than ₹${Number(
            restaurant.current_bid || 0
          ).toLocaleString("en-IN")}.`,
        },
        { status: 400 }
      );
    }

    /*
     * Create a pending bid in Supabase.
     */
    const { data: bid, error: bidError } = await supabase.rpc(
      "create_pending_bid",
      {
        p_restaurant_id: restaurantId,
        p_amount: amount,
      }
    );

    if (bidError || !bid) {
      return NextResponse.json(
        {
          error:
            bidError?.message || "Unable to create pending bid.",
        },
        { status: 400 }
      );
    }

    /*
     * Create Razorpay order.
     *
     * Razorpay expects INR amount in paise.
     * Example:
     * ₹2,803 = 280300 paise
     */
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        {
          error:
            "Razorpay configuration is missing on the server.",
        },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `dineup_bid_${bid.id}`,
      notes: {
        bid_id: String(bid.id),
        restaurant_id: String(restaurant.id),
        restaurant_name: restaurant.name,
      },
    });

    /*
     * Save Razorpay order ID against the bid.
     */
    const { error: updateError } = await supabase
      .from("bids")
      .update({
        razorpay_order_id: order.id,
        payment_status: "pending",
      })
      .eq("id", bid.id)
      .eq("restaurant_id", restaurant.id);

    if (updateError) {
      return NextResponse.json(
        {
          error:
            "Razorpay order created, but bid could not be updated.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      bidId: bid.id,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
    });
  } catch (error) {
    console.error("Razorpay create order error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create Razorpay order.",
      },
      { status: 500 }
    );
  }
}
