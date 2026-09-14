"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  address: string | null;
  current_bid: number | null;
  owner_id: string | null;
  is_active: boolean;
};

const stats = [
  ["Profile views", "1,284", "+18% this week"],
  ["Customer actions", "86", "calls + directions"],
];

export default function RestaurantDashboard() {
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [nextRank, setNextRank] = useState<number | null>(null);
  const [nextBid, setNextBid] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      /*
       * 1. Get currently logged-in Supabase user
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/restaurant/login");
        return;
      }

      /*
       * 2. Find restaurant belonging to this user
       */
      const { data: myRestaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select(
          "id, name, city, category, address, current_bid, owner_id, is_active"
        )
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (restaurantError) {
        throw restaurantError;
      }

      if (!myRestaurant) {
        setError(
          "No active restaurant is linked to this account. Please contact DineUp support."
        );
        return;
      }

      setRestaurant(myRestaurant);

      /*
       * 3. Load active restaurants in the same city
       *    and calculate live leaderboard rank.
       */
      const { data: restaurants, error: leaderboardError } = await supabase
        .from("restaurants")
        .select("id, name, current_bid, city, category, is_active")
        .eq("is_active", true)
        .eq("city", myRestaurant.city)
        .order("current_bid", { ascending: false });

      if (leaderboardError) {
        throw leaderboardError;
      }

      const leaderboard = restaurants || [];

      const myIndex = leaderboard.findIndex(
        (item) => item.id === myRestaurant.id
      );

      if (myIndex >= 0) {
        const currentRank = myIndex + 1;

        setRank(currentRank);

        if (myIndex > 0) {
          setNextRank(myIndex);

          const restaurantAbove = leaderboard[myIndex - 1];

          setNextBid(Number(restaurantAbove.current_bid || 0));
        } else {
          setNextRank(null);
          setNextBid(null);
        }
      } else {
        setRank(null);
        setNextRank(null);
        setNextBid(null);
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    /*
     * Refresh dashboard when user comes back to this tab.
     */
    const handleFocus = () => {
      loadDashboard();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [supabase]);

  async function handleLogout() {
    setLoggingOut(true);

    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/restaurant/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="brand">
            Dine<span>Up</span>
          </div>

          <div className="eyebrow">RESTAURANT PARTNER</div>

          <h1>Loading dashboard...</h1>

          <p className="muted">
            Checking your restaurant account and live leaderboard.
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

          <div className="eyebrow">RESTAURANT PARTNER</div>

          <h1>Unable to load dashboard.</h1>

          <p
            style={{
              color: "#b42318",
              background: "#fff1f1",
              border: "1px solid #ffd1d1",
              padding: "12px 14px",
              borderRadius: 10,
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>

          <button
            type="button"
            className="primary-btn full"
            onClick={() => router.push("/restaurant/login")}
          >
            Back to login →
          </button>
        </div>
      </main>
    );
  }

  if (!restaurant) {
    return null;
  }

  const currentBid = Number(restaurant.current_bid || 0);

  const minimumBid = currentBid + 1;

  const formattedCurrentBid = currentBid.toLocaleString("en-IN");

  const formattedMinimumBid = minimumBid.toLocaleString("en-IN");

  const formattedNextBid =
    nextBid !== null ? nextBid.toLocaleString("en-IN") : null;

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>

          <nav className="nav-links">
            <span className="partner-badge">Restaurant Partner</span>

            <Link href="/">View marketplace</Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                border: 0,
                background: "transparent",
                cursor: loggingOut ? "not-allowed" : "pointer",
                padding: 0,
                font: "inherit",
                opacity: loggingOut ? 0.6 : 1,
              }}
            >
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </nav>
        </div>
      </header>

      <section className="dashboard-wrap">
        <div className="container">
          <div className="dashboard-head">
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

          {error && (
            <div
              style={{
                marginTop: 20,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#9a3412",
              }}
            >
              {error}
            </div>
          )}

          <div className="stats-grid">
            <div className="stat-card">
              <span>Current rank</span>

              <strong>{rank !== null ? `#${rank}` : "—"}</strong>

              <small>{restaurant.city}</small>
            </div>

            <div className="stat-card">
              <span>Current bid</span>

              <strong>₹{formattedCurrentBid}</strong>

              <small>today</small>
            </div>

            {stats.map(([label, value, note]) => (
              <div className="stat-card" key={label}>
                <span>{label}</span>

                <strong>{value}</strong>

                <small>{note}</small>
              </div>
            ))}
          </div>

          <div className="dashboard-grid">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="eyebrow">LIVE CAMPAIGN</div>

                  <h2>Your visibility position</h2>
                </div>

                <span className="status-pill">ACTIVE</span>
              </div>

              <div className="position-box">
                <div>
                  <span>Your position</span>

                  <strong>{rank !== null ? `#${rank}` : "—"}</strong>
                </div>

                <div className="position-arrow">↑</div>

                <div>
                  <span>Next position</span>

                  <strong>
                    {nextRank !== null ? `#${nextRank}` : "TOP"}
                  </strong>
                </div>
              </div>

              <div className="campaign-details">
                <div className="bid-row">
                  <span>Current bid</span>

                  <strong>₹{formattedCurrentBid}</strong>
                </div>

                <div className="bid-row">
                  <span>Current position</span>

                  <strong>
                    {rank !== null ? `#${rank}` : "—"}
                  </strong>
                </div>

                <div className="bid-row">
                  <span>Next position</span>

                  <strong>
                    {nextRank !== null && formattedNextBid
                      ? `#${nextRank} · ₹${formattedNextBid}`
                      : "TOP"}
                  </strong>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <div className="eyebrow">INCREASE VISIBILITY</div>

                <p className="muted">
                  Your minimum new bid is{" "}
                  <strong>₹{formattedMinimumBid}</strong>.
                </p>

                <Link
                  href={`/restaurant/bid?id=${restaurant.id}`}
                  className="primary-btn full"
                >
                  Increase visibility ↑
                </Link>
              </div>
            </section>

            <section className="panel">
              <div className="eyebrow">CAMPAIGN SETTINGS</div>

              <h2>Restaurant promotion</h2>

              <p className="muted">
                Your restaurant automatically ranks higher when your verified
                campaign bid exceeds the restaurant above you.
              </p>

              <div className="info-box">
                <strong>Live ranking</strong>

                <p>
                  Bids are stored securely in Supabase and the leaderboard
                  updates automatically.
                </p>
              </div>

              <div className="info-box">
                <strong>Restaurant</strong>

                <p>{restaurant.name}</p>
              </div>

              <div className="info-box">
                <strong>Location</strong>

                <p>
                  {restaurant.city}
                  {restaurant.address
                    ? ` · ${restaurant.address}`
                    : ""}
                </p>
              </div>

              <div className="info-box">
                <strong>Category</strong>

                <p>{restaurant.category}</p>
              </div>
            </section>
          </div>

          <div
            style={{
              marginTop: 28,
              textAlign: "center",
            }}
          >
            <Link href="/" className="back-link">
              ← Back to DineUp marketplace
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
