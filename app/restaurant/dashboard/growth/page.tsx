"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

const fields = [
  ["Phone", "phone"], ["WhatsApp", "whatsapp"], ["Website", "website_url"], ["Menu URL", "menu_url"],
  ["Description", "description"], ["Price range", "price_range"], ["Cover image", "cover_image_url"], ["Logo image", "logo_image_url"],
] as const;

const actionCopy: Record<string, string> = {
  phone: "Add phone", whatsapp: "Add WhatsApp", website_url: "Add website", menu_url: "Add menu",
  description: "Add description", price_range: "Set price range", cover_image_url: "Add cover", logo_image_url: "Add logo",
};

function normalizeWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `91${digits}` : digits;
}

export default function RestaurantGrowthPage() {
  const supabase = createClient();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Please log in to view Growth Center.");
        const { data: r, error: rError } = await supabase.from("restaurants")
          .select("id, name, city, category, current_bid, is_active").eq("owner_id", user.id).eq("is_active", true).limit(1).maybeSingle();
        if (rError) throw rError;
        if (!r) throw new Error("No active restaurant is linked to this account.");
        setRestaurant(r);
        const [{ data: p, error: pError }, { data: events, error: eError }] = await Promise.all([
          supabase.from("restaurant_profiles").select("phone, whatsapp, website_url, description, price_range, menu_url, cover_image_url, logo_image_url, opening_hours").eq("restaurant_id", Number(r.id)).maybeSingle(),
          supabase.rpc("get_restaurant_analytics", { p_restaurant_id: Number(r.id) }),
        ]);
        if (pError) throw pError;
        if (eError) throw eError;
        setProfile(p || {});
        const next: Record<string, number> = {};
        (events || []).forEach((item: any) => { next[item.event_type] = Number(item.event_count || 0); });
        setAnalytics(next);
      } catch (e: any) { setError(e?.message || "Unable to load Growth Center."); }
      finally { setLoading(false); }
    }
    load();
  }, [supabase]);

  if (loading) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><div className="eyebrow">DINEUP GROWTH CENTER</div><h1>Loading...</h1><p className="muted">Preparing your restaurant growth checklist.</p></section></div></main>;
  if (error || !restaurant) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><div className="eyebrow">GROWTH CENTER</div><h1>Unable to load</h1><p className="muted">{error}</p><Link href="/restaurant/login" className="primary">Back to login →</Link></section></div></main>;

  const completed = fields.filter(([, key]) => Boolean(String(profile?.[key] ?? "").trim())).length;
  const profileScore = Math.round((completed / fields.length) * 100);
  const actions = ["call", "whatsapp", "directions", "menu", "website"].reduce((sum, key) => sum + Number(analytics[key] || 0), 0);
  const views = Number(analytics.profile_view || 0);
  const actionRate = views ? (actions / views) * 100 : 0;
  const incomplete = fields.filter(([, key]) => !Boolean(String(profile?.[key] ?? "").trim()));
  const phone = String(profile?.phone || "").trim();
  const whatsapp = normalizeWhatsApp(String(profile?.whatsapp || "").trim());
  const menuUrl = String(profile?.menu_url || "").trim();
  const websiteUrl = String(profile?.website_url || "").trim();
  const publicProfileUrl = `/restaurant/${restaurant.id}`;
  const tips = [
    !profile?.cover_image_url && "Add a strong cover photo so visitors immediately see your restaurant.",
    !profile?.logo_image_url && "Upload your restaurant logo for a more complete listing.",
    !profile?.description && "Add a short description explaining what makes your restaurant special.",
    !profile?.menu_url && "Add your menu URL so visitors have a clear next step.",
    !profile?.phone && !profile?.whatsapp && "Add a phone or WhatsApp contact option for direct enquiries.",
    views > 0 && actions === 0 && "Your profile is getting views; make contact and menu options prominent to give visitors an action.",
  ].filter(Boolean) as string[];

  const edit = "/restaurant/dashboard/profile";
  return <main className="page"><style jsx>{styles}</style>
    <header className="nav"><Link href="/" className="brand">Dine<span>Up</span></Link><div className="navRight"><Link href="/restaurant/dashboard" className="secondary">Dashboard</Link><Link href="/restaurant/dashboard/analytics" className="secondary">Analytics</Link></div></header>
    <div className="shell">
      <div className="heading"><div><div className="eyebrow">DINEUP GROWTH CENTER</div><h1>{restaurant.name}</h1><p className="muted">Practical actions to keep your listing complete and turn profile visits into customer actions.</p></div><Link href="/restaurant/dashboard" className="secondary">← Dashboard</Link></div>
      <section className="hero panel"><div><span className="eyebrow">PROFILE COMPLETENESS</span><strong>{profileScore}%</strong><p className="muted">{completed} of {fields.length} key profile fields completed.</p></div><div className="score"><div className="scoreBar"><i style={{ width: `${profileScore}%` }} /></div><Link href={edit} className="primary">Edit profile →</Link></div></section>
      <div className="grid">
        <section className="panel"><div className="panelTitle"><b>Growth checklist</b><span>{completed}/{fields.length}</span></div><div className="checklist">{fields.map(([label, key]) => { const done = Boolean(String(profile?.[key] ?? "").trim()); return <div className="check" key={key}><span className={done ? "dot done" : "dot"}>{done ? "✓" : ""}</span><div className="checkBody"><div><b>{label}</b><small>{done ? "Completed" : "Needs attention"}</small></div>{!done && <Link href={edit} className="miniAction">{actionCopy[key]} →</Link>}</div></div>; })}</div></section>
        <section className="panel"><div className="panelTitle"><b>Customer signals</b><span>Live</span></div><div className="signals"><div><small>Profile views</small><strong>{views}</strong></div><div><small>Customer actions</small><strong>{actions}</strong></div><div><small>Action rate</small><strong>{actionRate.toFixed(1)}%</strong></div></div><p className="muted note">These metrics come from your public DineUp profile activity.</p><Link href="/restaurant/dashboard/analytics" className="secondary full">Open detailed analytics →</Link></section>
      </div>

      <section className="panel conversion"><div className="panelTitle"><div><b>Customer conversion</b><p className="muted panelSub">Make it easy for interested visitors to contact you or view your menu.</p></div><span className="liveData">ACTION READY</span></div><div className="conversionGrid">
        <a className={`conversionAction ${phone ? "" : "disabled"}`} href={phone ? `tel:${phone}` : undefined} aria-disabled={!phone}><span>☎</span><div><b>Call restaurant</b><small>{phone ? `Use ${phone}` : "Add a phone number"}</small></div><em>→</em></a>
        <a className={`conversionAction ${whatsapp ? "" : "disabled"}`} href={whatsapp ? `https://wa.me/${whatsapp}` : undefined} target={whatsapp ? "_blank" : undefined} rel={whatsapp ? "noreferrer" : undefined} aria-disabled={!whatsapp}><span>◉</span><div><b>WhatsApp</b><small>{whatsapp ? "Start a customer conversation" : "Add WhatsApp"}</small></div><em>→</em></a>
        <a className={`conversionAction ${menuUrl ? "" : "disabled"}`} href={menuUrl || undefined} target={menuUrl ? "_blank" : undefined} rel={menuUrl ? "noreferrer" : undefined} aria-disabled={!menuUrl}><span>☰</span><div><b>View menu</b><small>{menuUrl ? "Open your restaurant menu" : "Add menu URL"}</small></div><em>→</em></a>
        <Link className="conversionAction" href={publicProfileUrl}><span>↗</span><div><b>View public profile</b><small>See the customer-facing listing</small></div><em>→</em></Link>
      </div><div className="conversionHint"><b>{actionRate >= 20 ? "Keep the momentum going." : "Turn more visits into actions."}</b><span>{actionRate >= 20 ? "Your profile is generating customer actions. Keep contact and menu details current." : "Complete contact and menu details, then share your public profile to create more customer opportunities."}</span><Link href={edit}>Update profile →</Link></div></section>

      <section className="panel"><div className="panelTitle"><div><b>Quick growth actions</b><p className="muted">Use these actions to improve the listing or increase marketplace visibility.</p></div></div><div className="quickActions"><Link href={edit} className="quick"><span>✎</span><div><b>Complete profile</b><small>{incomplete.length ? `${incomplete.length} item${incomplete.length === 1 ? "" : "s"} need attention` : "All profile fields completed"}</small></div><em>→</em></Link><Link href="/restaurant/dashboard/analytics" className="quick"><span>◔</span><div><b>Review analytics</b><small>{views} views • {actions} customer actions</small></div><em>→</em></Link><Link href={`/restaurant/bid?id=${restaurant.id}`} className="quick"><span>↑</span><div><b>Increase visibility</b><small>Manage your marketplace campaign</small></div><em>→</em></Link></div></section>
      <section className="panel"><div className="panelTitle"><div><b>Next actions</b><p className="muted">Focus on the items currently missing from your listing.</p></div><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary small">Increase visibility ↑</Link></div>{tips.length ? <div className="tips">{tips.slice(0, 5).map((tip, i) => <div className="tip" key={i}><span>{i + 1}</span><p>{tip}</p></div>)}</div> : <div className="success"><b>Your profile is fully completed.</b><p>Keep your listing current and monitor customer activity regularly.</p></div>}</section>
      <section className="panel campaign"><div><div className="eyebrow">VISIBILITY</div><h2>Reach more customers on DineUp</h2><p className="muted">Use the marketplace campaign when you want to compete for a higher position in your city.</p></div><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary">Manage visibility →</Link></section>
    </div>
  </main>;
}

