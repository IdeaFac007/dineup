"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function RestaurantDashboard() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [rank, setRank] = useState(0);
  const [nextRank, setNextRank] = useState<number | null>(null);
  const [nextBid, setNextBid] = useState<number | null>(null);
  const [bids, setBids] = useState<any[]>([]);
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
    cover_image_url: "", logo_image_url: "",
    opening_hours: { monday: "10:00 AM - 10:00 PM", tuesday: "10:00 AM - 10:00 PM", wednesday: "10:00 AM - 10:00 PM", thursday: "10:00 AM - 10:00 PM", friday: "10:00 AM - 10:00 PM", saturday: "10:00 AM - 10:00 PM", sunday: "10:00 AM - 10:00 PM" },
  });
  const currentBid = restaurant?.current_bid || 0;
  const formatMoney = (value: number) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  async function uploadProfileImage(kind: "logo" | "cover", file: File) {
    if (!restaurant) return;
    if (!file.type.startsWith("image/")) return setProfileMessage("Please select an image file.");
    if (file.size > 5 * 1024 * 1024) return setProfileMessage("Image must be 5 MB or smaller.");
    setUploadingImage(kind); setProfileMessage("");
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
      const filePath = `${restaurant.id}/${kind}-${Date.now()}.${safeExtension}`;
      const { error } = await supabase.storage.from("restaurant-media").upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("restaurant-media").getPublicUrl(filePath);
      setProfileForm((p: any) => ({ ...p, [kind === "logo" ? "logo_image_url" : "cover_image_url"]: data.publicUrl }));
      setProfileMessage(kind === "logo" ? "Logo uploaded. Click Save profile." : "Cover image uploaded. Click Save profile.");
    } catch (e: any) { setProfileMessage(e?.message || "Unable to upload image right now."); }
    finally { setUploadingImage(null); }
  }

  async function saveProfile() {
    if (!restaurant) return;
    setProfileSaving(true); setProfileMessage("");
    try {
      const payload = { restaurant_id: restaurant.id, phone: profileForm.phone.trim() || null, whatsapp: profileForm.whatsapp.trim() || null, website_url: profileForm.website_url.trim() || null, description: profileForm.description.trim() || null, price_range: profileForm.price_range || null, menu_url: profileForm.menu_url.trim() || null, cover_image_url: profileForm.cover_image_url.trim() || null, logo_image_url: profileForm.logo_image_url.trim() || null, opening_hours: profileForm.opening_hours, updated_at: new Date().toISOString() };
      const { error } = await supabase.from("restaurant_profiles").upsert(payload, { onConflict: "restaurant_id" });
      if (error) throw error;
      setProfileMessage("Profile saved successfully.");
      setProfileOpen(false);
      await loadDashboard(true);
    } catch (e: any) { setProfileMessage(e?.message || "Unable to save profile right now."); }
    finally { setProfileSaving(false); }
  }

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true); setMessage("");
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { router.push("/restaurant/login"); return; }
      const { data: myRestaurant, error: restaurantError } = await supabase.from("restaurants").select("id, name, city, category, address, current_bid, is_active").eq("owner_id", user.id).eq("is_active", true).limit(1).maybeSingle();
      if (restaurantError) throw restaurantError;
      if (!myRestaurant) throw new Error("No active restaurant is linked to this account.");
      const r = { ...myRestaurant, id: Number(myRestaurant.id), current_bid: Number(myRestaurant.current_bid || 0) }; setRestaurant(r);
      const { data: p } = await supabase.from("restaurant_profiles").select("phone, whatsapp, website_url, description, price_range, menu_url, cover_image_url, logo_image_url, opening_hours").eq("restaurant_id", r.id).maybeSingle();
      if (p) setProfileForm((prev: any) => ({ ...prev, ...p, opening_hours: { ...prev.opening_hours, ...(p.opening_hours || {}) } }));
      const { data: restaurants, error: leaderboardError } = await supabase.from("restaurants").select("id, name, current_bid").eq("is_active", true).eq("city", r.city).order("current_bid", { ascending: false });
      if (leaderboardError) throw leaderboardError;
      const lb = (restaurants || []).map((x: any) => ({ ...x, id: Number(x.id), current_bid: Number(x.current_bid || 0) })); const idx = lb.findIndex((x: any) => x.id === r.id);
      if (idx >= 0) { setRank(idx + 1); if (idx > 0) { setNextRank(idx); setNextBid(lb[idx - 1].current_bid); } else { setNextRank(null); setNextBid(null); } }
      const { data: bidData } = await supabase.from("bids").select("id, amount, status, payment_status, razorpay_order_id, razorpay_payment_id, created_at").eq("restaurant_id", r.id).order("created_at", { ascending: false }).limit(20);
      setBids((bidData || []).map((x: any) => ({ ...x, id: Number(x.id), amount: Number(x.amount || 0) })));
    } catch (e: any) { setMessage(e?.message || "Unable to load dashboard."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [router, supabase]);

  useEffect(() => { loadDashboard(); const refresh = () => loadDashboard(true); window.addEventListener("focus", refresh); window.addEventListener("pageshow", refresh); return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); }; }, [loadDashboard]);

  async function handleLogout() { setLoggingOut(true); const { error } = await supabase.auth.signOut(); if (error) { setMessage(error.message); setLoggingOut(false); return; } router.push("/restaurant/login"); router.refresh(); }
  if (loading) return <main className="page"><style jsx>{styles}</style><div className="shell"><div className="panel"><div className="eyebrow">RESTAURANT DASHBOARD</div><h1>Loading dashboard...</h1><p className="muted">Fetching your live restaurant performance.</p></div></div></main>;
  if (!restaurant) return <main className="page"><style jsx>{styles}</style><div className="shell"><div className="panel"><div className="eyebrow">DASHBOARD ERROR</div><h1>Unable to load dashboard.</h1><p className="muted">{message}</p><Link href="/restaurant/login" className="primary">Back to login →</Link></div></div></main>;
  const paidBids = bids.filter((b: any) => b.payment_status === "captured");

  return <main className="page"><style jsx>{styles}</style>
    <header className="nav"><Link href="/" className="brand">Dine<span>Up</span></Link><div className="navRight"><span className="pill">Restaurant Partner</span><Link href="/" className="text">Marketplace</Link><button className="secondary" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? "Logging out..." : "Logout"}</button></div></header>
    <div className="shell">
      <div className="heading"><div><div className="eyebrow">RESTAURANT DASHBOARD</div><h1>{restaurant.name}</h1><p className="muted">{restaurant.city} • {restaurant.category}{restaurant.address ? ` • ${restaurant.address}` : ""}</p></div><div className="actions"><button className="secondary" onClick={() => loadDashboard(true)} disabled={refreshing}>{refreshing ? "Refreshing..." : "↻ Refresh"}</button><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary">Increase visibility ↑</Link></div></div>
      {message && <div className="panel"><p className="muted">{message}</p></div>}
      <div className="stats"><div className="stat"><span>Current rank</span><strong>{rank ? `#${rank}` : "—"}</strong><small>in {restaurant.city}</small></div><div className="stat"><span>Current bid</span><strong>{formatMoney(currentBid)}</strong><small>live marketplace bid</small></div><div className="stat"><span>Paid bids</span><strong>{paidBids.length}</strong><small>successful payments</small></div><div className="stat"><span>Bid attempts</span><strong>{bids.length}</strong><small>recent bidding activity</small></div></div>
      <div className="grid">
        <section className="panel"><div className="panelTitle"><b>Live campaign</b><span className="status">ACTIVE</span></div><div className="rankBox"><div><small>Your position</small><strong>{rank ? `#${rank}` : "—"}</strong></div><div className="arrow">↑</div><div><small>{nextRank ? "Next position" : "Marketplace leader"}</small><strong>{nextRank ? `#${nextRank}` : "TOP"}</strong></div></div><div className="row"><span>Current bid</span><b>{formatMoney(currentBid)}</b></div><div className="row"><span>{nextBid ? `Bid to reach #${nextRank}` : "You are #1"}</span><b>{nextBid ? formatMoney(nextBid + 1) : "—"}</b></div>{nextBid && <div className="notice"><b>You are one bid away</b><p>Bid <b>{formatMoney(nextBid + 1)}</b> or more to move to #{nextRank}.</p></div>}<Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary full">Increase visibility ↑</Link></section>
        <section className="panel"><div className="panelTitle"><b>Restaurant profile</b><div className="titleActions"><span className="status">LIVE</span><button className="secondary small" onClick={() => { setProfileMessage(""); setProfileOpen(true); }}>Edit profile</button></div></div><div className="summary"><div><small>Restaurant</small><b>{restaurant.name}</b></div><div><small>Location</small><b>{restaurant.city}</b>{restaurant.address && <p>{restaurant.address}</p>}</div><div><small>Category</small><b>{restaurant.category}</b></div></div><div className="actions"><Link href="/" className="secondary">View marketplace</Link><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary">Promote restaurant</Link></div></section>
      </div>
      {profileOpen && <div className="backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !profileSaving && !uploadingImage) setProfileOpen(false); }}><div className="modal"><div className="modalHead"><div><small className="muted">Restaurant partner</small><h2>Edit restaurant profile</h2><p className="muted">Update the information customers see on your DineUp listing.</p></div><button className="close" onClick={() => !profileSaving && !uploadingImage && setProfileOpen(false)}>×</button></div><div className="formGrid">
        <label><span>Phone</span><input value={profileForm.phone} onChange={(e) => setProfileForm((p: any) => ({ ...p, phone: e.target.value }))} placeholder="Restaurant phone" /></label><label><span>WhatsApp</span><input value={profileForm.whatsapp} onChange={(e) => setProfileForm((p: any) => ({ ...p, whatsapp: e.target.value }))} placeholder="WhatsApp number" /></label><label><span>Website</span><input value={profileForm.website_url} onChange={(e) => setProfileForm((p: any) => ({ ...p, website_url: e.target.value }))} placeholder="https://example.com" /></label><label><span>Menu URL</span><input value={profileForm.menu_url} onChange={(e) => setProfileForm((p: any) => ({ ...p, menu_url: e.target.value }))} placeholder="Link to your menu" /></label><label><span>Price range</span><select value={profileForm.price_range} onChange={(e) => setProfileForm((p: any) => ({ ...p, price_range: e.target.value }))}><option value="">Select</option><option value="₹">₹ — Budget</option><option value="₹₹">₹₹ — Moderate</option><option value="₹₹₹">₹₹₹ — Premium</option><option value="₹₹₹₹">₹₹₹₹ — Luxury</option></select></label><label><span>Logo image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadProfileImage("logo", f); }} disabled={uploadingImage !== null} /><small>JPG, PNG or WebP • max 5 MB</small>{profileForm.logo_image_url && <img src={profileForm.logo_image_url} alt="Logo preview" className="logoPreview" />}</label><label><span>Cover image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadProfileImage("cover", f); }} disabled={uploadingImage !== null} /><small>Wide restaurant photo • max 5 MB</small>{profileForm.cover_image_url && <img src={profileForm.cover_image_url} alt="Cover preview" className="coverPreview" />}</label><label className="fullField"><span>Description</span><textarea value={profileForm.description} onChange={(e) => setProfileForm((p: any) => ({ ...p, description: e.target.value }))} rows={4} maxLength={500} placeholder="Tell customers what makes your restaurant special..." /><small>{profileForm.description.length}/500</small></label>
      </div><div className="hours"><b>Opening hours</b><p className="muted">Set the hours customers should see on your listing.</p><div className="hoursGrid">{[['monday','Monday'],['tuesday','Tuesday'],['wednesday','Wednesday'],['thursday','Thursday'],['friday','Friday'],['saturday','Saturday'],['sunday','Sunday']].map(([key,label]) => <label key={key}><span>{label}</span><input value={profileForm.opening_hours[key] || ""} onChange={(e) => setProfileForm((p: any) => ({ ...p, opening_hours: { ...p.opening_hours, [key]: e.target.value } }))} /></label>)}</div></div>{profileMessage && <div className={`profileMessage ${profileMessage.includes("successfully") ? "success" : "error"}`}>{profileMessage}</div>}<div className="modalActions"><button className="secondary" onClick={() => setProfileOpen(false)} disabled={profileSaving || !!uploadingImage}>Cancel</button><button className="primary" onClick={saveProfile} disabled={profileSaving || !!uploadingImage}>{profileSaving ? "Saving..." : uploadingImage ? "Uploading..." : "Save profile"}</button></div></div></div>}
      <section className="panel table"><div className="panelTitle"><b>Bid history</b><span className="muted">{bids.length} records</span></div>{bids.length === 0 ? <div className="empty"><b>No bids yet</b><p className="muted">Your bidding activity will appear here.</p></div> : <div className="scroll"><div className="tableRow header"><span>Date</span><span>Bid</span><span>Status</span><span>Payment</span></div>{bids.map((b: any) => <div className="tableRow" key={b.id}><span>{formatDate(b.created_at)}</span><b>{formatMoney(b.amount)}</b><span>{b.status === "active" ? <span className="status">ACTIVE</span> : b.status}</span><span>{b.payment_status === "captured" ? <span className="status">PAID</span> : b.payment_status}</span></div>)}</div>}</section>
      <section className="panel table"><div className="panelTitle"><b>Payment history</b><span className="muted">{paidBids.length} successful</span></div>{paidBids.length === 0 ? <div className="empty"><b>No successful payments yet</b></div> : <div className="scroll"><div className="tableRow header"><span>Date</span><span>Amount</span><span>Payment ID</span><span>Status</span></div>{paidBids.map((b: any) => <div className="tableRow" key={b.id}><span>{formatDate(b.created_at)}</span><b>{formatMoney(b.amount)}</b><span className="paymentId">{b.razorpay_payment_id || "—"}</span><span className="status">CAPTURED</span></div>)}</div>}</section>
      <section className="panel"><div className="panelTitle"><b>Quick actions</b></div><div className="quick"><Link href={`/restaurant/bid?id=${restaurant.id}`} className="primary">Increase visibility ↑</Link><Link href="/" className="secondary">View marketplace</Link><button className="secondary" onClick={() => loadDashboard(true)}>{refreshing ? "Refreshing..." : "Refresh dashboard"}</button></div></section>
      <div className="footer"><span>DineUp • Where Restaurants Rise</span></div>
    </div>
  </main>;
}

