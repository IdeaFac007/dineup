"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { TurnstileWidget } from "../../../components/turnstile-widget";
import { trackMarketingEvent } from "../../../lib/marketing-attribution";

const categories = ["Fine Dining","North Indian","South Indian","Mughlai","Chinese","Cafe","Fast Food","Bakery","Desserts","Other"];

export default function RestaurantSignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [restaurantName,setRestaurantName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [city,setCity]=useState("Lucknow");
  const [category,setCategory]=useState("Fine Dining");
  const [address,setAddress]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [captchaToken,setCaptchaToken]=useState<string | null>(null);
  const [captchaResetNonce,setCaptchaResetNonce]=useState(0);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage(""); setSuccess(false);
    const name=restaurantName.trim(), mail=email.trim().toLowerCase(), cleanCity=city.trim(), cleanAddress=address.trim();
    if(!name||!mail||!cleanCity||!cleanAddress){setMessage("Please fill all required fields.");return;}
    if(password.length<8){setMessage("Password must be at least 8 characters.");return;}
    if(password!==confirmPassword){setMessage("Passwords do not match.");return;}
    if(!captchaToken){setMessage("Please complete the security verification.");return;}
    setLoading(true);
    try {
      await trackMarketingEvent("restaurant_signup_started",undefined,{city:cleanCity,category});
      const {data,error}=await supabase.auth.signUp({
        email:mail,
        password,
        options:{
          captchaToken,
          data:{
            restaurant_name:name,
            phone:phone.trim()||null,
            city:cleanCity,
            category,
            address:cleanAddress
          }
        }
      });
      if(error){setMessage(error.message);return;}
      if(!data.user){setMessage("Unable to create your account. Please try again.");return;}
      await trackMarketingEvent("restaurant_signup_completed",undefined,{city:cleanCity,category,user_id:data.user.id});
      if(!data.session){
        setSuccess(true);
        setMessage("Account created. Please verify your email, then sign in to complete your restaurant application.");
        return;
      }
      setSuccess(true);
      setMessage("Application submitted successfully. Your restaurant is now pending admin approval.");
      setTimeout(()=>router.push("/restaurant/login"),2200);
    } catch(err) { console.error(err); setMessage("Something went wrong. Please try again."); }
    finally {
      setCaptchaToken(null);
      setCaptchaResetNonce((current)=>current+1);
      setLoading(false);
    }
  }

  return <main className="signupPage"><section className="shell">
    <div className="intro">
      <Link href="/" className="brand"><span className="mark">D</span><span><strong>DineUp</strong><small>WHERE RESTAURANTS RISE</small></span></Link>
      <div className="hero"><span className="eyebrow">FOR RESTAURANTS</span><h1>If you're not on DineUp, <em>customers can't discover you here.</em></h1><p>Register your restaurant to get a verified listing, showcase your menu and contact details, and compete for higher marketplace visibility.</p>
      <div className="benefits"><Benefit icon="✓" title="Get your official listing" text="Your restaurant gets a dedicated DineUp presence."/><Benefit icon="↗" title="Increase your visibility" text="Compete for attention through marketplace placement."/><Benefit icon="☎" title="Connect directly" text="Let customers call, WhatsApp, view your menu or get directions."/><Benefit icon="★" title="Build trust" text="Complete your profile and become eligible for verification."/></div>
      <div className="steps"><Step n="1" title="Register" text="Create your restaurant account" active/><Step n="2" title="Get approved" text="We review your listing"/><Step n="3" title="Grow visibility" text="Complete your profile and use DineUp tools"/></div></div>
    </div>
    <div className="card"><div className="header"><span className="eyebrow">RESTAURANT PARTNER</span><div className="requiredBadge">REQUIRED TO LIST</div><h2>Claim your place on DineUp.</h2><p>Create your restaurant account to start your listing.</p></div>
      {message&&<div className={success?"message success":"message error"}><strong>{success?"You're almost there":"Unable to continue"}</strong><span>{message}</span></div>}
      {!success&&<form onSubmit={handleSignup}>
        <Field label="Restaurant name" required><input value={restaurantName} onChange={e=>setRestaurantName(e.target.value)} placeholder="e.g. Royal Awadh Kitchen" required/></Field>
        <div className="cols"><Field label="Email" required><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@restaurant.com" autoComplete="email" required/></Field><Field label="Phone"><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></Field></div>
        <div className="cols"><Field label="City" required><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Lucknow" required/></Field><Field label="Category" required><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field></div>
        <Field label="Restaurant address" required><textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Full restaurant address" rows={3} required/></Field>
        <div className="cols"><Field label="Password" required><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" required/></Field><Field label="Confirm password" required><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" required/></Field></div>
        <div className="note"><span>✓</span><div><strong>Your restaurant goes live after approval</strong><p>Registration starts your official DineUp listing. After admin approval, customers can discover your profile and use the available contact and discovery features.</p></div></div>
        <div className="securityRow">
          <div className="captchaBox"><TurnstileWidget action="restaurant-signup" onToken={setCaptchaToken} resetNonce={captchaResetNonce}/></div>
          <button className="submit" disabled={loading || !captchaToken}>{loading?"Creating...":"Create account →"}</button>
        </div>
      </form>}
      <div className="login">Already have a restaurant account? <Link href="/restaurant/login">Sign in</Link></div>
    </div>
  </section><style jsx global>{styles}</style></main>;
}

