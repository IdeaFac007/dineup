"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

const defaultHours = {
  monday: "10:00 AM - 10:00 PM",
  tuesday: "10:00 AM - 10:00 PM",
  wednesday: "10:00 AM - 10:00 PM",
  thursday: "10:00 AM - 10:00 PM",
  friday: "10:00 AM - 10:00 PM",
  saturday: "10:00 AM - 10:00 PM",
  sunday: "10:00 AM - 10:00 PM",
};

export default function RestaurantDashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [onboarding, setOnboarding] = useState<any[]>([]);
  const [rank, setRank] = useState(0);
  const [indiaRank, setIndiaRank] = useState(0);
  const [indiaTotal, setIndiaTotal] = useState(0);
  const [leaderboardMode, setLeaderboardMode] = useState<"city" | "india">("city");
  const [nextRank, setNextRank] = useState<number | null>(null);
  const [nextBid, setNextBid] = useState<number | null>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({ profile_view: 0, call: 0, whatsapp: 0, directions: 0, menu: 0, website: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [message, setMessage] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<"logo" | "cover" | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileForm, setProfileForm] = useState<any>({
    phone: "", whatsapp: "", website_url: "", description: "", price_range: "", menu_url: "",
    cover_image_url: "", logo_image_url: "", opening_hours: { ...defaultHours },
  });

  const formatMoney = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/restaurant/login"); return; }

      const { data: r, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, city, category, address, current_bid, is_active, profile_completion_pct")
        .eq("owner_id", user.id).eq("is_active", true).limit(1).maybeSingle();
      if (restaurantError) throw restaurantError;
      if (!r) throw new Error("No active restaurant is linked to this account.");
      const restaurantData = { ...r, id: Number(r.id), current_bid: Number(r.current_bid || 0) };
      setRestaurant(restaurantData);

      const { data: p, error: profileError } = await supabase.from("restaurant_profiles")
        .select("phone, whatsapp, website_url, description, price_range, menu_url, cover_image_url, logo_image_url, opening_hours")
        .eq("restaurant_id", restaurantData.id).maybeSingle();
      if (profileError) console.error("Profile load error:", profileError);
      if (p) setProfileForm((prev: any) => ({
        ...prev,
        phone: p.phone ?? "",
        whatsapp: p.whatsapp ?? "",
        website_url: p.website_url ?? "",
        description: p.description ?? "",
        price_range: p.price_range ?? "",
        menu_url: p.menu_url ?? "",
        cover_image_url: p.cover_image_url ?? "",
        logo_image_url: p.logo_image_url ?? "",
        opening_hours: { ...defaultHours, ...(p.opening_hours || {}) },
      }));

      const { data: onboardingData, error: onboardingError } = await supabase.rpc("get_restaurant_onboarding_status", { p_restaurant_id: restaurantData.id });
      if (onboardingError) console.error("Onboarding error:", onboardingError); else setOnboarding(onboardingData || []);

      const { data: restaurants, error: leaderboardError } = await supabase.from("restaurants")
        .select("id, name, city, current_bid").eq("is_active", true)
        .order("current_bid", { ascending: false }).order("id", { ascending: true });
      if (leaderboardError) throw leaderboardError;
      const allLb = (restaurants || []).map((x: any) => ({ ...x, id: Number(x.id), current_bid: Number(x.current_bid || 0) }));
      const cityLb = allLb.filter((x: any) => String(x.city || "").toLowerCase() === String(restaurantData.city || "").toLowerCase());
      const cityIdx = cityLb.findIndex((x: any) => x.id === restaurantData.id);
      const indiaIdx = allLb.findIndex((x: any) => x.id === restaurantData.id);
      setIndiaRank(indiaIdx >= 0 ? indiaIdx + 1 : 0);
      setIndiaTotal(allLb.length);
      if (cityIdx >= 0) {
        setRank(cityIdx + 1);
        if (cityIdx > 0) { setNextRank(cityIdx); setNextBid(cityLb[cityIdx - 1].current_bid); }
        else { setNextRank(null); setNextBid(null); }
      } else { setRank(0); setNextRank(null); setNextBid(null); }

      const { data: bidData, error: bidError } = await supabase.from("bids")
        .select("id, amount, status, payment_status, razorpay_order_id, razorpay_payment_id, created_at")
        .eq("restaurant_id", restaurantData.id).order("created_at", { ascending: false }).limit(20);
      if (bidError) console.error("Bid history error:", bidError);
      setBids((bidData || []).map((x: any) => ({ ...x, id: Number(x.id), amount: Number(x.amount || 0) })));

      const { data: analyticsData, error: analyticsError } = await supabase.rpc("get_restaurant_analytics", { p_restaurant_id: restaurantData.id });
      if (analyticsError) console.error("Analytics error:", analyticsError);
      else {
        const next = { profile_view: 0, call: 0, whatsapp: 0, directions: 0, menu: 0, website: 0 };
        (analyticsData || []).forEach((item: any) => {
          if (item.event_type in next) next[item.event_type as keyof typeof next] = Number(item.event_count || 0);
        });
        setAnalytics(next);
      }
    } catch (e: any) { setMessage(e?.message || "Unable to load dashboard."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [router, supabase]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "profile") {
      setProfileOpen(true);
      window.history.replaceState({}, "", "/restaurant/dashboard");
    }
    loadDashboard();
    const refresh = () => loadDashboard(true);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); };
  }, [loadDashboard]);

  async function uploadProfileImage(kind: "logo" | "cover", file: File) {
    if (!restaurant) return;
    if (!file.type.startsWith("image/")) { setProfileMessage("Please select an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setProfileMessage("Image must be 5 MB or smaller."); return; }
    setUploadingImage(kind); setProfileMessage("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
      const path = `${restaurant.id}/${kind}-${Date.now()}.${safeExtension}`;
      const { error } = await supabase.storage.from("restaurant-media").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("restaurant-media").getPublicUrl(path);
      setProfileForm((p: any) => ({ ...p, [kind === "logo" ? "logo_image_url" : "cover_image_url"]: data.publicUrl }));
      setProfileMessage(`${kind === "logo" ? "Logo" : "Cover image"} uploaded. Click Save profile.`);
    } catch (e: any) { setProfileMessage(e?.message || "Unable to upload image right now."); }
    finally { setUploadingImage(null); }
  }

  async function saveProfile() {
    if (!restaurant) return;
    setProfileSaving(true); setProfileMessage("");
    try {
      const payload = {
        restaurant_id: restaurant.id,
        phone: String(profileForm.phone ?? "").trim() || null,
        whatsapp: String(profileForm.whatsapp ?? "").trim() || null,
        website_url: String(profileForm.website_url ?? "").trim() || null,
        description: String(profileForm.description ?? "").trim() || null,
        price_range: profileForm.price_range || null,
        menu_url: String(profileForm.menu_url ?? "").trim() || null,
        cover_image_url: String(profileForm.cover_image_url ?? "").trim() || null,
        logo_image_url: String(profileForm.logo_image_url ?? "").trim() || null,
        opening_hours: profileForm.opening_hours || { ...defaultHours },
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("restaurant_profiles").upsert(payload, { onConflict: "restaurant_id" });
      if (error) throw error;
      setProfileMessage("Profile saved successfully.");
      setProfileOpen(false);
      await loadDashboard(true);
    } catch (e: any) { setProfileMessage(e?.message || "Unable to save profile right now."); }
    finally { setProfileSaving(false); }
  }

  async function handleLogout() {
    setLoggingOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) { setMessage(error.message); setLoggingOut(false); return; }
    router.push("/restaurant/login"); router.refresh();
  }

  if (loading) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><div className="eyebrow">RESTAURANT DASHBOARD</div><h1>Loading dashboard...</h1><p className="muted">Fetching your live restaurant performance.</p></section></div></main>;
  if (!restaurant) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="panel"><div className="eyebrow">DASHBOARD ERROR</div><h1>Unable to load dashboard.</h1><p className="muted">{message}</p><Link href="/restaurant/login" className="primary">Back to login →</Link></section></div></main>;

  const paidBids = bids.filter((b: any) => b.payment_status === "captured");
  const customerActions = analytics.call + analytics.whatsapp + analytics.directions + analytics.menu + analytics.website;
  const completedOnboarding = onboarding.filter((item: any) => item.completed).length;
  const onboardingPercent = onboarding.length ? Math.round((completedOnboarding / onboarding.length) * 100) : 0;
  const nextOnboardingStep = onboarding.find((item: any) => !item.completed) || null;

  return <main className="page"><style jsx>{styles}</style>
    <header className="nav"><Link href="/" className="brand">Dine<span>Up</span></Link><div className="navRight"><span className="pill">Restaurant Partner</span><Link href="/restaurant/dashboard/orders" className="text">Orders</Link><Link href="/restaurant/dashboard/reviews" className="text">Reviews</Link><Link href="/marketplace" className="text">Marketplace</Link><button type="button" className="secondary" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? "Logging out..." : "Logout"}</button></div></header>
    <div className="shell">
      <div className="heading"><div><div className="eyebrow">RESTAURANT DASHBOARD</div><h1>{restaurant.name}</h1><p className="muted">{restaurant.city} • {restaurant.category}{restaurant.address ? ` • ${restaurant.address}` : ""}</p></div><div className="actions"><button type="button" className="secondary" onClick={() => loadDashboard(true)} disabled={refreshing}>{refreshing ? "Refreshing..." : "↻ Refresh"}</button><Link href={`/restaurant/dashboard/verification`} className="secondary">Verify business</Link><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary">Increase visibility ↑</Link></div></div>
      {message && <div className="panel alert"><p className="muted">{message}</p></div>}

      <section className="panel onboardingPanel"><div className="panelTitle"><div><b>Restaurant onboarding</b><p className="muted panelSub">Complete the key steps to make your listing customer-ready.</p></div><span className="completionBadge">{onboardingPercent}% complete</span></div><div className="progressTrack"><div className="progressFill" style={{width:`${onboardingPercent}%`}}/></div><div className="progressMeta"><span>{completedOnboarding} of {onboarding.length || 8} onboarding steps completed</span><b>{onboardingPercent}%</b></div>{nextOnboardingStep && <div className="nextStepBanner"><div><small>NEXT STEP</small><b>{nextOnboardingStep.label}</b><span>{nextOnboardingStep.status === "in_progress" ? "In progress" : "Not completed yet"}</span></div><Link className="primary small" href={nextOnboardingStep.action_url}>{nextOnboardingStep.step === "payment" ? "Promote" : "Continue →"}</Link></div>}{!nextOnboardingStep && <div className="nextStepBanner complete"><div><small>ALL SET</small><b>Your onboarding is complete</b><span>Your restaurant has completed the DineUp onboarding checklist.</span></div></div>}<div className="onboardingSteps">{onboarding.map((item:any)=><div className={`onboardingStep ${item.completed?"done":""}`} key={item.step}><div className="stepIcon">{item.completed?"✓":"•"}</div><div className="stepBody"><b>{item.label}</b><span>{item.completed?"Completed":item.status==="in_progress"?"In progress":"Pending"}</span></div>{item.completed?<span className="stepStatus">DONE</span>:<Link className="secondary small" href={item.action_url}>{item.step==="payment"?"Promote":"Continue"}</Link>}</div>)}</div></section>
      <div className="stats">
        <div className="stat"><span>{leaderboardMode === "city" ? "Current rank" : "India rank"}</span><strong>{leaderboardMode === "city" ? (rank ? `#${rank}` : "—") : (indiaRank ? `#${indiaRank}` : "—")}</strong><small>{leaderboardMode === "city" ? `in ${restaurant.city}` : `of ${indiaTotal} active restaurants`}</small></div>
        <div className="stat"><span>Current bid</span><strong>{formatMoney(restaurant.current_bid)}</strong><small>live marketplace bid</small></div>
        <div className="stat"><span>Profile views</span><strong>{analytics.profile_view}</strong><small>customer visits</small></div>
        <div className="stat"><span>Customer actions</span><strong>{customerActions}</strong><small>calls, WhatsApp & clicks</small></div>
        <div className="stat"><span>Paid bids</span><strong>{paidBids.length}</strong><small>successful payments</small></div>
        <div className="stat"><span>Bid attempts</span><strong>{bids.length}</strong><small>recent bidding activity</small></div>
      </div>

      <div className="grid">
        <section className="panel"><div className="panelTitle"><b>Live campaign</b><span className="status">ACTIVE</span></div><div className="leaderboardToggle" role="group" aria-label="Leaderboard scope"><button type="button" className={leaderboardMode === "city" ? "active" : ""} onClick={() => setLeaderboardMode("city")}>📍 {restaurant.city}</button><button type="button" className={leaderboardMode === "india" ? "active" : ""} onClick={() => setLeaderboardMode("india")}>🇮🇳 India</button></div><div className="rankBox"><div><small>{leaderboardMode === "city" ? `Your position in ${restaurant.city}` : "Your India position"}</small><strong>{leaderboardMode === "city" ? (rank ? `#${rank}` : "—") : (indiaRank ? `#${indiaRank}` : "—")}</strong></div><div className="arrow">↑</div><div><small>{nextRank ? "Next position" : "Marketplace leader"}</small><strong>{nextRank ? `#${nextRank}` : "TOP"}</strong></div></div><div className="row"><span>Current bid</span><b>{formatMoney(restaurant.current_bid)}</b></div><div className="row"><span>{nextBid ? `Bid to reach #${nextRank}` : "You are #1"}</span><b>{nextBid ? formatMoney(nextBid + 1) : "—"}</b></div>{nextBid && <div className="notice"><b>You are one bid away</b><p>Bid <b>{formatMoney(nextBid + 1)}</b> or more to move to #{nextRank}.</p></div>}<Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary full">Increase visibility ↑</Link></section>
        <section className="panel"><div className="panelTitle"><b>Restaurant profile</b><div className="titleActions"><span className="status">LIVE</span><button type="button" className="secondary small" onClick={() => { setProfileMessage(""); setProfileOpen(true); }}>Edit profile</button></div></div><div className="summary"><div><small>Restaurant</small><b>{restaurant.name}</b></div><div><small>Location</small><b>{restaurant.city}</b>{restaurant.address && <p>{restaurant.address}</p>}</div><div><small>Category</small><b>{restaurant.category}</b></div></div><div className="actions"><Link href="/marketplace" className="secondary">View marketplace</Link><Link href={`/restaurant/${restaurant.id}`} className="secondary">View public profile</Link><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary">Promote restaurant</Link></div></section>
      </div>

      <section className="panel analyticsPanel"><div className="panelTitle"><div><b>Customer activity</b><p className="muted panelSub">Actions recorded on your public DineUp profile.</p></div><span className="liveData">LIVE DATA</span></div><div className="analyticsGrid"><div className="analyticsItem"><span>Profile views</span><strong>{analytics.profile_view}</strong></div><div className="analyticsItem"><span>Calls</span><strong>{analytics.call}</strong></div><div className="analyticsItem"><span>WhatsApp</span><strong>{analytics.whatsapp}</strong></div><div className="analyticsItem"><span>Directions</span><strong>{analytics.directions}</strong></div><div className="analyticsItem"><span>Menu views</span><strong>{analytics.menu}</strong></div><div className="analyticsItem"><span>Website visits</span><strong>{analytics.website}</strong></div></div></section>

      <section className="panel"><div className="panelTitle"><b>Bid history</b><span className="muted">Last 20 attempts</span></div>{bids.length === 0 ? <p className="muted">No bids yet.</p> : <div className="tableWrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Payment</th></tr></thead><tbody>{bids.map((b: any) => <tr key={b.id}><td>{formatDate(b.created_at)}</td><td><b>{formatMoney(b.amount)}</b></td><td><span className="status">{b.status}</span></td><td>{b.payment_status || "pending"}</td></tr>)}</tbody></table></div>}</section>

      {profileOpen && <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !profileSaving && !uploadingImage) setProfileOpen(false); }}><div className="modal"><div className="modalHead"><div><small className="muted">Restaurant partner</small><h2>Edit restaurant profile</h2><p className="muted">Update the information customers see on your DineUp listing.</p></div><button type="button" className="close" onClick={() => !profileSaving && !uploadingImage && setProfileOpen(false)}>×</button></div><div className="formGrid">
        <label><span>Phone</span><input value={profileForm.phone ?? ""} onChange={(e) => setProfileForm((p: any) => ({ ...p, phone: e.target.value }))} placeholder="Restaurant phone" /></label>
        <label><span>WhatsApp</span><input value={profileForm.whatsapp ?? ""} onChange={(e) => setProfileForm((p: any) => ({ ...p, whatsapp: e.target.value }))} placeholder="WhatsApp number" /></label>
        <label><span>Website</span><input value={profileForm.website_url ?? ""} onChange={(e) => setProfileForm((p: any) => ({ ...p, website_url: e.target.value }))} placeholder="https://example.com" /></label>
        <label><span>Menu URL</span><input value={profileForm.menu_url ?? ""} onChange={(e) => setProfileForm((p: any) => ({ ...p, menu_url: e.target.value }))} placeholder="Link to your menu" /></label>
        <label><span>Price range</span><select value={profileForm.price_range ?? ""} onChange={(e) => setProfileForm((p: any) => ({ ...p, price_range: e.target.value }))}><option value="">Select</option><option value="₹">₹ — Budget</option><option value="₹₹">₹₹ — Moderate</option><option value="₹₹₹">₹₹₹ — Premium</option><option value="₹₹₹₹">₹₹₹₹ — Luxury</option></select></label>
        <label><span>Logo image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadProfileImage("logo", f); }} disabled={uploadingImage !== null} /><small>JPG, PNG or WebP • max 5 MB</small>{profileForm.logo_image_url && <img src={profileForm.logo_image_url} alt="Logo preview" className="logoPreview" />}</label>
        <label><span>Cover image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadProfileImage("cover", f); }} disabled={uploadingImage !== null} /><small>Wide restaurant photo • max 5 MB</small>{profileForm.cover_image_url && <img src={profileForm.cover_image_url} alt="Cover preview" className="coverPreview" />}</label>
        <label className="fullField"><span>Description</span><textarea value={profileForm.description ?? ""} onChange={(e) => setProfileForm((p: any) => ({ ...p, description: e.target.value }))} rows={4} maxLength={500} placeholder="Tell customers what makes your restaurant special..." /><small>{String(profileForm.description ?? "").length}/500</small></label>
      </div><div className="hours"><b>Opening hours</b><p className="muted">Set the hours customers should see on your listing.</p><div className="hoursGrid">{Object.entries(defaultHours).map(([key]) => <label key={key}><span>{key.charAt(0).toUpperCase() + key.slice(1)}</span><input value={profileForm.opening_hours?.[key] || ""} onChange={(e) => setProfileForm((p: any) => ({ ...p, opening_hours: { ...(p.opening_hours || {}), [key]: e.target.value } }))} /></label>)}</div></div>{profileMessage && <div className={`profileMessage ${profileMessage.includes("successfully") ? "success" : "error"}`}>{profileMessage}</div>}<div className="modalActions"><button type="button" className="secondary" onClick={() => setProfileOpen(false)} disabled={profileSaving || !!uploadingImage}>Cancel</button><button type="button" className="primary" onClick={saveProfile} disabled={profileSaving || !!uploadingImage}>{profileSaving ? "Saving..." : "Save profile"}</button></div></div></div>}

      <div className="footer">DineUp • Where Restaurants Rise</div>
    </div>
  </main>;
}

