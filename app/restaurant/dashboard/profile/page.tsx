"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

const emptyProfile = { phone: "", whatsapp: "", website_url: "", menu_url: "", description: "", price_range: "", cover_image_url: "", logo_image_url: "", instagram_url: "", google_maps_url: "", cuisine_tags: "", owner_name: "", owner_designation: "" };

type Media = { id:number; media_type:"gallery"|"menu"; storage_path:string; public_url:string; title:string|null; caption:string|null; sort_order:number };
type VerificationDoc = { id:number; document_type:string; file_name:string; mime_type:string; file_size:number; status:"pending"|"approved"|"rejected"; admin_note:string|null; created_at:string };

export default function RestaurantProfileEditor() {
  const supabase = createClient();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyProfile);
  const [gallery, setGallery] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo"|"cover"|"menu"|"gallery"|null>(null);
  const [generating, setGenerating] = useState<"logo"|"cover"|null>(null);
  const [message, setMessage] = useState("");
  const [verificationDocs, setVerificationDocs] = useState<VerificationDoc[]>([]);
  const [verificationUploading, setVerificationUploading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMessage("Please log in to edit your restaurant profile."); setLoading(false); return; }
      const { data: r, error: re } = await supabase.from("restaurants").select("id,name,city,category,is_active").eq("owner_id", user.id).eq("is_active", true).limit(1).maybeSingle();
      if (re || !r) { setMessage(re?.message || "No active restaurant is linked to this account."); setLoading(false); return; }
      setRestaurant(r);
      const [{ data: p, error: pe }, { data: media, error: me }, { data: docs, error: de }] = await Promise.all([
        supabase.from("restaurant_profiles").select("phone,whatsapp,website_url,menu_url,description,price_range,cover_image_url,logo_image_url,instagram_url,google_maps_url,cuisine_tags,owner_name,owner_designation").eq("restaurant_id", Number(r.id)).maybeSingle(),
        supabase.from("restaurant_media").select("id,media_type,storage_path,public_url,title,caption,sort_order").eq("restaurant_id", Number(r.id)).eq("media_type","gallery").eq("is_active",true).order("sort_order",{ascending:true}).order("created_at",{ascending:true}),
        supabase.from("restaurant_verification_documents").select("id,document_type,file_name,mime_type,file_size,status,admin_note,created_at").eq("restaurant_id", Number(r.id)).order("created_at",{ascending:false})
      ]);
      if (pe) setMessage(pe.message); else setForm({ ...emptyProfile, ...(p || {}), cuisine_tags: Array.isArray(p?.cuisine_tags) ? p.cuisine_tags.join(", ") : (p?.cuisine_tags || "") });
      if (me) setMessage(me.message); else setGallery((media || []) as Media[]);
      if (de) setMessage(de.message); else setVerificationDocs((docs || []) as VerificationDoc[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const set = (key: string, value: string) => setForm((p: any) => ({ ...p, [key]: value }));

  function validateImage(file: File) {
    return ["image/jpeg","image/png","image/webp","image/gif"].includes(file.type) && file.size <= 10 * 1024 * 1024;
  }

  async function uploadProfileImage(kind: "logo_image_url" | "cover_image_url", file?: File) {
    if (!restaurant || !file) return;
    if (!validateImage(file)) { setMessage("Please choose JPG, PNG, WebP or GIF up to 10 MB."); return; }
    setUploading(kind === "logo_image_url" ? "logo" : "cover");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safe = ["jpg","jpeg","png","webp","gif"].includes(ext) ? ext : "jpg";
      const path = `${Number(restaurant.id)}/${kind === "logo_image_url" ? "logo" : "cover"}-${Date.now()}.${safe}`;
      const { error } = await supabase.storage.from("restaurant-media").upload(path, file, { upsert:false, cacheControl:"3600", contentType:file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("restaurant-media").getPublicUrl(path);
      set(kind, data.publicUrl);
      setMessage(`${kind === "logo_image_url" ? "Logo" : "Cover"} uploaded. Save the profile to publish it.`);
    } catch (e:any) { setMessage(e?.message || "Upload failed."); } finally { setUploading(null); }
  }

  async function uploadMenu(file?: File) {
    if (!restaurant || !file) return;
    if (!["application/pdf","image/jpeg","image/png","image/webp","image/gif"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage("Menu must be PDF/JPG/PNG/WebP/GIF and up to 10 MB."); return;
    }
    setUploading("menu");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const safe = ["pdf","jpg","jpeg","png","webp","gif"].includes(ext) ? ext : "pdf";
      const path = `${Number(restaurant.id)}/menu-${Date.now()}.${safe}`;
      const { error } = await supabase.storage.from("restaurant-media").upload(path, file, { upsert:false, cacheControl:"3600", contentType:file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("restaurant-media").getPublicUrl(path);
      set("menu_url", data.publicUrl);
      setMessage("Menu uploaded. Save the profile to publish it.");
    } catch (e:any) { setMessage(e?.message || "Menu upload failed."); } finally { setUploading(null); }
  }

  async function uploadVerificationDoc(file: File | undefined, documentType: string) {
    if (!restaurant || !file) return;
    const allowed = ["application/pdf","image/jpeg","image/png","image/webp"];
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage("Verification document must be PDF/JPG/PNG/WebP and up to 10 MB.");
      return;
    }
    setVerificationUploading(true); setMessage("");
    const safeType = documentType || "other";
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const safeExt = ["pdf","jpg","jpeg","png","webp"].includes(ext) ? ext : "pdf";
      const path = String(restaurant.id) + "/" + crypto.randomUUID() + "-" + safeType + "." + safeExt;
      const { error: uploadError } = await supabase.storage.from("restaurant-verification-docs").upload(path, file, {
        upsert:false, cacheControl:"3600", contentType:file.type
      });
      if (uploadError) throw uploadError;
      const { data: authData } = await supabase.auth.getUser();
      const { data: row, error: rowError } = await supabase.from("restaurant_verification_documents").insert({
        restaurant_id:Number(restaurant.id), user_id:authData.user?.id,
        document_type:safeType, storage_path:path, file_name:file.name, mime_type:file.type, file_size:file.size, status:"pending"
      }).select("id,document_type,file_name,mime_type,file_size,status,admin_note,created_at").single();
      if (rowError) {
        await supabase.storage.from("restaurant-verification-docs").remove([path]);
        throw rowError;
      }
      setVerificationDocs(items => [row as VerificationDoc, ...items]);
      setMessage("Verification document submitted. DineUp will review it.");
    } catch (e:any) {
      setMessage(e?.message || "Verification document upload failed.");
    } finally { setVerificationUploading(false); }
  }

  async function uploadGallery(file?: File) {
    if (!restaurant || !file) return;
    if (!validateImage(file)) { setMessage("Gallery images must be JPG, PNG, WebP or GIF up to 10 MB."); return; }
    setUploading("gallery");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safe = ["jpg","jpeg","png","webp","gif"].includes(ext) ? ext : "jpg";
      const path = `${Number(restaurant.id)}/gallery-${Date.now()}.${safe}`;
      const { error } = await supabase.storage.from("restaurant-media").upload(path, file, { upsert:false, cacheControl:"3600", contentType:file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("restaurant-media").getPublicUrl(path);
      const { data: row, error: re } = await supabase.from("restaurant_media").insert({
        restaurant_id:Number(restaurant.id), media_type:"gallery", storage_path:path, public_url:data.publicUrl,
        title:file.name.replace(/\.[^.]+$/,""), sort_order:gallery.length
      }).select("id,media_type,storage_path,public_url,title,caption,sort_order").single();
      if (re) throw re;
      setGallery((items) => [...items, row as Media]);
      setMessage("Gallery image added.");
    } catch (e:any) { setMessage(e?.message || "Gallery upload failed."); } finally { setUploading(null); }
  }

  async function deleteGallery(item: Media) {
    if (!restaurant) return;
    try {
      const { error: re } = await supabase.from("restaurant_media").delete().eq("id",item.id).eq("restaurant_id",Number(restaurant.id));
      if (re) throw re;
      await supabase.storage.from("restaurant-media").remove([item.storage_path]);
      setGallery((items) => items.filter((x) => x.id !== item.id));
      setMessage("Gallery image removed.");
    } catch (e:any) { setMessage(e?.message || "Could not remove image."); }
  }

  function escapeXml(value: string) {
    return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
  }

  async function generateImage(kind: "logo"|"cover") {
    if (!restaurant || generating) return;
    setGenerating(kind); setMessage("");
    try {
      const name=escapeXml(String(restaurant.name||"Restaurant")), city=escapeXml(String(restaurant.city||"India")), category=escapeXml(String(restaurant.category||"Restaurant"));
      const initials=String(restaurant.name||"R").split(/\s+/).filter(Boolean).slice(0,3).map((part:string)=>part[0]).join("").toUpperCase();
      const svg=kind==="logo"
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" rx="120" fill="#111111"/><circle cx="400" cy="315" r="175" fill="#ff6a00"/><text x="400" y="370" text-anchor="middle" font-family="Arial,sans-serif" font-size="150" font-weight="800" fill="#ffffff">${escapeXml(initials)}</text><text x="400" y="590" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="700" fill="#ffffff">${name}</text><text x="400" y="650" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#cccccc">${city}</text></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600" viewBox="0 0 1600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111111"/><stop offset="1" stop-color="#ff6a00"/></linearGradient></defs><rect width="1600" height="600" fill="url(#g)"/><circle cx="1300" cy="120" r="260" fill="#ffffff" opacity=".08"/><circle cx="1450" cy="480" r="320" fill="#ffffff" opacity=".06"/><text x="110" y="225" font-family="Arial,sans-serif" font-size="72" font-weight="800" fill="#ffffff">${name}</text><text x="110" y="305" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#ffffff">${category}</text><text x="110" y="365" font-family="Arial,sans-serif" font-size="30" fill="#f3f3f3">${city}</text><text x="110" y="475" font-family="Arial,sans-serif" font-size="22" letter-spacing="4" fill="#ffffff">DINEUP RESTAURANT PROFILE</text></svg>`;
      const blob=new Blob([svg],{type:"image/svg+xml"});
      const path=`${Number(restaurant.id)}/auto-${kind}-${Date.now()}.svg`;
      const {error}=await supabase.storage.from("restaurant-media").upload(path,blob,{upsert:false,cacheControl:"3600",contentType:"image/svg+xml"});
      if(error)throw error;
      const {data}=supabase.storage.from("restaurant-media").getPublicUrl(path);
      set(kind==="logo"?"logo_image_url":"cover_image_url",data.publicUrl);
      setMessage(`${kind==="logo"?"Logo":"Cover"} generated by DineUp. Save the profile to publish it.`);
    } catch(e:any){setMessage(e?.message||"Could not generate the image.");} finally{setGenerating(null);}
  }

  async function save() {
    if (!restaurant) return;
    setSaving(true); setMessage("");
    const payload={
      restaurant_id:Number(restaurant.id), phone:form.phone.trim()||null, whatsapp:form.whatsapp.trim()||null,
      website_url:form.website_url.trim()||null, menu_url:form.menu_url.trim()||null, description:form.description.trim()||null,
      price_range:form.price_range||null, instagram_url:form.instagram_url.trim()||null, google_maps_url:form.google_maps_url.trim()||null,
      cuisine_tags:form.cuisine_tags.split(",").map((x:string)=>x.trim()).filter(Boolean), owner_name:form.owner_name.trim()||null,
      owner_designation:form.owner_designation.trim()||null, cover_image_url:form.cover_image_url.trim()||null,
      logo_image_url:form.logo_image_url.trim()||null, updated_at:new Date().toISOString()
    };
    const {error}=await supabase.from("restaurant_profiles").upsert(payload,{onConflict:"restaurant_id"});
    if(error){setSaving(false);setMessage(error.message);return;}
    const {data:completion,error:ce}=await supabase.rpc("update_restaurant_profile_completion",{p_restaurant_id:Number(restaurant.id)});
    setSaving(false);
    if(ce){setMessage("Profile saved, but completion could not be refreshed.");return;}
    setMessage(`Profile saved successfully. Completion: ${completion ?? "—"}%.`);
  }

  if(loading)return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="card"><p>Loading profile…</p></section></div></main>;
  if(!restaurant)return <main className="page"><style jsx>{styles}</style><div className="shell"><section className="card"><h1>Profile editor</h1><p>{message}</p><Link href="/restaurant/login" className="button dark">Back to login</Link></section></div></main>;

  const field=(label:string,key:string,placeholder="")=><label><span>{label}</span><input value={form[key]||""} onChange={(e)=>set(key,e.target.value)} placeholder={placeholder}/></label>;

  return <main className="page"><style jsx>{styles}</style><header><Link href="/" className="brand">Dine<span>Up</span></Link><Link href="/restaurant/dashboard/growth" className="button">Growth Center</Link></header>
  <div className="shell"><div className="heading"><div><div className="eyebrow">RESTAURANT PROFILE</div><h1>{restaurant.name}</h1><p>{restaurant.city} • {restaurant.category}</p></div><Link href="/restaurant/dashboard" className="button">← Dashboard</Link></div>
  <section className="card"><h2>Complete your listing</h2><p className="muted">Add the information customers see on your DineUp profile.</p>
  <div className="grid">{field("Phone","phone","Restaurant phone")}{field("WhatsApp","whatsapp","WhatsApp number")}{field("Website","website_url","https://example.com")}{field("Menu URL","menu_url","Link to your menu")}{field("Instagram","instagram_url","Instagram profile URL")}{field("Google Maps","google_maps_url","Google Maps URL")}{field("Owner name","owner_name","Owner / manager name")}{field("Designation","owner_designation","Owner / manager designation")}</div>
  <label><span>Cuisine tags</span><input value={form.cuisine_tags||""} onChange={(e)=>set("cuisine_tags",e.target.value)} placeholder="Mughlai, North Indian, Chinese"/><small>Separate cuisines with commas.</small></label>
  <label><span>Price range</span><select value={form.price_range||""} onChange={(e)=>set("price_range",e.target.value)}><option value="">Select price range</option><option value="₹">₹ — Budget</option><option value="₹₹">₹₹ — Moderate</option><option value="₹₹₹">₹₹₹ — Premium</option><option value="₹₹₹₹">₹₹₹₹ — Luxury</option></select></label>
  <label><span>Description</span><textarea value={form.description||""} onChange={(e)=>set("description",e.target.value)} placeholder="Tell customers what makes your restaurant special…"/></label>

  <div className="mediaSection"><h3>Logo & Cover</h3><p className="muted">Public restaurant branding. Owners can upload or generate these assets.</p><div className="images">
  <label><span>Logo image</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e)=>uploadProfileImage("logo_image_url",e.target.files?.[0])}/><small>JPG, PNG, WebP or GIF • max 10 MB</small>{form.logo_image_url?<img src={form.logo_image_url} alt="Logo preview" className="logo"/>:<button type="button" className="generate" onClick={()=>generateImage("logo")} disabled={generating!==null||uploading!==null}>{generating==="logo"?"Creating logo…":"✨ Generate with DineUp"}</button>}</label>
  <label><span>Cover image</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e)=>uploadProfileImage("cover_image_url",e.target.files?.[0])}/><small>Wide restaurant photo • max 10 MB</small>{form.cover_image_url?<img src={form.cover_image_url} alt="Cover preview" className="cover"/>:<button type="button" className="generate" onClick={()=>generateImage("cover")} disabled={generating!==null||uploading!==null}>{generating==="cover"?"Creating cover…":"✨ Generate with DineUp"}</button>}</label>
  </div></div>

  <div className="mediaSection"><h3>Restaurant verification</h3><p className="muted">Upload a business, GST, FSSAI or ownership document. These files are private and visible only to your account and DineUp admins.</p>
  <div className="verificationGrid">
    {[["business_license","Business license"],["gst","GST certificate"],["fssai","FSSAI certificate"],["ownership_proof","Ownership proof"]].map(([value,label])=><label key={value}><span>{label}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e)=>uploadVerificationDoc(e.target.files?.[0],value)} disabled={verificationUploading}/></label>)}
  </div>
  {verificationDocs.length===0?<div className="empty">No verification documents submitted yet.</div>:<div className="verificationList">{verificationDocs.map(doc=><div className="verificationItem" key={doc.id}><div><strong>{doc.file_name}</strong><small>{doc.document_type.replaceAll("_"," ")} · {(doc.file_size/1024/1024).toFixed(2)} MB · {new Date(doc.created_at).toLocaleDateString("en-IN")}</small>{doc.admin_note&&<small>Admin note: {doc.admin_note}</small>}</div><span className={"verificationStatus "+doc.status}>{doc.status}</span></div>)}</div>}
  </div>

  <div className="mediaSection"><h3>Menu</h3><p className="muted">Upload a menu PDF or image. Customers will see it on your public profile.</p><div className="menuRow"><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" onChange={(e)=>uploadMenu(e.target.files?.[0])}/><small>PDF/JPG/PNG/WebP/GIF • max 10 MB</small>{form.menu_url&&<a className="button" href={form.menu_url} target="_blank" rel="noreferrer">Open current menu</a>}</div></div>

  <div className="mediaSection"><div className="sectionHead"><div><h3>Media gallery</h3><p className="muted">Add restaurant photos customers can browse.</p></div><label className="uploadButton"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e)=>uploadGallery(e.target.files?.[0])} disabled={uploading!==null}/>{uploading==="gallery"?"Uploading…":"＋ Add photo"}</label></div>
  {gallery.length===0?<div className="empty">No gallery photos yet.</div>:<div className="gallery">{gallery.map(item=><div className="galleryItem" key={item.id}><img src={item.public_url} alt={item.title||"Restaurant photo"}/><button type="button" className="remove" onClick={()=>deleteGallery(item)}>Remove</button></div>)}</div>}</div>

  {message&&<div className="message">{message}</div>}<div className="footer"><Link href="/restaurant/dashboard/growth" className="button">Cancel</Link><button className="button dark" onClick={save} disabled={saving||generating!==null||uploading!==null}>{saving?"Saving…":"Save profile"}</button></div>
  </section></div></main>;
}

