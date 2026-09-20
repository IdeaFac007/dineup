"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { TurnstileWidget } from "../../../components/turnstile-widget";
import { getMarketingAttribution, trackMarketingEvent } from "../../../lib/marketing-attribution";

const categories = ["Fine Dining","North Indian","South Indian","Mughlai","Chinese","Cafe","Fast Food","Bakery","Desserts","Other"];

export default function RestaurantSignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [restaurantName,setRestaurantName]=useState("");
  const [placeSuggestions,setPlaceSuggestions]=useState<Array<{description:string;place_id:string}>>([]);
  const [placeLoading,setPlaceLoading]=useState(false);
  const [googleSessionToken,setGoogleSessionToken]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [city,setCity]=useState("Lucknow");
  const [category,setCategory]=useState("Fine Dining");
  const [address,setAddress]=useState("");
  const [googleMapsUrl,setGoogleMapsUrl]=useState("");
  const [onboardingMode,setOnboardingMode]=useState<"full"|"bid_only">("full");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [captchaToken,setCaptchaToken]=useState<string | null>(null);
  const [captchaResetNonce,setCaptchaResetNonce]=useState(0);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);

  async function searchGooglePlaces(value:string) {
    setRestaurantName(value);
    setPlaceSuggestions([]);
    if (value.trim().length < 3) return;

    const sessionToken=googleSessionToken || crypto.randomUUID();
    if (!googleSessionToken) setGoogleSessionToken(sessionToken);
    setPlaceLoading(true);

    try {
      const response=await fetch(
        "/api/google-places/autocomplete?input="+encodeURIComponent(value.trim())+
        "&city="+encodeURIComponent(city.trim())+
        "&session_token="+encodeURIComponent(sessionToken)
      );
      if (!response.ok) return;
      const data=await response.json();
      setPlaceSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      setPlaceSuggestions([]);
    } finally {
      setPlaceLoading(false);
    }
  }

  async function selectGooglePlace(placeId:string, description:string) {
    setPlaceSuggestions([]);
    setPlaceLoading(true);
    try {
      const response=await fetch(
        "/api/google-places/details?place_id="+encodeURIComponent(placeId)+
        "&session_token="+encodeURIComponent(googleSessionToken)
      );
      if (!response.ok) return;
      const place=await response.json();

      if (place.name) setRestaurantName(place.name);
      if (place.phone) setPhone(place.phone);
      if (place.city) setCity(place.city);
      if (place.address) setAddress(place.address);
      if (place.category) setCategory(place.category);
      if (place.googleMapsUrl) setGoogleMapsUrl(place.googleMapsUrl);
    } catch {
      setRestaurantName(description.split(",")[0]?.trim() || description);
    } finally {
      setGoogleSessionToken("");
      setPlaceLoading(false);
    }
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage(""); setSuccess(false);
    const name=restaurantName.trim(), mail=email.trim().toLowerCase(), cleanCity=city.trim(), cleanAddress=address.trim(), cleanGoogleMapsUrl=googleMapsUrl.trim();
    const attribution=getMarketingAttribution();
    if(!name||!mail||!cleanCity||(onboardingMode==="full"&&!cleanAddress)){setMessage("Please fill all required fields.");return;}
    if(password.length<8){setMessage("Password must be at least 8 characters.");return;}
    if(password!==confirmPassword){setMessage("Passwords do not match.");return;}
    if(!captchaToken){setMessage("Please complete the security verification.");return;}
    setLoading(true);
    try {
      await trackMarketingEvent("restaurant_signup_started",undefined,{city:cleanCity,category,onboarding_mode:onboardingMode});
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
            address:cleanAddress||null,
            google_maps_url:cleanGoogleMapsUrl||null,
            onboarding_mode:onboardingMode,
            acquisition_source:attribution.source,
            acquisition_medium:attribution.medium,
            acquisition_campaign:attribution.campaign,
            acquisition_content:attribution.content
          }
        }
      });
      if(error){setMessage(error.message);return;}
      if(!data.user){setMessage("Unable to create your account. Please try again.");return;}
      await trackMarketingEvent("restaurant_signup_completed",undefined,{city:cleanCity,category,onboarding_mode:onboardingMode,user_id:data.user.id});
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
      <div className="hero"><span className="eyebrow">FOR RESTAURANTS</span><h1>If you're not on<br/>DineUp,<br/><em>customers can't<br/>discover you here.</em></h1><p>Register your restaurant to get a verified listing, showcase your menu and contact details, and compete for higher marketplace visibility.</p>
      <div className="benefits"><Benefit icon="✓" title="Get your official listing" text="Your restaurant gets a dedicated DineUp presence."/><Benefit icon="↗" title="Increase your visibility" text="Compete for attention through marketplace placement."/><Benefit icon="☎" title="Connect directly" text="Let customers call, WhatsApp, view your menu or get directions."/><Benefit icon="★" title="Build trust" text="Complete your profile and become eligible for verification."/></div>
      <div className="steps"><Step n="1" title="Register" text="Create your restaurant account" active/><Step n="2" title="Get approved" text="We review your listing"/><Step n="3" title="Grow visibility" text="Complete your profile and use DineUp tools"/></div></div>
    </div>
    <div className="card"><div className="header"><span className="eyebrow">RESTAURANT PARTNER</span><div className="requiredBadge">ONLINE ONBOARDING</div><h2>{onboardingMode==="bid_only"?"Bid for visibility on DineUp.":"Claim your place on DineUp."}</h2><p>{onboardingMode==="bid_only"?"Start with a simple restaurant account and compete for a top marketplace position.":"Create your restaurant account to start your listing."}</p></div>
      {message&&<div className={success?"message success":"message error"}><strong>{success?"You're almost there":"Unable to continue"}</strong><span>{message}</span></div>}
      {success&&<div className="onboardingComplete">
        <div className="completeIcon">✓</div>
        <div className="completeEyebrow">DINEUP RESTAURANT ONBOARDING</div>
        <h3>You're on the way to DineUp.</h3>
        <p>{message}</p>
        <div className="onboardingSteps">
          <div className="onboardingStep done"><span>✓</span><div><strong>Restaurant selected</strong><small>{restaurantName || "Your Google restaurant listing"} has been added.</small></div></div>
          <div className="onboardingStep done"><span>✓</span><div><strong>Account created</strong><small>Your restaurant partner account is ready.</small></div></div>
          <div className="onboardingStep active"><span>3</span><div><strong>Verify & review</strong><small>Verify your email. DineUp will review the restaurant information.</small></div></div>
          <div className="onboardingStep"><span>4</span><div><strong>Go live</strong><small>After approval, sign in to open your restaurant dashboard.</small></div></div>
        </div>
        <Link className="completeButton" href="/restaurant/login">Continue to restaurant login →</Link>
      </div>}
      {!success&&<form onSubmit={handleSignup}>
        <div className="modeSwitch"><button type="button" className={onboardingMode==="full"?"mode active": "mode"} onClick={()=>setOnboardingMode("full")}><strong>Full listing</strong><span>Profile, menu & visibility</span></button><button type="button" className={onboardingMode==="bid_only"?"mode active": "mode"} onClick={()=>setOnboardingMode("bid_only")}><strong>Bid only</strong><span>Pay to compete for top placement</span></button></div>
        <Field label="Restaurant name" required><div className="placeSearch"><input value={restaurantName} onChange={e=>void searchGooglePlaces(e.target.value)} placeholder="Search your restaurant on Google" autoComplete="off" required/>{placeLoading&&<span className="placeLoading">Searching Google…</span>}{placeSuggestions.length>0&&<div className="placeSuggestions">{placeSuggestions.map(place=><button type="button" key={place.place_id} onClick={()=>void selectGooglePlace(place.place_id,place.description)}><strong>⌕</strong><span>{place.description}</span></button>)}</div>}</div></Field>
        <div className="cols"><Field label="Email" required><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@restaurant.com" autoComplete="email" required/></Field><Field label="Phone"><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></Field></div>
        <div className="cols"><Field label="City" required><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Lucknow" required/></Field><Field label="Category" required><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field></div>
        <Field label={onboardingMode==="bid_only"?"Restaurant address (optional)":"Restaurant address"} required={onboardingMode==="full"}><textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder={onboardingMode==="bid_only"?"Add it now or complete your profile later":"Full restaurant address"} rows={3} required={onboardingMode==="full"}/></Field>
        <div className="cols"><Field label="Password" required><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" required/></Field><Field label="Confirm password" required><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" required/></Field></div>
        <div className="note"><span>{onboardingMode==="bid_only"?"₹":"✓"}</span><div><strong>{onboardingMode==="bid_only"?"Bid-only onboarding is available":"Your restaurant goes live after approval"}</strong><p>{onboardingMode==="bid_only"?"You can keep your profile minimal and bid for marketplace visibility. Only successful paid bids affect your position; full profile details can be completed later.":"Registration starts your official DineUp listing. After admin approval, customers can discover your profile and use the available contact and discovery features."}</p></div></div>
        <div className="securityRow">
          <div className="captchaBox"><TurnstileWidget action="restaurant-signup" onToken={setCaptchaToken} resetNonce={captchaResetNonce}/></div>
          <button className="submit" disabled={loading || !captchaToken}>{loading?"Creating...":"Create account →"}</button>
        </div>
      </form>}
      <div className="claimLink"><span>Already listed on DineUp?</span> <Link href="/restaurant/claim">Find your restaurant and claim it →</Link></div><div className="login">Already have a restaurant account? <Link href="/restaurant/login">Sign in</Link></div>
    </div>
  </section><style jsx global>{styles}</style></main>;
}