const styles = `
  * { box-sizing: border-box; }
  .page { min-height: 100vh; background: #f7f7f7; color: #111; font-family: Arial, Helvetica, sans-serif; }
  .nav { height: 68px; padding: 0 5%; background: #fff; border-bottom: 1px solid #e9e9e9; display:flex; align-items:center; justify-content:space-between; gap:20px; }
  .brand { font-size:24px; font-weight:900; color:#111; text-decoration:none; letter-spacing:-1px; }.brand span { font-weight:400; }
  .navRight,.actions,.titleActions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }.text { color:#333; text-decoration:none; font-weight:700; font-size:14px; }.pill,.status,.liveData { display:inline-flex; align-items:center; border-radius:999px; padding:6px 10px; background:#f0f0f0; font-size:10px; font-weight:800; letter-spacing:.6px; text-transform:uppercase; }.status { background:#eef8f0; color:#1c6b36; }
  .shell { width:min(1180px,92%); margin:0 auto; padding:42px 0 20px; }.heading { display:flex; justify-content:space-between; align-items:flex-end; gap:25px; margin-bottom:25px; }.eyebrow { font-size:11px; font-weight:800; letter-spacing:1.5px; color:#777; }.heading h1 { margin:7px 0 6px; font-size:38px; letter-spacing:-1.5px; }.muted { color:#777; }.panelSub { margin:5px 0 0; font-size:12px; }
  .primary,.secondary { display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:0 15px; border-radius:10px; font-weight:800; font-size:13px; text-decoration:none; cursor:pointer; border:1px solid #111; }.primary { background:#111; color:#fff; }.secondary { background:#fff; color:#111; border-color:#ddd; }.small { min-height:34px; padding:0 11px; font-size:12px; }.full { width:100%; margin-top:16px; }.primary:disabled,.secondary:disabled { opacity:.5; cursor:not-allowed; }
  .onboardingPanel{margin-bottom:20px}.completionBadge{display:inline-flex;padding:7px 11px;border-radius:999px;background:#111;color:#fff;font-size:11px;font-weight:800}.progressTrack{height:10px;background:#ececec;border-radius:999px;overflow:hidden}.progressFill{height:100%;background:#111;border-radius:999px;transition:width .3s}.progressMeta{display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#777}.nextStepBanner{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-top:16px;padding:14px;border:1px solid #e3e3e3;border-radius:13px;background:#fafafa}.nextStepBanner div{display:grid;gap:3px}.nextStepBanner small{font-size:9px;letter-spacing:1px;font-weight:900;color:#888}.nextStepBanner b{font-size:13px}.nextStepBanner span{font-size:10px;color:#777}.nextStepBanner.complete{background:#f5f8f5;border-color:#dce7dd}.onboardingSteps{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:18px}.onboardingStep{display:flex;align-items:center;gap:10px;border:1px solid #e5e5e5;border-radius:12px;padding:12px}.onboardingStep.done{background:#fafafa}.stepIcon{width:28px;height:28px;border-radius:50%;background:#eee;display:flex;align-items:center;justify-content:center;font-weight:900}.onboardingStep.done .stepIcon{background:#111;color:#fff}.stepBody{min-width:0;flex:1}.stepBody b,.stepBody span{display:block}.stepBody b{font-size:12px}.stepBody span{font-size:10px;color:#777;margin-top:3px}.stepStatus{font-size:9px;font-weight:900;color:#666}.stats { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; margin-bottom:20px; }.stat,.panel { background:#fff; border:1px solid #e5e5e5; border-radius:16px; }.stat { padding:18px; min-height:120px; }.stat span,.stat small { display:block; color:#777; font-size:11px; }.stat strong { display:block; font-size:28px; margin:9px 0 5px; letter-spacing:-1px; }.panel { padding:22px; margin-bottom:20px; }.grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }.panelTitle { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:18px; }.panelTitle b { font-size:16px; }.rankBox { display:grid; grid-template-columns:1fr 45px 1fr; align-items:center; padding:18px; border-radius:14px; background:#f7f7f7; margin-bottom:14px; }.rankBox small { display:block; color:#777; font-size:11px; }.rankBox strong { display:block; font-size:30px; margin-top:4px; }.arrow { text-align:center; font-size:25px; }.row { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #eee; font-size:13px; }.notice { background:#f7f7f7; border-radius:12px; padding:13px; margin-top:14px; font-size:13px; }.notice p { margin:5px 0 0; color:#666; }.summary { display:grid; gap:16px; }.summary small { display:block; color:#777; font-size:10px; text-transform:uppercase; letter-spacing:.6px; margin-bottom:4px; }.summary b { font-size:14px; }.summary p { margin:4px 0 0; color:#777; font-size:12px; }.analyticsPanel { margin-top:0; }.liveData { background:#111; color:#fff; }.analyticsGrid { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:12px; }.analyticsItem { padding:16px; border:1px solid #e8e8e8; border-radius:14px; background:#fafafa; }.analyticsItem span { display:block; color:#777; font-size:11px; }.analyticsItem strong { display:block; font-size:24px; margin-top:7px; }
  .alert { border-color:#f0caca; background:#fffafa; }.tableWrap { overflow:auto; } table { width:100%; border-collapse:collapse; font-size:13px; } th,td { text-align:left; padding:12px 10px; border-bottom:1px solid #eee; white-space:nowrap; } th { color:#777; font-size:10px; text-transform:uppercase; letter-spacing:.6px; }.footer { text-align:center; color:#888; font-size:12px; padding:10px 0 35px; }
  .backdrop { position:fixed; inset:0; background:rgba(0,0,0,.48); display:flex; align-items:center; justify-content:center; padding:20px; z-index:1000; }.modal { width:min(780px,100%); max-height:92vh; overflow:auto; background:#fff; border-radius:20px; padding:25px; box-shadow:0 25px 80px rgba(0,0,0,.22); }.modalHead { display:flex; justify-content:space-between; gap:20px; margin-bottom:22px; }.modalHead h2 { margin:5px 0; font-size:24px; }.close { border:0; background:#f2f2f2; width:36px; height:36px; border-radius:10px; font-size:22px; cursor:pointer; }.formGrid { display:grid; grid-template-columns:1fr 1fr; gap:15px; }.formGrid label,.hoursGrid label { display:grid; gap:7px; min-width:0; }.formGrid label > span,.hoursGrid label > span { font-size:12px; font-weight:700; color:#555; }.formGrid input,.formGrid select,.formGrid textarea,.hoursGrid input { width:100%; border:1px solid #ddd; border-radius:10px; padding:11px 12px; font:inherit; background:#fff; outline:none; }.formGrid textarea { resize:vertical; }.formGrid input:focus,.formGrid select:focus,.formGrid textarea:focus,.hoursGrid input:focus { border-color:#111; }.formGrid small { color:#777; font-size:11px; }.fullField { grid-column:1/-1; }.logoPreview { width:96px; height:96px; object-fit:cover; border-radius:12px; margin-top:3px; }.coverPreview { width:100%; height:120px; object-fit:cover; border-radius:12px; margin-top:3px; }.hours { margin-top:22px; padding-top:20px; border-top:1px solid #eee; }.hours > p { font-size:12px; margin:5px 0 14px; }.hoursGrid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }.profileMessage { margin-top:18px; padding:11px 13px; border-radius:10px; font-size:13px; font-weight:600; }.profileMessage.success { background:#edf9f1; border:1px solid #ccebd6; }.profileMessage.error { background:#fff1f1; border:1px solid #f0caca; }.modalActions { display:flex; justify-content:flex-end; gap:10px; margin-top:22px; padding-top:18px; border-top:1px solid #eee; } @media(max-width:760px){.nextStepBanner{align-items:flex-start;flex-direction:column}.nextStepBanner .primary{width:100%}}
  @media(max-width:1050px){.stats{grid-template-columns:repeat(3,minmax(0,1fr));}.analyticsGrid{grid-template-columns:repeat(3,minmax(0,1fr));}}
  @media(max-width:750px){.nav{padding:0 4%;}.navRight .pill,.navRight .text{display:none;}.shell{padding-top:25px;}.heading{align-items:flex-start; flex-direction:column;}.heading h1{font-size:30px;}.grid{grid-template-columns:1fr;}.stats{grid-template-columns:repeat(2,minmax(0,1fr));}.analyticsGrid{grid-template-columns:repeat(2,minmax(0,1fr));}.formGrid,.hoursGrid{grid-template-columns:1fr;}.fullField{grid-column:auto;}.modal{max-height:94vh; border-radius:18px 18px 0 0;}.backdrop{align-items:flex-end;padding:10px;}.modalActions{position:sticky;bottom:-20px;background:#fff;padding-bottom:20px;}}
`;