const styles = `*{box-sizing:border-box}.page{min-height:100vh;background:#f6f7f9;color:#171717;font-family:Arial,sans-serif}.nav{height:72px;border-bottom:1px solid #e6e7eb;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 6vw;position:sticky;top:0;z-index:10}.brand{font-size:27px;font-weight:800;color:#111;text-decoration:none}.brand span{color:#ff5a1f}.navRight{display:flex;gap:10px}.shell{max-width:1180px;margin:0 auto;padding:42px 22px 70px}.heading{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;margin-bottom:24px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#777}.heading h1{font-size:38px;margin:8px 0}.muted{color:#737780;line-height:1.5}.panel{background:#fff;border:1px solid #e6e7eb;border-radius:16px;padding:22px;box-shadow:0 5px 18px rgba(0,0,0,.04);margin-bottom:18px}.secondary,.primary{display:inline-block;border:1px solid #ddd;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:11px 15px;font-weight:700}.primary{background:#111;color:#fff;border-color:#111}.small{padding:9px 12px;font-size:13px}.hero{display:flex;justify-content:space-between;align-items:center;gap:30px}.hero strong{display:block;font-size:46px;margin:8px 0}.score{width:45%;display:flex;align-items:center;gap:15px}.scoreBar{height:12px;flex:1;background:#eceef1;border-radius:99px;overflow:hidden}.scoreBar i{display:block;height:100%;background:#111;border-radius:99px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.panelTitle{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;margin-bottom:18px}.panelTitle b{font-size:18px}.panelSub{margin:5px 0 0}.checklist{display:grid;grid-template-columns:1fr 1fr;gap:12px}.check{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #eee;border-radius:12px}.checkBody{flex:1;min-width:0;display:flex;justify-content:space-between;align-items:center;gap:8px}.dot{width:26px;height:26px;border-radius:50%;border:1px solid #ccc;display:grid;place-items:center;font-size:13px;flex:none}.dot.done{background:#111;color:#fff;border-color:#111}.check b,.check small{display:block}.check small{color:#777;margin-top:3px}.miniAction{font-size:11px;font-weight:800;color:#111;text-decoration:none;white-space:nowrap}.signals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.signals>div{padding:15px;border:1px solid #eee;border-radius:12px}.signals small{display:block;color:#777;font-size:12px}.signals strong{display:block;font-size:25px;margin-top:7px}.note{font-size:13px}.full{width:100%;text-align:center}.liveData{font-size:11px;font-weight:800;letter-spacing:.08em;padding:8px 10px;border-radius:999px;background:#f1f1f1;color:#111}.conversionGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.conversionAction{display:flex;align-items:center;gap:11px;padding:15px;border:1px solid #e8e8e8;border-radius:13px;text-decoration:none;color:#111;background:#fafafa;min-width:0}.conversionAction>span{width:34px;height:34px;border-radius:10px;background:#111;color:#fff;display:grid;place-items:center;font-weight:800;flex:none}.conversionAction div{min-width:0;flex:1}.conversionAction b,.conversionAction small{display:block}.conversionAction small{color:#777;margin-top:4px;line-height:1.35}.conversionAction em{font-style:normal;font-weight:800}.conversionAction.disabled{opacity:.55;cursor:not-allowed}.conversionHint{margin-top:14px;padding:14px;border-radius:12px;background:#f7f7f7;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.conversionHint b{font-size:14px}.conversionHint span{color:#666;font-size:13px;flex:1;min-width:220px}.conversionHint a{color:#111;font-size:13px;font-weight:800;text-decoration:none}.quickActions{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.quick{display:flex;align-items:center;gap:12px;padding:15px;border:1px solid #e8e8e8;border-radius:13px;text-decoration:none;color:#111;background:#fafafa}.quick>span{width:34px;height:34px;border-radius:10px;background:#111;color:#fff;display:grid;place-items:center;font-weight:800;flex:none}.quick div{min-width:0;flex:1}.quick b,.quick small{display:block}.quick small{color:#777;margin-top:4px;line-height:1.35}.quick em{font-style:normal;font-weight:800}.tip{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid #eee}.tip:last-child{border-bottom:0}.tip span{width:28px;height:28px;border-radius:50%;background:#111;color:#fff;display:grid;place-items:center;font-weight:700;flex:none}.tip p{margin:4px 0;line-height:1.5}.success{padding:16px;border-radius:12px;background:#f7f7f7}.success p{margin-bottom:0;color:#666}.campaign{display:flex;justify-content:space-between;align-items:center;gap:20px}.campaign h2{margin:7px 0;font-size:24px}@media(max-width:1000px){.conversionGrid{grid-template-columns:1fr 1fr}}@media(max-width:900px){.grid{grid-template-columns:1fr}.hero,.campaign{align-items:flex-start;flex-direction:column}.score{width:100%}.checklist,.quickActions{grid-template-columns:1fr}}@media(max-width:600px){.nav{padding:0 18px}.navRight .secondary:last-child{display:none}.shell{padding:28px 14px}.heading{align-items:flex-start;flex-direction:column}.heading h1{font-size:30px}.panel{padding:17px}.signals{grid-template-columns:1fr}.hero strong{font-size:38px}.checkBody{align-items:flex-start;flex-direction:column}.miniAction{margin-top:2px}.conversionGrid{grid-template-columns:1fr}.conversionHint{align-items:flex-start;flex-direction:column}.conversionHint span{min-width:0}}`;
