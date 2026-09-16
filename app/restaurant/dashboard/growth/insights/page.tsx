"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../../../lib/supabase/client";

function money(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export default function GrowthInsightsPage() {
  const supabase = createClient();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [views, setViews] = useState(0);
  const [actions, setActions] = useState(0);
  const [paidBids, setPaidBids] = useState(0);
  const [spend, setSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Please log in to view Growth Insights.");

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

        const [{ data: p }, { data: eventRows, error: eError }, { data: bidRows, error: bError }] = await Promise.all([
          supabase.from("restaurant_profiles").select("phone, whatsapp, website_url, menu_url, description, price_range, cover_image_url, logo_image_url").eq("restaurant_id", Number(r.id)).maybeSingle(),
          supabase.from("restaurant_events").select("event_type").eq("restaurant_id", Number(r.id)).in("event_type", ["profile_view", "call", "whatsapp", "directions", "menu", "website"]),
          supabase.from("bids").select("amount, payment_status").eq("restaurant_id", Number(r.id)).order("created_at", { ascending: false }).limit(20),
        ]);
        if (eError) throw eError;
        if (bError) throw bError;
        setProfile(p || {});
        const events = eventRows || [];
        setViews(events.filter((e) => e.event_type === "profile_view").length);
        setActions(events.filter((e) => e.event_type !== "profile_view").length);
        const paid = (bidRows || []).filter((b) => b.payment_status === "captured");
        setPaidBids(paid.length);
        setSpend(paid.reduce((sum, b) => sum + Number(b.amount || 0), 0));
      } catch (e: any) {
        setError(e?.message || "Unable to load Growth Insights.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  if (loading) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><div className="eyebrow">DINEUP GROWTH INSIGHTS</div><h1>Loading...</h1></section></div></main>;
  if (error || !restaurant) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><h1>Unable to load</h1><p className="muted">{error}</p><Link href="/restaurant/dashboard/growth" className="primary">Back to Growth Center →</Link></section></div></main>;

  const profileFields = [profile.phone, profile.whatsapp, profile.website_url, profile.menu_url, profile.description, profile.price_range, profile.cover_image_url, profile.logo_image_url];
  const missing = [
    !profile.cover_image_url ? "Add a cover photo so customers can see your restaurant immediately." : null,
    !profile.logo_image_url ? "Upload your restaurant logo for a more complete listing." : null,
    !profile.description ? "Add a short description explaining what makes your restaurant special." : null,
  ].filter(Boolean) as string[];
  const completeness = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const actionRate = views ? Math.round((actions / views) * 1000) / 10 : 0;

  const recommendations = [
    ...missing.map((text) => ({ title: "Complete your profile", text, href: "/restaurant/dashboard/profile", label: "Update profile" })),
    ...(views === 0 ? [{ title: "Get your first profile visit", text: "Share your DineUp listing with existing customers and local audiences to start generating profile activity.", href: `/restaurant/${restaurant.id}`, label: "View public profile" }] : []),
    ...(views > 0 && actions === 0 ? [{ title: "Improve customer conversion", text: "Make your phone, WhatsApp and menu details prominent and keep them current.", href: "/restaurant/dashboard/profile", label: "Update contact details" }] : []),
    ...(views > 0 && actions > 0 && actionRate < 10 ? [{ title: "Turn more visits into actions", text: "Add a stronger description and make sure your menu and contact links are accurate.", href: "/restaurant/dashboard/profile", label: "Improve profile" }] : []),
    ...(paidBids === 0 ? [{ title: "Build marketplace visibility", text: "Review your bidding options when you want to compete for a higher position in your city.", href: `/restaurant/dashboard/growth/visibility`, label: "Manage visibility" }] : []),
  ];

  return <main className="page"><style jsx>{styles}</style>
    <header className="nav"><Link href="/" className="brand">Dine<span>Up</span></Link><div className="navRight"><Link href="/restaurant/dashboard" className="secondary">Dashboard</Link><Link href="/restaurant/dashboard/growth" className="secondary">Growth Center</Link></div></header>
    <div className="shell">
      <div className="heading"><div><div className="eyebrow">DINEUP GROWTH INSIGHTS</div><h1>{restaurant.name}</h1><p className="muted">Use your listing data to decide what to improve next.</p></div><Link href="/restaurant/dashboard/growth" className="secondary">← Growth Center</Link></div>

      <section className="panel hero"><div><div className="eyebrow">GROWTH SNAPSHOT</div><h2>{recommendations.length ? `${recommendations.length} actions available` : "Your listing is in good shape"}</h2><p className="muted">Profile completeness {completeness}% • {views} profile views • {actions} customer actions</p></div><Link href="/restaurant/dashboard/analytics" className="primary">Open analytics →</Link></section>

      <div className="stats"><div className="stat"><small>Profile completeness</small><strong>{completeness}%</strong><span>{profileFields.filter(Boolean).length} of 8 fields</span></div><div className="stat"><small>Profile views</small><strong>{views}</strong><span>recorded activity</span></div><div className="stat"><small>Customer actions</small><strong>{actions}</strong><span>calls, WhatsApp & clicks</span></div><div className="stat"><small>Campaign spend</small><strong>{money(spend)}</strong><span>{paidBids} paid bids</span></div></div>

      <section className="panel"><div className="panelTitle"><div><b>Recommended next actions</b><p className="muted">Prioritized from your current profile and activity.</p></div><span className="badge">LIVE</span></div>
        {recommendations.length ? <div className="recommendations">{recommendations.map((item, i) => <div className="recommendation" key={`${item.title}-${i}`}><div className="number">{i + 1}</div><div className="recBody"><b>{item.title}</b><p>{item.text}</p></div><Link href={item.href} className="secondary small">{item.label} →</Link></div>)}</div> : <div className="success"><b>No urgent actions.</b><p>Your current profile and activity do not show a major missing item. Keep your information current and monitor analytics regularly.</p></div>}
      </section>

      <section className="panel"><div className="panelTitle"><div><b>How DineUp reads your activity</b><p className="muted">Simple signals, not guarantees.</p></div></div><div className="signals"><div><small>Profile signal</small><strong>{completeness >= 75 ? "Complete" : "Needs work"}</strong><p>More complete listings give customers more information before they act.</p></div><div><small>Conversion signal</small><strong>{views ? `${actionRate}% action rate` : "No data yet"}</strong><p>Customer actions divided by recorded profile views.</p></div><div><small>Visibility signal</small><strong>{paidBids ? "Campaign active/history" : "No paid campaign"}</strong><p>Paid bidding activity is shown separately from organic profile activity.</p></div></div></section>

      <section className="panel next"><div><div className="eyebrow">KEEP GROWING</div><h2>Return to your Growth Center</h2><p className="muted">Complete missing profile items, review customer signals, and manage visibility from one place.</p></div><Link href="/restaurant/dashboard/growth" className="primary">Growth Center →</Link></section>
    </div>
  </main>;
}

const styles = `*{box-sizing:border-box}.page{min-height:100vh;background:#f6f7f9;color:#171717;font-family:Arial,sans-serif}.nav{height:72px;border-bottom:1px solid #e6e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 6vw;position:sticky;top:0;z-index:10}.brand{font-size:27px;font-weight:800;color:#111;text-decoration:none}.brand span{color:#ff5a1f}.navRight{display:flex;gap:10px}.shell{max-width:1180px;margin:0 auto;padding:42px 22px 70px}.heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:24px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#777}.heading h1{font-size:38px;margin:8px 0}.muted{color:#737780;line-height:1.5}.panel{background:#fff;border:1px solid #e6e7eb;border-radius:16px;padding:22px;box-shadow:0 5px 18px rgba(0,0,0,.04);margin-bottom:18px}.hero{display:flex;justify-content:space-between;align-items:center;gap:20px}.hero h2{font-size:28px;margin:8px 0}.secondary,.primary{display:inline-block;border:1px solid #ddd;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:11px 15px;font-weight:700}.primary{background:#111;color:#fff;border-color:#111}.small{padding:9px 12px;font-size:13px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.stat{background:#fff;border:1px solid #e6e7eb;border-radius:16px;padding:20px;box-shadow:0 5px 18px rgba(0,0,0,.04)}.stat small,.stat span{display:block;color:#777}.stat strong{display:block;font-size:28px;margin:8px 0}.stat span{font-size:12px}.panelTitle{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}.panelTitle b{font-size:20px}.panelTitle p{margin:5px 0 0}.badge{font-size:11px;font-weight:800;letter-spacing:.08em;padding:8px 11px;border-radius:999px;background:#f1f2f4}.recommendations{display:grid;gap:10px}.recommendation{display:flex;align-items:center;gap:14px;border:1px solid #e8e9ec;border-radius:12px;padding:15px}.number{width:30px;height:30px;border-radius:50%;background:#111;color:#fff;display:grid;place-items:center;font-weight:800;flex:0 0 auto}.recBody{flex:1}.recBody b{font-size:16px}.recBody p{margin:5px 0 0;color:#737780;line-height:1.45}.success{padding:18px;border:1px solid #e8e9ec;border-radius:12px}.success p{margin:6px 0 0;color:#737780}.signals{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.signals>div{border:1px solid #e8e9ec;border-radius:12px;padding:18px}.signals small{display:block;color:#777}.signals strong{display:block;font-size:20px;margin:7px 0}.signals p{color:#737780;line-height:1.45;margin:0}.next{display:flex;justify-content:space-between;align-items:center;gap:20px}.next h2{margin:7px 0}.next p{max-width:700px}@media(max-width:800px){.heading,.hero,.next{flex-direction:column;align-items:flex-start}.stats{grid-template-columns:repeat(2,1fr)}.signals{grid-template-columns:1fr}.recommendation{align-items:flex-start;flex-wrap:wrap}.recommendation .secondary{margin-left:44px}.nav{padding:0 20px}.navRight{display:none}}@media(max-width:520px){.stats{grid-template-columns:1fr}.shell{padding:28px 14px 50px}.heading h1{font-size:30px}}`;
