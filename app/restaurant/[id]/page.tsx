"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = { id:number; name:string; city:string; category:string; address:string|null; current_bid:number|null; is_claimed:boolean|null; claim_status:string };
type Profile = { phone:string|null; whatsapp:string|null; website_url:string|null; description:string|null; price_range:string|null; menu_url:string|null; cover_image_url:string|null; logo_image_url:string|null; opening_hours:Record<string,string>|null; instagram_url:string|null; google_maps_url:string|null; cuisine_tags:string[]|null };
type Media = { id:number; media_type:"gallery"|"menu"; public_url:string; title:string|null; caption:string|null; sort_order:number };

function safeExternalUrl(value:string|null|undefined){
 const raw=value?.trim();
 if(!raw)return "";
 try{
   const candidate=/^[a-z][a-z0-9+.-]*:/i.test(raw)?raw:"https://"+raw;
   const url=new URL(candidate);
   return url.protocol==="http:"||url.protocol==="https:" ? url.toString() : "";
 }catch{
   return "";
 }
}
function safeRestaurantMediaUrl(value:string|null|undefined){
 const safe=safeExternalUrl(value);
 if(!safe)return "";
 try{
   const url=new URL(safe);
   return url.protocol==="https:"&&url.hostname==="xeabrfkenplmrrkhnbor.supabase.co"&&url.pathname.startsWith("/storage/v1/object/public/")?url.toString():"";
 }catch{
   return "";
 }
}
function normalizeCuisineTags(value:string[]|null|undefined){
 const seen=new Set<string>();
 const tags:(string)[]=[];
 for(const tag of value||[]){const clean=tag.trim(); const key=clean.toLocaleLowerCase("en-IN"); if(!clean||seen.has(key))continue; seen.add(key); tags.push(clean); if(tags.length===12)break;}
 return tags;
}
const DAYS = [["monday","Monday"],["tuesday","Tuesday"],["wednesday","Wednesday"],["thursday","Thursday"],["friday","Friday"],["saturday","Saturday"],["sunday","Sunday"]] as const;

