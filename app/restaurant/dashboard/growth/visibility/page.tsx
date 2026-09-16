"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../../../lib/supabase/client";

function money(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export default function GrowthVisibilityPage() {
  const supabase = createClient();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Please log in to view Visibility Center.");

        const { data: r, error: rError } = await supabase
          .from("restaurants")
          .select("id, name, city, category, current_bid, is_active")
          .eq("owner_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        if (rError) throw rError;
        if (!r) throw new Error("No active restaurant is linked to this account.");
        setRestaurant(r);

        const { data: bidRows, error: bError } = await supabase
          .from("bids")
          .select("id, amount, status, payment_status, created_at")
          .eq("restaurant_id", Number(r.id))
          .order("created_at", { ascending: false })
          .limit(20);
        if (bError) throw bError;
        setBids(bidRows || []);
      } catch (e: any) {
        setError(e?.message || "Unable to load Visibility Center.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  if (loading) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><div className="eyebrow">DINEUP VISIBILITY CENTER</div><h1>Loading...</h1><p className="muted">Preparing your marketplace campaign summary.</p></section></div></main>;
  if (error || !restaurant) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><div className="eyebrow">VISIBILITY CENTER</div><h1>Unable to load</h1><p className="muted">{error}</p><Link href="/restaurant/dashboard" className="primary">Back to dashboard →</Link></section></div></main>;

  const paid = bids.filter((b) => b.payment_status === "captured");
  const active = bids.filter((b) => String(b.status || "").toLowerCase() === "active");
  const spend = paid.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const highest = bids.reduce((max, b) => Math.max(max, Number(b.amount || 0)), 0);
  const averagePaid = paid.length ? spend / paid.length : 0;
  const currentBid = Number(restaurant.current_bid || 0);

  return <main className="page"><style jsx>{styles}</style>
    <header className="nav"><Link href="/" className="brand">Dine<span>Up</span></Link><div className="navRight"><Link href="/restaurant/dashboard" className="secondary">Dashboard</Link><Link href="/restaurant/dashboard/growth" className="secondary">Growth Center</Link></div></header>
    <div className="shell">
      <div className="heading"><div><div className="eyebrow">DINEUP VISIBILITY CENTER</div><h1>{restaurant.name}</h1><p className="muted">Track your marketplace bidding activity and keep your visibility campaign under control.</p></div><Link href="/restaurant/dashboard/growth" className="secondary">← Growth Center</Link></div>

      <section className="panel hero"><div><span className="eyebrow">CURRENT MARKETPLACE BID</span><strong>{money(currentBid)}</strong><p className="muted">Your latest live bid on DineUp.</p></div><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary">Increase visibility ↑</Link></section>

      <div className="stats">
        <div className="stat"><small>Bid attempts</small><strong>{bids.length}</strong><span>last 20 attempts</span></div>
        <div className="stat"><small>Paid bids</small><strong>{paid.length}</strong><span>captured payments</span></div>
        <div className="stat"><small>Campaign spend</small><strong>{money(spend)}</strong><span>captured bid payments</span></div>
        <div className="stat"><small>Highest bid</small><strong>{money(highest)}</strong><span>recorded amount</span></div>
      </div>

      <section className="panel"><div className="panelTitle"><div><b>Campaign health</b><p className="muted">A simple view of your recent marketplace activity.</p></div><span className="badge">LIVE DATA</span></div><div className="healthGrid"><div><small>Current status</small><strong>{active.length ? "Active" : "No active bid"}</strong><p>{active.length ? "A recent bid is marked active." : "Place a bid to start or restore marketplace visibility."}</p></div><div><small>Average paid bid</small><strong>{money(averagePaid)}</strong><p>{paid.length ? "Average across captured payments in the recent history." : "No captured payment history yet."}</p></div><div><small>City</small><strong>{restaurant.city || "—"}</strong><p>{restaurant.category || "Restaurant listing"}</p></div></div></section>

      <section className="panel"><div className="panelTitle"><div><b>Recent bid history</b><p className="muted">Latest marketplace bidding activity for this restaurant.</p></div><span>{bids.length} shown</span></div>{bids.length ? <div className="tableWrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Payment</th></tr></thead><tbody>{bids.map((b) => <tr key={b.id}><td>{new Date(b.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td><td><b>{money(Number(b.amount || 0))}</b></td><td><span className={String(b.status).toLowerCase() === "active" ? "status active" : "status"}>{b.status || "—"}</span></td><td>{b.payment_status || "—"}</td></tr>)}</tbody></table></div> : <div className="empty"><b>No bidding activity yet.</b><p>Start a marketplace campaign when you are ready to increase visibility.</p></div>}</section>

      <section className="panel next"><div><div className="eyebrow">NEXT STEP</div><h2>Manage your marketplace campaign</h2><p className="muted">Review the current bid, choose your next bid amount, and continue building visibility in your city.</p></div><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary">Open bidding →</Link></section>
    </div>
  </main>;
}

const styles = `*{box-sizing:border-box}.page{min-height:100vh;background:#f6f7f9;color:#171717;font-family:Arial,sans-serif}.nav{height:72px;border-bottom:1px solid #e6e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 6vw;position:sticky;top:0;z-index:10}.brand{font-size:27px;font-weight:800;color:#111;text-decoration:none}.brand span{color:#ff5a1f}.navRight{display:flex;gap:10px}.shell{max-width:1180px;margin:0 auto;padding:42px 22px 70px}.heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:24px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#777}.heading h1{font-size:38px;margin:8px 0}.muted{color:#737780;line-height:1.5}.panel{background:#fff;border:1px solid #e6e7eb;border-radius:16px;padding:22px;box-shadow:0 5px 18px rgba(0,0,0,.04);margin-bottom:18px}.secondary,.primary{display:inline-block;border:1px solid #ddd;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:11px 15px;font-weight:700}.primary{background:#111;color:#fff;border-color:#111}.hero{display:flex;justify-content:space-between;align-items:center;gap:20px}.hero strong{display:block;font-size:46px;margin:8px 0}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.stat{background:#fff;border:1px solid #e6e7eb;border-radius:16px;padding:20px;box-shadow:0 5px 18px rgba(0,0,0,.04)}.stat small,.stat span{display:block;color:#777}.stat strong{display:block;font-size:28px;margin:8px 0}.stat span{font-size:12px}.panelTitle{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;margin-bottom:18px}.panelTitle b{font-size:18px}.panelTitle p{margin:5px 0 0}.badge{font-size:11px;font-weight:800;letter-spacing:.08em;padding:8px 10px;border-radius:999px;background:#f1f1f1}.healthGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.healthGrid>div{padding:17px;border:1px solid #eee;border-radius:12px}.healthGrid small{color:#777}.healthGrid strong{display:block;font-size:23px;margin:8px 0}.healthGrid p{margin:0;color:#777;line-height:1.45;font-size:13px}.tableWrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:14px 10px;border-bottom:1px solid #eee;font-size:14px}th{font-size:11px;letter-spacing:.08em;color:#777;text-transform:uppercase}.status{display:inline-block;padding:6px 9px;border-radius:999px;background:#f1f1f1;font-size:11px;font-weight:800}.status.active{background:#eef8f0;color:#18743a}.empty{padding:18px;border-radius:12px;background:#f7f7f7}.empty p{margin-bottom:0;color:#777}.next{display:flex;justify-content:space-between;align-items:center;gap:20px}.next h2{margin:7px 0}.next p{margin-bottom:0}@media(max-width:850px){.stats{grid-template-columns:1fr 1fr}.healthGrid{grid-template-columns:1fr}.heading,.hero,.next{align-items:flex-start;flex-direction:column}}@media(max-width:600px){.nav{padding:0 18px}.navRight .secondary:last-child{display:none}.shell{padding:28px 14px}.heading h1{font-size:30px}.panel{padding:17px}.stats{grid-template-columns:1fr}.hero strong{font-size:38px}}`;