function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){return <div className="field"><label>{label} {required&&<b>*</b>}</label>{children}</div>}
function Benefit({icon,title,text}:{icon:string;title:string;text:string}){return <div className="benefit"><span>{icon}</span><strong>{title}</strong><small>{text}</small></div>}
function Step({n,title,text,active}:{n:string;title:string;text:string;active?:boolean}){return <div className="step"><span className={active?"num active":"num"}>{n}</span><div><strong>{title}</strong><small>{text}</small></div></div>}

const styles=`*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f4f5f7;color:#171717}button,input,textarea,select{font:inherit}.signupPage{position:relative;min-height:100vh;height:100vh;overflow:hidden;padding:24px 24px;background:radial-gradient(circle at 8% 82%,rgba(237,101,12,.12),transparent 28%),radial-gradient(circle at 92% 18%,rgba(237,101,12,.09),transparent 25%),linear-gradient(135deg,#f8f7f4 0%,#f1f2f3 52%,#f7f3ed 100%)}.signupPage:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.42;background-image:linear-gradient(rgba(23,23,23,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(23,23,23,.035) 1px,transparent 1px);background-size:42px 42px}.signupPage:after{content:"";position:absolute;width:420px;height:420px;border-radius:50%;right:-170px;bottom:-210px;background:rgba(237,101,12,.08);border:1px solid rgba(237,101,12,.1);box-shadow:0 0 0 45px rgba(237,101,12,.025),0 0 0 90px rgba(237,101,12,.018);pointer-events:none}.shell{position:relative;z-index:1;height:100%;max-width:1160px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(450px,540px);gap:58px;align-items:start}.card{align-self:start;margin-top:24px}.brand{position:relative;z-index:2;display:inline-flex;align-items:center;gap:11px;text-decoration:none;color:#171717}.mark{width:38px;height:38px;border-radius:11px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:21px}.brand strong{display:block;font-size:20px}.brand small{display:block;margin-top:2px;color:#85898f;font-size:8px;font-weight:800;letter-spacing:1.5px}.hero{margin-top:8px;max-width:500px}.eyebrow{display:block;color:#85898f;font-size:9px;font-weight:900;letter-spacing:1.8px}.hero h1{margin:7px 0 8px;font-size:40px;line-height:1.01;letter-spacing:-1.8px}.hero h1 em{font-family:Georgia,serif;font-weight:400;color:#d86118}.hero>p{margin:0;color:#70747a;font-size:12px;line-height:1.45}.benefits{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}.benefit{padding:7px 9px;border:1px solid #e5e6e8;background:rgba(255,255,255,.58);border-radius:11px}.benefit>span{width:19px;height:19px;border-radius:6px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;margin-bottom:8px}.benefit strong,.benefit small{display:block}.benefit strong{font-size:8.5px}.benefit small{color:#85898f;font-size:7.5px;line-height:1.25;margin-top:2px}.steps{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.requiredBadge{display:inline-block;margin-top:8px;padding:5px 8px;border-radius:999px;background:#fff1e7;color:#d45d17;font-size:8px;font-weight:900;letter-spacing:1px}.step{display:flex;align-items:center;gap:8px}.num{width:26px;height:26px;border-radius:9px;background:#e6e7e9;color:#777b80;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900}.num.active{background:#171717;color:#fff}.step strong,.step small{display:block}.step strong{font-size:8.5px}.step small{margin-top:1px;color:#96999e;font-size:7.5px}.card{background:#fff;border:1px solid #e4e5e8;border-radius:18px;padding:19px 25px;box-shadow:0 20px 60px rgba(0,0,0,.07)}.header{margin-bottom:13px}.header h2{margin:7px 0 4px;font-size:22px}.header p{margin:0;color:#92959a;font-size:11px}.message{border-radius:10px;padding:12px 13px;margin-bottom:16px;font-size:10px}.message strong,.message span{display:block}.message span{margin-top:4px;line-height:1.5}.error{background:#fff0f0;border:1px solid #f0cccc;color:#9b3030}.success{background:#eaf8f0;border:1px solid #ccebd9;color:#247b4d}.field{margin-bottom:8px}.field label{display:block;margin-bottom:5px;color:#5f6369;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.65px}.field input,.field textarea,.field select{width:100%;border:1px solid #dfe1e4;border-radius:8px;background:#fff;color:#171717;padding:7px 10px;outline:none;font-size:11px}.field textarea{resize:none;line-height:1.4}.field input:focus,.field textarea:focus,.field select:focus{border-color:#777}.cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}.note{display:flex;gap:8px;background:#f6f7f8;border:1px solid #e8e9eb;border-radius:9px;padding:7px;margin:2px 0 8px}.note>span{width:22px;height:22px;border-radius:8px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0}.note strong{font-size:10px}.note p{margin:3px 0 0;color:#85898f;font-size:8px;line-height:1.35}.securityRow{display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:9px;align-items:center}.captchaBox{min-width:0;overflow:hidden}.submit{width:100%;height:40px;border:0;border-radius:9px;background:#171717;color:#fff;padding:10px 8px;font-size:10px;font-weight:800;cursor:pointer}.submit:disabled{opacity:.55}.login{text-align:center;margin-top:10px;color:#8b8e94;font-size:10px}.login a{color:#171717;font-weight:800;text-decoration:none}@media(max-width:900px){.signupPage{height:auto;min-height:100vh;overflow:auto;padding:24px 18px}.shell{height:auto;grid-template-columns:1fr;max-width:650px;gap:30px}.card{margin-top:0}.hero{margin-top:30px}}@media(max-width:600px){.signupPage{padding:20px 14px}.hero h1{font-size:35px;letter-spacing:-1.4px}.benefits{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.card{padding:22px 18px}.cols{grid-template-columns:1fr}.securityRow{grid-template-columns:1fr}.submit{height:42px}}`;