const styles=`*{box-sizing:border-box}.page{min-height:100vh;background:#f6f7f9;color:#171717;font-family:Arial,sans-serif}header{height:72px;background:#fff;border-bottom:1px solid #e6e7eb;display:flex;align-items:center;justify-content:space-between;padding:0 6vw}.brand{font-size:27px;font-weight:800;color:#111;text-decoration:none}.brand span{color:#ff5a1f}.shell{max-width:980px;margin:0 auto;padding:40px 20px 70px}.heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:22px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#777}.heading h1{font-size:38px;margin:8px 0}.heading p,.muted{color:#737780}.card{background:#fff;border:1px solid #e6e7eb;border-radius:16px;padding:24px;box-shadow:0 5px 18px rgba(0,0,0,.04)}h2{margin-top:0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}label{display:block;margin-top:16px}label span{display:block;font-size:13px;font-weight:700;margin-bottom:7px}input,select,textarea{width:100%;border:1px solid #d9dce1;border-radius:10px;padding:12px;font:inherit;background:#fff}textarea{min-height:130px;resize:vertical}small{display:block;color:#777;margin-top:5px}.mediaSection{border-top:1px solid #eee;margin-top:24px;padding-top:20px}.mediaSection h3{margin:0 0 5px}.images{display:grid;grid-template-columns:1fr 1fr;gap:16px}.logo{display:block;width:90px;height:90px;object-fit:cover;border-radius:12px;margin-top:10px}.cover{display:block;width:100%;max-height:180px;object-fit:cover;border-radius:12px;margin-top:10px}.generate,.uploadButton{display:inline-block;margin-top:12px;border:1px solid #ddd;background:#fff;color:#222;border-radius:10px;padding:11px 15px;font-weight:700;cursor:pointer}.generate:disabled,.uploadButton:has(input:disabled){opacity:.6;cursor:not-allowed}.uploadButton input{display:none} .verificationGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.verificationList{display:grid;gap:9px;margin-top:14px}.verificationItem{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px;border:1px solid #ececef;border-radius:10px}.verificationItem strong{display:block;font-size:13px}.verificationItem small{display:block;margin-top:4px}.verificationStatus{padding:5px 8px;border-radius:999px;font-size:9px;font-weight:800;text-transform:uppercase}.verificationStatus.pending{background:#fff7e6;color:#a56600}.verificationStatus.approved{background:#e9f7ef;color:#258150}.verificationStatus.rejected{background:#fff0f0;color:#a43b3b}.menuRow{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end}.sectionHead{display:flex;justify-content:space-between;gap:15px;align-items:center}.sectionHead .muted{margin:0}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:15px}.galleryItem{position:relative;border-radius:12px;overflow:hidden;background:#eee;aspect-ratio:4/3}.galleryItem img{width:100%;height:100%;object-fit:cover}.remove{position:absolute;right:8px;bottom:8px;border:0;background:rgba(0,0,0,.75);color:#fff;border-radius:8px;padding:7px 9px;cursor:pointer;font-weight:700}.empty{margin-top:15px;border:1px dashed #d7d9dd;border-radius:12px;padding:25px;text-align:center;color:#777}.button{display:inline-block;border:1px solid #ddd;background:#fff;color:#222;text-decoration:none;border-radius:10px;padding:11px 15px;font-weight:700}.dark{background:#111;color:#fff;border-color:#111;cursor:pointer}.dark:disabled{opacity:.6}.message{margin-top:18px;padding:12px;border-radius:10px;background:#f3f4f6}.footer{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}@media(max-width:700px){.grid,.images{grid-template-columns:1fr}.gallery{grid-template-columns:1fr 1fr}.heading{align-items:flex-start;flex-direction:column}.menuRow{grid-template-columns:1fr}.sectionHead{align-items:flex-start;flex-direction:column}}@media(max-width:480px){.gallery{grid-template-columns:1fr}}`;
