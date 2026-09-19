"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = { id:number; name:string; city:string; category:string; address:string|null; current_bid:number|null; is_claimed:boolean|null; claim_status:string };
type Profile = { phone:string|null; whatsapp:string|null; website_url:string|null; description:string|null; price_range:string|null; menu_url:string|null; cover_image_url:string|null; logo_image_url:string|null; opening_hours:Record<string,string>|null; instagram_url:string|null; google_maps_url:string|null; cuisine_tags:string[]|null };
type Media = { id:number; media_type:"gallery"|"menu"; public_url:string; title:string|null; caption:string|null; sort_order:number };
const DAYS = [["monday","Monday"],["tuesday","Tuesday"],["wednesday","Wednesday"],["thursday","Thursday"],["friday","Friday"],["saturday","Saturday"],["sunday","Sunday"]] as const;

export default function PublicRestaurantProfile(){
 const params=useParams<{id:string}>(); const id=Number(params?.id); const supabase=createClient();
 const [restaurant,setRestaurant]=useState<Restaurant|null>(null); const [profile,setProfile]=useState<Profile|null>(null); const [gallery,setGallery]=useState<Media[]>([]); const [rank,setRank]=useState<number|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [shareMessage,setShareMessage]=useState(""); const [addressMessage,setAddressMessage]=useState("");

 function getVisitorKey(){
   if(typeof window === "undefined") return null;
   try{
     const storageKey="dineup_analytics_visitor_id";
     let key=window.localStorage.getItem(storageKey);
     if(!key){
       key=typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
         ? crypto.randomUUID()
         : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
       window.localStorage.setItem(storageKey,key);
     }
     return key;
   }catch{
     return null;
   }
 }

 async function track(event_type:"profile_view"|"call"|"whatsapp"|"directions"|"menu"|"website"){ if(!Number.isFinite(id)||id<=0)return; const {error:e}=await supabase.rpc("track_restaurant_event",{p_restaurant_id:id,p_event_type:event_type,p_visitor_key:getVisitorKey()}); if(e) console.warn("Analytics event failed",e.message); }
 useEffect(()=>{ async function load(){ if(!Number.isFinite(id)||id<=0){setError("Restaurant not found.");setLoading(false);return;} try{
   const {data:r,error:re}=await supabase.from("restaurants").select("id,name,city,category,address,current_bid,is_claimed,claim_status").eq("id",id).eq("is_active",true).maybeSingle(); if(re)throw re; if(!r){setError("This restaurant is not available on DineUp.");setLoading(false);return;}
   setRestaurant({...r,id:Number(r.id),current_bid:Number(r.current_bid||0)});
   const [{data:p,error:pe},{data:media,error:me}]=await Promise.all([supabase.from("restaurant_profiles").select("phone,whatsapp,website_url,description,price_range,menu_url,cover_image_url,logo_image_url,opening_hours,instagram_url,google_maps_url,cuisine_tags").eq("restaurant_id",id).maybeSingle(),supabase.from("restaurant_media").select("id,media_type,public_url,title,caption,sort_order").eq("restaurant_id",id).eq("media_type","gallery").eq("is_active",true).order("sort_order",{ascending:true}).order("created_at",{ascending:true})]); if(pe)throw pe; if(me)throw me; setProfile(p as Profile|null); setGallery((media||[]) as Media[]);
   const {data:cityList,error:ce}=await supabase.from("restaurants").select("id,current_bid").eq("city",r.city).eq("is_active",true).order("current_bid",{ascending:false}); if(ce)throw ce;
   const position=(cityList||[]).findIndex(x=>Number(x.id)===id); setRank(position>=0?position+1:null);
   void track("profile_view");
 }catch(e){console.error(e);setError(e instanceof Error?e.message:"Unable to load profile.");}finally{setLoading(false);} } load(); },[id]);
 if(loading)return <><Header/><div className="state"><span>DINEUP RESTAURANT</span><h1>Loading profile...</h1></div><style jsx global>{styles}</style></>;
 if(!restaurant||error)return <><Header/><div className="state"><span>DINEUP</span><h1>Restaurant unavailable</h1><p>{error||"Restaurant not found."}</p><Link href="/marketplace" className="primary">Back to marketplace</Link></div><style jsx global>{styles}</style></>;
 const bid=Number(restaurant.current_bid||0), sponsored=bid>0, hours=profile?.opening_hours||{}, phone=profile?.phone||"", whatsapp=profile?.whatsapp||phone;
 const normalizeWhatsApp=(value:string)=>{let digits=value.replace(/\D/g,""); if(digits.startsWith("00"))digits=digits.slice(2); if(digits.length===10)digits="91"+digits; return digits.length>=8&&digits.length<=15?digits:"";};
 const whatsappNumber=normalizeWhatsApp(whatsapp);
 const whatsappMessage=encodeURIComponent(`Hi, I found ${restaurant.name} on DineUp. I would like to know more.`);
 const fallbackMaps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([restaurant.name,restaurant.address,restaurant.city].filter(Boolean).join(", "))}`;
 const maps=profile?.google_maps_url||fallbackMaps;
 const addressText=[restaurant.address,restaurant.city].filter(Boolean).join(", ");
 const copyAddress=async()=>{
   if(!addressText)return;
   setAddressMessage("");
   try{
     if(typeof navigator.clipboard?.writeText==="function"){
       await navigator.clipboard.writeText(addressText);
       setAddressMessage("Address copied.");
       return;
     }
   }catch{}
   try{
     const input=document.createElement("textarea");
     input.value=addressText;
     input.setAttribute("readonly","");
     input.style.position="fixed";
     input.style.opacity="0";
     document.body.appendChild(input);
     input.select();
     document.execCommand("copy");
     input.remove();
     setAddressMessage("Address copied.");
   }catch{
     setAddressMessage("Copy the address manually.");
   }
 };
 const shareProfile=async()=>{
   if(typeof window==="undefined"||!restaurant)return;
   const url=window.location.href;
   const title=restaurant.name+" on DineUp";
   const text=`Discover ${restaurant.name} in ${restaurant.city} on DineUp.`;
   setShareMessage("");
   try{
     if(typeof navigator.share==="function"){
       await navigator.share({title,text,url});
       setShareMessage("Profile shared.");
       return;
     }
     if(typeof navigator.clipboard?.writeText==="function"){
       await navigator.clipboard.writeText(url);
       setShareMessage("Profile link copied.");
       return;
     }
   }catch(error){
     if(error instanceof DOMException && error.name==="AbortError") return;
   }
   try{
     const input=document.createElement("input");
     input.value=url;
     input.setAttribute("readonly","");
     input.style.position="fixed";
     input.style.opacity="0";
     document.body.appendChild(input);
     input.select();
     document.execCommand("copy");
     input.remove();
     setShareMessage("Profile link copied.");
   }catch{
     setShareMessage("Copy the page URL to share this profile.");
   }
 };
 return <main className="page"><Header/><section className="shell"><nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/marketplace">Marketplace</Link><span aria-hidden="true">/</span><span>{restaurant.city}</span><span aria-hidden="true">/</span><span aria-current="page">{restaurant.name}</span></nav><div className="cover">{profile?.cover_image_url?<Image className="coverImage" src={profile.cover_image_url} alt={`${restaurant.name} cover`} fill priority sizes="(max-width: 800px) 100vw, 1180px" />:<div className="cover-letter">{restaurant.name[0]}</div>}<div className="coverShade"/><div className="rankBadge">{rank?`#${rank} in ${restaurant.city}`:"DineUp listing"}</div></div>
 <div className="main"><div className="identity"><div className="logo">{profile?.logo_image_url?<Image src={profile.logo_image_url} alt={`${restaurant.name} logo`} width={184} height={184} sizes="92px" loading="eager" />:restaurant.name[0]}</div><div><small>RESTAURANT</small><h1>{restaurant.name}</h1><p>{restaurant.category} • {restaurant.city}</p><div className="badges">{sponsored&&<b>SPONSORED</b>}{restaurant.claim_status==="verified"&&<b className="verifiedBadge">✓ DINEUP VERIFIED</b>}{restaurant.is_claimed&&restaurant.claim_status!=="verified"&&<b className="claimed">✓ CLAIMED</b>}{restaurant.claim_status==="verification_pending"&&<b className="pending">VERIFICATION PENDING</b>}</div></div><div className="rankCard"><small>DINEUP RANK</small><strong>{rank?`#${rank}`:"—"}</strong><span>{restaurant.city}</span></div></div>
 <div className="actions"><button type="button" className="secondary shareButton" onClick={()=>void shareProfile()}>Share profile</button>{phone&&<a className="primary" href={`tel:${phone}`} onClick={()=>void track("call")}>Call restaurant</a>}{whatsappNumber&&<a className="secondary" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" aria-label={`Chat with ${restaurant.name} on WhatsApp`} onClick={()=>void track("whatsapp")}>WhatsApp</a>}<a className="secondary" href={maps} target="_blank" rel="noopener noreferrer" aria-label={`Get directions to ${restaurant.name}`} onClick={()=>void track("directions")}>Get directions</a>{profile?.menu_url&&<a className="secondary" href={profile.menu_url} target="_blank" rel="noopener noreferrer" aria-label={`View ${restaurant.name} menu`} onClick={()=>void track("menu")}>View menu</a>}{restaurant.claim_status==="unclaimed"&&!restaurant.is_claimed&&<Link className="secondary" href={"/restaurant/claim/"+id}>Claim this restaurant</Link>}{profile?.website_url&&<a className="secondary" href={profile.website_url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${restaurant.name} website`} onClick={()=>void track("website")}>Website</a>}{profile?.instagram_url&&<a className="secondary" href={profile.instagram_url} target="_blank" rel="noopener noreferrer" aria-label={`View ${restaurant.name} on Instagram`}>Instagram</a>}</div>{shareMessage&&<div className="shareNotice" role="status" aria-live="polite">{shareMessage}</div>}
 <div className="grid"><div className="left"><section className="card"><div className="heading"><div><small>ABOUT</small><h2>About {restaurant.name}</h2></div>{profile?.price_range&&<strong>{profile.price_range}</strong>}</div><p className="description">{profile?.description||`${restaurant.name} is a ${restaurant.category.toLowerCase()} restaurant in ${restaurant.city}.`}</p></section>
 {gallery.length>0&&<section className="card"><small>PHOTOS</small><h2>Restaurant gallery</h2><div className="publicGallery">{gallery.map(item=><figure className="publicGalleryItem" key={item.id}><a className="publicGalleryLink" href={item.public_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title||restaurant.name} photo in full size`}><Image src={item.public_url} alt={item.title||restaurant.name} width={800} height={600} sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 33vw" loading="lazy" /></a>{item.caption&&<figcaption>{item.caption}</figcaption>}</figure>)}</div></section>}
 <section className="card"><small>LOCATION</small><h2>Find us</h2><div className="location"><div>⌖</div><p><strong>{restaurant.city}</strong><br/>{restaurant.address||"Address available on request."}</p><div className="locationActions"><a className="secondary locationAction" href={maps} target="_blank" rel="noopener noreferrer" onClick={()=>void track("directions")}>Directions</a>{addressText&&<button type="button" className="secondary locationAction" onClick={()=>void copyAddress()}>Copy address</button>}</div></div>{addressMessage&&<div className="addressNotice" role="status" aria-live="polite">{addressMessage}</div>}</section>
 <section className="card"><small>HOURS</small><h2>Opening hours</h2>{DAYS.map(([key,label])=><div className="hour" key={key}><span>{label}</span><strong>{hours[key]||"Hours not provided"}</strong></div>)}</section></div>
 <aside className="right"><section className="card trustCard"><small>TRUST & VERIFICATION</small>{restaurant.claim_status==="verified"?<><h2>Business verified by DineUp</h2><p>The restaurant has completed DineUp business verification.</p></>:restaurant.claim_status==="verification_pending"?<><h2>Verification in progress</h2><p>Business verification is currently under review.</p></>:<><h2>Listed on DineUp</h2><p>Business verification information is not currently available.</p></>}</section><section className="card dark"><small>DINEUP VISIBILITY</small><h2>{sponsored?"Promoted on DineUp":"Listed on DineUp"}</h2>{sponsored&&<div className="bid">₹{bid.toLocaleString("en-IN")}</div>}<p>{sponsored?"This restaurant is participating in the DineUp visibility marketplace.":"Discover this restaurant on the DineUp marketplace."}</p><Link href="/marketplace" className="lightButton">Explore marketplace</Link></section><section className="card"><small>QUICK INFO</small><div className="info"><span>Category</span><strong>{restaurant.category}</strong></div><div className="info"><span>City</span><strong>{restaurant.city}</strong></div>{profile?.price_range&&<div className="info"><span>Price range</span><strong>{profile.price_range}</strong></div>}{profile?.cuisine_tags?.length&&<div className="cuisineInfo"><span>Cuisine</span><div className="cuisineTags">{profile.cuisine_tags.map(tag=><span className="cuisineTag" key={tag}>{tag}</span>)}</div></div>}</section></aside></div></div></section><div className="mobileStickyCta" aria-label="Restaurant contact actions">{phone&&<a href={`tel:${phone}`} className="mobileCtaPrimary" onClick={()=>void track("call")}>Call</a>}{whatsappNumber&&<a href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} className="mobileCtaSecondary" target="_blank" rel="noopener noreferrer" onClick={()=>void track("whatsapp")}>WhatsApp</a>}<a href={maps} className="mobileCtaSecondary" target="_blank" rel="noreferrer" onClick={()=>void track("directions")}>Directions</a></div><footer>DineUp • Where Restaurants Rise</footer><style jsx global>{styles}</style></main>;
}
function Header(){return <header className="nav"><Link href="/marketplace" className="brand">Dine<span>Up</span></Link><Link href="/marketplace" className="back">← Marketplace</Link></header>}
const styles=`*{box-sizing:border-box}body{margin:0}.page{min-height:100vh;background:#f5f6f7;color:#111;font-family:Arial,Helvetica,sans-serif}.nav{height:72px;background:#fff;border-bottom:1px solid #e6e6e6;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;position:sticky;top:0;z-index:10}.brand{font-size:26px;font-weight:900;color:#111;text-decoration:none;letter-spacing:-1px}.brand span{font-weight:500}.back{color:#111;text-decoration:none;font-weight:700;font-size:13px}.shell{max-width:1180px;margin:30px auto 60px;padding:0 20px}.breadcrumb{display:flex;align-items:center;gap:8px;margin:0 2px 12px;color:#777;font-size:12px;font-weight:700;overflow:hidden}.breadcrumb a{color:#111;text-decoration:none}.breadcrumb span:last-child{color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cover{height:300px;border-radius:24px;position:relative;overflow:hidden;background:linear-gradient(135deg,#171717,#555)}.coverImage{object-fit:cover;object-position:center}.cover-letter{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:110px;font-weight:900;opacity:.12}.coverShade{position:absolute;inset:0;background:linear-gradient(transparent 25%,rgba(0,0,0,.7))}.rankBadge{position:absolute;left:24px;bottom:24px;background:#fff;padding:9px 13px;border-radius:999px;font-size:12px;font-weight:800}.main{background:#fff;border:1px solid #e5e5e5;border-radius:24px;padding:28px}.identity{display:flex;gap:20px;align-items:center}.logo{width:92px;height:92px;border-radius:20px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:900;overflow:hidden;flex:none}.logo img{width:100%;height:100%;object-fit:cover}.identity small,.card>small,.heading small{font-size:10px;font-weight:900;letter-spacing:2px;color:#777}.identity h1{margin:5px 0;font-size:34px;letter-spacing:-1px}.identity p{margin:0;color:#666;font-size:14px}.badges{display:flex;gap:7px;margin-top:10px}.badges b{font-size:10px;background:#111;color:#fff;border-radius:999px;padding:6px 9px}.badges .verifiedBadge{background:#eaf7ef;color:#1f7040}.badges .claimed{background:#edf8f1;color:#177442}.badges .pending{background:#fff6e8;color:#9a5b00}.rankCard{margin-left:auto;background:#f6f6f6;border-radius:15px;padding:15px 20px;min-width:140px}.rankCard small,.rankCard span{display:block;color:#777;font-size:10px}.rankCard strong{display:block;font-size:28px;margin:5px 0}.actions{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid #eee;margin-top:25px;padding-top:22px}.primary,.secondary,.lightButton{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 16px;border-radius:11px;text-decoration:none;font-size:13px;font-weight:800}.primary{background:#111;color:#fff}.secondary{border:1px solid #ddd;color:#111;background:#fff}.shareButton{cursor:pointer;font-family:inherit}.shareNotice{margin-top:10px;color:#4f6b58;font-size:12px;font-weight:700}.grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.8fr);gap:20px;margin-top:25px}.left,.right{display:grid;gap:20px;align-content:start}.card{border:1px solid #e7e7e7;border-radius:18px;padding:22px;background:#fff}.card h2{font-size:19px;margin:6px 0 15px}.heading{display:flex;justify-content:space-between;gap:15px}.description{color:#555;line-height:1.75;margin:0;font-size:15px}.location{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:13px;padding:15px;background:#f7f7f7;border-radius:12px}.locationActions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.locationAction{min-height:38px;padding:9px 11px;font-size:11px;white-space:nowrap}.addressNotice{margin-top:8px;color:#4f6b58;font-size:12px;font-weight:700}.location>div{width:40px;height:40px;background:#111;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center}.location p{margin:0;color:#666;font-size:13px;line-height:1.6}.location strong{color:#111}.hour{display:flex;justify-content:space-between;gap:20px;padding:11px 0;border-bottom:1px solid #eee;font-size:13px}.hour:last-child{border-bottom:0}.hour span{color:#666}.hour strong{text-align:right}.trustCard{background:#f7faf7;border-color:#dce9de}.trustCard h2{margin-bottom:8px}.trustCard p{color:#5f6b63;font-size:13px;line-height:1.6;margin:0}.dark{background:#111;color:#fff;border-color:#111}.dark small{color:#aaa}.dark h2{font-size:21px}.dark p{color:#c5c5c5;font-size:13px;line-height:1.6}.bid{font-size:30px;font-weight:900;margin:10px 0}.lightButton{background:#fff;color:#111;width:100%;margin-top:8px}.info{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #eee;font-size:13px;gap:15px}.info:last-child{border:0}.info span{color:#777}.info strong{text-align:right}.cuisineInfo{display:flex;justify-content:space-between;gap:15px;padding:13px 0;font-size:13px}.cuisineInfo>span{color:#777;flex:none}.cuisineTags{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:6px}.cuisineTag{padding:5px 8px;border:1px solid #e1e1e1;border-radius:999px;background:#f7f7f7;color:#333;font-size:11px;font-weight:700}.state{max-width:700px;margin:80px auto;padding:35px;background:#fff;border:1px solid #e5e5e5;border-radius:20px}.state span{font-size:10px;font-weight:900;letter-spacing:2px;color:#777}.state h1{font-size:30px}.state p{color:#666;margin-bottom:24px}.publicGallery{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:15px}.publicGalleryItem{margin:0;border-radius:12px;overflow:hidden;background:#eee;min-height:180px}.publicGalleryLink{display:block}.publicGalleryLink:focus-visible{outline:3px solid #111;outline-offset:2px}.publicGalleryItem img{width:100%;height:220px;object-fit:cover;display:block}.publicGalleryItem figcaption{padding:8px 10px;font-size:12px;color:#666;background:#fff}.publicGallery{max-height:520px;overflow:auto}.publicGalleryItem{}footer{max-width:1180px;margin:auto;padding:0 20px 35px;color:#777;font-size:12px}@media(max-width:800px){.publicGallery{grid-template-columns:1fr 1fr}.publicGalleryItem img{height:180px}}@media(max-width:520px){.publicGallery{grid-template-columns:1fr}}@media(max-width:700px){.page{padding-bottom:76px}.mobileStickyCta{position:fixed;left:12px;right:12px;bottom:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;background:rgba(255,255,255,.97);border:1px solid #ddd;border-radius:16px;box-shadow:0 10px 35px rgba(0,0,0,.14);z-index:30;backdrop-filter:blur(12px)}.mobileStickyCta:empty{display:none}}@media(max-width:800px){.shell{padding:0 12px;margin-top:15px}.cover{height:230px;border-radius:18px}.main{padding:18px;border-radius:18px}.identity{align-items:flex-start;flex-wrap:wrap}.identity h1{font-size:25px}.logo{width:72px;height:72px;font-size:27px}.rankCard{width:100%;margin-left:0;display:flex;align-items:center;gap:10px}.rankCard strong{margin:0}.rankCard span{margin-left:auto}.grid{grid-template-columns:1fr}.nav{padding:0 16px}}@media(max-width:520px){.actions{display:grid;grid-template-columns:1fr 1fr}.actions a{width:100%}.hour{flex-direction:column;gap:5px}.hour strong{text-align:left}.heading{display:block}.location{grid-template-columns:40px minmax(0,1fr)}.locationActions{grid-column:1 / -1;justify-content:stretch}.locationAction{flex:1;width:100%}}`;