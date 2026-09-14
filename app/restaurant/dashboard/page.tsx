"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  address: string;
  current_bid: number;
  owner_id: string;
};

type LeaderboardRestaurant = {
  id: number;
  name: string;
  current_bid: number;
};

export default function RestaurantDashboard() {
  const supabase = createClient();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [currentBid, setCurrentBid] = useState(0);
  const [rank, setRank] = useState(0);
  const [nextRank, setNextRank] = useState<number | null>(null);
  const [nextBid, setNextBid] = useState<number | null>(null);

  const [newBid, setNewBid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      /*
       * 1. Get the currently logged-in Supabase user.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        window.location.href = "/restaurant/login";
        return;
      }

      /*
       * 2. Find the restaurant belonging to this user.
       *
       * No hardcoded restaurant ID.
       */
      const { data: myRestaurant, error: restaurantError } =
        await supabase
          .from("restaurants")
          .select(
            "id, name, city, category, address, current_bid, owner_id"
          )
          .eq("owner_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

      if (restaurantError) {
        throw restaurantError;
      }

      if (!myRestaurant) {
        setRestaurant(null);
        setError(
          "No active restaurant is linked to this account. Please contact DineUp support."
        );
        setLoading(false);
        return;
      }

      setRestaurant(myRestaurant as Restaurant);

      /*
       * 3. Load the leaderboard for the restaurant's city.
       */
      const { data: restaurants, error: leaderboardError } =
        await supabase
          .from("restaurants")
          .select("id, name, current_bid")
          .eq("is_active", true)
          .eq("city", myRestaurant.city)
          .order("current_bid", { ascending: false });

      if (leaderboardError) {
        throw leaderboardError;
      }

      const list = (restaurants || []) as LeaderboardRestaurant[];

      const myIndex = list.findIndex(
        (item) => item.id === myRestaurant.id
      );

      if (myIndex >= 0) {
        const bid = Number(list[myIndex].current_bid || 0);

        setCurrentBid(bid);
        setRank(myIndex + 1);

        /*
         * Restaurant immediately above us.
         */
        if (myIndex > 0) {
          setNextRank(myIndex);
          setNextBid(Number(list[myIndex - 1].current_bid || 0));
        } else {
          setNextRank(null);
          setNextBid(null);
        }
      }

      /*
       * Default next bid.
       */
      if (myIndex >= 0 && myIndex > 0) {
        setNewBid(
          String(Number(list[myIndex - 1].current_bid || 0) + 1)
        );
      } else {
        setNewBid(String(Number(myRestaurant.current_bid || 0) + 1));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadDashboard();

    const refreshDashboard = () => {
      loadDashboard();
    };

    window.addEventListener("focus", refreshDashboard);
    window.addEventListener("pageshow", refreshDashboard);

    return () => {
      window.removeEventListener("focus", refreshDashboard);
      window.removeEventListener("pageshow", refreshDashboard);
    };
  }, [loadDashboard]);

  async function handleBid() {
    setMessage("");
    setError("");

    if (!restaurant) {
      setError("Restaurant information not available.");
      return;
    }

    const amount = Number(newBid);

    if (!amount || amount <= 0) {
      setError("Please enter a valid bid amount.");
      return;
    }

    if (amount <= currentBid) {
      setError(
        `Your bid must be higher than ₹${currentBid.toLocaleString(
          "en-IN"
        )}.`
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * Atomic bid placement through Supabase RPC.
       *
       * Payment will be connected before production bidding.
       */
      const { error: bidError } = await supabase.rpc("place_bid", {
        p_restaurant_id: restaurant.id,
        p_amount: amount,
      });

      if (bidError) {
        throw bidError;
      }

      setMessage(
        `Bid updated successfully to ₹${amount.toLocaleString(
          "en-IN"
        )}.`
      );

      setNewBid("");
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update bid."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/restaurant/login";
  }

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand">
            Dine<span>Up</span>
          </div>

          <div className="eyebrow">RESTAURANT DASHBOARD</div>

          <h1>Loading dashboard...</h1>

          <p className="muted">
            Checking your restaurant account.
          </p>
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

          <div className="eyebrow">RESTAURANT DASHBOARD</div>

          <h1>Unable to access dashboard.</h1>

          <p className="muted">{error}</p>

          <Link href="/restaurant/login" className="primary-btn full">
            Back to login →
          </Link>
        </div>
      </main>
    );
  }

  if (!restaurant) {
    return null;
  }

  const minimumBid = currentBid + 1;

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          Dine<span>Up</span>
        </Link>

        <nav className="nav-links">
          <span className="partner-badge">Restaurant Partner</span>

          <Link href="/">
            View marketplace
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="logout-btn"
          >
            Logout
          </button>
        </nav>
      </header>

      <section className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <div className="eyebrow">RESTAURANT DASHBOARD</div>

            <h1>{restaurant.name}</h1>

            <p className="muted">
              {restaurant.city} • {restaurant.category}
            </p>
          </div>

          <Link
            href={`/restaurant/bid?id=${restaurant.id}`}
            className="primary-btn"
          >
            Increase visibility ↑
          </Link>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Profile views</span>
            <strong>1,284</strong>
            <small>+18% this week</small>
          </div>

          <div className="stat-card">
            <span>Customer actions</span>
            <strong>86</strong>
            <small>calls + directions</small>
          </div>

          <div className="stat-card">
            <span>Current rank</span>
            <strong>#{rank}</strong>
            <small>{restaurant.city}</small>
          </div>

          <div className="stat-card">
            <span>Current bid</span>
            <strong>
              ₹{currentBid.toLocaleString("en-IN")}
            </strong>
            <small>live</small>
          </div>
        </div>

        {error && (
          <div
            style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: 10,
              background: "#fff1f1",
              color: "#b42318",
              border: "1px solid #ffd1d1",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: 10,
              background: "#eefbf1",
              color: "#18794e",
              border: "1px solid #c8efd5",
            }}
          >
            {message}
          </div>
        )}

        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-title">
              <span>LIVE CAMPAIGN</span>
              <span className="status-badge">ACTIVE</span>
            </div>

            <h2>Your visibility position</h2>

            <div className="position-box">
              <div>
                <span>Your position</span>
                <strong>#{rank}</strong>
              </div>

              <div className="position-arrow">↑</div>

              <div>
                <span>Next position</span>
                <strong>
                  {nextRank ? `#${nextRank}` : "TOP"}
                </strong>
              </div>
            </div>

            <div className="bid-row">
              <span>Current bid</span>

              <strong>
                ₹{currentBid.toLocaleString("en-IN")}
              </strong>
            </div>

            <div className="bid-row">
              <span>Current position</span>

              <strong>#{rank}</strong>
            </div>

            <div className="bid-row">
              <span>Next position</span>

              <strong>
                {nextRank && nextBid !== null
                  ? `#${nextRank} • ₹${nextBid.toLocaleString(
                      "en-IN"
                    )}`
                  : "TOP"}
              </strong>
            </div>

            <div style={{ marginTop: 24 }}>
              <div className="eyebrow">
                INCREASE VISIBILITY
              </div>

              <p className="muted">
                Minimum new bid: ₹
                {minimumBid.toLocaleString("en-IN")}
              </p>

              <input
                type="number"
                min={minimumBid}
                value={newBid}
                onChange={(event) =>
                  setNewBid(event.target.value)
                }
                placeholder={`Minimum ₹${minimumBid.toLocaleString(
                  "en-IN"
                )}`}
                style={{
                  width: "100%",
                  marginTop: 8,
                }}
              />

              <button
                type="button"
                className="primary-btn full"
                onClick={handleBid}
                disabled={saving}
                style={{
                  marginTop: 12,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Updating..."
                  : "Increase visibility ↑"}
              </button>
            </div>
          </section>

          <aside className="panel">
            <div className="panel-title">
              CAMPAIGN SETTINGS
            </div>

            <h2>Restaurant promotion</h2>

            <p className="muted">
              Your restaurant automatically ranks higher
              when your verified campaign bid exceeds the
              restaurant above you.
            </p>

            <div className="info-box">
              <strong>Live ranking</strong>

              <p>
                Bids are stored securely in Supabase and the
                leaderboard updates automatically.
              </p>
            </div>

            <div className="restaurant-info">
              <div>
                <span>Restaurant</span>
                <strong>{restaurant.name}</strong>
              </div>

              <div>
                <span>Location</span>
                <strong>
                  {restaurant.city} • {restaurant.address}
                </strong>
              </div>

              <div>
                <span>Category</span>
                <strong>{restaurant.category}</strong>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
