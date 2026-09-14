"use client";

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
  is_claimed: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
};

type NavItem = {
  id: string;
  label: string;
  icon: string;
};

const navItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "restaurants", label: "Restaurants", icon: "◉" },
  { id: "leaderboard", label: "Leaderboard", icon: "♛" },
  { id: "bids", label: "Bids", icon: "↗" },
  { id: "payments", label: "Payments", icon: "₹" },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("overview");

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/admin/login");
        return;
      }

      setAdminEmail(user.email || "");

      const { data: adminUser, error: adminError } =
        await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (adminError) {
        console.error("Admin verification error:", adminError);
        setError("Unable to verify admin access.");
        return;
      }

      if (!adminUser) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      const { data: restaurantData, error: restaurantError } =
        await supabase
          .from("restaurants")
          .select(
            "id, name, city, category, address, current_bid, is_claimed, is_active, created_at"
          )
          .order("current_bid", {
            ascending: false,
          });

      if (restaurantError) {
        console.error("Restaurant loading error:", restaurantError);

        setError(
          restaurantError.message ||
            "Unable to load restaurant data."
        );

        return;
      }

      setRestaurants((restaurantData || []) as Restaurant[]);
    } catch (err) {
      console.error("Dashboard error:", err);

      setError(
        "Something went wrong while loading the dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace("/admin/login");
    router.refresh();
  }

  const stats = useMemo(() => {
    const total = restaurants.length;

    const active = restaurants.filter(
      (restaurant) => restaurant.is_active !== false
    ).length;

    const claimed = restaurants.filter(
      (restaurant) => restaurant.is_claimed === true
    ).length;

    const totalBidValue = restaurants.reduce(
      (sum, restaurant) =>
        sum + Number(restaurant.current_bid || 0),
      0
    );

    const highestBid =
      restaurants.length > 0
        ? Math.max(
            ...restaurants.map((restaurant) =>
              Number(restaurant.current_bid || 0)
            )
          )
        : 0;

    const cities = new Set(
      restaurants.map((restaurant) => restaurant.city)
    ).size;

    return {
      total,
      active,
      claimed,
      totalBidValue,
      highestBid,
      cities,
    };
  }, [restaurants]);

  const filteredRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return restaurants;
    }

    return restaurants.filter((restaurant) => {
      return (
        restaurant.name.toLowerCase().includes(query) ||
        restaurant.city.toLowerCase().includes(query) ||
        restaurant.category.toLowerCase().includes(query) ||
        (restaurant.address || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [restaurants, search]);

  const topRestaurants = restaurants.slice(0, 5);

  if (loading) {
    return (
      <>
        <div className="loadingScreen">
          <div className="loadingLogo">D</div>
          <div>
            <strong>DineUp Admin</strong>
            <span>Loading dashboard...</span>
          </div>
        </div>

        <style jsx>{`
          .loadingScreen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 14px;
            background: #f6f7f9;
            color: #171717;
            font-family: Arial, Helvetica, sans-serif;
          }

          .loadingLogo {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: #171717;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            font-weight: 800;
          }

          .loadingScreen strong,
          .loadingScreen span {
            display: block;
          }

          .loadingScreen span {
            margin-top: 4px;
            color: #777;
            font-size: 13px;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="adminShell">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brandMark">D</div>

            <div>
              <div className="brandName">DineUp</div>
              <div className="brandSub">ADMIN PANEL</div>
            </div>
          </div>

          <div className="sideSectionTitle">
            MANAGEMENT
          </div>

          <nav className="navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={
                  activeNav === item.id
                    ? "navItem active"
                    : "navItem"
                }
                onClick={() => setActiveNav(item.id)}
              >
                <span className="navIcon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebarBottom">
            <div className="adminMini">
              <div className="adminAvatar">A</div>

              <div className="adminMiniText">
                <strong>Administrator</strong>
                <span>{adminEmail}</span>
              </div>
            </div>

            <button
              className="logoutButton"
              onClick={handleLogout}
            >
              <span>↪</span>
              Logout
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="mainArea">

          {/* TOP BAR */}
          <header className="topbar">
            <div>
              <div className="breadcrumb">
                DineUp / Admin
              </div>

              <h1>
                {activeNav === "overview"
                  ? "Dashboard"
                  : navItems.find(
                      (item) => item.id === activeNav
                    )?.label}
              </h1>
            </div>

            <div className="topActions">
              <div className="liveStatus">
                <span className="liveDot" />
                System Live
              </div>

              <button
                className="refreshButton"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>
          </header>

          <main className="content">

            {error && (
              <div className="errorBox">
                <strong>Dashboard Error</strong>
                <span>{error}</span>
              </div>
            )}

            {/* OVERVIEW */}
            {activeNav === "overview" && (
              <>
                <section className="welcomeCard">
                  <div>
                    <span className="eyebrow">
                      DINEUP CONTROL CENTER
                    </span>

                    <h2>
                      Where Restaurants Rise.
                    </h2>

                    <p>
                      Monitor restaurants, bids and
                      marketplace activity from one place.
                    </p>
                  </div>

                  <div className="welcomeBadge">
                    <span>LIVE</span>
                    <strong>
                      {stats.total} Restaurants
                    </strong>
                  </div>
                </section>

                {/* STATS */}
                <section className="statsGrid">

                  <StatCard
                    label="Total Restaurants"
                    value={stats.total.toString()}
                    icon="◉"
                    note="Listed on DineUp"
                  />

                  <StatCard
                    label="Active Restaurants"
                    value={stats.active.toString()}
                    icon="✓"
                    note="Currently active"
                  />

                  <StatCard
                    label="Current Bid Value"
                    value={`₹${stats.totalBidValue.toLocaleString(
                      "en-IN"
                    )}`}
                    icon="₹"
                    note="Across current leaderboard"
                  />

                  <StatCard
                    label="Highest Bid"
                    value={`₹${stats.highestBid.toLocaleString(
                      "en-IN"
                    )}`}
                    icon="♛"
                    note="Current market leader"
                  />

                </section>

                {/* CONTENT GRID */}
                <section className="dashboardGrid">

                  {/* LEADERBOARD */}
                  <div className="panel largePanel">

                    <div className="panelHeader">
                      <div>
                        <h3>Live Leaderboard</h3>
                        <p>
                          Restaurants ranked by current bid
                        </p>
                      </div>

                      <button
                        className="textButton"
                        onClick={() =>
                          setActiveNav("leaderboard")
                        }
                      >
                        View all →
                      </button>
                    </div>

                    <div className="leaderboard">

                      {topRestaurants.length === 0 ? (
                        <EmptyState />
                      ) : (
                        topRestaurants.map(
                          (restaurant, index) => (
                            <div
                              className="leaderRow"
                              key={restaurant.id}
                            >
                              <div
                                className={
                                  index === 0
                                    ? "rank first"
                                    : "rank"
                                }
                              >
                                {index + 1}
                              </div>

                              <div className="restaurantAvatar">
                                {restaurant.name
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div className="restaurantInfo">
                                <strong>
                                  {restaurant.name}
                                </strong>

                                <span>
                                  {restaurant.category}
                                  {" • "}
                                  {restaurant.city}
                                </span>
                              </div>

                              <div className="bidAmount">
                                ₹
                                {Number(
                                  restaurant.current_bid || 0
                                ).toLocaleString("en-IN")}
                              </div>

                              <div className="statusPill">
                                {restaurant.is_active !== false
                                  ? "Active"
                                  : "Inactive"}
                              </div>
                            </div>
                          )
                        )
                      )}

                    </div>
                  </div>

                  {/* MARKET SNAPSHOT */}
                  <div className="panel">

                    <div className="panelHeader">
                      <div>
                        <h3>Market Snapshot</h3>
                        <p>Current marketplace overview</p>
                      </div>
                    </div>

                    <div className="snapshotList">

                      <SnapshotRow
                        label="Cities"
                        value={stats.cities.toString()}
                      />

                      <SnapshotRow
                        label="Claimed Restaurants"
                        value={stats.claimed.toString()}
                      />

                      <SnapshotRow
                        label="Unclaimed Restaurants"
                        value={(
                          stats.total - stats.claimed
                        ).toString()}
                      />

                      <SnapshotRow
                        label="Average Bid"
                        value={
                          stats.total > 0
                            ? `₹${Math.round(
                                stats.totalBidValue /
                                  stats.total
                              ).toLocaleString("en-IN")}`
                            : "₹0"
                        }
                      />

                    </div>

                    <div className="marketMessage">
                      <span className="messageIcon">↗</span>

                      <div>
                        <strong>
                          Marketplace is active
                        </strong>

                        <p>
                          Restaurants can compete for
                          higher visibility.
                        </p>
                      </div>
                    </div>

                  </div>

                </section>

                {/* QUICK ACTIONS */}
                <section className="quickSection">

                  <div className="sectionTitle">
                    <div>
                      <h3>Quick Management</h3>
                      <p>
                        Jump directly to important admin
                        sections.
                      </p>
                    </div>
                  </div>

                  <div className="quickGrid">

                    <QuickAction
                      icon="◉"
                      title="Restaurants"
                      description="Manage restaurant listings"
                      onClick={() =>
                        setActiveNav("restaurants")
                      }
                    />

                    <QuickAction
                      icon="♛"
                      title="Leaderboard"
                      description="Monitor ranking positions"
                      onClick={() =>
                        setActiveNav("leaderboard")
                      }
                    />

                    <QuickAction
                      icon="↗"
                      title="Bids"
                      description="Monitor bidding activity"
                      onClick={() =>
                        setActiveNav("bids")
                      }
                    />

                    <QuickAction
                      icon="₹"
                      title="Payments"
                      description="Review payment activity"
                      onClick={() =>
                        setActiveNav("payments")
                      }
                    />

                  </div>

                </section>
              </>
            )}

            {/* RESTAURANTS */}
            {activeNav === "restaurants" && (
              <section className="panel fullPanel">

                <div className="panelHeader">
                  <div>
                    <h3>Restaurant Management</h3>
                    <p>
                      All restaurants currently listed
                      on DineUp.
                    </p>
                  </div>

                  <input
                    className="searchInput"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search restaurant..."
                  />
                </div>

                <RestaurantTable
                  restaurants={filteredRestaurants}
                />

              </section>
            )}

            {/* LEADERBOARD */}
            {activeNav === "leaderboard" && (
              <section className="panel fullPanel">

                <div className="panelHeader">
                  <div>
                    <h3>Live Leaderboard</h3>
                    <p>
                      Current restaurant ranking by bid.
                    </p>
                  </div>

                  <div className="liveStatus">
                    <span className="liveDot" />
                    Live
                  </div>
                </div>

                <RestaurantTable
                  restaurants={restaurants}
                  showRank
                />

              </section>
            )}

            {/* BIDS */}
            {activeNav === "bids" && (
              <section className="emptyFeature">

                <div className="featureIcon">↗</div>

                <h2>Bid Management</h2>

                <p>
                  Bid monitoring and bid history will be
                  connected to the admin panel next.
                </p>

                <div className="featureStats">
                  <div>
                    <span>Highest Bid</span>
                    <strong>
                      ₹{stats.highestBid.toLocaleString(
                        "en-IN"
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Total Bid Value</span>
                    <strong>
                      ₹{stats.totalBidValue.toLocaleString(
                        "en-IN"
                      )}
                    </strong>
                  </div>
                </div>

              </section>
            )}

            {/* PAYMENTS */}
            {activeNav === "payments" && (
              <section className="emptyFeature">

                <div className="featureIcon">₹</div>

                <h2>Payment Management</h2>

                <p>
                  Razorpay payment monitoring will be
                  connected here in the next phase.
                </p>

                <div className="paymentNotice">
                  Razorpay integration is currently
                  running in TEST MODE.
                </div>

              </section>
            )}

          </main>

          <footer className="footer">
            <span>
              DineUp Admin • Where Restaurants Rise
            </span>

            <span>
              Production Dashboard
            </span>
          </footer>

        </div>
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .adminShell {
          min-height: 100vh;
          display: flex;
          background: #f5f6f8;
          color: #171717;
          font-family: Arial, Helvetica, sans-serif;
        }

        .sidebar {
          width: 255px;
          min-height: 100vh;
          background: #111214;
          color: white;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 10px 30px;
        }

        .brandMark {
          width: 40px;
          height: 40px;
          background: white;
          color: #111214;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          font-weight: 900;
        }

        .brandName {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .brandSub {
          margin-top: 2px;
          color: #777b82;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.6px;
        }

        .sideSectionTitle {
          color: #666a71;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
          padding: 0 12px 10px;
        }

        .navigation {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .navItem {
          width: 100%;
          border: 0;
          background: transparent;
          color: #9da1a8;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .navItem:hover {
          background: #1b1d20;
          color: white;
        }

        .navItem.active {
          background: white;
          color: #111214;
        }

        .navIcon {
          width: 22px;
          text-align: center;
          font-size: 16px;
        }

        .sidebarBottom {
          margin-top: auto;
          border-top: 1px solid #292b2f;
          padding-top: 18px;
        }

        .adminMini {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
        }

        .adminAvatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #2a2d32;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 800;
        }

        .adminMiniText {
          min-width: 0;
        }

        .adminMiniText strong,
        .adminMiniText span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .adminMiniText strong {
          font-size: 11px;
        }

        .adminMiniText span {
          margin-top: 3px;
          color: #777b82;
          font-size: 9px;
        }

        .logoutButton {
          width: 100%;
          border: 1px solid #2b2d31;
          background: transparent;
          color: #aaaeb4;
          border-radius: 9px;
          padding: 10px;
          margin-top: 12px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
        }

        .logoutButton:hover {
          background: #1b1d20;
          color: white;
        }

        .logoutButton span {
          margin-right: 8px;
        }

        .mainArea {
          width: calc(100% - 255px);
          margin-left: 255px;
          min-height: 100vh;
        }

        .topbar {
          height: 94px;
          background: white;
          border-bottom: 1px solid #e7e8eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 38px;
        }

        .breadcrumb {
          color: #9a9da3;
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .topbar h1 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.7px;
        }

        .topActions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .liveStatus {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border: 1px solid #e4e5e8;
          border-radius: 9px;
          color: #555960;
          background: white;
          font-size: 11px;
          font-weight: 700;
        }

        .liveDot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #21a366;
          display: inline-block;
        }

        .refreshButton {
          border: 0;
          background: #171717;
          color: white;
          border-radius: 9px;
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .refreshButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .content {
          padding: 30px 38px 50px;
          max-width: 1550px;
          margin: 0 auto;
        }

        .errorBox {
          background: #fff1f1;
          border: 1px solid #f0c9c9;
          color: #9b2929;
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 20px;
          font-size: 12px;
        }

        .errorBox strong,
        .errorBox span {
          display: block;
        }

        .errorBox span {
          margin-top: 4px;
        }

        .welcomeCard {
          background: #171717;
          color: white;
          border-radius: 18px;
          padding: 30px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          overflow: hidden;
          position: relative;
        }

        .welcomeCard:after {
          content: "";
          position: absolute;
          width: 280px;
          height: 280px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 50%;
          right: 80px;
          top: -170px;
        }

        .eyebrow {
          color: #8d9299;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.8px;
        }

        .welcomeCard h2 {
          margin: 9px 0 6px;
          font-size: 28px;
          letter-spacing: -1px;
        }

        .welcomeCard p {
          margin: 0;
          color: #a4a8ad;
          font-size: 12px;
        }

        .welcomeBadge {
          min-width: 160px;
          border: 1px solid #303237;
          background: #202124;
          border-radius: 13px;
          padding: 14px 16px;
          position: relative;
          z-index: 1;
        }

        .welcomeBadge span {
          display: inline-block;
          color: #62c98a;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.5px;
          margin-bottom: 7px;
        }

        .welcomeBadge strong {
          display: block;
          font-size: 15px;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .statCard {
          background: white;
          border: 1px solid #e6e7e9;
          border-radius: 15px;
          padding: 20px;
        }

        .statTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .statIcon {
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: #f0f1f3;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 900;
        }

        .statLabel {
          color: #7d8086;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .statValue {
          margin-top: 15px;
          font-size: 25px;
          font-weight: 800;
          letter-spacing: -0.7px;
        }

        .statNote {
          margin-top: 4px;
          color: #999ca2;
          font-size: 10px;
        }

        .dashboardGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr);
          gap: 20px;
          margin-bottom: 22px;
        }

        .panel {
          background: white;
          border: 1px solid #e6e7e9;
          border-radius: 16px;
          overflow: hidden;
        }

        .largePanel {
          min-width: 0;
        }

        .fullPanel {
          min-height: 500px;
        }

        .panelHeader {
          padding: 21px 22px;
          border-bottom: 1px solid #ececef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .panelHeader h3 {
          margin: 0;
          font-size: 15px;
          letter-spacing: -0.2px;
        }

        .panelHeader p {
          margin: 5px 0 0;
          color: #92959a;
          font-size: 10px;
        }

        .textButton {
          border: 0;
          background: transparent;
          color: #171717;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .leaderboard {
          padding: 6px 20px 10px;
        }

        .leaderRow {
          min-height: 65px;
          display: grid;
          grid-template-columns: 34px 38px minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid #f0f0f1;
        }

        .leaderRow:last-child {
          border-bottom: 0;
        }

        .rank {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: #f0f1f3;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 900;
        }

        .rank.first {
          background: #171717;
          color: white;
        }

        .restaurantAvatar {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: #eceef1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 900;
        }

        .restaurantInfo {
          min-width: 0;
        }

        .restaurantInfo strong,
        .restaurantInfo span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .restaurantInfo strong {
          font-size: 11px;
        }

        .restaurantInfo span {
          color: #92959a;
          font-size: 9px;
          margin-top: 4px;
        }

        .bidAmount {
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .statusPill {
          color: #258150;
          background: #e9f7ef;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 900;
          white-space: nowrap;
        }

        .snapshotList {
          padding: 6px 22px;
        }

        .snapshotRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 0;
          border-bottom: 1px solid #f0f0f1;
        }

        .snapshotRow:last-child {
          border-bottom: 0;
        }

        .snapshotRow span {
          color: #777b81;
          font-size: 10px;
        }

        .snapshotRow strong {
          font-size: 12px;
        }

        .marketMessage {
          margin: 10px 22px 22px;
          padding: 14px;
          background: #f5f6f7;
          border-radius: 11px;
          display: flex;
          gap: 10px;
        }

        .messageIcon {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          background: #171717;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
        }

        .marketMessage strong {
          font-size: 10px;
        }

        .marketMessage p {
          margin: 4px 0 0;
          color: #888c91;
          font-size: 9px;
          line-height: 1.5;
        }

        .quickSection {
          margin-top: 4px;
        }

        .sectionTitle {
          margin-bottom: 12px;
        }

        .sectionTitle h3 {
          margin: 0;
          font-size: 15px;
        }

        .sectionTitle p {
          margin: 5px 0 0;
          color: #92959a;
          font-size: 10px;
        }

        .quickGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }

        .quickAction {
          border: 1px solid #e6e7e9;
          background: white;
          border-radius: 14px;
          padding: 18px;
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .quickAction:hover {
          transform: translateY(-2px);
          border-color: #cfd1d5;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.05);
        }

        .quickIcon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: #171717;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 13px;
          margin-bottom: 13px;
        }

        .quickAction strong {
          display: block;
          font-size: 11px;
        }

        .quickAction span {
          display: block;
          margin-top: 5px;
          color: #92959a;
          font-size: 9px;
        }

        .searchInput {
          width: 220px;
          border: 1px solid #dedfe2;
          border-radius: 9px;
          padding: 9px 11px;
          outline: none;
          font-size: 10px;
        }

        .searchInput:focus {
          border-color: #777;
        }

        .restaurantTable {
          width: 100%;
          border-collapse: collapse;
        }

        .restaurantTable th {
          background: #fafafa;
          color: #888b91;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          text-align: left;
          padding: 13px 20px;
          border-bottom: 1px solid #e9eaec;
        }

        .restaurantTable td {
          padding: 15px 20px;
          border-bottom: 1px solid #f0f0f1;
          font-size: 10px;
        }

        .restaurantTable tr:last-child td {
          border-bottom: 0;
        }

        .tableRestaurant {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .tableAvatar {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          background: #eceef1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 10px;
        }

        .tableRestaurant strong {
          display: block;
          font-size: 10px;
        }

        .tableRestaurant span {
          display: block;
          color: #92959a;
          font-size: 8px;
          margin-top: 3px;
        }

        .tableBid {
          font-weight: 900;
        }

        .claimYes {
          color: #266c9c;
          background: #e9f4fb;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 800;
        }

        .claimNo {
          color: #777b80;
          background: #f0f1f3;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 8px;
          font-weight: 800;
        }

        .emptyState {
          padding: 45px 20px;
          text-align: center;
          color: #999;
          font-size: 11px;
        }

        .emptyFeature {
          background: white;
          border: 1px solid #e6e7e9;
          border-radius: 18px;
          padding: 60px 30px;
          text-align: center;
          max-width: 700px;
          margin: 30px auto;
        }

        .featureIcon {
          width: 58px;
          height: 58px;
          margin: 0 auto 18px;
          border-radius: 16px;
          background: #171717;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 900;
        }

        .emptyFeature h2 {
          margin: 0;
          font-size: 22px;
        }

        .emptyFeature > p {
          max-width: 470px;
          margin: 10px auto 25px;
          color: #888c91;
          font-size: 12px;
          line-height: 1.6;
        }

        .featureStats {
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .featureStats div {
          min-width: 160px;
          padding: 16px;
          background: #f5f6f7;
          border-radius: 12px;
        }

        .featureStats span,
        .featureStats strong {
          display: block;
        }

        .featureStats span {
          color: #888c91;
          font-size: 9px;
        }

        .featureStats strong {
          margin-top: 5px;
          font-size: 15px;
        }

        .paymentNotice {
          display: inline-block;
          background: #fff5dd;
          color: #8a6518;
          border: 1px solid #f0dfb4;
          padding: 9px 13px;
          border-radius: 9px;
          font-size: 10px;
          font-weight: 700;
        }

        .footer {
          padding: 20px 38px 28px;
          display: flex;
          justify-content: space-between;
          color: #a0a3a8;
          font-size: 9px;
        }

        @media (max-width: 1050px) {
          .sidebar {
            width: 210px;
          }

          .mainArea {
            width: calc(100% - 210px);
            margin-left: 210px;
          }

          .statsGrid,
          .quickGrid {
            grid-template-columns: repeat(2, 1fr);
          }

          .dashboardGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .sidebar {
            position: static;
            width: 100%;
            min-height: auto;
          }

          .adminShell {
            display: block;
          }

          .mainArea {
            width: 100%;
            margin-left: 0;
          }

          .navigation {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }

          .sidebarBottom {
            margin-top: 20px;
          }

          .topbar {
            height: auto;
            padding: 20px;
            gap: 15px;
            align-items: flex-start;
          }

          .topActions {
            flex-direction: column;
            align-items: flex-end;
          }

          .content {
            padding: 20px;
          }

          .welcomeCard {
            align-items: flex-start;
            flex-direction: column;
            gap: 20px;
          }

          .statsGrid,
          .quickGrid {
            grid-template-columns: 1fr;
          }

          .leaderRow {
            grid-template-columns: 30px 34px minmax(0, 1fr) auto;
          }

          .statusPill {
            display: none;
          }

          .searchInput {
            width: 100%;
          }

          .panelHeader {
            align-items: flex-start;
            flex-direction: column;
          }

          .restaurantTable {
            min-width: 700px;
          }

          .footer {
            padding: 20px;
            flex-direction: column;
            gap: 5px;
          }
        }
      `}</style>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string;
  icon: string;
  note: string;
}) {
  return (
    <div className="statCard">
      <div className="statTop">
        <span className="statLabel">{label}</span>
        <span className="statIcon">{icon}</span>
      </div>

      <div className="statValue">{value}</div>

      <div className="statNote">{note}</div>
    </div>
  );
}

function SnapshotRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="snapshotRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button className="quickAction" onClick={onClick}>
      <div className="quickIcon">{icon}</div>
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="emptyState">
      No restaurants available.
    </div>
  );
}

function RestaurantTable({
  restaurants,
  showRank = false,
}: {
  restaurants: Restaurant[];
  showRank?: boolean;
}) {
  if (restaurants.length === 0) {
    return <EmptyState />;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="restaurantTable">
        <thead>
          <tr>
            {showRank && <th>Rank</th>}
            <th>Restaurant</th>
            <th>City</th>
            <th>Category</th>
            <th>Current Bid</th>
            <th>Status</th>
            <th>Claim</th>
          </tr>
        </thead>

        <tbody>
          {restaurants.map((restaurant, index) => (
            <tr key={restaurant.id}>

              {showRank && (
                <td>
                  <strong>#{index + 1}</strong>
                </td>
              )}

              <td>
                <div className="tableRestaurant">
                  <div className="tableAvatar">
                    {restaurant.name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>{restaurant.name}</strong>

                    <span>
                      {restaurant.address || "Address not added"}
                    </span>
                  </div>
                </div>
              </td>

              <td>{restaurant.city}</td>

              <td>{restaurant.category}</td>

              <td className="tableBid">
                ₹
                {Number(
                  restaurant.current_bid || 0
                ).toLocaleString("en-IN")}
              </td>

              <td>
                {restaurant.is_active !== false ? (
                  <span className="statusPill">
                    Active
                  </span>
                ) : (
                  <span className="claimNo">
                    Inactive
                  </span>
                )}
              </td>

              <td>
                {restaurant.is_claimed ? (
                  <span className="claimYes">
                    Claimed
                  </span>
                ) : (
                  <span className="claimNo">
                    Unclaimed
                  </span>
                )}
              </td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
