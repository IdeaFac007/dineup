"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

const emptyProfile = { phone: "", whatsapp: "", website_url: "", menu_url: "", description: "", price_range: "", cover_image_url: "", logo_image_url: "" };

export default function RestaurantProfileEditor() {
  const supabase = createClient();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMessage("Please log in to edit your restaurant profile."); setLoading(false); return; }
      const { data: r, error: re } = await supabase.from("restaurants").select("id,name,city,category,is_active").eq("owner_id", user.id).eq("is_active", true).limit(1).maybeSingle();
      if (re || !r) { setMessage(re?.message || "No active restaurant is linked to this account."); setLoading(false); return; }
      setRestaurant(r);
      const { data: p, error: pe } = await supabase.from("restaurant_profiles").select("phone,whatsapp,website_url,menu_url,description,price_range,cover_image_url,logo_image_url").eq("restaurant_id", Number(r.id)).maybeSingle();
      if (pe) setMessage(pe.message); else setForm({ ...emptyProfile, ...(p || {}) });
      setLoading(false);
    }
    load();
  }, [supabase]);

  const set = (key: string, value: string) => setForm((p: any) => ({ ...p, [key]: value }));

  async function upload(kind: "logo_image_url" | "cover_image_url", file?: File) {
    if (!restaurant || !file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setMessage("Please choose an image up to 5 MB."); return; }
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safe = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
    const path = `${Number(restaurant.id)}/${kind === "logo_image_url" ? "logo" : "cover"}-${Date.now()}.${safe}`;
    const { error } = await supabase.storage.from("restaurant-media").upload(path, file, { upsert: false, cacheControl: "3600", contentType: file.type });
    if (error) { setMessage(error.message); return; }
    const { data } = supabase.storage.from("restaurant-media").getPublicUrl(path);
    set(kind, data.publicUrl); setMessage("Image uploaded. Save the profile to publish it.");
  }

  async function save() {
    if (!restaurant) return;
    setSaving(true); setMessage("");
    const payload = {
      restaurant_id: Number(restaurant.id),
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      website_url: form.website_url.trim() || null,
      menu_url: form.menu_url.trim() || null,
      description: form.description.trim() || null,
      price_range: form.price_range || null,
      cover_image_url: form.cover_image_url.trim() || null,
      logo_image_url: form.logo_image_url.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("restaurant_profiles").upsert(payload, { onConflict: "restaurant_id" });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage("Profile saved successfully.");
  }

  if (loading) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="card"><p>Loading profile…</p></section></div></main>;
  if (!restaurant) return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="card"><h1>Profile editor</h1><p>{message}</p><Link href="/restaurant/login" className="button dark">Back to login</Link></section></div></main>;

  const field = (label: string, key: string, placeholder = "") => <label><span>{label}</span><input value={form[key] || ""} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} /></label>;

  return <main className="page"><style jsx>{styles}</style><header><Link href="/" className="brand">Dine<span>Up</span></Link><Link href="/restaurant/dashboard/growth" className="button">Growth Center</Link></header><div className="shell"><div className="heading"><div><div className="eyebrow">RESTAURANT PROFILE</div><h1>{restaurant.name}</h1><p>{restaurant.city} • {restaurant.category}</p></div><Link href="/restaurant/dashboard" className="button">← Dashboard</Link></div><section className="card"><h2>Complete your listing</h2><p className="muted">Add the missing information customers see on your DineUp profile.</p><div className="grid">{field("Phone", "phone", "Restaurant phone")}{field("WhatsApp", "whatsapp", "WhatsApp number")}{field("Website", "website_url", "https://example.com")}{field("Menu URL", "menu_url", "Link to your menu")}</div><label><span>Price range</span><select value={form.price_range || ""} onChange={(e) => set("price_range", e.target.value)}><option value="">Select price range</option><option value="₹ — Budget">₹ — Budget</option><option value="₹₹ — Moderate">₹₹ — Moderate</option><option value="₹₹₹ — Premium">₹₹₹ — Premium</option><option value="₹₹₹₹ — Luxury">₹₹₹₹ — Luxury</option></select></label><label><span>Description</span><textarea value={form.description || ""} onChange={(e) => set("description", e.target.value)} placeholder="Tell customers what makes your restaurant special…" /></label><div className="images"><label><span>Logo image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload("logo_image_url", e.target.files?.[0])} /><small>JPG, PNG or WebP • max 5 MB</small>{form.logo_image_url && <img src={form.logo_image_url} alt="Logo preview" className="logo" />}</label><label><span>Cover image</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => upload("cover_image_url", e.target.files?.[0])} /><small>Wide restaurant photo • max 5 MB</small>{form.cover_image_url && <img src={form.cover_image_url} alt="Cover preview" className="cover" />}</label></div>{message && <div className="message">{message}</div>}<div className="footer"><Link href="/restaurant/dashboard/growth" className="button">Cancel</Link><button className="button dark" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div></section></div></main>;
}

const styles = `*{box-sizing:border-box}.page{min-height:100vh;background:#f6f7f9;color:#171717;font-family:Arial,sans-serif}header{height:72px;background:#fff;border-bottom:1px solid #e6e7eb;display:flex;align-items:center;justify-content:space-between;padding:0 6vw}.brand{font-size:27px;font-weight:800;color:#111;text-decoration:none}.brand span{color:#ff5a1f}.shell{max-width:980px;margin:0 auto;padding:40px 20px 70px}.heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#777}.heading h1{font-size:38px;margin:8px 0}.heading p,.muted{color:#737780}.card{background:#fff;border:1px solid #e6e7eb;border-radius:16px;padding:24px;box-shadow:0 5px 18px rgba(0,0,0,.04)}h2{margin-top:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:block;margin-top:16px}label span{display:block;font-size:13px;font-weight:700;margin-bottom:7px}input,select,textarea{width:100%;border:1px solid #d9dce1;border-radius:10px;padding:12px;font:inherit;background:#fff}textarea{min-height:130px;resize:vertical}small{display:block;color:#777;margin-top:5px}.images{display:grid;grid-template-columns:1fr 1fr;gap:16px}.logo{display:block;width:90px;height:90px;object-fit:cover;border-radius:12px;margin-top:10px}.cover{display:block;width:100%;max-height:180px;object-fit:cover;border-radius:12px;margin-top:10px}.button{display:inline-block;border:1px solid #ddd;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:11px 15px;font-weight:700}.dark{background:#111;color:#fff;border-color:#111;cursor:pointer}.dark:disabled{opacity:.6}.message{margin-top:18px;padding:12px;border-radius:10px;background:#f3f4f6}.footer{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}@media(max-width:700px){.grid,.images{grid-template-columns:1fr}.heading{align-items:flex-start;flex-direction:column}}`;
