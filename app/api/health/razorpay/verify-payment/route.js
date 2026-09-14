import { NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import { createClient } from "../../../../../lib/supabase/server";

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
        { error: "Missing payment verification details." },
        { status: 400 }
      );
    }

    // Razorpay secret must stay on the server
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return NextResponse.json(
        { error: "Razorpay configuration is missing on the server." },
        { status: 500 }
      );
    }

    /*
     * Find the bid and make sure it belongs to the
     * currently logged-in restaurant owner.
     */
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
        razorpay_payment_id,
        restaurants!inner (
          id,
          name,
          owner_id,
          is_active
        )
      `
      )
      .eq("id", bidId)
      .eq("restaurants.owner_id", user.id)
      .single();

    if (bidError || !bid) {
      return NextResponse.json(
        { error: "Bid not found or access denied." },
        { status: 403 }
      );
    }

    if (bid.razorpay_order_id !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Razorpay order mismatch." },
        { status: 400 }
      );
    }

    /*
     * Verify Razorpay payment signature.
     *
     * Signature:
     * HMAC SHA256(order_id + "|" + payment_id)
     */
    const generatedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const generatedBuffer = Buffer.from(generatedSignature, "utf8");
    const receivedBuffer = Buffer.from(razorpaySignature, "utf8");

    if (
      generatedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(generatedBuffer, receivedBuffer)
    ) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 }
      );
    }

    /*
     * Verify the payment directly with Razorpay.
     * We only confirm the bid after Razorpay reports
     * the payment as captured.
     */
    const razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const payment = await razorpay.payments.fetch(razorpayPaymentId);

    if (!payment) {
      return NextResponse.json(
        { error: "Unable to verify payment with Razorpay." },
        { status: 400 }
      );
    }

    if (payment.order_id !== razorpayOrderId) {
      return NextResponse.json(
        { error: "Payment does not belong to this Razorpay order." },
        { status: 400 }
      );
    }

    if (payment.status !== "captured") {
      return NextResponse.json(
        {
          error: `Payment is not captured. Current status: ${payment.status}`,
        },
        { status: 400 }
      );
    }

    /*
     * Confirm the paid bid in Supabase.
     * This function also handles the case where another
     * restaurant has already moved ahead before payment.
     */
    const { data: confirmedBid, error: confirmError } =
      await supabase.rpc("confirm_paid_bid", {
        p_bid_id: bidId,
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId,
        p_razorpay_signature: razorpaySignature,
      });

    if (confirmError || !confirmedBid) {
      return NextResponse.json(
        {
          error:
            confirmError?.message ||
            "Payment verified, but bid confirmation failed.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified and bid confirmed successfully.",
      bid: confirmedBid,
    });
  } catch (error) {
    console.error("Razorpay verify payment error:", error);

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
