import { NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { createClient } from "../../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // 1. Supabase authenticated user
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
    // 2. Read Razorpay response
    // --------------------------------------------------
    const body = await request.json();

    const bidId = Number(body.bidId);
    const razorpayOrderId = String(body.razorpay_order_id || "");
    const razorpayPaymentId = String(body.razorpay_payment_id || "");
    const razorpaySignature = String(body.razorpay_signature || "");

    if (
      !bidId ||
      !razorpayOrderId ||
      !razorpayPaymentId ||
      !razorpaySignature
    ) {
      return NextResponse.json(
        {
          error: "Missing payment verification details.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 3. Razorpay server credentials
    // --------------------------------------------------
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        {
          error: "Razorpay configuration is missing on the server.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 4. Get the bid
    // --------------------------------------------------
    const { data: bid, error: bidError } = await supabase
      .from("bids")
      .select(
        `
        id,
        restaurant_id,
        amount,
        status,
        payment_status,
        razorpay_order_id,
        razorpay_payment_id
        `
      )
      .eq("id", bidId)
      .single();

    if (bidError || !bid) {
      console.error("Bid lookup error:", bidError);

      return NextResponse.json(
        {
          error: "Bid not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 5. Get restaurant separately
    // --------------------------------------------------
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select("id, name, owner_id, is_active")
      .eq("id", bid.restaurant_id)
      .single();

    if (restaurantError || !restaurant) {
      console.error("Restaurant lookup error:", restaurantError);

      return NextResponse.json(
        {
          error: "Restaurant not found.",
        },
        { status: 404 }
      );
    }

    // --------------------------------------------------
    // 6. Verify that logged-in user owns restaurant
    // --------------------------------------------------
    if (restaurant.owner_id !== user.id) {
      console.error("Owner mismatch:", {
        restaurantOwner: restaurant.owner_id,
        loggedInUser: user.id,
      });

      return NextResponse.json(
        {
          error: "You do not have permission to verify this bid.",
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
    // 8. Verify Razorpay order ID
    // --------------------------------------------------
    if (bid.razorpay_order_id !== razorpayOrderId) {
      console.error("Order mismatch:", {
        databaseOrder: bid.razorpay_order_id,
        receivedOrder: razorpayOrderId,
      });

      return NextResponse.json(
        {
          error: "Razorpay order mismatch.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 9. Verify Razorpay signature
    // --------------------------------------------------
    const generatedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const generatedBuffer = Buffer.from(
      generatedSignature,
      "utf8"
    );

    const receivedBuffer = Buffer.from(
      razorpaySignature,
      "utf8"
    );

    if (
      generatedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(
        generatedBuffer,
        receivedBuffer
      )
    ) {
      console.error("Signature verification failed.");

      return NextResponse.json(
        {
          error: "Payment signature verification failed.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 10. Verify payment directly with Razorpay
    // --------------------------------------------------
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const payment = await razorpay.payments.fetch(
      razorpayPaymentId
    );

    if (!payment) {
      return NextResponse.json(
        {
          error: "Unable to verify payment with Razorpay.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 11. Payment must belong to this order
    // --------------------------------------------------
    if (payment.order_id !== razorpayOrderId) {
      console.error("Payment/order mismatch:", {
        paymentOrder: payment.order_id,
        expectedOrder: razorpayOrderId,
      });

      return NextResponse.json(
        {
          error:
            "Payment does not belong to this Razorpay order.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 12. Payment must be captured
    // --------------------------------------------------
    if (payment.status !== "captured") {
      return NextResponse.json(
        {
          error: `Payment is not captured. Current status: ${payment.status}`,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 13. Confirm bid through secure Supabase RPC
    // --------------------------------------------------
    const { data: confirmedBid, error: confirmError } =
      await supabase.rpc("confirm_paid_bid", {
        p_bid_id: bidId,
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId,
        p_razorpay_signature: razorpaySignature,
      });

    if (confirmError || !confirmedBid) {
      console.error(
        "Bid confirmation error:",
        confirmError
      );

      return NextResponse.json(
        {
          error:
            confirmError?.message ||
            "Payment verified, but bid confirmation failed.",
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 14. Success
    // --------------------------------------------------
    return NextResponse.json({
      success: true,
      message:
        "Payment verified and bid confirmed successfully.",
      bid: confirmedBid,
    });
  } catch (error) {
    console.error(
      "Razorpay verify payment error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to verify Razorpay payment.",
      },
      { status: 500 }
    );
  }
}
