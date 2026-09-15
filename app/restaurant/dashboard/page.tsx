"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  address?: string | null;
  current_bid: number;
  is_active?: boolean;
};

type LeaderboardRestaurant = {
  id: number;
  name: string;
  current_bid: number;
};

type Bid = {
  id: number;
  amount: number;
  status: string;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
};

export default function RestaurantDashboard() {
  const supabase = createClient();
  const router = useRouter();

  const [restaurant, setRestaurant] =
    useState<Restaurant | null>(null);

  const [rank, setRank] = useState(0);
  const [nextRank, setNextRank] =
    useState<number | null>(null);
  const [nextBid, setNextBid] =
    useState<number | null>(null);

  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState("");

  const currentBid = restaurant?.current_bid || 0;

  const formatMoney = (value: number) =>
    `₹${Number(value || 0).toLocaleString("en-IN")}`;

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return date;
    }
  };

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      try {
        // ---------------------------------------------
        // 1. Get logged-in restaurant owner
        // ---------------------------------------------
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/restaurant/login");
          return;
        }

        // ---------------------------------------------
        // 2. Load restaurant
        // ---------------------------------------------
        const {
          data: myRestaurant,
          error: restaurantError,
        } = await supabase
          .from("restaurants")
          .select(
            `
            id,
            name,
            city,
            category,
            address,
            current_bid,
            is_active
            `
          )
          .eq("owner_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (restaurantError) {
          throw restaurantError;
        }

        if (!myRestaurant) {
          throw new Error(
            "No active restaurant is linked to this account."
          );
        }

        const restaurantData: Restaurant = {
          id: Number(myRestaurant.id),
          name: myRestaurant.name,
          city: myRestaurant.city,
          category: myRestaurant.category,
          address: myRestaurant.address,
          current_bid: Number(
            myRestaurant.current_bid || 0
          ),
          is_active: myRestaurant.is_active,
        };

        setRestaurant(restaurantData);

        // ---------------------------------------------
        // 3. Load city leaderboard
        // ---------------------------------------------
        const {
          data: restaurants,
          error: leaderboardError,
        } = await supabase
          .from("restaurants")
          .select(
            "id, name, current_bid"
          )
          .eq("is_active", true)
          .eq("city", restaurantData.city)
          .order("current_bid", {
            ascending: false,
          });

        if (leaderboardError) {
          throw leaderboardError;
        }

        const leaderboard: LeaderboardRestaurant[] =
          (restaurants || []).map((item) => ({
            id: Number(item.id),
            name: item.name,
            current_bid: Number(
              item.current_bid || 0
            ),
          }));

        const myIndex =
          leaderboard.findIndex(
            (item) =>
              item.id === restaurantData.id
          );

        if (myIndex >= 0) {
          setRank(myIndex + 1);

          if (myIndex > 0) {
            setNextRank(myIndex);
            setNextBid(
              leaderboard[myIndex - 1]
                .current_bid
            );
          } else {
            setNextRank(null);
            setNextBid(null);
          }
        } else {
          setRank(0);
          setNextRank(null);
          setNextBid(null);
        }

        // ---------------------------------------------
        // 4. Load bid history
        // ---------------------------------------------
        const {
          data: bidData,
          error: bidError,
        } = await supabase
          .from("bids")
          .select(
            `
            id,
            amount,
            status,
            payment_status,
            razorpay_order_id,
            razorpay_payment_id,
            created_at
            `
          )
          .eq(
            "restaurant_id",
            restaurantData.id
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(20);

        if (bidError) {
          console.error(
            "Bid history error:",
            bidError
          );
        } else {
          setBids(
            (bidData || []).map((item) => ({
              id: Number(item.id),
              amount: Number(
                item.amount || 0
              ),
              status: item.status,
              payment_status:
                item.payment_status,
              razorpay_order_id:
                item.razorpay_order_id,
              razorpay_payment_id:
                item.razorpay_payment_id,
              created_at:
                item.created_at,
            }))
          );
        }
      } catch (error) {
        console.error(
          "Dashboard error:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, supabase]
  );

  useEffect(() => {
    loadDashboard();

    const refreshDashboard = () => {
      loadDashboard(true);
    };

    window.addEventListener(
      "focus",
      refreshDashboard
    );

    window.addEventListener(
      "pageshow",
      refreshDashboard
    );

    return () => {
      window.removeEventListener(
        "focus",
        refreshDashboard
      );

      window.removeEventListener(
        "pageshow",
        refreshDashboard
      );
    };
  }, [loadDashboard]);

  async function handleLogout() {
    setLoggingOut(true);
    setMessage("");

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      setMessage(error.message);
      setLoggingOut(false);
      return;
    }

    router.push("/restaurant/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="dashboard-page">
        <header className="dash-nav">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>
        </header>

        <section className="dashboard-shell">
          <div className="panel">
            <div className="eyebrow">
              RESTAURANT DASHBOARD
            </div>

            <h1>Loading dashboard...</h1>

            <p className="muted">
              Fetching your live restaurant
              performance.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!restaurant) {
    return (
      <main className="dashboard-page">
        <header className="dash-nav">
          <Link href="/" className="brand">
            Dine<span>Up</span>
          </Link>
        </header>

        <section className="dashboard-shell">
          <div className="panel">
            <div className="eyebrow">
              DASHBOARD ERROR
            </div>

            <h1>
              Unable to load dashboard.
            </h1>

            {message && (
              <p
                className="muted"
                style={{ marginTop: 12 }}
              >
                {message}
              </p>
            )}

            <p style={{ marginTop: 20 }}>
              <Link
                href="/restaurant/login"
                className="primary-btn"
              >
                Back to login →
              </Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  const activeBids = bids.filter(
    (bid) =>
      bid.status === "active" &&
      bid.payment_status === "captured"
  );

  const paidBids = bids.filter(
    (bid) =>
      bid.payment_status === "captured"
  );

  const pendingBids = bids.filter(
    (bid) =>
      bid.payment_status === "pending"
  );

  return (
    <main className="dashboard-page">
      {/* ==================================================
          NAVIGATION
      ================================================== */}
      <header className="dash-nav">
        <Link href="/" className="brand">
          Dine<span>Up</span>
        </Link>

        <div className="dash-right">
          <span className="partner-pill">
            Restaurant Partner
          </span>

          <Link
            href="/"
            className="text-link"
          >
            View marketplace
          </Link>

          <button
            type="button"
            className="secondary-btn"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut
              ? "Logging out..."
              : "Logout"}
          </button>
        </div>
      </header>

      <section className="dashboard-shell">
        {/* ==================================================
            HEADER
        ================================================== */}
        <div className="dash-heading">
          <div>
            <div className="eyebrow">
              RESTAURANT DASHBOARD
            </div>

            <h1>{restaurant.name}</h1>

            <p className="muted">
              {restaurant.city} •{" "}
              {restaurant.category}
              {restaurant.address
                ? ` • ${restaurant.address}`
                : ""}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                loadDashboard(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

            <Link
              href={`/restaurant/bid?id=${restaurant.id}`}
              className="primary-btn"
            >
              Increase visibility ↑
            </Link>
          </div>
        </div>

        {/* ==================================================
            ERROR / INFO MESSAGE
        ================================================== */}
        {message && (
          <div
            className="panel"
            style={{
              marginBottom: 20,
              borderColor: "#f0caca",
            }}
          >
            <p className="muted">
              {message}
            </p>
          </div>
        )}

        {/* ==================================================
            LIVE STATS
        ================================================== */}
        <div className="stats-grid">
          <div className="stat-card">
            <span>Current rank</span>

            <strong>
              {rank ? `#${rank}` : "—"}
            </strong>

            <small>
              in {restaurant.city}
            </small>
          </div>

          <div className="stat-card">
            <span>Current bid</span>

            <strong>
              {formatMoney(currentBid)}
            </strong>

            <small>
              live marketplace bid
            </small>
          </div>

          <div className="stat-card">
            <span>Paid bids</span>

            <strong>
              {paidBids.length}
            </strong>

            <small>
              successful payments
            </small>
          </div>

          <div className="stat-card">
            <span>Bid attempts</span>

            <strong>
              {bids.length}
            </strong>

            <small>
              recent bidding activity
            </small>
          </div>
        </div>

        {/* ==================================================
            MAIN GRID
        ================================================== */}
        <div className="dashboard-grid">
          {/* ----------------------------------------------
              LIVE CAMPAIGN
          ---------------------------------------------- */}
          <section className="panel">
            <div className="panel-title">
              <div>
                <span className="live-dot" />{" "}
                Live campaign
              </div>

              <span className="status">
                ACTIVE
              </span>
            </div>

            <div className="rank-box">
              <div>
                <small>
                  Your position
                </small>

                <strong>
                  {rank
                    ? `#${rank}`
                    : "—"}
                </strong>
              </div>

              <div className="rank-arrow">
                ↑
              </div>

              <div>
                <small>
                  {nextRank
                    ? "Next position"
                    : "Marketplace leader"}
                </small>

                <strong>
                  {nextRank
                    ? `#${nextRank}`
                    : "TOP"}
                </strong>
              </div>
            </div>

            <div className="bid-row">
              <span>
                Current bid
              </span>

              <strong>
                {formatMoney(currentBid)}
              </strong>
            </div>

            <div className="bid-row">
              <span>
                {nextBid
                  ? `Bid to reach #${nextRank}`
                  : "You are #1"}
              </span>

              <strong>
                {nextBid
                  ? formatMoney(
                      nextBid + 1
                    )
                  : "—"}
              </strong>
            </div>

            {nextBid && (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 12,
                  background: "#f7f7f7",
                  border:
                    "1px solid #e5e5e5",
                }}
              >
                <strong>
                  You are one bid away
                </strong>

                <p
                  className="muted"
                  style={{
                    marginTop: 6,
                    marginBottom: 0,
                  }}
                >
                  Bid{" "}
                  <strong>
                    {formatMoney(
                      nextBid + 1
                    )}
                  </strong>{" "}
                  or more to move to #
                  {nextRank}.
                </p>
              </div>
            )}

            {!nextBid && rank === 1 && (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  borderRadius: 12,
                  background: "#f7f7f7",
                  border:
                    "1px solid #e5e5e5",
                }}
              >
                <strong>
                  🏆 You are currently #1
                </strong>

                <p
                  className="muted"
                  style={{
                    marginTop: 6,
                    marginBottom: 0,
                  }}
                >
                  Keep monitoring the
                  marketplace to maintain
                  your position.
                </p>
              </div>
            )}

            <div
              style={{
                marginTop: 20,
              }}
            >
              <Link
                href={`/restaurant/bid?id=${restaurant.id}`}
                className="primary-btn full"
              >
                Increase visibility ↑
              </Link>
            </div>
          </section>

          {/* ----------------------------------------------
              RESTAURANT PROFILE
          ---------------------------------------------- */}
          <section className="panel">
            <div className="panel-title">
              <div>
                Restaurant profile
              </div>

              <span className="status">
                LIVE
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
              }}
            >
              <div
                style={{
                  padding: 15,
                  borderRadius: 12,
                  background: "#f7f7f7",
                  border:
                    "1px solid #e5e5e5",
                }}
              >
                <small
                  style={{
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Restaurant
                </small>

                <strong>
                  {restaurant.name}
                </strong>
              </div>

              <div
                style={{
                  padding: 15,
                  borderRadius: 12,
                  background: "#f7f7f7",
                  border:
                    "1px solid #e5e5e5",
                }}
              >
                <small
                  style={{
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Location
                </small>

                <strong>
                  {restaurant.city}
                </strong>

                {restaurant.address && (
                  <p
                    className="muted"
                    style={{
                      marginTop: 4,
                    }}
                  >
                    {restaurant.address}
                  </p>
                )}
              </div>

              <div
                style={{
                  padding: 15,
                  borderRadius: 12,
                  background: "#f7f7f7",
                  border:
                    "1px solid #e5e5e5",
                }}
              >
                <small
                  style={{
                    display: "block",
                    marginBottom: 5,
                  }}
                >
                  Category
                </small>

                <strong>
                  {restaurant.category}
                </strong>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/"
                className="secondary-btn"
              >
                View marketplace
              </Link>

              <Link
                href={`/restaurant/bid?id=${restaurant.id}`}
                className="primary-btn"
              >
                Promote restaurant
              </Link>
            </div>
          </section>
        </div>

        {/* ==================================================
            BID HISTORY
        ================================================== */}
        <section
          className="panel table-panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-title">
            <div>
              Bid history
            </div>

            <span className="muted">
              {bids.length} records
            </span>
          </div>

          {bids.length === 0 ? (
            <div
              style={{
                padding: "30px 10px",
                textAlign: "center",
              }}
            >
              <strong>
                No bids yet
              </strong>

              <p
                className="muted"
                style={{
                  marginTop: 6,
                }}
              >
                Your bidding activity will
                appear here.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <div
                style={{
                  minWidth: 650,
                }}
              >
                <div className="leader-row header">
                  <span>Date</span>
                  <span>Bid</span>
                  <span>Status</span>
                  <span>Payment</span>
                </div>

                {bids.map((bid) => (
                  <div
                    className="leader-row"
                    key={bid.id}
                  >
                    <span>
                      {formatDate(
                        bid.created_at
                      )}
                    </span>

                    <strong>
                      {formatMoney(
                        bid.amount
                      )}
                    </strong>

                    <span>
                      {bid.status ===
                        "active" ? (
                        <span className="status">
                          ACTIVE
                        </span>
                      ) : bid.status ===
                        "paid_outbid" ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          OUTBID
                        </span>
                      ) : (
                        <span>
                          {bid.status}
                        </span>
                      )}
                    </span>

                    <span>
                      {bid.payment_status ===
                      "captured" ? (
                        <span className="status">
                          PAID
                        </span>
                      ) : bid.payment_status ===
                        "pending" ? (
                        <span>
                          Pending
                        </span>
                      ) : (
                        <span>
                          {bid.payment_status}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            PAYMENT HISTORY
        ================================================== */}
        <section
          className="panel table-panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-title">
            <div>
              Payment history
            </div>

            <span className="muted">
              {paidBids.length} successful
            </span>
          </div>

          {paidBids.length === 0 ? (
            <div
              style={{
                padding: "30px 10px",
                textAlign: "center",
              }}
            >
              <strong>
                No successful payments yet
              </strong>

              <p
                className="muted"
                style={{
                  marginTop: 6,
                }}
              >
                Completed Razorpay payments
                will appear here.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <div
                style={{
                  minWidth: 700,
                }}
              >
                <div className="leader-row header">
                  <span>Date</span>
                  <span>Amount</span>
                  <span>Payment ID</span>
                  <span>Status</span>
                </div>

                {paidBids.map((bid) => (
                  <div
                    className="leader-row"
                    key={`payment-${bid.id}`}
                  >
                    <span>
                      {formatDate(
                        bid.created_at
                      )}
                    </span>

                    <strong>
                      {formatMoney(
                        bid.amount
                      )}
                    </strong>

                    <span
                      style={{
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow:
                          "ellipsis",
                        whiteSpace:
                          "nowrap",
                        maxWidth: 230,
                      }}
                      title={
                        bid.razorpay_payment_id ||
                        ""
                      }
                    >
                      {bid.razorpay_payment_id ||
                        "—"}
                    </span>

                    <span className="status">
                      CAPTURED
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ==================================================
            MARKETPLACE PREVIEW
        ================================================== */}
        <section
          className="panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-title">
            <div>
              Marketplace preview
            </div>

            <Link
              href="/"
              className="text-link"
            >
              Open public board →
            </Link>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent:
                "space-between",
              gap: 20,
              padding: 20,
              borderRadius: 14,
              background: "#f7f7f7",
              border:
                "1px solid #e5e5e5",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 14,
                  background: "#111",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "center",
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                {restaurant.name
                  .slice(0, 1)
                  .toUpperCase()}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                >
                  {restaurant.name}
                </div>

                <div
                  className="muted"
                  style={{
                    marginTop: 4,
                  }}
                >
                  {restaurant.city} •{" "}
                  {restaurant.category}
                </div>

                <div
                  style={{
                    marginTop: 7,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {rank === 1
                    ? "🏆 #1 on DineUp"
                    : rank
                    ? `#${rank} on DineUp`
                    : "Listed on DineUp"}
                </div>
              </div>
            </div>

            <div
              style={{
                textAlign: "right",
              }}
            >
              <small className="muted">
                Current bid
              </small>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  marginTop: 3,
                }}
              >
                {formatMoney(currentBid)}
              </div>

              <span
                className="status"
                style={{
                  display: "inline-block",
                  marginTop: 6,
                }}
              >
                SPONSORED
              </span>
            </div>
          </div>
        </section>

        {/* ==================================================
            QUICK ACTIONS
        ================================================== */}
        <section
          className="panel"
          style={{ marginTop: 20 }}
        >
          <div className="panel-title">
            <div>
              Quick actions
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            <Link
              href={`/restaurant/bid?id=${restaurant.id}`}
              className="primary-btn"
              style={{
                textAlign: "center",
              }}
            >
              Increase visibility ↑
            </Link>

            <Link
              href="/"
              className="secondary-btn"
              style={{
                textAlign: "center",
              }}
            >
              View marketplace
            </Link>

            <button
              type="button"
              className="secondary-btn"
              onClick={() =>
                loadDashboard(true)
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh dashboard"}
            </button>
          </div>
        </section>

        {/* ==================================================
            FOOTER NOTE
        ================================================== */}
        <div
          style={{
            padding: "24px 0 10px",
            textAlign: "center",
          }}
        >
          <p
            className="muted"
            style={{ fontSize: 12 }}
          >
            DineUp • Where Restaurants Rise
          </p>
        </div>
      </section>
    </main>
  );
}