function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){return <div className="field"><label>{label} {required&&<b>*</b>}</label>{children}</div>}
function Benefit({icon,title,text}:{icon:string;title:string;text:string}){return <div className="benefit"><span>{icon}</span><strong>{title}</strong><small>{text}</small></div>}
function Step({n,title,text,active}:{n:string;title:string;text:string;active?:boolean}){return <div className="step"><span className={active?"num active":"num"}>{n}</span><div><strong>{title}</strong><small>{text}</small></div></div>}

const styles=`*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f4f5f7;color:#171717}button,input,textarea,select{font:inherit}.signupPage{position:relative;min-height:100vh;height:100vh;overflow:hidden;padding:14px 18px;background:radial-gradient(circle at 8% 82%,rgba(237,101,12,.12),transparent 28%),radial-gradient(circle at 92% 18%,rgba(237,101,12,.09),transparent 25%),linear-gradient(135deg,#f8f7f4 0%,#f1f2f3 52%,#f7f3ed 100%)}.signupPage:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.42;background-image:linear-gradient(rgba(23,23,23,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(23,23,23,.035) 1px,transparent 1px);background-size:42px 42px}.signupPage:after{content:"";position:absolute;width:420px;height:420px;border-radius:50%;right:-170px;bottom:-210px;background:rgba(237,101,12,.08);border:1px solid rgba(237,101,12,.1);box-shadow:0 0 0 45px rgba(237,101,12,.025),0 0 0 90px rgba(237,101,12,.018);pointer-events:none}.shell{position:relative;z-index:1;height:100%;max-width:1120px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(450px,540px);gap:34px;align-items:start}.card{align-self:start;margin-top:8px}.brand{position:relative;z-index:2;display:inline-flex;align-items:center;gap:11px;text-decoration:none;color:#171717}.mark{width:38px;height:38px;border-radius:11px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:21px}.brand strong{display:block;font-size:20px}.brand small{display:block;margin-top:2px;color:#85898f;font-size:8px;font-weight:800;letter-spacing:1.5px}.hero{margin-top:8px;max-width:500px}.eyebrow{display:block;color:#85898f;font-size:9px;font-weight:900;letter-spacing:1.8px}.hero h1{margin:7px 0 8px;font-size:40px;line-height:1.01;letter-spacing:-1.8px}.hero h1 em{font-family:Georgia,serif;font-weight:400;color:#d86118}.hero>p{margin:0;color:#70747a;font-size:12px;line-height:1.45}.benefits{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}.benefit{padding:7px 9px;border:1px solid #e5e6e8;background:rgba(255,255,255,.58);border-radius:11px}.benefit>span{width:19px;height:19px;border-radius:6px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;margin-bottom:8px}.benefit strong,.benefit small{display:block}.benefit strong{font-size:8.5px}.benefit small{color:#85898f;font-size:7.5px;line-height:1.25;margin-top:2px}.steps{margin-top:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.modeSwitch{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0 0 8px}.mode{border:1px solid #e1e2e4;background:#fafafa;border-radius:10px;padding:9px 10px;text-align:left;cursor:pointer}.mode strong,.mode span{display:block}.mode strong{font-size:10px}.mode span{font-size:8px;color:#85898f;margin-top:3px}.mode.active{border-color:#171717;background:#f4f4f4}.requiredBadge{display:inline-block;margin-top:8px;padding:5px 8px;border-radius:999px;background:#fff1e7;color:#d45d17;font-size:8px;font-weight:900;letter-spacing:1px}.step{display:flex;align-items:center;gap:8px}.num{width:26px;height:26px;border-radius:9px;background:#e6e7e9;color:#777b80;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900}.num.active{background:#171717;color:#fff}.step strong,.step small{display:block}.step strong{font-size:8.5px}.step small{margin-top:1px;color:#96999e;font-size:7.5px}.card{background:#fff;border:1px solid #e4e5e8;border-radius:15px;padding:14px 20px;box-shadow:0 20px 60px rgba(0,0,0,.07)}.header{margin-bottom:8px}.header h2{margin:5px 0 3px;font-size:20px}.header p{margin:0;color:#92959a;font-size:11px}.message{border-radius:10px;padding:12px 13px;margin-bottom:16px;font-size:10px}.message strong,.message span{display:block}.message span{margin-top:4px;line-height:1.5}.error{background:#fff0f0;border:1px solid #f0cccc;color:#9b3030}.success{background:#eaf8f0;border:1px solid #ccebd9;color:#247b4d}.field{margin-bottom:5px}.field label{display:block;margin-bottom:5px;color:#5f6369;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.65px}.field input,.field textarea,.field select{width:100%;border:1px solid #dfe1e4;border-radius:8px;background:#fff;color:#171717;padding:6px 9px;outline:none;font-size:10px}.field textarea{resize:none;line-height:1.4}.field input:focus,.field textarea:focus,.field select:focus{border-color:#777}.placeSearch{position:relative}.placeLoading{position:absolute;right:10px;top:10px;color:#999;font-size:8px}.placeSuggestions{position:absolute;left:0;right:0;top:100%;z-index:30;background:#fff;border:1px solid #ddd;border-radius:9px;margin-top:4px;box-shadow:0 12px 28px rgba(0,0,0,.12);overflow:hidden}.placeSuggestions button{width:100%;display:flex;gap:9px;align-items:center;text-align:left;border:0;background:#fff;padding:10px;cursor:pointer;font-size:10px}.placeSuggestions button:hover{background:#f7f7f7}.placeSuggestions strong{font-size:14px;color:#ed650c}.placeSuggestions span{color:#333;line-height:1.3}.mapsActions{margin-top:7px}.mapsSearch{border:1px solid #ed650c;background:#fff7f1;color:#c7520e;border-radius:8px;padding:7px 9px;font-size:9px;font-weight:800;cursor:pointer}.mapsSearch:hover{background:#ed650c;color:#fff}.mapsInput small{display:block;margin-top:5px;color:#96999e;font-size:8px;line-height:1.35}.cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}.note{display:flex;gap:8px;background:#f6f7f8;border:1px solid #e8e9eb;border-radius:9px;padding:6px;margin:2px 0 6px}.note>span{width:22px;height:22px;border-radius:8px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0}.note strong{font-size:10px}.note p{margin:3px 0 0;color:#85898f;font-size:8px;line-height:1.35}.securityRow{display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:9px;align-items:center}.captchaBox{min-width:0;overflow:hidden}.submit{width:100%;height:36px;border:0;border-radius:9px;background:#171717;color:#fff;padding:10px 8px;font-size:10px;font-weight:800;cursor:pointer}.submit:disabled{opacity:.55}.onboardingComplete{border:1px solid #e2e5e7;background:#fafbfb;border-radius:13px;padding:17px}.completeIcon{width:34px;height:34px;border-radius:10px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px}.completeEyebrow{margin-top:10px;color:#8a8d91;font-size:8px;font-weight:900;letter-spacing:1.5px}.onboardingComplete h3{margin:5px 0 4px;font-size:20px}.onboardingComplete>p{margin:0;color:#777;font-size:10px;line-height:1.45}.onboardingSteps{margin:14px 0;border:1px solid #e6e7e9;border-radius:10px;overflow:hidden}.onboardingStep{display:flex;gap:9px;padding:9px 10px;border-bottom:1px solid #eee;align-items:flex-start}.onboardingStep:last-child{border-bottom:0}.onboardingStep>span{width:22px;height:22px;border-radius:7px;background:#e9eaec;color:#777;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;flex:0 0 22px}.onboardingStep.done>span{background:#171717;color:#fff}.onboardingStep.active>span{background:#fff0e6;color:#d45d17;border:1px solid #f1c9aa}.onboardingStep strong,.onboardingStep small{display:block}.onboardingStep strong{font-size:9px}.onboardingStep small{font-size:8px;color:#85898f;line-height:1.3;margin-top:2px}.completeButton{display:flex;align-items:center;justify-content:center;background:#171717;color:#fff;text-decoration:none;border-radius:9px;padding:10px;font-size:10px;font-weight:800}..login{text-align:center;margin-top:6px;color:#8b8e94;font-size:10px}.login a{color:#171717;font-weight:800;text-decoration:none}@media(max-width:900px){.signupPage{height:auto;min-height:100vh;overflow:auto;padding:24px 18px}.shell{height:auto;grid-template-columns:1fr;max-width:650px;gap:30px}.card{margin-top:0}.hero{margin-top:30px}}@media(max-width:600px){.modeSwitch{grid-template-columns:1fr}.signupPage{padding:20px 14px}.hero h1{font-size:35px;letter-spacing:-1.4px}.benefits{grid-template-columns:1fr}.steps{grid-template-columns:1fr}.card{padding:22px 18px}.cols{grid-template-columns:1fr}.securityRow{grid-template-columns:1fr}.submit{height:42px}}`;