export default function PublicRestaurantProfile(){
 const params=useParams<{id:string}>(); const id=Number(params?.id); const supabase=createClient();
 const errorRef=useRef<HTMLDivElement|null>(null); const profileViewTrackedRef=useRef<number|null>(null); const actionTrackRef=useRef<Record<string,number>>({}); const [restaurant,setRestaurant]=useState<Restaurant|null>(null); const [profile,setProfile]=useState<Profile|null>(null); const [gallery,setGallery]=useState<Media[]>([]); const [rank,setRank]=useState<number|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [shareMessage,setShareMessage]=useState(""); const [addressMessage,setAddressMessage]=useState(""); const [phoneMessage,setPhoneMessage]=useState(""); const [todayKey,setTodayKey]=useState(""); const [brokenCover,setBrokenCover]=useState(false); const [brokenLogo,setBrokenLogo]=useState(false); const [brokenGallery,setBrokenGallery]=useState<number[]>([]);

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

 async function track(event_type:"profile_view"|"call"|"whatsapp"|"directions"|"menu"|"website",enabled=true){ if(!enabled||!Number.isFinite(id)||id<=0)return; if(event_type!=="profile_view"){const now=Date.now(); const last=actionTrackRef.current[event_type]||0; if(now-last<1500)return; actionTrackRef.current[event_type]=now;} const {error:e}=await supabase.rpc("track_restaurant_event",{p_restaurant_id:id,p_event_type:event_type,p_visitor_key:getVisitorKey()}); if(e) console.warn("Analytics event failed",e.message); }
 useEffect(()=>{ let cancelled=false; async function load(){ actionTrackRef.current={}; setLoading(true); setRestaurant(null); setProfile(null); setGallery([]); setRank(null); setBrokenCover(false); setBrokenLogo(false); setBrokenGallery([]); setError(""); setShareMessage(""); setAddressMessage(""); setPhoneMessage(""); if(!Number.isFinite(id)||id<=0){if(!cancelled){setError("Restaurant not found.");setLoading(false);}return;} setTodayKey(new Intl.DateTimeFormat("en-IN",{weekday:"long",timeZone:"Asia/Kolkata"}).format(new Date()).toLowerCase()); try{
   const {data:r,error:re}=await supabase.from("restaurants").select("id,name,city,category,address,current_bid,is_claimed,claim_status").eq("id",id).eq("is_active",true).maybeSingle(); if(re)throw re; if(cancelled)return; if(!r){setError("This restaurant is not available on DineUp.");setLoading(false);return;}
   setRestaurant({...r,id:Number(r.id),current_bid:Number(r.current_bid||0)});
   const [{data:p,error:pe},{data:media,error:me}]=await Promise.all([supabase.from("restaurant_profiles").select("phone,whatsapp,website_url,description,price_range,menu_url,cover_image_url,logo_image_url,opening_hours,instagram_url,google_maps_url,cuisine_tags").eq("restaurant_id",id).maybeSingle(),supabase.from("restaurant_media").select("id,media_type,public_url,title,caption,sort_order").eq("restaurant_id",id).eq("media_type","gallery").eq("is_active",true).order("sort_order",{ascending:true}).order("created_at",{ascending:true})]); if(pe)throw pe; if(me)throw me; if(cancelled)return; const normalizedProfile=p?{...p,cover_image_url:safeRestaurantMediaUrl(p.cover_image_url)||null,logo_image_url:safeRestaurantMediaUrl(p.logo_image_url)||null,cuisine_tags:normalizeCuisineTags(p.cuisine_tags)}:null; const normalizedGallery=(media||[]).map(item=>({...item,public_url:safeRestaurantMediaUrl(item.public_url)})).filter(item=>Boolean(item.public_url)); setProfile(normalizedProfile as Profile|null); setGallery(normalizedGallery as Media[]);
   const {data:cityList,error:ce}=await supabase.from("restaurants").select("id,current_bid").eq("city",r.city).eq("is_active",true).order("current_bid",{ascending:false,nullsFirst:false}).order("id",{ascending:true});
   if(!cancelled){
     if(ce){console.warn("Restaurant ranking lookup failed:",ce.message);setRank(null);}else{const position=(cityList||[]).findIndex(x=>Number(x.id)===id);setRank(position>=0?position+1:null);}
   }
   if(!cancelled&&profileViewTrackedRef.current!==id){ profileViewTrackedRef.current=id; void track("profile_view"); }
 }catch(e){if(!cancelled){console.error("Restaurant profile load failed:",e);setError("Unable to load this restaurant profile. Please try again.");}}finally{if(!cancelled)setLoading(false);} } load(); return ()=>{cancelled=true;}; },[id]);
 useEffect(()=>{ if(error&&!loading) errorRef.current?.focus({preventScroll:true}); },[error,loading]);
 useEffect(()=>{ if(!shareMessage)return; const timer=window.setTimeout(()=>setShareMessage(""),3500); return()=>window.clearTimeout(timer); },[shareMessage]);
 useEffect(()=>{ if(!addressMessage)return; const timer=window.setTimeout(()=>setAddressMessage(""),3500); return()=>window.clearTimeout(timer); },[addressMessage]);
 useEffect(()=>{ if(!phoneMessage)return; const timer=window.setTimeout(()=>setPhoneMessage(""),3500); return()=>window.clearTimeout(timer); },[phoneMessage]);
 if(loading)return <main className="page" aria-busy="true" aria-label="Loading restaurant profile"><Header/><section className="loadingShell" role="status" aria-live="polite"><span className="srOnly">Loading restaurant profile…</span><div className="skeletonCover"/><div className="skeletonMain"><div className="skeletonIdentity"><div className="skeletonLogo"/><div className="skeletonText"><span/><span/><span/></div></div><div className="skeletonActions"><span/><span/><span/></div><div className="skeletonGrid"><div className="skeletonColumn"><div className="skeletonCard"/><div className="skeletonCard"/><div className="skeletonCard"/></div><div className="skeletonColumn"><div className="skeletonCard"/><div className="skeletonCard"/></div></div></div></section><style jsx global>{styles}</style></main>;
 if(!restaurant||error)return <><Header/><div ref={errorRef} className="state" role="alert" tabIndex={-1} aria-labelledby="profile-error-title" aria-describedby="profile-error-message"><span aria-hidden="true">DINEUP</span><h1 id="profile-error-title">Restaurant unavailable</h1><p id="profile-error-message">{error||"Restaurant not found."}</p><div className="stateActions"><button type="button" className="primary stateRetry" onClick={()=>window.location.reload()}>Retry</button><Link href="/marketplace" className="secondary">Back to marketplace</Link></div></div><style jsx global>{styles}</style></>;
 const bid=Number(restaurant.current_bid||0), sponsored=bid>0, hours=profile?.opening_hours||{}, phone=profile?.phone?.trim()||"", whatsapp=profile?.whatsapp||phone;
 const normalizePhoneHref=(value:string)=>{const hasPlus=value.startsWith("+"); const digits=value.replace(/\D/g,""); return digits.length>=8&&digits.length<=15?`${hasPlus?"+":""}${digits}`:"";};
 const phoneHref=normalizePhoneHref(phone);
 const normalizeWhatsApp=(value:string)=>{let digits=value.replace(/\D/g,""); if(digits.startsWith("00"))digits=digits.slice(2); if(digits.startsWith("0")&&digits.length===11)digits=digits.slice(1); if(digits.length===10)digits="91"+digits; return digits.length>=10&&digits.length<=15?digits:"";};
 const formatHours=(value:unknown)=>typeof value==="string"&&value.trim()?value.trim():"Hours not provided";
 const whatsappNumber=normalizeWhatsApp(whatsapp);
 const whatsappMessage=encodeURIComponent(`Hi, I found ${restaurant.name} on DineUp. I would like to know more.`);
 const fallbackMaps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([restaurant.name,restaurant.address,restaurant.city].filter(Boolean).join(", "))}`;
 const maps=safeExternalUrl(profile?.google_maps_url)||fallbackMaps;
 const menuUrl=safeExternalUrl(profile?.menu_url);
 const websiteUrl=safeExternalUrl(profile?.website_url);
 const instagramUrl=safeExternalUrl(profile?.instagram_url);
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
 const copyPhone=async()=>{
   if(!phone)return;
   setPhoneMessage("");
   try{
     if(typeof navigator.clipboard?.writeText==="function"){
       await navigator.clipboard.writeText(phone);
       setPhoneMessage("Phone copied.");
       return;
     }
   }catch{}
   try{
     const input=document.createElement("textarea");
     input.value=phone;
     input.setAttribute("readonly","");
     input.style.position="fixed";
     input.style.opacity="0";
     document.body.appendChild(input);
     input.select();
     document.execCommand("copy");
     input.remove();
     setPhoneMessage("Phone copied.");
   }catch{
     setPhoneMessage("Copy the phone number manually.");
   }
 };
 const shareProfile=async()=>{
   if(typeof window==="undefined"||!restaurant)return;
   const url=`https://dineupindia.com/restaurant/${id}`;
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
 return <main className="page"><Header/><section className="shell"><nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/marketplace">Marketplace</Link><span aria-hidden="true">/</span><span>{restaurant.city}</span><span aria-hidden="true">/</span><span aria-current="page">{restaurant.name}</span></nav><div className="cover">{profile?.cover_image_url&&!brokenCover?<Image className="coverImage" src={profile.cover_image_url} alt={`${restaurant.name} cover`} fill priority sizes="(max-width: 800px) 100vw, 1180px" referrerPolicy="no-referrer" onError={()=>setBrokenCover(true)} />:<div className="cover-letter">{restaurant.name[0]}</div>}<div className="coverShade"/><div className="rankBadge">{rank?`#${rank} in ${restaurant.city}`:"DineUp listing"}</div></div>
 <div className="main"><div className="identity"><div className="logo">{profile?.logo_image_url&&!brokenLogo?<Image src={profile.logo_image_url} alt={`${restaurant.name} logo`} width={184} height={184} sizes="92px" loading="eager" referrerPolicy="no-referrer" onError={()=>setBrokenLogo(true)} />:restaurant.name[0]}</div><div><small>RESTAURANT</small><h1>{restaurant.name}</h1><p>{restaurant.category} • {restaurant.city}</p><div className="badges">{sponsored&&<b>SPONSORED</b>}{restaurant.claim_status==="verified"&&<b className="verifiedBadge">✓ DINEUP VERIFIED</b>}{restaurant.is_claimed&&restaurant.claim_status!=="verified"&&<b className="claimed">✓ CLAIMED</b>}{restaurant.claim_status==="verification_pending"&&<b className="pending">VERIFICATION PENDING</b>}</div></div><div className="rankCard" role="group" aria-label={`${restaurant.name} DineUp ranking`}><small>DINEUP RANK</small><strong>{rank?`#${rank}`:"—"}</strong><span>{restaurant.city}</span></div></div>
 <div className="actions" role="group" aria-label={`Actions for ${restaurant.name}`}><button type="button" className="secondary shareButton" aria-label={`Share ${restaurant.name} profile`} title={`Share ${restaurant.name} profile`} onClick={()=>void shareProfile()}>Share profile</button>{phoneHref&&<a className="primary" href={`tel:${phoneHref}`} onClick={()=>void track("call",Boolean(phoneHref))}>Call restaurant</a>}{whatsappNumber&&<a className="secondary" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Chat with ${restaurant.name} on WhatsApp`} onClick={()=>void track("whatsapp",Boolean(whatsappNumber))}>WhatsApp</a>}<a className="secondary" href={maps} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Get directions to ${restaurant.name}`} onClick={()=>void track("directions",Boolean(maps))}>Get directions</a>{menuUrl&&<a className="secondary" href={menuUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`View ${restaurant.name} menu`} onClick={()=>void track("menu",Boolean(menuUrl))}>View menu</a>}{restaurant.claim_status==="unclaimed"&&!restaurant.is_claimed&&<Link className="secondary" href={"/restaurant/claim/"+id}>Claim this restaurant</Link>}{websiteUrl&&<a className="secondary" href={websiteUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Visit ${restaurant.name} website`} onClick={()=>void track("website",Boolean(websiteUrl))}>Website</a>}{instagramUrl&&<a className="secondary" href={instagramUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`View ${restaurant.name} on Instagram`}>Instagram</a>}</div>{shareMessage&&<div className="shareNotice" role="status" aria-live="polite">{shareMessage}</div>}
 <div className="grid"><div className="left"><section className="card" aria-labelledby="about-title"><div className="heading"><div><small>ABOUT</small><h2 id="about-title">About {restaurant.name}</h2></div>{profile?.price_range&&<strong>{profile.price_range}</strong>}</div><p className="description">{profile?.description||`${restaurant.name} is a ${restaurant.category.toLowerCase()} restaurant in ${restaurant.city}.`}</p></section>
 {gallery.some(item=>!brokenGallery.includes(item.id))&&<section className="card" aria-labelledby="gallery-title"><small>PHOTOS</small><h2 id="gallery-title">Restaurant gallery</h2><div className="publicGallery">{gallery.filter(item=>!brokenGallery.includes(item.id)).map(item=><figure className="publicGalleryItem" key={item.id}><a className="publicGalleryLink" href={item.public_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Open ${item.title||restaurant.name} photo in full size`}><Image src={item.public_url} alt={item.title||item.caption||`${restaurant.name} gallery photo`} width={800} height={600} sizes="(max-width: 520px) 100vw, (max-width: 800px) 50vw, 33vw" loading="lazy" fetchPriority="low" referrerPolicy="no-referrer" draggable={false} onError={()=>setBrokenGallery(ids=>ids.includes(item.id)?ids:[...ids,item.id])} /></a>{item.caption&&<figcaption>{item.caption}</figcaption>}</figure>)}</div></section>}
 <section className="card" aria-labelledby="location-title"><small>LOCATION</small><h2 id="location-title">Find us</h2><div className="location"><div aria-hidden="true">⌖</div><p><strong>{restaurant.city}</strong><br/>{restaurant.address||"Address available on request."}</p><div className="locationActions"><a className="secondary locationAction" href={maps} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={()=>void track("directions",Boolean(maps))}>Directions</a>{addressText&&<button type="button" className="secondary locationAction" aria-label={`Copy ${restaurant.name} address`} title={`Copy ${restaurant.name} address`} onClick={()=>void copyAddress()}>Copy address</button>}</div></div>{addressMessage&&<div className="addressNotice" role="status" aria-live="polite">{addressMessage}</div>}</section>
 <section className="card" aria-labelledby="opening-hours-title"><small>HOURS</small><h2 id="opening-hours-title">Opening hours</h2>{DAYS.map(([key,label])=><div className={`hour${todayKey===key?" currentDay":""}`} key={key} aria-current={todayKey===key?"date":undefined}><span>{label}{todayKey===key&&<small className="todayLabel">Today</small>}</span><strong>{formatHours(hours[key])}</strong></div>)}</section></div>
 <aside className="right"><section className="card trustCard" aria-labelledby="trust-title"><small>TRUST & VERIFICATION</small>{restaurant.claim_status==="verified"?<><h2 id="trust-title">Business verified by DineUp</h2><p>The restaurant has completed DineUp business verification.</p></>:restaurant.claim_status==="verification_pending"?<><h2 id="trust-title">Verification in progress</h2><p>Business verification is currently under review.</p></>:<><h2 id="trust-title">Listed on DineUp</h2><p>Business verification information is not currently available.</p></>}</section><section className="card dark" aria-labelledby="visibility-title"><small>DINEUP VISIBILITY</small><h2 id="visibility-title">{sponsored?"Promoted on DineUp":"Listed on DineUp"}</h2>{sponsored&&<div className="bid">₹{bid.toLocaleString("en-IN")}</div>}<p>{sponsored?"This restaurant is participating in the DineUp visibility marketplace.":"Discover this restaurant on the DineUp marketplace."}</p><Link href="/marketplace" className="lightButton">Explore marketplace</Link></section>{(phoneHref||whatsappNumber)&&<section className="card" aria-labelledby="contact-title"><small>CONTACT</small><h2 id="contact-title" className="srOnly">Contact {restaurant.name}</h2>{phoneHref&&<div className="contactRow"><a href={`tel:${phoneHref}`} className="contactPhone" onClick={()=>void track("call",Boolean(phoneHref))}>{phone}</a><button type="button" className="secondary contactCopy" aria-label={`Copy ${restaurant.name} phone number`} title={`Copy ${restaurant.name} phone number`} onClick={()=>void copyPhone()}>Copy</button></div>}{whatsappNumber&&<a className="secondary contactWhatsapp" href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={()=>void track("whatsapp",Boolean(whatsappNumber))}>WhatsApp</a>}{phoneMessage&&<div className="addressNotice" role="status" aria-live="polite">{phoneMessage}</div>}</section>}<section className="card" aria-labelledby="quick-info-title"><small>QUICK INFO</small><h2 id="quick-info-title" className="srOnly">Quick information</h2><div className="info"><span>Category</span><strong>{restaurant.category}</strong></div><div className="info"><span>City</span><strong>{restaurant.city}</strong></div>{profile?.price_range&&<div className="info"><span>Price range</span><strong>{profile.price_range}</strong></div>}{profile?.cuisine_tags?.length&&<div className="cuisineInfo"><span>Cuisine</span><div className="cuisineTags">{profile.cuisine_tags.map(tag=><span className="cuisineTag" key={tag}>{tag}</span>)}</div></div>}</section></aside></div></div></section><div className="mobileStickyCta" role="group" aria-label="Restaurant contact actions">{phoneHref&&<a href={`tel:${phoneHref}`} className="mobileCtaPrimary" aria-label={`Call ${restaurant.name}`} onClick={()=>void track("call",Boolean(phoneHref))}>Call</a>}{whatsappNumber&&<a href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`} className="mobileCtaSecondary" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Chat with ${restaurant.name} on WhatsApp`} onClick={()=>void track("whatsapp",Boolean(whatsappNumber))}>WhatsApp</a>}<a href={maps} className="mobileCtaSecondary" target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`Get directions to ${restaurant.name}`} onClick={()=>void track("directions",Boolean(maps))}>Directions</a></div><footer>DineUp • Where Restaurants Rise</footer><style jsx global>{styles}</style></main>;
}
function Header(){return <header className="nav"><Link href="/marketplace" className="brand">Dine<span>Up</span></Link><Link href="/marketplace" className="back">← Marketplace</Link></header>}
const styles=`*{box-sizing:border-box}body{margin:0}.srOnly{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.page{min-height:100vh;background:#f5f6f7;color:#111;font-family:Arial,Helvetica,sans-serif}.nav{height:72px;background:#fff;border-bottom:1px solid #e6e6e6;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;position:sticky;top:0;z-index:10}.brand{font-size:26px;font-weight:900;color:#111;text-decoration:none;letter-spacing:-1px}.brand span{font-weight:500}.back{color:#111;text-decoration:none;font-weight:700;font-size:13px}.shell{max-width:1180px;margin:30px auto 60px;padding:0 20px}.breadcrumb{display:flex;align-items:center;gap:8px;margin:0 2px 12px;color:#777;font-size:12px;font-weight:700;overflow:hidden}.breadcrumb>*{min-width:0;white-space:nowrap}.breadcrumb a{color:#111;text-decoration:none}.breadcrumb span:last-child{color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cover{height:300px;border-radius:24px;position:relative;overflow:hidden;background:linear-gradient(135deg,#171717,#555)}.coverImage{object-fit:cover;object-position:center}.cover-letter{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:110px;font-weight:900;opacity:.12}.coverShade{position:absolute;inset:0;background:linear-gradient(transparent 25%,rgba(0,0,0,.7))}.rankBadge{position:absolute;left:24px;bottom:24px;background:#fff;padding:9px 13px;border-radius:999px;font-size:12px;font-weight:800}.main{background:#fff;border:1px solid #e5e5e5;border-radius:24px;padding:28px}.identity{display:flex;gap:20px;align-items:center}.logo{width:92px;height:92px;border-radius:20px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:900;overflow:hidden;flex:none}.logo img{width:100%;height:100%;object-fit:cover}.identity small,.card>small,.heading small{font-size:10px;font-weight:900;letter-spacing:2px;color:#777}.identity h1{margin:5px 0;font-size:34px;letter-spacing:-1px}.identity p{margin:0;color:#666;font-size:14px}.badges{display:flex;gap:7px;margin-top:10px}.badges b{font-size:10px;background:#111;color:#fff;border-radius:999px;padding:6px 9px}.badges .verifiedBadge{background:#eaf7ef;color:#1f7040}.badges .claimed{background:#edf8f1;color:#177442}.badges .pending{background:#fff6e8;color:#9a5b00}.rankCard{margin-left:auto;background:#f6f6f6;border-radius:15px;padding:15px 20px;min-width:140px}.rankCard small,.rankCard span{display:block;color:#777;font-size:10px}.rankCard strong{display:block;font-size:28px;margin:5px 0}.actions{display:flex;gap:10px;flex-wrap:wrap;border-top:1px solid #eee;margin-top:25px;padding-top:22px}.primary,.secondary,.lightButton{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:11px 16px;border-radius:11px;text-decoration:none;font-size:13px;font-weight:800}.primary{background:#111;color:#fff}.secondary{border:1px solid #ddd;color:#111;background:#fff}.shareButton{cursor:pointer;font-family:inherit}.shareButton:focus-visible,.primary:focus-visible,.secondary:focus-visible,.mobileCtaPrimary:focus-visible,.mobileCtaSecondary:focus-visible{outline:3px solid #111;outline-offset:2px}.shareNotice{margin-top:10px;color:#4f6b58;font-size:12px;font-weight:700}.grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.8fr);gap:20px;margin-top:25px}.left,.right{display:grid;gap:20px;align-content:start}.card{border:1px solid #e7e7e7;border-radius:18px;padding:22px;background:#fff}.card h2{font-size:19px;margin:6px 0 15px}.heading{display:flex;justify-content:space-between;gap:15px}.description{color:#555;line-height:1.75;margin:0;font-size:15px}.location{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:13px;padding:15px;background:#f7f7f7;border-radius:12px}.locationActions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.locationAction{min-height:38px;padding:9px 11px;font-size:11px;white-space:nowrap}.addressNotice{margin-top:8px;color:#4f6b58;font-size:12px;font-weight:700}.location>div:first-child{width:40px;height:40px;background:#111;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center}.location p{margin:0;color:#666;font-size:13px;line-height:1.6}.location strong{color:#111}.hour{display:flex;justify-content:space-between;gap:20px;padding:11px 0;border-bottom:1px solid #eee;font-size:13px}.hour:last-child{border-bottom:0}.hour span{color:#666}.hour strong{text-align:right}.hour.currentDay{background:#f7f7f7;border-radius:10px;padding:11px 10px;margin:3px -10px}.hour.currentDay span{color:#111;font-weight:800}.todayLabel{display:inline-flex;margin-left:7px;padding:3px 6px;border-radius:999px;background:#111;color:#fff;font-size:9px;font-weight:800;letter-spacing:.5px}.hour.currentDay strong{font-weight:900}.trustCard{background:#f7faf7;border-color:#dce9de}.trustCard h2{margin-bottom:8px}.trustCard p{color:#5f6b63;font-size:13px;line-height:1.6;margin:0}.dark{background:#111;color:#fff;border-color:#111}.dark small{color:#aaa}.dark h2{font-size:21px}.dark p{color:#c5c5c5;font-size:13px;line-height:1.6}.bid{font-size:30px;font-weight:900;margin:10px 0}.lightButton{background:#fff;color:#111;width:100%;margin-top:8px}.info{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #eee;font-size:13px;gap:15px}.info:last-child{border:0}.info span{color:#777}.info strong{text-align:right}.contactRow{display:flex;align-items:center;gap:8px}.contactPhone{color:#111;text-decoration:none;font-weight:800;font-size:14px;overflow-wrap:anywhere}.contactCopy{min-height:38px;padding:9px 11px;font-size:11px;flex:none}.contactWhatsapp{width:100%;margin-top:10px}.cuisineInfo{display:flex;justify-content:space-between;gap:15px;padding:13px 0;font-size:13px}.cuisineInfo>span{color:#777;flex:none}.cuisineTags{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:6px}.cuisineTag{padding:5px 8px;border:1px solid #e1e1e1;border-radius:999px;background:#f7f7f7;color:#333;font-size:11px;font-weight:700}.state{max-width:700px;margin:80px auto;padding:35px;background:#fff;border:1px solid #e5e5e5;border-radius:20px}.stateActions{display:flex;gap:10px;flex-wrap:wrap}.stateRetry{border:0;cursor:pointer;font:inherit}.loadingShell{max-width:1180px;margin:30px auto 60px;padding:0 20px}.skeletonCover,.skeletonLogo,.skeletonText span,.skeletonActions span,.skeletonCard{background:linear-gradient(90deg,#eee 25%,#f7f7f7 37%,#eee 63%);background-size:400% 100%;animation:skeletonPulse 1.4s ease infinite}.skeletonCover{height:300px;border-radius:24px}.skeletonMain{margin-top:0;background:#fff;border:1px solid #e5e5e5;border-radius:24px;padding:28px}.skeletonIdentity{display:flex;gap:20px;align-items:center}.skeletonLogo{width:92px;height:92px;border-radius:20px;flex:none}.skeletonText{display:grid;gap:10px;width:min(420px,70%)}.skeletonText span:nth-child(1){width:130px;height:10px;border-radius:5px}.skeletonText span:nth-child(2){width:260px;max-width:100%;height:30px;border-radius:8px}.skeletonText span:nth-child(3){width:190px;max-width:80%;height:14px;border-radius:7px}.skeletonActions{display:flex;gap:10px;margin-top:25px;padding-top:22px;border-top:1px solid #eee}.skeletonActions span{height:44px;width:120px;border-radius:11px}.skeletonGrid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.8fr);gap:20px;margin-top:25px}.skeletonColumn{display:grid;gap:20px}.skeletonCard{height:150px;border-radius:18px}.skeletonColumn:last-child .skeletonCard{height:120px}@keyframes skeletonPulse{0%{background-position:100% 0}100%{background-position:-100% 0}}@media(max-width:800px){.state{margin:40px 12px;padding:24px}.stateActions{display:grid;grid-template-columns:1fr 1fr}.stateActions>*{width:100%}.loadingShell{padding:0 12px;margin-top:15px}.skeletonCover{height:230px;border-radius:18px}.skeletonMain{padding:18px;border-radius:18px}.skeletonLogo{width:72px;height:72px}.skeletonGrid{grid-template-columns:1fr}.skeletonActions{display:grid;grid-template-columns:1fr 1fr}.skeletonActions span{width:100%}}@media(prefers-reduced-motion:reduce){.skeletonCover,.skeletonLogo,.skeletonText span,.skeletonActions span,.skeletonCard{animation:none}.skeletonCover,.skeletonLogo,.skeletonText span,.skeletonActions span,.skeletonCard{background:#eee}}.state span{font-size:10px;font-weight:900;letter-spacing:2px;color:#777}.state h1{font-size:30px}.state p{color:#666;margin-bottom:24px}.publicGallery{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:15px}.publicGalleryItem{margin:0;border-radius:12px;overflow:hidden;background:#eee;min-height:180px}.publicGalleryLink{display:block;cursor:zoom-in}.publicGalleryLink:hover{opacity:.96}.publicGalleryLink:focus-visible{outline:3px solid #111;outline-offset:2px}.publicGalleryItem img{width:100%;height:220px;object-fit:cover;display:block}.publicGalleryItem figcaption{padding:8px 10px;font-size:12px;color:#666;background:#fff}.publicGallery{max-height:520px;overflow:auto}.mobileStickyCta{display:none}.publicGalleryItem{}footer{max-width:1180px;margin:auto;padding:0 20px 35px;color:#777;font-size:12px}@media(max-width:800px){.publicGallery{grid-template-columns:1fr 1fr;max-height:none;overflow:visible}.publicGalleryItem img{height:180px}}@media(max-width:520px){.publicGallery{grid-template-columns:1fr}}@media(max-width:700px){.page{padding-bottom:calc(76px + env(safe-area-inset-bottom))}.mobileStickyCta{position:fixed;left:12px;right:12px;bottom:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px;padding:8px 8px calc(8px + env(safe-area-inset-bottom));background:rgba(255,255,255,.97);border:1px solid #ddd;border-radius:16px;box-shadow:0 10px 35px rgba(0,0,0,.14);z-index:30;backdrop-filter:blur(12px)}.mobileStickyCta:empty{display:none}}@media(max-width:800px){.shell{padding:0 12px;margin-top:15px}.breadcrumb{gap:6px;font-size:11px;margin-bottom:10px}.cover{height:230px;border-radius:18px}.main{padding:18px;border-radius:18px}.identity{align-items:flex-start;flex-wrap:wrap}.identity h1{font-size:25px}.logo{width:72px;height:72px;font-size:27px}.rankCard{width:100%;margin-left:0;display:flex;align-items:center;gap:10px}.rankCard strong{margin:0}.rankCard span{margin-left:auto}.grid{grid-template-columns:1fr}.nav{padding:0 16px}}@media(max-width:520px){.actions{display:grid;grid-template-columns:1fr 1fr}.actions a{width:100%}.contactRow{display:grid;grid-template-columns:minmax(0,1fr) auto}.contactPhone{min-width:0}.hour{flex-direction:column;gap:5px}.hour strong{text-align:left}.heading{display:block}.location{grid-template-columns:40px minmax(0,1fr)}.locationActions{grid-column:1 / -1;justify-content:stretch}.locationAction{flex:1;width:100%}}`;