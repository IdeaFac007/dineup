"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import { TurnstileWidget } from "../../../components/turnstile-widget";
import { trackMarketingEvent } from "../../../lib/marketing-attribution";

export default function RestaurantLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null); const [captchaResetNonce, setCaptchaResetNonce] = useState(0);
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "info">("error");
  function showMessage(text:string,type:"error"|"success"|"info"="error"){setMessage(text);setMessageType(type)}
  async function handleLogin(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(!email.trim()||!password){showMessage("Please enter your email and password.");return}
    if(!captchaToken){showMessage("Please complete the security verification.");return}
    setLoading(true);setMessage("");
    try{
      await trackMarketingEvent("restaurant_login_started");
      const {data:authData,error:authError}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password,options:{captchaToken}});
      if(authError){console.error("LOGIN AUTH ERROR:",authError);showMessage("Invalid email or password.");setLoading(false);return}
      const user=authData.user;if(!user){showMessage("Unable to create login session.");setLoading(false);return}
      const {data:applications,error:applicationError}=await supabase.from("restaurant_applications").select(`id,owner_id,restaurant_name,email,phone,city,category,address,status,admin_note,created_at,reviewed_at`).eq("owner_id",user.id).order("created_at",{ascending:false}).limit(1);
      if(applicationError){console.error("APPLICATION QUERY ERROR:",applicationError);await supabase.auth.signOut();showMessage("Unable to check your restaurant application. Please try again.");setLoading(false);return}
      const application=applications&&applications.length>0?applications[0]:null;
      if(application?.status==="rejected"){await supabase.auth.signOut();showMessage(`Application rejected: ${application.admin_note?.trim()||"Your restaurant application was not approved."}`);setLoading(false);return}
      if(application?.status==="pending"){await supabase.auth.signOut();showMessage("Your restaurant application is still pending approval.","info");setLoading(false);return}
      const {data:restaurant,error:restaurantError}=await supabase.from("restaurants").select(`id,name,city,category,address,current_bid,is_claimed,is_active,owner_id`).eq("owner_id",user.id).eq("is_active",true).maybeSingle();
      if(restaurantError){console.error("RESTAURANT QUERY ERROR:",restaurantError);await supabase.auth.signOut();showMessage("Unable to load your restaurant. Please try again.");setLoading(false);return}
      if(!restaurant){await supabase.auth.signOut();if(!application)showMessage("Your account is verified, but your restaurant application has not been submitted yet.","info");else if(application.status==="approved")showMessage("Your application is approved, but your restaurant profile is not active yet. Please contact DineUp support.","info");else showMessage("Your restaurant has not been approved yet.","info");setLoading(false);return}
      await trackMarketingEvent("restaurant_login_completed",restaurant.id,{city:restaurant.city,category:restaurant.category});
      showMessage("Login successful. Redirecting...","success");router.push("/restaurant/dashboard");router.refresh();
    }catch(error){console.error("UNEXPECTED LOGIN ERROR:",error);await supabase.auth.signOut();showMessage("Something went wrong while logging in. Please try again.");setLoading(false)}
    finally{setCaptchaToken(null);setCaptchaResetNonce(current=>current+1);setLoading(false)}
  }
  const messageBackground=messageType==="success"?"#ecfdf5":messageType==="info"?"#eff6ff":"#fef2f2";
  const messageBorder=messageType==="success"?"#bbf7d0":messageType==="info"?"#bfdbfe":"#fecaca";
  const messageColor=messageType==="success"?"#15803d":messageType==="info"?"#1d4ed8":"#dc2626";
  return <main style={{minHeight:"100vh",background:"#111111",padding:"40px 16px",boxSizing:"border-box",fontFamily:"Inter, Arial, Helvetica, sans-serif"}}><div style={{minHeight:"calc(100vh - 80px)",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:"100%",maxWidth:"560px",background:"#ffffff",borderRadius:"28px",padding:"42px",boxSizing:"border-box",boxShadow:"0 25px 70px rgba(0,0,0,0.35)"}}>
    <div style={{marginBottom:"34px"}}><div style={{fontSize:"32px",fontWeight:900,letterSpacing:"-1.5px",lineHeight:1}}><span style={{color:"#111111"}}>Dine</span><span style={{color:"#d97927"}}>Up</span></div><div style={{marginTop:"9px",fontSize:"11px",fontWeight:800,letterSpacing:"3px",color:"#111111"}}>RESTAURANT PARTNER</div></div>
    <div style={{marginBottom:"28px"}}><h1 style={{margin:0,fontSize:"48px",lineHeight:1.05,fontWeight:900,letterSpacing:"-2px",color:"#111111"}}>Welcome back.</h1><p style={{margin:"14px 0 0",fontSize:"16px",lineHeight:1.6,color:"#6b7280"}}>Login to manage your restaurant visibility, campaign and leaderboard position.</p></div>
    {message&&<div style={{marginBottom:"22px",padding:"14px 16px",borderRadius:"12px",border:`1px solid ${messageBorder}`,background:messageBackground,color:messageColor,fontSize:"14px",lineHeight:1.5,fontWeight:600}}>{message}</div>}
    <form onSubmit={handleLogin}><div style={{marginBottom:"20px"}}><label htmlFor="email" style={{display:"block",marginBottom:"8px",fontSize:"14px",fontWeight:800,color:"#111111"}}>Email</label><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="restaurant@example.com" autoComplete="email" disabled={loading} style={{width:"100%",height:"54px",padding:"0 16px",boxSizing:"border-box",border:"1px solid #d1d5db",borderRadius:"12px",background:"#ffffff",color:"#111111",fontSize:"15px",outline:"none"}}/></div>
    <div style={{marginBottom:"26px"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}><label htmlFor="password" style={{fontSize:"14px",fontWeight:800,color:"#111111"}}>Password</label><Link href="/restaurant/forgot-password" style={{fontSize:"13px",fontWeight:700,color:"#d97927",textDecoration:"none"}}>Forgot password?</Link></div><input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" disabled={loading} style={{width:"100%",height:"54px",padding:"0 16px",boxSizing:"border-box",border:"1px solid #d1d5db",borderRadius:"12px",background:"#ffffff",color:"#111111",fontSize:"15px",outline:"none"}}/></div>
    <TurnstileWidget action="restaurant-login" onToken={setCaptchaToken} resetNonce={captchaResetNonce}/><button type="submit" disabled={loading||!captchaToken} style={{width:"100%",height:"56px",border:"none",borderRadius:"12px",background:loading?"#444444":"#111111",color:"#ffffff",fontSize:"15px",fontWeight:800,cursor:loading||!captchaToken?"not-allowed":"pointer",opacity:!captchaToken&&!loading?0.65:1}}>{loading?"Checking...":"Login to dashboard →"}</button></form>
    <div style={{marginTop:"30px",paddingTop:"26px",borderTop:"1px solid #eeeeee",textAlign:"center"}}><p style={{margin:0,fontSize:"14px",color:"#6b7280"}}>Don&apos;t have a restaurant account?</p><Link href="/restaurant/signup" style={{display:"inline-block",marginTop:"9px",fontSize:"14px",fontWeight:800,color:"#d97927",textDecoration:"none"}}>Register your restaurant →</Link></div>
    <div style={{marginTop:"30px",textAlign:"center",fontSize:"12px",color:"#9ca3af"}}>DineUp · Where Restaurants Rise</div>
  </div></div><style jsx>{`@media (max-width:600px){main{padding:20px 12px !important}}`}</style></main>
}
