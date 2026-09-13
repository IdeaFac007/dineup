"use client";

import { useState } from "react";
import Link from "next/link";

export default function BidPage() {
  const [bid, setBid] = useState(2600);
  const [submitted, setSubmitted] = useState(false);

  const currentBid = 2500;
  const nextPosition = 6;

  const handleBid = () => {
    if (bid <= currentBid) {
      alert(`Your bid must be higher than ₹${currentBid.toLocaleString("en-IN")}.`);
      return;
    }

    setSubmitted(true);
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/restaurant/dashboard" className="back-link">
          ← Back to dashboard
        </Link>

        <div className="eyebrow">DINEUP • VISIBILITY</div>

        <h1>Increase your visibility.</h1>

        <p className="muted">
          Place a higher bid to move Royal Awadh Kitchen up the Lucknow
          leaderboard.
        </p>

        <div className="panel" style={{ marginTop: 28 }}>
          <div className="panel-title">Current campaign</div>

          <div className="bid-row">
            <span>Current position</span>
            <strong>#7</strong>
          </div>

          <div className="bid-row">
            <span>Current top bid</span>
            <strong>₹2,500</strong>
          </div>

          <div className="bid-row">
            <span>Next position</span>
            <strong>#6</strong>
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
              min={currentBid + 1}
              value={bid}
              onChange={(e) => setBid(Number(e.target.value))}
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
              Minimum bid: ₹2,501
            </p>

            <button
              type="button"
              className="primary-btn full"
              onClick={handleBid}
              style={{ marginTop: 14 }}
            >
              Place bid →
            </button>

            <div className="demo-note" style={{ marginTop: 18 }}>
              MVP demo: No real payment is processed yet. Razorpay will be
              connected in the next phase.
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
              Royal Awadh Kitchen
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
                  ₹{bid.toLocaleString("en-IN")}
                </strong>
              </div>

              <div className="stat-card">
                <span>New position</span>
                <strong>#{nextPosition}</strong>
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
