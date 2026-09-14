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

type Bid = {
  id: number;
  restaurant_id: number;
  amount: number | string;
  status: string;
  payment_status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
};

type NavItem = { id: string; label: string; icon: string };

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
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [search, setSearch] = useState("");
  const [activeNav, setActiveNav] = useState("overview");

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        router.replace("/admin/login");
        return;
      }

      setAdminEmail(user.email || "");

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError) {
        setError("Unable to verify admin access.");
        return;
      }

      if (!adminUser) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      const [restaurantResult, bidResult] = await Promise.all([
        supabase
          .from("restaurants")
          .select("id, name, city, category, address, current_bid, is_claimed, is_active, created_at")
          .order("current_bid", { ascending: false }),
        supabase
          .from("bids")
          .select("id, restaurant_id, amount, status, payment_status, razorpay_order_id, razorpay_payment_id, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (restaurantResult.error) {
        setError(restaurantResult.error.message || "Unable to load restaurant data.");
        return;
      }
      if (bidResult.error) {
        setError(bidResult.error.message || "Unable to load bid data. Check the admin bids policy.");
        return;
      }

      setRestaurants((restaurantResult.data || []) as Restaurant[]);
      setBids((bidResult.data || []) as Bid[]);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while loading the dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const restaurantMap = useMemo(() => {
    const map = new Map<number, Restaurant>();
    restaurants.forEach((r) => map.set(r.id, r));
    return map;
  }, [restaurants]);

  const stats = useMemo(() => {
    const total = restaurants.length;
    const active = restaurants.filter((r) => r.is_active !== false).length;
    const claimed = restaurants.filter((r) => r.is_claimed === true).length;
    const totalBidValue = restaurants.reduce((sum, r) => sum + Number(r.current_bid || 0), 0);
    const highestBid = total ? Math.max(...restaurants.map((r) => Number(r.current_bid || 0))) : 0;
    const cities = new Set(restaurants.map((r) => r.city)).size;
    const captured = bids.filter((b) => b.payment_status === "captured");
    const pending = bids.filter((b) => b.payment_status !== "captured");
    const capturedAmount = captured.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    return { total, active, claimed, totalBidValue, highestBid, cities, totalBids: bids.length, capturedPayments: captured.length, pendingPayments: pending.length, capturedAmount };
  }, [restaurants, bids]);

  const filteredRestaurants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) => [r.name, r.city, r.category, r.address || ""].some((v) => v.toLowerCase().includes(q)));
  }, [restaurants, search]);

  const filteredBids = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bids;
    return bids.filter((b) => {
      const r = restaurantMap.get(b.restaurant_id);
      return [String(b.id), r?.name || "", r?.city || "", String(b.amount), b.status, b.payment_status, b.razorpay_order_id || "", b.razorpay_payment_id || ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [bids, restaurantMap, search]);

    const topRestaurants = restaurants.slice(0, 5);

  if (loading) {
    return <div className="loadingScreen"><div className="loadingLogo">D</div><div><strong>DineUp Admin</strong><span>Loading dashboard...</span></div><style jsx global>{loadingCss}</style></div>;
  }

  return (
    <>
      <div className="adminShell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brandMark">D</div>
            <div><div className="brandName">DineUp</div><div className="brandSub">ADMIN PANEL</div></div>
          </div>
          <div className="sideSectionTitle">MANAGEMENT</div>
          <nav className="navigation">
            {navItems.map((item) => (
              <button key={item.id} className={activeNav === item.id ? "navItem active" : "navItem"} onClick={() => { setActiveNav(item.id); setSearch(""); }}>
                <span className="navIcon">{item.icon}</span><span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebarBottom">
            <div className="adminMini"><div className="adminAvatar">A</div><div className="adminMiniText"><strong>Administrator</strong><span>{adminEmail}</span></div></div>
            <button className="logoutButton" onClick={handleLogout}>↪ &nbsp; Logout</button>
          </div>
        </aside>

        <div className="mainArea">
          <header className="topbar">
            <div><div className="breadcrumb">DineUp / Admin</div><h1>{activeNav === "overview" ? "Dashboard" : navItems.find((i) => i.id === activeNav)?.label}</h1></div>
            <div className="topActions"><div className="liveStatus"><span className="liveDot"/>System Live</div><button className="refreshButton" onClick={() => loadDashboard(true)} disabled={refreshing}>{refreshing ? "Refreshing..." : "↻ Refresh"}</button></div>
          </header>

          <main className="content">
            {error && <div className="errorBox"><strong>Dashboard Error</strong><span>{error}</span></div>}

            {activeNav === "overview" && <>
              <section className="welcomeCard"><div><span className="eyebrow">DINEUP CONTROL CENTER</span><h2>Where Restaurants Rise.</h2><p>Monitor restaurants, bids and marketplace activity from one place.</p></div><div className="welcomeBadge"><span>LIVE</span><strong>{stats.total} Restaurants</strong></div></section>
              <section className="statsGrid">
                <StatCard label="Total Restaurants" value={String(stats.total)} icon="◉" note="Listed on DineUp"/>
                <StatCard label="Active Restaurants" value={String(stats.active)} icon="✓" note="Currently active"/>
                <StatCard label="Current Bid Value" value={`₹${stats.totalBidValue.toLocaleString("en-IN")}`} icon="₹" note="Across current leaderboard"/>
                <StatCard label="Highest Bid" value={`₹${stats.highestBid.toLocaleString("en-IN")}`} icon="♛" note="Current market leader"/>
              </section>
              <section className="dashboardGrid">
                <div className="panel"><div className="panelHeader"><div><h3>Live Leaderboard</h3><p>Restaurants ranked by current bid</p></div><button className="textButton" onClick={() => setActiveNav("leaderboard")}>View all →</button></div><div className="leaderboard">{topRestaurants.length ? topRestaurants.map((r, i) => <div className="leaderRow" key={r.id}><div className={i === 0 ? "rank first" : "rank"}>{i + 1}</div><div className="restaurantAvatar">{r.name.charAt(0).toUpperCase()}</div><div className="restaurantInfo"><strong>{r.name}</strong><span>{r.category} • {r.city}</span></div><div className="bidAmount">₹{Number(r.current_bid || 0).toLocaleString("en-IN")}</div><div className="statusPill">{r.is_active !== false ? "Active" : "Inactive"}</div></div>) : <EmptyState/>}</div></div>
                <div className="panel"><div className="panelHeader"><div><h3>Market Snapshot</h3><p>Current marketplace overview</p></div></div><div className="snapshotList"><SnapshotRow label="Cities" value={String(stats.cities)}/><SnapshotRow label="Claimed Restaurants" value={String(stats.claimed)}/><SnapshotRow label="Unclaimed Restaurants" value={String(stats.total - stats.claimed)}/><SnapshotRow label="Total Bids" value={String(stats.totalBids)}/><SnapshotRow label="Captured Payments" value={String(stats.capturedPayments)}/><SnapshotRow label="Paid Amount" value={`₹${stats.capturedAmount.toLocaleString("en-IN")}`}/></div><div className="marketMessage"><span className="messageIcon">↗</span><div><strong>Marketplace is active</strong><p>Restaurants can compete for higher visibility.</p></div></div></div>
              </section>
              <section className="quickSection"><div className="sectionTitle"><h3>Quick Management</h3><p>Jump directly to important admin sections.</p></div><div className="quickGrid"><QuickAction icon="◉" title="Restaurants" description="Manage restaurant listings" onClick={() => setActiveNav("restaurants")}/><QuickAction icon="♛" title="Leaderboard" description="Monitor ranking positions" onClick={() => setActiveNav("leaderboard")}/><QuickAction icon="↗" title="Bids" description={`${stats.totalBids} bids recorded`} onClick={() => setActiveNav("bids")}/><QuickAction icon="₹" title="Payments" description={`${stats.capturedPayments} captured`} onClick={() => setActiveNav("payments")}/></div></section>
            </>}

            {activeNav === "restaurants" && <section className="panel fullPanel"><PanelHeader title="Restaurant Management" subtitle="All restaurants currently listed on DineUp." search={search} setSearch={setSearch} placeholder="Search restaurant..."/><RestaurantTable restaurants={filteredRestaurants}/></section>}

            {activeNav === "leaderboard" && <section className="panel fullPanel"><div className="panelHeader"><div><h3>Live Leaderboard</h3><p>Current restaurant ranking by bid.</p></div><div className="liveStatus"><span className="liveDot"/>Live</div></div><RestaurantTable restaurants={restaurants} showRank/></section>}

            {activeNav === "bids" && <section className="panel fullPanel"><PanelHeader title="Bid Management" subtitle="Complete bidding activity and history." search={search} setSearch={setSearch} placeholder="Search bids..."/><div className="miniStats"><MiniStat label="Total Bids" value={stats.totalBids}/><MiniStat label="Captured" value={stats.capturedPayments}/><MiniStat label="Pending" value={stats.pendingPayments}/><MiniStat label="Highest Bid" value={`₹${stats.highestBid.toLocaleString("en-IN")}`}/></div><BidTable bids={filteredBids} restaurantMap={restaurantMap}/></section>}

            {activeNav === "payments" && <section className="panel fullPanel"><PanelHeader title="Payment Management" subtitle="Razorpay payment activity and verification status." search={search} setSearch={setSearch} placeholder="Search payments..."/><div className="paymentSummary"><MiniStat label="Captured Payments" value={stats.capturedPayments}/><MiniStat label="Captured Amount" value={`₹${stats.capturedAmount.toLocaleString("en-IN")}`}/><MiniStat label="Pending" value={stats.pendingPayments}/><MiniStat label="Mode" value="TEST"/></div><PaymentTable bids={filteredBids} restaurantMap={restaurantMap}/></section>}
          </main>
          <footer className="footer"><span>DineUp Admin • Where Restaurants Rise</span><span>Production Dashboard</span></footer>
        </div>
      </div>
      <style jsx global>{styles}</style>
    </>
  );
}

function PanelHeader({ title, subtitle, search, setSearch, placeholder }: { title: string; subtitle: string; search: string; setSearch: (v: string) => void; placeholder: string }) {
  return <div className="panelHeader"><div><h3>{title}</h3><p>{subtitle}</p></div><input className="searchInput" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder}/></div>;
}

function StatCard({ label, value, icon, note }: { label: string; value: string; icon: string; note: string }) {
  return <div className="statCard"><div className="statTop"><span className="statLabel">{label}</span><span className="statIcon">{icon}</span></div><div className="statValue">{value}</div><div className="statNote">{note}</div></div>;
}

function SnapshotRow({ label, value }: { label: string; value: string }) { return <div className="snapshotRow"><span>{label}</span><strong>{value}</strong></div>; }
function QuickAction({ icon, title, description, onClick }: { icon: string; title: string; description: string; onClick: () => void }) { return <button className="quickAction" onClick={onClick}><div className="quickIcon">{icon}</div><strong>{title}</strong><span>{description}</span></button>; }
function MiniStat({ label, value }: { label: string; value: string | number }) { return <div className="miniStat"><span>{label}</span><strong>{value}</strong></div>; }
function EmptyState() { return <div className="emptyState">No records available.</div>; }

function StatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls = v === "captured" || v === "active" ? "successBadge" : v === "pending" ? "warningBadge" : v.includes("outbid") || v.includes("failed") ? "dangerBadge" : "neutralBadge";
  return <span className={cls}>{value}</span>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function BidTable({ bids, restaurantMap }: { bids: Bid[]; restaurantMap: Map<number, Restaurant> }) {
  if (!bids.length) return <EmptyState/>;
  return <div className="tableScroll"><table className="dataTable"><thead><tr><th>Bid ID</th><th>Restaurant</th><th>Amount</th><th>Bid Status</th><th>Payment</th><th>Razorpay Order</th><th>Date</th></tr></thead><tbody>{bids.map((b) => { const r = restaurantMap.get(b.restaurant_id); return <tr key={b.id}><td className="mutedCell">#{b.id}</td><td><TableRestaurant restaurant={r}/></td><td className="tableBid">₹{Number(b.amount).toLocaleString("en-IN")}</td><td><StatusBadge value={b.status}/></td><td><StatusBadge value={b.payment_status}/></td><td className="monoCell">{b.razorpay_order_id || "—"}</td><td className="dateCell">{formatDate(b.created_at)}</td></tr>; })}</tbody></table></div>;
}

function PaymentTable({ bids, restaurantMap }: { bids: Bid[]; restaurantMap: Map<number, Restaurant> }) {
  if (!bids.length) return <EmptyState/>;
  return <div className="tableScroll"><table className="dataTable"><thead><tr><th>Bid ID</th><th>Restaurant</th><th>Amount</th><th>Payment Status</th><th>Order ID</th><th>Payment ID</th><th>Date</th></tr></thead><tbody>{bids.map((b) => { const r = restaurantMap.get(b.restaurant_id); return <tr key={b.id}><td className="mutedCell">#{b.id}</td><td><TableRestaurant restaurant={r}/></td><td className="tableBid">₹{Number(b.amount).toLocaleString("en-IN")}</td><td><StatusBadge value={b.payment_status}/></td><td className="monoCell">{b.razorpay_order_id || "—"}</td><td className="monoCell">{b.razorpay_payment_id || "—"}</td><td className="dateCell">{formatDate(b.created_at)}</td></tr>; })}</tbody></table></div>;
}

function TableRestaurant({ restaurant }: { restaurant?: Restaurant }) {
  const name = restaurant?.name || "Unknown restaurant";
  return <div className="tableRestaurant"><div className="tableAvatar">{name.charAt(0).toUpperCase()}</div><div><strong>{name}</strong><span>{restaurant?.city || "—"}</span></div></div>;
}

function RestaurantTable({ restaurants, showRank = false }: { restaurants: Restaurant[]; showRank?: boolean }) {
  if (!restaurants.length) return <EmptyState/>;
  return <div className="tableScroll"><table className="dataTable"><thead><tr>{showRank && <th>Rank</th>}<th>Restaurant</th><th>City</th><th>Category</th><th>Current Bid</th><th>Status</th><th>Claim</th></tr></thead><tbody>{restaurants.map((r, i) => <tr key={r.id}>{showRank && <td><strong>#{i + 1}</strong></td>}<td><TableRestaurant restaurant={r}/></td><td>{r.city}</td><td>{r.category}</td><td className="tableBid">₹{Number(r.current_bid || 0).toLocaleString("en-IN")}</td><td>{r.is_active !== false ? <span className="successBadge">Active</span> : <span className="neutralBadge">Inactive</span>}</td><td>{r.is_claimed ? <span className="infoBadge">Claimed</span> : <span className="neutralBadge">Unclaimed</span>}</td></tr>)}</tbody></table></div>;
}

const loadingCss = `
.loadingScreen{min-height:100vh;display:flex;align-items:center;justify-content:center;gap:14px;background:#f6f7f9;color:#171717;font-family:Arial,Helvetica,sans-serif}.loadingLogo{width:44px;height:44px;border-radius:12px;background:#171717;color:white;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800}.loadingScreen strong,.loadingScreen span{display:block}.loadingScreen span{margin-top:4px;color:#777;font-size:13px}`;

const styles = `
*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#f5f6f8;color:#171717;font-family:Arial,Helvetica,sans-serif}button,input{font-family:Arial,Helvetica,sans-serif}.adminShell{min-height:100vh;display:flex;background:#f5f6f8}.sidebar{width:255px;min-height:100vh;background:#111214;color:white;display:flex;flex-direction:column;padding:24px 16px;position:fixed;left:0;top:0;bottom:0;z-index:20}.brand{display:flex;align-items:center;gap:12px;padding:4px 10px 30px}.brandMark{width:40px;height:40px;background:white;color:#111214;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:900}.brandName{color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px}.brandSub{margin-top:2px;color:#777b82;font-size:9px;font-weight:700;letter-spacing:1.6px}.sideSectionTitle{color:#666a71;font-size:9px;font-weight:800;letter-spacing:1.5px;padding:0 12px 10px}.navigation{display:flex;flex-direction:column;gap:4px}.navItem{width:100%;border:0;background:transparent;color:#9da1a8;border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px;text-align:left;font-size:13px;font-weight:600;cursor:pointer;transition:.2s}.navItem:hover{background:#1b1d20;color:white}.navItem.active{background:white;color:#111214}.navIcon{width:22px;text-align:center;font-size:16px}.sidebarBottom{margin-top:auto;border-top:1px solid #292b2f;padding-top:18px}.adminMini{display:flex;align-items:center;gap:10px;padding:8px}.adminAvatar{width:34px;height:34px;border-radius:50%;background:#2a2d32;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}.adminMiniText{min-width:0}.adminMiniText strong,.adminMiniText span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.adminMiniText strong{font-size:11px}.adminMiniText span{margin-top:3px;color:#777b82;font-size:9px}.logoutButton{width:100%;border:1px solid #2b2d31;background:transparent;color:#aaaeb4;border-radius:9px;padding:10px;margin-top:12px;cursor:pointer;font-size:12px;font-weight:700}.logoutButton:hover{background:#1b1d20;color:white}.mainArea{width:calc(100% - 255px);margin-left:255px;min-height:100vh}.topbar{height:94px;background:white;border-bottom:1px solid #e7e8eb;display:flex;align-items:center;justify-content:space-between;padding:0 38px}.breadcrumb{color:#9a9da3;font-size:10px;font-weight:700;margin-bottom:6px}.topbar h1{margin:0;font-size:25px;letter-spacing:-.7px}.topActions{display:flex;align-items:center;gap:12px}.liveStatus{display:inline-flex;align-items:center;gap:7px;padding:8px 11px;border:1px solid #e4e5e8;border-radius:9px;color:#555960;background:white;font-size:11px;font-weight:700;white-space:nowrap}.liveDot{width:7px;height:7px;border-radius:50%;background:#21a366;display:inline-block}.refreshButton{border:0;background:#171717;color:white;border-radius:9px;padding:10px 14px;font-size:11px;font-weight:800;cursor:pointer}.refreshButton:disabled{opacity:.55;cursor:not-allowed}.content{padding:30px 38px 50px;max-width:1550px;margin:0 auto}.errorBox{background:#fff1f1;border:1px solid #f0c9c9;color:#9b2929;border-radius:12px;padding:14px 16px;margin-bottom:20px;font-size:12px}.errorBox strong,.errorBox span{display:block}.errorBox span{margin-top:4px}.welcomeCard{background:#171717;color:white;border-radius:18px;padding:30px 32px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;overflow:hidden;position:relative}.welcomeCard:after{content:"";position:absolute;width:280px;height:280px;border:1px solid rgba(255,255,255,.08);border-radius:50%;right:80px;top:-170px}.eyebrow{color:#8d9299;font-size:9px;font-weight:800;letter-spacing:1.8px}.welcomeCard h2{margin:9px 0 6px;font-size:28px;letter-spacing:-1px}.welcomeCard p{margin:0;color:#a4a8ad;font-size:12px}.welcomeBadge{min-width:160px;border:1px solid #303237;background:#202124;border-radius:13px;padding:14px 16px;position:relative;z-index:1}.welcomeBadge span{display:inline-block;color:#62c98a;font-size:8px;font-weight:900;letter-spacing:1.5px;margin-bottom:7px}.welcomeBadge strong{display:block;font-size:15px}.statsGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}.statCard{background:white;border:1px solid #e6e7e9;border-radius:15px;padding:20px}.statTop{display:flex;justify-content:space-between;align-items:center}.statIcon{width:32px;height:32px;border-radius:9px;background:#f0f1f3;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900}.statLabel{color:#7d8086;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px}.statValue{margin-top:15px;font-size:25px;font-weight:800;letter-spacing:-.7px}.statNote{margin-top:4px;color:#999ca2;font-size:10px}.dashboardGrid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,1fr);gap:20px;margin-bottom:22px}.panel{background:white;border:1px solid #e6e7e9;border-radius:16px;overflow:hidden}.fullPanel{min-height:500px}.panelHeader{padding:21px 22px;border-bottom:1px solid #ececef;display:flex;align-items:center;justify-content:space-between;gap:15px}.panelHeader h3{margin:0;font-size:15px;letter-spacing:-.2px}.panelHeader p{margin:5px 0 0;color:#92959a;font-size:10px}.textButton{border:0;background:transparent;color:#171717;font-size:10px;font-weight:800;cursor:pointer}.leaderboard{padding:6px 20px 10px}.leaderRow{min-height:65px;display:grid;grid-template-columns:34px 38px minmax(0,1fr) auto auto;align-items:center;gap:12px;border-bottom:1px solid #f0f0f1}.leaderRow:last-child{border-bottom:0}.rank{width:26px;height:26px;border-radius:8px;background:#f0f1f3;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900}.rank.first{background:#171717;color:white}.restaurantAvatar{width:34px;height:34px;border-radius:10px;background:#eceef1;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900}.restaurantInfo{min-width:0}.restaurantInfo strong,.restaurantInfo span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.restaurantInfo strong{font-size:11px}.restaurantInfo span{color:#92959a;font-size:9px;margin-top:4px}.bidAmount{font-size:11px;font-weight:900;white-space:nowrap}.statusPill{color:#258150;background:#e9f7ef;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;white-space:nowrap}.snapshotList{padding:6px 22px}.snapshotRow{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #f0f0f1}.snapshotRow:last-child{border-bottom:0}.snapshotRow span{color:#777b81;font-size:10px}.snapshotRow strong{font-size:12px}.marketMessage{margin:10px 22px 22px;padding:14px;background:#f5f6f7;border-radius:11px;display:flex;gap:10px}.messageIcon{width:26px;height:26px;border-radius:8px;background:#171717;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}.marketMessage strong{font-size:10px}.marketMessage p{margin:4px 0 0;color:#888c91;font-size:9px;line-height:1.5}.quickSection{margin-top:4px}.sectionTitle{margin-bottom:12px}.sectionTitle h3{margin:0;font-size:15px}.sectionTitle p{margin:5px 0 0;color:#92959a;font-size:10px}.quickGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.quickAction{border:1px solid #e6e7e9;background:white;border-radius:14px;padding:18px;text-align:left;cursor:pointer;transition:.2s}.quickAction:hover{transform:translateY(-2px);border-color:#cfd1d5;box-shadow:0 8px 25px rgba(0,0,0,.05)}.quickIcon{width:34px;height:34px;border-radius:10px;background:#171717;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;margin-bottom:13px}.quickAction strong{display:block;font-size:11px}.quickAction span{display:block;margin-top:5px;color:#92959a;font-size:9px}.searchInput{width:230px;border:1px solid #dedfe2;border-radius:9px;padding:10px 11px;outline:none;font-size:11px;background:white;color:#171717}.searchInput:focus{border-color:#777}.miniStats,.paymentSummary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:18px 22px;border-bottom:1px solid #ececef;background:#fafafa}.miniStat{background:white;border:1px solid #e8e9eb;border-radius:11px;padding:13px 14px}.miniStat span{display:block;color:#85898f;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}.miniStat strong{display:block;margin-top:6px;font-size:16px}.tableScroll{width:100%;overflow-x:auto}.dataTable{width:100%;min-width:900px;border-collapse:collapse}.dataTable th{background:#fafafa;color:#888b91;font-size:8px;text-transform:uppercase;letter-spacing:.8px;text-align:left;padding:13px 20px;border-bottom:1px solid #e9eaec;white-space:nowrap}.dataTable td{padding:14px 20px;border-bottom:1px solid #f0f0f1;font-size:10px;vertical-align:middle}.dataTable tr:last-child td{border-bottom:0}.tableRestaurant{display:flex;align-items:center;gap:10px;min-width:180px}.tableAvatar{width:30px;height:30px;border-radius:8px;background:#eceef1;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px;flex-shrink:0}.tableRestaurant strong{display:block;font-size:10px;white-space:nowrap}.tableRestaurant span{display:block;color:#92959a;font-size:8px;margin-top:3px;white-space:nowrap}.tableBid{font-weight:900;white-space:nowrap}.mutedCell{color:#777b80;font-weight:700}.dateCell{color:#676b71;white-space:nowrap}.monoCell{color:#5e6268;font-family:"Courier New",monospace;font-size:8px!important;white-space:nowrap}.successBadge,.warningBadge,.dangerBadge,.neutralBadge,.infoBadge{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:800;white-space:nowrap}.successBadge{color:#258150;background:#e9f7ef}.warningBadge{color:#8a6518;background:#fff5dd}.dangerBadge{color:#a43b3b;background:#fff0f0}.neutralBadge{color:#777b80;background:#f0f1f3}.infoBadge{color:#266c9c;background:#e9f4fb}.emptyState{padding:55px 20px;text-align:center;color:#999;font-size:11px}.footer{padding:20px 38px 28px;display:flex;justify-content:space-between;color:#a0a3a8;font-size:9px}
@media(max-width:1050px){.sidebar{width:210px}.mainArea{width:calc(100% - 210px);margin-left:210px}.statsGrid,.quickGrid,.miniStats,.paymentSummary{grid-template-columns:repeat(2,1fr)}.dashboardGrid{grid-template-columns:1fr}}
@media(max-width:760px){.sidebar{position:static;width:100%;min-height:auto}.adminShell{display:block}.mainArea{width:100%;margin-left:0}.navigation{display:grid;grid-template-columns:repeat(2,1fr)}.sidebarBottom{margin-top:20px}.topbar{height:auto;padding:20px;gap:15px;align-items:flex-start}.topActions{flex-direction:column;align-items:flex-end}.content{padding:20px}.welcomeCard{align-items:flex-start;flex-direction:column;gap:20px}.statsGrid,.quickGrid,.miniStats,.paymentSummary{grid-template-columns:1fr}.leaderRow{grid-template-columns:30px 34px minmax(0,1fr) auto}.leaderRow .statusPill{display:none}.searchInput{width:100%}.panelHeader{align-items:flex-start;flex-direction:column}.footer{padding:20px;flex-direction:column;gap:5px}}
`;
