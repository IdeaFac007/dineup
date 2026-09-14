"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

function BidPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [bid, setBid] = useState("");
  const [currentBid, setCurrentBid] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantId, setRestaurantId] = useState<number | null>(null);

  useEffect(() => {
    const id = Number(searchParams.get("id"));

    if (!id) {
      setError("Restaurant not found.");
      return;
    }

    setRestaurantId(id);

    async function loadRestaurant() {
      const { data, error } = await supabase
        .from("restaurants")
        .select("name, current_bid")
        .eq("id", id)
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      const amount = Number(data?.current_bid || 0);

      setRestaurantName(data?.name || "Restaurant");
      setCurrentBid(amount);
      setBid(String(amount + 1));
    }

    loadRestaurant();
  }, [searchParams]);

  const minimumBid = currentBid + 1;

  const handleBid = async () => {
    setError("");

    if (!restaurantId) {
      setError("Restaurant not found.");
      return;
    }

    const amount = Number(bid);

    if (!amount || amount <= currentBid) {
      setError(
        `Your bid must be higher than ₹${currentBid.toLocaleString("en-IN")}.`
      );
      return;
    }

    setSaving(true);

    try {
      const { error: bidError } = await supabase.rpc("place_bid", {
        p_restaurant_id: restaurantId,
        p_amount: amount,
      });

      if (bidError) {
        throw new Error(bidError.message);
      }

      setCurrentBid(amount);
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">

        <Link href="/" className="back-link">
          ← Back to leaderboard
        </Link>

        <div className="eyebrow">DINEUP • VISIBILITY</div>

        <h1>Increase your visibility.</h1>

        <p className="muted">
          Place a higher bid to move{" "}
          {restaurantName || "this restaurant"} up the Lucknow leaderboard.
        </p>

        <div className="panel" style={{ marginTop: 28 }}>
          <div className="panel-title">Current campaign</div>

          <div className="bid-row">
            <span>Current top bid</span>

            <strong>
              ₹{currentBid.toLocaleString("en-IN")}
            </strong>
          </div>

          <div className="bid-row">
            <span>Minimum new bid</span>

            <strong>
              ₹{minimumBid.toLocaleString("en-IN")}
            </strong>
          </div>
        </div>

        {!submitted ? (
          <>
            <label
              htmlFor="bid"
              style={{
                display: "block",
                marginTop: 24,
                marginBottom: 8,
                fontWeight: 700,
              }}
            >
              Your new bid
            </label>

            <input
              id="bid"
              type="number"
              min={minimumBid}
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              style={{
                width: "100%",
                padding: "15px 16px",
                border: "1px solid #ddd",
                borderRadius: 9,
                fontSize: 18,
                boxSizing: "border-box",
              }}
            />

            <p className="muted" style={{ marginTop: 10 }}>
              Minimum bid: ₹{minimumBid.toLocaleString("en-IN")}
            </p>

            {error && (
              <p
                style={{
                  color: "crimson",
                  marginTop: 12,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </p>
            )}

            <button
              type="button"
              className="primary-btn full"
              onClick={handleBid}
              disabled={saving || !restaurantId}
              style={{ marginTop: 14 }}
            >
              {saving ? "Saving bid..." : "Place bid →"}
            </button>

            <div className="demo-note" style={{ marginTop: 18 }}>
              MVP demo: No real payment is processed yet.
              Razorpay will be connected in the next phase.
            </div>
          </>
        ) : (
          <div
            className="panel"
            style={{
              marginTop: 24,
              textAlign: "center",
              padding: 28,
            }}
          >
            <div className="eyebrow">BID SUBMITTED</div>

            <h2 style={{ margin: "10px 0" }}>
              You are moving up!
            </h2>

            <p className="muted">
              {restaurantName}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 22,
              }}
            >
              <div className="stat-card">
                <span>New bid</span>

                <strong>
                  ₹{Number(bid).toLocaleString("en-IN")}
                </strong>
              </div>

              <div className="stat-card">
                <span>Status</span>

                <strong>LIVE</strong>
              </div>
            </div>

            <Link
              href="/restaurant/dashboard"
              className="primary-btn full"
              style={{ marginTop: 22 }}
            >
              Back to dashboard →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function BidPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BidPageContent />
    </Suspense>
  );
}