const styles = `
.page{min-height:100vh;background:#f6f6f4;color:#111}.nav{height:72px;background:#fff;border-bottom:1px solid #ececec;display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:20}.brand{font-weight:900;font-size:22px;text-decoration:none;color:#111}.brand span{color:#ef7d1a}.navRight,.actions,.titleActions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.pill{font-size:12px;font-weight:700;background:#f2f2f2;border-radius:999px;padding:7px 11px}.text{color:#111;text-decoration:none;font-size:13px;font-weight:700}.shell{max-width:1120px;margin:0 auto;padding:32px 20px 50px}.heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:22px}.eyebrow{font-size:11px;letter-spacing:.15em;font-weight:800;color:#777}.heading h1{font-size:34px;line-height:1.05;margin:8px 0}.muted{color:#707070}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:10px 14px;border-radius:10px;font:inherit;font-size:13px;font-weight:800;text-decoration:none;cursor:pointer;box-sizing:border-box}.primary{background:#111;color:#fff;border:1px solid #111}.secondary{background:#fff;color:#111;border:1px solid #d8d8d8}.small{min-height:34px;padding:7px 11px;font-size:12px}.full{width:100%}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}.stat,.panel{background:#fff;border:1px solid #e5e5e5;border-radius:18px}.stat{padding:18px}.stat span{font-size:12px;color:#666}.stat strong{display:block;font-size:30px;margin-top:8px}.stat small{display:block;color:#777;margin-top:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.grid .panel{margin-top:0}.panel{padding:22px;margin-top:20px}.panelTitle{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px}.status{display:inline-flex;font-size:10px;font-weight:900;padding:6px 8px;border-radius:999px;background:#edf9f1;color:#1c7c3e}.rankBox{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:18px;border:1px solid #e9e9e9;background:#f8f8f8;border-radius:14px}.rankBox small{display:block;color:#777}.rankBox strong{display:block;font-size:25px;margin-top:4px}.arrow{text-align:center;font-size:25px}.row{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #efefef}.notice{margin:16px 0;padding:15px;border:1px solid #e6e6e6;background:#f8f8f8;border-radius:12px}.notice p{margin:6px 0 0}.summary{display:grid;gap:12px}.summary>div{padding:14px;border-radius:12px;background:#f8f8f8;border:1px solid #e6e6e6}.summary small{display:block;color:#777;margin-bottom:5px}.summary b{display:block}.summary p{margin:4px 0 0;font-size:13px}.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1000}.modal{width:min(820px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:26px;box-shadow:0 25px 80px rgba(0,0,0,.25);position:relative}.modalHead{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px}.modalHead h2{margin:5px 0;font-size:25px}.modalHead p{margin:0}.close{border:0;background:#f2f2f2;width:38px;height:38px;border-radius:10px;font-size:22px;cursor:pointer}.formGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.formGrid label,.hoursGrid label{display:grid;gap:7px}.formGrid label>span,.hoursGrid label>span{font-size:12px;font-weight:800;color:#555}.formGrid input,.formGrid select,.formGrid textarea,.hoursGrid input{width:100%;border:1px solid #ddd;border-radius:10px;padding:11px 12px;font:inherit;background:#fff;box-sizing:border-box}.fullField{grid-column:1/-1}.formGrid small{font-size:11px;color:#777}.logoPreview{width:74px;height:74px;object-fit:cover;border-radius:14px;border:1px solid #ddd}.coverPreview{width:100%;height:130px;object-fit:cover;border-radius:12px;border:1px solid #ddd}.hours{margin-top:22px;padding-top:20px;border-top:1px solid #eee}.hours p{margin:4px 0 14px;font-size:12px}.hoursGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.profileMessage{margin-top:18px;padding:11px 13px;border-radius:10px;font-size:13px;font-weight:700}.profileMessage.success{background:#edf9f1;border:1px solid #ccebd6}.profileMessage.error{background:#fff1f1;border:1px solid #f0caca}.modalActions{position:sticky;bottom:-26px;margin:22px -26px -26px;padding:16px 26px;background:rgba(255,255,255,.98);border-top:1px solid #e8e8e8;display:flex;justify-content:flex-end;gap:10px;z-index:5;box-shadow:0 -8px 18px rgba(0,0,0,.05)}.modalActions .primary,.modalActions .secondary{min-width:120px}.scroll{overflow-x:auto}.tableRow{display:grid;grid-template-columns:1.2fr .8fr 1fr 1fr;gap:14px;padding:12px 4px;border-top:1px solid #efefef;min-width:650px}.tableRow.header{border-top:0;color:#777;text-transform:uppercase;font-size:10px;font-weight:900}.paymentId{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.empty{text-align:center;padding:30px 10px}.empty p{margin:6px 0 0}.quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.quick>*{width:100%}.footer{text-align:center;padding:24px 0 10px;font-size:12px;color:#707070}
@media(max-width:800px){.nav{padding:0 16px}.navRight .pill,.navRight .text{display:none}.shell{padding:24px 14px 40px}.heading{flex-direction:column;align-items:stretch}.stats{grid-template-columns:1fr 1fr}.grid{grid-template-columns:1fr}.formGrid{grid-template-columns:1fr}.fullField{grid-column:auto}.hoursGrid{grid-template-columns:1fr}.modal{padding:18px}.modalHead h2{font-size:21px}.backdrop{padding:10px}.modalActions{bottom:-18px;margin-left:-18px;margin-right:-18px;margin-bottom:-18px;padding-left:18px;padding-right:18px}.modalActions>*{flex:1}}
@media(max-width:480px){.stats{grid-template-columns:1fr}.heading .actions>*{width:100%}.heading h1{font-size:28px}}
`;
