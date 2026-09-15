import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createClient } from "../../../../../lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Verify logged-in restaurant user
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
    // 2. Read request
    // --------------------------------------------------
    const body = await request.json();

    const restaurantId = Number(body.restaurantId);
    const amount = Number(body.amount);

    if (
      !Number.isInteger(restaurantId) ||
      restaurantId <= 0 ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid restaurant or bid amount." },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Razorpay credentials
    // --------------------------------------------------
    const razorpayKeyId =
      process.env.RAZORPAY_KEY_ID;

    const razorpayKeySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error(
        "Razorpay environment variables are missing."
      );

      return NextResponse.json(
        {
          error:
            "Razorpay configuration is missing on the server.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 4. Supabase server credentials
    // --------------------------------------------------
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      console.error(
        "Supabase secret key configuration is missing."
      );

      return NextResponse.json(
        {
          error:
            "Server database configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 5. Create server-only Supabase client
    // --------------------------------------------------
    const supabaseAdmin =
      createSupabaseAdmin(
        supabaseUrl,
        supabaseSecretKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

    // --------------------------------------------------
    // 6. Verify restaurant ownership
    // --------------------------------------------------
    const {
      data: restaurant,
      error: restaurantError,
    } =
      await supabaseAdmin
        .from("restaurants")
        .select(
          "id, name, owner_id, current_bid, is_active"
        )
        .eq("id", restaurantId)
        .single();

    if (
      restaurantError ||
      !restaurant
    ) {
      console.error(
        "Restaurant lookup error:",
        restaurantError
      );

      return NextResponse.json(
        {
          error: "Restaurant not found.",
        },
        { status: 404 }
      );
    }

    if (
      restaurant.owner_id !== user.id
    ) {
      console.error(
        "Owner mismatch:",
        {
          restaurantOwner:
            restaurant.owner_id,
          loggedInUser: user.id,
        }
      );

      return NextResponse.json(
        {
          error:
            "You are not authorized to create a campaign for this restaurant.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 7. Restaurant must be active
    // --------------------------------------------------
    if (!restaurant.is_active) {
      return NextResponse.json(
        {
          error: "Restaurant is inactive.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // 8. Bid must be higher than current bid
    // --------------------------------------------------
    const currentBid =
      Number(
        restaurant.current_bid || 0
      );

    if (amount <= currentBid) {
      return NextResponse.json(
        {
          error:
            `Bid must be higher than ₹${currentBid.toLocaleString(
              "en-IN"
            )}.`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 9. Create pending bid
    //
    // This RPC already verifies ownership
    // using auth.uid().
    // --------------------------------------------------
    const {
      data: bid,
      error: bidError,
    } = await supabase.rpc(
      "create_pending_bid",
      {
        p_restaurant_id:
          restaurantId,
        p_amount: amount,
      }
    );

    if (bidError || !bid) {
      console.error(
        "Pending bid creation error:",
        bidError
      );

      return NextResponse.json(
        {
          error:
            bidError?.message ||
            "Unable to create pending bid.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 10. Create Razorpay order
    // --------------------------------------------------
    const razorpay =
      new Razorpay({
        key_id: razorpayKeyId,
        key_secret:
          razorpayKeySecret,
      });

    const order =
      await razorpay.orders.create({
        amount: Math.round(
          amount * 100
        ),
        currency: "INR",
        receipt:
          `dineup_bid_${bid.id}`,
        notes: {
          bid_id: String(bid.id),
          restaurant_id:
            String(restaurant.id),
          restaurant_name:
            restaurant.name,
        },
      });

    // --------------------------------------------------
    // 11. Save Razorpay order ID
    //
    // IMPORTANT:
    // This uses the server-only Supabase client.
    // Authenticated browser users do NOT need
    // UPDATE permission on bids.
    // --------------------------------------------------
    const {
      error: updateError,
    } = await supabaseAdmin
      .from("bids")
      .update({
        razorpay_order_id:
          order.id,
        payment_status:
          "pending",
      })
      .eq("id", bid.id)
      .eq(
        "restaurant_id",
        restaurant.id
      );

    if (updateError) {
      console.error(
        "Bid Razorpay order update error:",
        updateError
      );

      // Best-effort cleanup:
      // mark the pending bid as failed
      // so it does not remain misleadingly pending.
      await supabaseAdmin
        .from("bids")
        .update({
          status: "payment_setup_failed",
          payment_status: "failed",
        })
        .eq("id", bid.id);

      return NextResponse.json(
        {
          error:
            "Razorpay order was created, but the bid could not be updated.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 12. Success
    // --------------------------------------------------
    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      bidId: bid.id,
      restaurantId:
        restaurant.id,
      restaurantName:
        restaurant.name,
    });

  } catch (error) {
    console.error(
      "Razorpay create order error:",
      error
    );

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
