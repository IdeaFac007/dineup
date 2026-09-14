"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function BidPageContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const restaurantId = Number(searchParams.get("id"));

  const [restaurant, setRestaurant] = useState<{
    id: number;
    name: string;
    city: string;
    category: string;
    current_bid: number;
  } | null>(null);

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadRestaurant() {
      setLoading(true);
      setError("");

      if (!restaurantId) {
        setError("Restaurant information is missing.");
        setLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/restaurant/login");
        return;
      }

      const { data, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, city, category, current_bid")
        .eq("id", restaurantId)
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .single();

      if (restaurantError || !data) {
        setError(
          "Restaurant not found or this account is not authorized to manage it."
        );
        setLoading(false);
        return;
      }

      setRestaurant(data);
      setAmount(String(Number(data.current_bid || 0) + 1));
      setLoading(false);
    }

    loadRestaurant();
  }, [restaurantId, router, supabase]);

  function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(true));
        existingScript.addEventListener("error", () => resolve(false));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  }

  async function handleIncreaseVisibility() {
    setError("");
    setMessage("");

    if (!restaurant) {
      setError("Restaurant information is not available.");
      return;
    }

    const bidAmount = Number(amount);

    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      setError("Please enter a valid bid amount.");
      return;
    }

    if (bidAmount <= Number(restaurant.current_bid)) {
      setError(
        `Your bid must be higher than ₹${Number(
          restaurant.current_bid
        ).toLocaleString("en-IN")}.`
      );
      return;
    }

    setPaymentLoading(true);

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        throw new Error(
          "Unable to load Razorpay Checkout. Please refresh and try again."
        );
      }

      const response = await fetch("/api/health/razorpay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          amount: bidAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Unable to create Razorpay payment order."
        );
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "DineUp",
        description: `Restaurant visibility bid for ${restaurant.name}`,
        order_id: data.orderId,

        prefill: {
          name: restaurant.name,
        },

        notes: {
          bid_id: String(data.bidId),
          restaurant_id: String(data.restaurantId),
        },

        theme: {
          color: "#171717",
        },

        handler: async function (paymentResponse: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            setMessage("Payment received. Verifying payment...");

            const verifyResponse = await fetch(
              "/api/health/razorpay/verify-payment",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  bidId: data.bidId,
                  razorpay_payment_id:
                    paymentResponse.razorpay_payment_id,
                  razorpay_order_id:
                    paymentResponse.razorpay_order_id,
                  razorpay_signature:
                    paymentResponse.razorpay_signature,
                }),
              }
            );

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(
                verifyData.error || "Payment verification failed."
              );
            }

            setMessage(
              `Payment successful. Your bid of ₹${bidAmount.toLocaleString(
                "en-IN"
              )} is now active.`
            );

            setTimeout(() => {
              router.push("/restaurant/dashboard");
              router.refresh();
            }, 1200);
          } catch (verificationError) {
            setError(
              verificationError instanceof Error
                ? verificationError.message
                : "Payment verification failed."
            );
            setMessage("");
            setPaymentLoading(false);
          }
        },

        modal: {
          ondismiss: function () {
            setPaymentLoading(false);
            setMessage("");
            setError("Payment was cancelled.");
          },
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on(
        "payment.failed",
        function (response: {
          error?: {
            description?: string;
          };
        }) {
          setPaymentLoading(false);
          setError(
            response?.error?.description ||
              "Payment failed. Please try again."
          );
          setMessage("");
        }
      );

      razorpay.open();
    } catch (paymentError) {
      setPaymentLoading(false);

      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Unable to start payment."
      );
    }
  }

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand">
            Dine<span>Up</span>
          </div>
          <p className="muted">Loading restaurant...</p>
        </div>
      </main>
    );
  }

  if (error && !restaurant) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>

          <div className="eyebrow">RESTAURANT PARTNER</div>

          <h1>Unable to open bidding.</h1>

          <p
            style={{
              color: "#b42318",
              marginTop: 12,
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>

          <p className="back-link">
            <Link href="/restaurant/dashboard">
              ← Back to dashboard
            </Link>
          </p>
        </div>
      </main>
    );
  }

  if (!restaurant) {
    return null;
  }

  const minimumBid = Number(restaurant.current_bid || 0) + 1;

  return (
    <main className="auth-page">
      <div
        className="auth-card"
        style={{
          maxWidth: 620,
        }}
      >
        <Link href="/restaurant/dashboard" className="brand">
          Dine<span>Up</span>
        </Link>

        <div className="eyebrow">INCREASE VISIBILITY</div>

        <h1>Rise higher on the leaderboard.</h1>

        <p className="muted">
          Place a higher verified campaign bid to move your restaurant
          above the restaurant currently ahead of you.
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 18,
            border: "1px solid #e8e8e8",
            borderRadius: 14,
            background: "#fafafa",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#666",
              marginBottom: 6,
            }}
          >
            Restaurant
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            {restaurant.name}
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 14,
              color: "#666",
            }}
          >
            {restaurant.city} • {restaurant.category}
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: 16,
              border: "1px solid #e8e8e8",
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 13, color: "#777" }}>
              Current bid
            </div>

            <strong
              style={{
                display: "block",
                marginTop: 6,
                fontSize: 21,
              }}
            >
              ₹{Number(restaurant.current_bid).toLocaleString("en-IN")}
            </strong>
          </div>

          <div
            style={{
              padding: 16,
              border: "1px solid #e8e8e8",
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 13, color: "#777" }}>
              Minimum next bid
            </div>

            <strong
              style={{
                display: "block",
                marginTop: 6,
                fontSize: 21,
              }}
            >
              ₹{minimumBid.toLocaleString("en-IN")}
            </strong>
          </div>
        </div>

        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleIncreaseVisibility();
          }}
          style={{ marginTop: 22 }}
        >
          <label>
            Your new bid
            <input
              type="number"
              min={minimumBid}
              step="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={paymentLoading}
              required
            />
          </label>

          {error && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fff1f1",
                border: "1px solid #ffd1d1",
                color: "#b42318",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          )}

          <button
            className="primary-btn"
            type="submit"
            disabled={paymentLoading}
            style={{
              opacity: paymentLoading ? 0.65 : 1,
              cursor: paymentLoading ? "not-allowed" : "pointer",
            }}
          >
            {paymentLoading
              ? "Opening secure payment..."
              : `Pay ₹${Number(amount || 0).toLocaleString(
                  "en-IN"
                )} & increase visibility →`}
          </button>
        </form>

        <div
          className="demo-note"
          style={{
            marginTop: 18,
          }}
        >
          <strong>Secure payment:</strong> Your bid is not added to
          the live leaderboard until the Razorpay payment is verified.
        </div>

        <p className="back-link">
          <Link href="/restaurant/dashboard">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RestaurantBidPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card">
            <div className="brand">
              Dine<span>Up</span>
            </div>
            <p className="muted">Loading...</p>
          </div>
        </main>
      }
    >
      <BidPageContent />
    </Suspense>
  );
}
