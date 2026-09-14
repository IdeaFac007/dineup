import { NextResponse } from "next/server";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const amount = Number(body.amount);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid amount",
        },
        { status: 400 }
      );
    }

    // Razorpay amount is always in paise
    const amountInPaise = Math.round(amount * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `dineup_${Date.now()}`,
      notes: {
        service: "DineUp",
        type: "restaurant_bid",
      },
    });

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Unable to create Razorpay order",
      },
      { status: 500 }
    );
  }
}
