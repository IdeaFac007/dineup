"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

const EVENT_LABELS: Record<string, string> = {
  profile_view: "Profile views",
  call: "Calls",
  whatsapp: "WhatsApp",
  directions: "Directions",
  menu: "Menu views",
  website: "Website visits",
};

const EVENT_KEYS = ["profile_view", "call", "whatsapp", "directions", "menu", "website"];

export default function RestaurantAnalyticsPage() {
  const supabase = createClient();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [events, setEvents] = useState<Record<string, number>>({});
  const [bidStats, setBidStats] = useState({ total_attempts: 0, paid_bids: 0, active_bids: 0, total_spend: 0, highest_bid: 0, average_paid_bid: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(daysValue = days) {
    setLoading(true);
    setError("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please log in to view analytics.");

      const { data: r, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, city, category, current_bid")
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (restaurantError) throw restaurantError;
      if (!r) throw new Error("No active restaurant is linked to this account.");
      setRestaurant(r);

      const [{ data: eventData, error: eventError }, { data: bidData, error: bidError }] = await Promise.all([
        supabase.rpc("get_restaurant_analytics_period", { p_restaurant_id: Number(r.id), p_days: daysValue }),
        supabase.rpc("get_restaurant_bid_analytics", { p_restaurant_id: Number(r.id), p_days: daysValue }),
      ]);
      if (eventError) throw eventError;
      if (bidError) throw bidError;

      const nextEvents: Record<string, number> = {};
      EVENT_KEYS.forEach((key) => { nextEvents[key] = 0; });
      (eventData || []).forEach((item: any) => {
        if (EVENT_KEYS.includes(item.event_type)) nextEvents[item.event_type] = Number(item.event_count || 0);
      });
      setEvents(nextEvents);
      const row = (bidData || [])[0];
      if (row) setBidStats({
        total_attempts: Number(row.total_attempts || 0),
        paid_bids: Number(row.paid_bids || 0),
        active_bids: Number(row.active_bids || 0),
        total_spend: Number(row.total_spend || 0),
        highest_bid: Number(row.highest_bid || 0),
        average_paid_bid: Number(row.average_paid_bid || 0),
      });
    } catch (e: any) {
      setError(e?.message || "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(30); }, []);

  const profileViews = events.profile_view || 0;
  const actions = (events.call || 0) + (events.whatsapp || 0) + (events.directions || 0) + (events.menu || 0) + (events.website || 0);
  const conversion = profileViews > 0 ? (actions / profileViews) * 100 : 0;
  const maxEvent = Math.max(1, ...EVENT_KEYS.map((key) => events[key] || 0));
  const topActionKey = EVENT_KEYS.filter((key) => key !== "profile_view").sort((a, b) => (events[b] || 0) - (events[a] || 0))[0];

  const money = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

  return (
    <main className="page">
      <style jsx>{styles}</style>
      <header className="nav">
        <Link href="/" className="brand">Dine<span>Up</span></Link>
        <div className="navRight">
          <Link href="/marketplace" className="text">Marketplace</Link>
          <Link href="/restaurant/dashboard" className="secondary">Dashboard</Link>
        </div>
      </header>

      <div className="shell">
        <div className="heading">
          <div>
            <div className="eyebrow">RESTAURANT ANALYTICS</div>
            <h1>{restaurant?.name || "Performance"}</h1>
            <p className="muted">Understand how customers discover and act on your DineUp profile.</p>
          </div>
          <div className="periods">
            {[7, 30, 90].map((value) => (
              <button key={value} className={days === value ? "period active" : "period"} onClick={() => { setDays(value as 7 | 30 | 90); load(value as 7 | 30 | 90); }}>
                {value} days
              </button>
            ))}
          </div>
        </div>

        {error && <section className="panel alert">{error}</section>}
        {loading ? <section className="panel"><h2>Loading analytics...</h2><p className="muted">Fetching live performance data.</p></section> : (
          <>
            <div className="stats">
              <div className="stat"><span>Profile views</span><strong>{profileViews}</strong><small>public profile visits</small></div>
              <div className="stat"><span>Customer actions</span><strong>{actions}</strong><small>calls & clicks</small></div>
              <div className="stat"><span>Action rate</span><strong>{conversion.toFixed(1)}%</strong><small>actions ÷ profile views</small></div>
              <div className="stat"><span>Paid bids</span><strong>{bidStats.paid_bids}</strong><small>successful payments</small></div>
              <div className="stat"><span>Campaign spend</span><strong>{money(bidStats.total_spend)}</strong><small>paid bids in period</small></div>
              <div className="stat"><span>Highest bid</span><strong>{money(bidStats.highest_bid)}</strong><small>highest attempt in period</small></div>
            </div>

            <div className="grid">
              <section className="panel">
                <div className="panelTitle"><div><b>Customer funnel</b><p className="muted">From profile discovery to customer action.</p></div><span className="live">LIVE DATA</span></div>
                <div className="funnel">
                  <div className="funnelRow"><span>Profile views</span><b>{profileViews}</b><div className="bar"><i style={{ width: "100%" }} /></div></div>
                  <div className="funnelRow"><span>Customer actions</span><b>{actions}</b><div className="bar"><i style={{ width: `${Math.min(100, conversion)}%` }} /></div></div>
                </div>
                <div className="insight"><b>{conversion > 0 ? `${conversion.toFixed(1)} customer actions were recorded per 100 profile views.` : "No customer actions recorded yet."}</b><p>{profileViews > 0 ? "Keep your menu, phone, WhatsApp and directions information complete to give visitors a clear next step." : "Share your DineUp profile and improve your listing to start generating customer activity."}</p></div>
              </section>

              <section className="panel">
                <div className="panelTitle"><div><b>Action breakdown</b><p className="muted">What customers do after viewing your profile.</p></div></div>
                <div className="actionList">
                  {EVENT_KEYS.filter((key) => key !== "profile_view").map((key) => {
                    const value = events[key] || 0;
                    return <div className="actionRow" key={key}><div className="actionMeta"><span>{EVENT_LABELS[key]}</span><b>{value}</b></div><div className="bar"><i style={{ width: `${(value / maxEvent) * 100}%` }} /></div></div>;
                  })}
                </div>
                <div className="insight"><b>{actions > 0 ? `${EVENT_LABELS[topActionKey]} is your most-used customer action.` : "Waiting for customer activity."}</b><p>Use this data to understand which contact option is getting the most engagement.</p></div>
              </section>
            </div>

            <section className="panel">
              <div className="panelTitle"><div><b>Visibility campaign</b><p className="muted">Your bidding performance for the selected period.</p></div><Link href={`/restaurant/bid?id=${restaurant?.id}`} className="primary small">Increase visibility ↑</Link></div>
              <div className="campaignGrid">
                <div><small>Current marketplace bid</small><strong>{money(Number(restaurant?.current_bid || 0))}</strong></div>
                <div><small>Bid attempts</small><strong>{bidStats.total_attempts}</strong></div>
                <div><small>Successful bids</small><strong>{bidStats.paid_bids}</strong></div>
                <div><small>Average paid bid</small><strong>{money(bidStats.average_paid_bid)}</strong></div>
                <div><small>Active bids</small><strong>{bidStats.active_bids}</strong></div>
                <div><small>Paid campaign spend</small><strong>{money(bidStats.total_spend)}</strong></div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const styles = `
*{box-sizing:border-box}.page{min-height:100vh;background:#f6f7f9;color:#171717;font-family:Arial,sans-serif}.nav{height:72px;border-bottom:1px solid #e6e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 6vw;position:sticky;top:0;z-index:10}.brand{font-size:27px;font-weight:800;color:#111;text-decoration:none}.brand span{color:#ff5a1f}.navRight,.actions,.periods{display:flex;gap:10px;align-items:center}.text{color:#555;text-decoration:none;font-weight:600}.secondary,.primary,.period{border:1px solid #ddd;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:11px 15px;font-weight:700;cursor:pointer}.primary{background:#111;color:#fff;border-color:#111}.primary.small,.secondary.small{padding:8px 11px;font-size:13px}.shell{max-width:1180px;margin:0 auto;padding:42px 22px 70px}.heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:26px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#777}.heading h1{font-size:38px;margin:8px 0}.muted{color:#737780;margin:5px 0}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:18px}.stat,.panel{background:#fff;border:1px solid #e6e7eb;border-radius:16px;box-shadow:0 5px 18px rgba(0,0,0,.04)}.stat{padding:18px}.stat span,.stat small,.campaignGrid small{display:block;color:#70747c;font-size:12px}.stat strong{display:block;font-size:25px;margin:8px 0 4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}.panel{padding:22px;margin-bottom:18px}.panelTitle{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:20px}.panelTitle b{font-size:18px}.panelTitle p{font-size:13px}.live{font-size:11px;font-weight:800;letter-spacing:.08em;padding:7px 9px;border-radius:99px;background:#f0f0f0}.funnelRow{margin-bottom:18px}.funnelRow>span{display:inline-block;color:#555}.funnelRow>b{float:right}.bar{height:8px;background:#eceef1;border-radius:99px;overflow:hidden;margin-top:9px}.bar i{display:block;height:100%;background:#111;border-radius:99px}.insight{margin-top:18px;padding:14px;background:#f7f7f8;border-radius:12px}.insight b{font-size:14px}.insight p{font-size:13px;color:#666;margin:6px 0 0;line-height:1.5}.actionRow{margin:14px 0}.actionMeta{display:flex;justify-content:space-between;font-size:14px}.campaignGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#e7e7e7;border:1px solid #e7e7e7;border-radius:12px;overflow:hidden}.campaignGrid>div{background:#fff;padding:18px}.campaignGrid strong{display:block;font-size:20px;margin-top:7px}.period{padding:9px 12px}.period.active{background:#111;color:#fff;border-color:#111}.alert{border-color:#ddd;color:#555}.alert{padding:16px}.small{white-space:nowrap}@media(max-width:900px){.stats{grid-template-columns:repeat(3,1fr)}.grid{grid-template-columns:1fr}.heading{align-items:flex-start;flex-direction:column}.campaignGrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.nav{padding:0 18px}.navRight .text{display:none}.shell{padding:28px 14px}.heading h1{font-size:30px}.stats{grid-template-columns:repeat(2,1fr)}.stat{padding:14px}.stat strong{font-size:22px}.campaignGrid{grid-template-columns:1fr}.periods{width:100%}.period{flex:1}.panel{padding:17px}}
`;