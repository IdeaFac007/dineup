"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

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
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage(""); setSuccess(false);
    const name=restaurantName.trim(), mail=email.trim().toLowerCase(), cleanCity=city.trim(), cleanAddress=address.trim();
    if(!name||!mail||!cleanCity||!cleanAddress){setMessage("Please fill all required fields.");return;}
    if(password.length<8){setMessage("Password must be at least 8 characters.");return;}
    if(password!==confirmPassword){setMessage("Passwords do not match.");return;}
    setLoading(true);
    try {
      const {data,error}=await supabase.auth.signUp({email:mail,password});
      if(error){setMessage(error.message);return;}
      if(!data.user){setMessage("Unable to create your account. Please try again.");return;}
      if(!data.session){
        setSuccess(true);
        setMessage("Account created. Please verify your email, then sign in to complete your restaurant application.");
        return;
      }
      const {error:appError}=await supabase.from("restaurant_applications").insert({
        owner_id:data.user.id,email:mail,restaurant_name:name,phone:phone.trim()||null,city:cleanCity,category,address:cleanAddress,status:"pending"
      });
      if(appError){setMessage(`Account created, but application submission failed: ${appError.message}`);return;}
      setSuccess(true);
      setMessage("Application submitted successfully. Your restaurant is now pending admin approval.");
      setTimeout(()=>router.push("/restaurant/login"),1800);
    } catch(err) { console.error(err); setMessage("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  }

  return <main className="signupPage"><section className="shell">
    <div className="intro">
      <Link href="/" className="brand"><span className="mark">D</span><span><strong>DineUp</strong><small>WHERE RESTAURANTS RISE</small></span></Link>
      <div className="hero"><span className="eyebrow">FOR RESTAURANTS</span><h1>Put your restaurant where customers see it.</h1><p>Create your restaurant account, submit your listing for approval, and compete for higher visibility on DineUp.</p>
      <div className="steps"><Step n="1" title="Create account" text="Set up your restaurant profile" active/><Step n="2" title="Admin approval" text="We review your listing"/><Step n="3" title="Start bidding" text="Rise higher on the leaderboard"/></div></div>
    </div>
    <div className="card"><div className="header"><span className="eyebrow">RESTAURANT PARTNER</span><h2>Create your account</h2><p>Submit your restaurant for DineUp approval.</p></div>
      {message&&<div className={success?"message success":"message error"}><strong>{success?"You're almost there":"Unable to continue"}</strong><span>{message}</span></div>}
      {!success&&<form onSubmit={handleSignup}>
        <Field label="Restaurant name" required><input value={restaurantName} onChange={e=>setRestaurantName(e.target.value)} placeholder="e.g. Royal Awadh Kitchen" required/></Field>
        <div className="cols"><Field label="Email" required><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@restaurant.com" autoComplete="email" required/></Field><Field label="Phone"><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+91 98765 43210"/></Field></div>
        <div className="cols"><Field label="City" required><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Lucknow" required/></Field><Field label="Category" required><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field></div>
        <Field label="Restaurant address" required><textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Full restaurant address" rows={3} required/></Field>
        <div className="cols"><Field label="Password" required><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimum 8 characters" autoComplete="new-password" required/></Field><Field label="Confirm password" required><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" required/></Field></div>
        <div className="note"><span>✓</span><div><strong>Admin approval required</strong><p>Your restaurant remains pending until the DineUp admin team approves the listing.</p></div></div>
        <button className="submit" disabled={loading}>{loading?"Creating account...":"Create restaurant account →"}</button>
      </form>}
      <div className="login">Already have a restaurant account? <Link href="/restaurant/login">Sign in</Link></div>
    </div>
  </section><style jsx global>{styles}</style></main>;
}

function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){return <div className="field"><label>{label} {required&&<b>*</b>}</label>{children}</div>}
function Step({n,title,text,active}:{n:string;title:string;text:string;active?:boolean}){return <div className="step"><span className={active?"num active":"num"}>{n}</span><div><strong>{title}</strong><small>{text}</small></div></div>}

const styles=`*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;background:#f4f5f7;color:#171717}button,input,textarea,select{font:inherit}.signupPage{min-height:100vh;padding:42px 24px;background:#f4f5f7}.shell{max-width:1120px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(450px,540px);gap:72px;align-items:center}.brand{display:inline-flex;align-items:center;gap:11px;text-decoration:none;color:#171717}.mark{width:42px;height:42px;border-radius:12px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:21px}.brand strong{display:block;font-size:21px}.brand small{display:block;margin-top:2px;color:#85898f;font-size:8px;font-weight:800;letter-spacing:1.5px}.hero{margin-top:85px;max-width:500px}.eyebrow{display:block;color:#85898f;font-size:9px;font-weight:900;letter-spacing:1.8px}.hero h1{margin:12px 0 14px;font-size:47px;line-height:1.04;letter-spacing:-2px}.hero>p{margin:0;color:#70747a;font-size:14px;line-height:1.7}.steps{margin-top:38px;display:flex;flex-direction:column;gap:17px}.step{display:flex;align-items:center;gap:13px}.num{width:30px;height:30px;border-radius:9px;background:#e6e7e9;color:#777b80;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900}.num.active{background:#171717;color:#fff}.step strong,.step small{display:block}.step strong{font-size:11px}.step small{margin-top:3px;color:#96999e;font-size:9px}.card{background:#fff;border:1px solid #e4e5e8;border-radius:20px;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,.07)}.header{margin-bottom:22px}.header h2{margin:8px 0 5px;font-size:24px}.header p{margin:0;color:#92959a;font-size:11px}.message{border-radius:10px;padding:12px 13px;margin-bottom:16px;font-size:10px}.message strong,.message span{display:block}.message span{margin-top:4px;line-height:1.5}.error{background:#fff0f0;border:1px solid #f0cccc;color:#9b3030}.success{background:#eaf8f0;border:1px solid #ccebd9;color:#247b4d}.field{margin-bottom:15px}.field label{display:block;margin-bottom:7px;color:#5f6369;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.65px}.field input,.field textarea,.field select{width:100%;border:1px solid #dfe1e4;border-radius:9px;background:#fff;color:#171717;padding:11px 12px;outline:none;font-size:11px}.field textarea{resize:vertical;line-height:1.5}.field input:focus,.field textarea:focus,.field select:focus{border-color:#777}.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.note{display:flex;gap:10px;background:#f6f7f8;border:1px solid #e8e9eb;border-radius:10px;padding:12px;margin:4px 0 17px}.note>span{width:25px;height:25px;border-radius:8px;background:#171717;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0}.note strong{font-size:10px}.note p{margin:4px 0 0;color:#85898f;font-size:9px;line-height:1.45}.submit{width:100%;border:0;border-radius:10px;background:#171717;color:#fff;padding:13px;font-size:11px;font-weight:800;cursor:pointer}.submit:disabled{opacity:.55}.login{text-align:center;margin-top:17px;color:#8b8e94;font-size:10px}.login a{color:#171717;font-weight:800;text-decoration:none}@media(max-width:900px){.shell{grid-template-columns:1fr;max-width:650px;gap:35px}.hero{margin-top:45px}}@media(max-width:600px){.signupPage{padding:24px 14px}.hero h1{font-size:35px;letter-spacing:-1.4px}.card{padding:22px 18px}.cols{grid-template-columns:1fr}}`;
