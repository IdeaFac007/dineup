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

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  current_bid: number;
};

function BidPageContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const restaurantId = Number(searchParams.get("id"));

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRazorpay = () => {
      if (document.getElementById("razorpay-checkout-script")) {
        return;
      }

      const script = document.createElement("script");

      script.id = "razorpay-checkout-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;

      document.body.appendChild(script);
    };

    loadRazorpay();
  }, []);

  useEffect(() => {
    async function loadRestaurant() {
      setLoading(true);
      setError("");

      try {
        if (!restaurantId) {
          throw new Error("Restaurant ID is missing.");
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/restaurant/login");
          return;
        }

        setUserEmail(user.email || "");

        const { data, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id, name, city, category, current_bid")
          .eq("id", restaurantId)
          .eq("owner_id", user.id)
          .eq("is_active", true)
          .single();

        if (restaurantError || !data) {
          throw new Error(
            "Restaurant not found or you are not authorized to manage it."
          );
        }

        const currentBid = Number(data.current_bid || 0);

        setRestaurant({
          id: Number(data.id),
          name: data.name,
          city: data.city,
          category: data.category,
          current_bid: currentBid,
        });

        setBidAmount(String(currentBid + 1));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load restaurant."
        );
      } finally {
        setLoading(false);
      }
    }

    loadRestaurant();
  }, [restaurantId, router, supabase]);

  async function handlePayment() {
    setError("");
    setMessage("");

    if (!restaurant) {
      setError("Restaurant information is not available.");
      return;
    }

    const amount = Number(bidAmount);

    if (!amount || amount <= 0) {
      setError("Please enter a valid bid amount.");
      return;
    }

    if (amount <= restaurant.current_bid) {
      setError(
        `Your bid must be higher than ₹${restaurant.current_bid.toLocaleString(
          "en-IN"
        )}.`
      );
      return;
    }

    if (!window.Razorpay) {
      setError(
        "Razorpay Checkout is still loading. Please wait a moment and try again."
      );
      return;
    }

    setPaymentLoading(true);

    try {
      /*
       * Step 1:
       * Ask our server to create a pending bid
       * and a Razorpay order.
       */
      const orderResponse = await fetch(
        "/api/health/razorpay/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            restaurantId: restaurant.id,
            amount,
          }),
        }
      );

      const orderData = await orderResponse.json();

      if (!orderResponse.ok || !orderData.success) {
        throw new Error(
          orderData.error || "Unable to create Razorpay order."
        );
      }

      /*
       * Step 2:
       * Open Razorpay Checkout.
       */
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "DineUp",
        description: `Leaderboard promotion for ${restaurant.name}`,
        order_id: orderData.orderId,

        prefill: {
          email: userEmail,
        },

        notes: {
          bid_id: String(orderData.bidId),
          restaurant_id: String(restaurant.id),
        },

        theme: {
          color: "#111111",
        },

        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
            setMessage("Payment cancelled.");
          },
        },

        /*
         * Step 3:
         * Razorpay returns payment details here.
         *
         * We DO NOT update Supabase directly from the browser.
         * Instead we send the details to our secure server route.
         */
        handler: async function (response: any) {
          try {
            setMessage("Payment received. Verifying payment...");
            setError("");

            const verifyResponse = await fetch(
              "/api/health/razorpay/verify-payment",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  bidId: orderData.bidId,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
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
              "Payment successful! Your bid has been updated. 🚀"
            );

            setTimeout(() => {
              router.push("/restaurant/dashboard");
              router.refresh();
            }, 1200);
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Payment verification failed."
            );
            setMessage("");
            setPaymentLoading(false);
          }
        },
      };

      const razorpay = new window.Razorpay(options);

      razorpay.on("payment.failed", function (response: any) {
        console.error("Razorpay payment failed:", response);

        setError(
          response?.error?.description ||
            "Payment failed. Please try again."
        );

        setMessage("");
        setPaymentLoading(false);
      });

      razorpay.open();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start payment."
      );

      setPaymentLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>

          <div className="eyebrow">RESTAURANT PARTNER</div>

          <h1>Loading campaign...</h1>

          <p className="muted">
            Please wait while we load your restaurant campaign.
          </p>
        </div>
      </main>
    );
  }

  if (!restaurant) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>

          <div className="eyebrow">CAMPAIGN ERROR</div>

          <h1>Unable to load campaign.</h1>

          {error && (
            <div
              style={{
                marginTop: 16,
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

          <p className="back-link">
            <Link href="/restaurant/dashboard">
              ← Back to dashboard
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const minimumBid = restaurant.current_bid + 1;

  return (
    <main className="auth-page">
      <div
        className="auth-card"
        style={{
          maxWidth: 560,
        }}
      >
        <Link href="/" className="brand">
          Dine<span>Up</span>
        </Link>

        <div className="eyebrow">BOOST YOUR VISIBILITY</div>

        <h1>Move up the leaderboard.</h1>

        <p className="muted">
          Increase your restaurant&apos;s position by placing a higher
          bid. Payment is securely processed through Razorpay.
        </p>

        <div
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 14,
            background: "#f7f7f7",
            border: "1px solid #e5e5e5",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "#777",
              marginBottom: 6,
            }}
          >
            RESTAURANT
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#111",
            }}
          >
            {restaurant.name}
          </div>

          <div
            style={{
              marginTop: 6,
              color: "#666",
              fontSize: 14,
            }}
          >
            {restaurant.city} • {restaurant.category}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginTop: 16,
          }}
        >
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: "1px solid #e5e5e5",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#777",
              }}
            >
              Current bid
            </div>

            <strong
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 22,
              }}
            >
              ₹{restaurant.current_bid.toLocaleString("en-IN")}
            </strong>
          </div>

          <div
            style={{
              padding: 16,
              borderRadius: 12,
              border: "1px solid #e5e5e5",
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#777",
              }}
            >
              Minimum next bid
            </div>

            <strong
              style={{
                display: "block",
                marginTop: 4,
                fontSize: 22,
              }}
            >
              ₹{minimumBid.toLocaleString("en-IN")}
            </strong>
          </div>
        </div>

        <div className="auth-form" style={{ marginTop: 20 }}>
          <label>
            New bid amount
            <input
              type="number"
              min={minimumBid}
              value={bidAmount}
              onChange={(event) => setBidAmount(event.target.value)}
              placeholder={`Minimum ₹${minimumBid.toLocaleString(
                "en-IN"
              )}`}
              disabled={paymentLoading}
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
                background: "#f1fff5",
                border: "1px solid #c9efd6",
                color: "#147a3d",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          )}

          <button
            className="primary-btn"
            type="button"
            onClick={handlePayment}
            disabled={paymentLoading}
            style={{
              width: "100%",
              opacity: paymentLoading ? 0.7 : 1,
              cursor: paymentLoading ? "not-allowed" : "pointer",
            }}
          >
            {paymentLoading
              ? "Processing payment..."
              : `Pay ₹${Number(bidAmount || 0).toLocaleString(
                  "en-IN"
                )} & increase rank →`}
          </button>
        </div>

        <div className="demo-note">
          <strong>Secure payment:</strong> Your payment is processed
          through Razorpay Test Mode. DineUp verifies the payment on
          the server before updating your leaderboard position.
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

export default function BidPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card">
            <Link href="/" className="brand">
              Dine<span>Up</span>
            </Link>

            <div className="eyebrow">DINEUP</div>

            <h1>Loading...</h1>

            <p className="muted">
              Please wait.
            </p>
          </div>
        </main>
      }
    >
      <BidPageContent />
    </Suspense>
  );
}
