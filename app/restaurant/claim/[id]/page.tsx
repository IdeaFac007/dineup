"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";

type Restaurant = { id:number; name:string; city:string; category:string|null; address:string|null; claim_status:string; owner_id:string|null };

export default function ClaimRestaurantPage(){
  const params=useParams<{id:string}>(); const router=useRouter();
  const id=Number(params?.id); const supabase=createClient();
  const [restaurant,setRestaurant]=useState<Restaurant|null>(null);
  const [user,setUser]=useState<any>(null); const [ownerName,setOwnerName]=useState(""); const [phone,setPhone]=useState("");
  const [message,setMessage]=useState(""); const [loading,setLoading]=useState(true); const [submitting,setSubmitting]=useState(false); const [error,setError]=useState(""); const [success,setSuccess]=useState(false);

  useEffect(()=>{(async()=>{
    if(!Number.isFinite(id)||id<=0){setError("Invalid restaurant.");setLoading(false);return;}
    const [{data:{user:u}},{data:r,error:e}]=await Promise.all([
      supabase.auth.getUser(),
      supabase.from("restaurants").select("id,name,city,category,address,claim_status,owner_id").eq("id",id).eq("is_active",true).maybeSingle()
    ]);
    if(e||!r){setError("Restaurant not found or inactive.");setLoading(false);return;}
    setRestaurant(r as Restaurant); setUser(u||null); setLoading(false);
    if(u) setOwnerName((u.user_metadata?.full_name||"").trim());
  })()},[id]);

  async function submit(){
    setError("");
    if(!user){router.push("/restaurant/login?next=/restaurant/claim/"+id);return;}
    if(!ownerName.trim()){setError("Please enter the owner name.");return;}
    setSubmitting(true);
    const {error:e}=await supabase.rpc("request_restaurant_claim",{p_restaurant_id:id,p_owner_name:ownerName.trim(),p_phone:phone.trim()||null,p_message:message.trim()||null});
    if(e){setError(e.message);setSubmitting(false);return;}
    setSuccess(true); setSubmitting(false);
  }

  if(loading)return <Page><div className="state">Loading restaurant…</div></Page>;
  if(error&&!restaurant)return <Page><div className="state"><h1>Restaurant unavailable</h1><p>{error}</p><Link href="/marketplace" className="secondary">Back to marketplace</Link></div></Page>;

  return <Page>
    <div className="card">
      <div className="eyebrow">DINEUP · RESTAURANT CLAIM</div>
      <h1>Claim {restaurant!.name}</h1>
      <p className="sub">{restaurant!.category||"Restaurant"} · {restaurant!.city}{restaurant!.address ? " · "+restaurant!.address : ""}</p>
      {success ? <div className="success"><strong>Claim request submitted.</strong><span>DineUp will review your ownership details. Your listing is now marked as verification pending.</span><Link href={"/restaurant/"+id} className="primary">View restaurant profile →</Link></div> :
      <>{restaurant!.claim_status!=="unclaimed"||restaurant!.owner_id ? <div className="notice"><strong>This listing is already under review or claimed.</strong><span>If you believe this is your restaurant, contact DineUp support for assistance.</span></div> :
      <>
        {!user&&<div className="notice"><strong>Sign in required</strong><span>You can sign in first, then return here to submit the claim.</span></div>}
        <label>Owner / Manager name<input value={ownerName} onChange={e=>setOwnerName(e.target.value)} placeholder="Your full name"/></label>
        <label>Phone number<input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></label>
        <label>Why should this listing be assigned to you?<textarea value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Optional: ownership or business details"/></label>
        {error&&<div className="error">{error}</div>}
        <button onClick={submit} disabled={submitting} className="primary">{submitting?"Submitting…":user?"Submit claim for verification →":"Sign in to continue →"}</button>
      </>}</>}
      <Link href={"/restaurant/"+id} className="back">← Back to restaurant</Link>
    </div>
    <style jsx>{`.page{min-height:100vh;background:#f5f6f7;padding:70px 18px;font-family:Arial,Helvetica,sans-serif;color:#111}.card{max-width:620px;margin:auto;background:#fff;border:1px solid #e5e5e5;border-radius:22px;padding:32px;box-shadow:0 20px 55px rgba(0,0,0,.07)}.eyebrow{font-size:10px;font-weight:900;letter-spacing:2px;color:#777}.card h1{font-size:34px;margin:10px 0 7px;letter-spacing:-1px}.sub{color:#777;font-size:13px;line-height:1.5;margin-bottom:25px}label{display:block;font-size:11px;font-weight:800;margin:17px 0;color:#333}input,textarea{display:block;width:100%;margin-top:7px;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:13px;box-sizing:border-box}textarea{resize:vertical}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:800;border:0;cursor:pointer}.primary{background:#111;color:#fff}.secondary{border:1px solid #ddd;color:#111;background:#fff}.primary:disabled{opacity:.55}.notice,.success,.error{padding:15px;border-radius:12px;margin:20px 0}.notice{background:#f6f7f8;border:1px solid #e7e8ea}.success{background:#edf8f1;border:1px solid #cdebd9}.error{background:#fff0f0;border:1px solid #f0cccc;color:#9b3030;font-size:12px}.notice strong,.notice span,.success strong,.success span{display:block}.notice span,.success span{margin-top:5px;color:#666;font-size:12px;line-height:1.5}.success .primary{margin-top:15px}.back{display:block;margin-top:23px;color:#777;text-decoration:none;font-size:11px;font-weight:700}.state{max-width:620px;margin:auto;background:#fff;padding:30px;border-radius:18px}`}</style>
  </Page>
}
function Page({children}:{children:React.ReactNode}){return <main className="page">{children}</main>}
