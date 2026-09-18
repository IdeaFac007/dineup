"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Restaurant = {
  id: number; name: string; city: string; category: string | null; address: string | null;
  current_bid: number | null; is_claimed: boolean | null; is_active: boolean | null;
  owner_id: string | null; created_at: string | null; claim_status: string; profile_completion_pct: number;
};

type Profile = {
  restaurant_id: number; phone: string | null; whatsapp: string | null; website_url: string | null;
  menu_url: string | null; instagram_url: string | null; google_maps_url: string | null;
  description: string | null; price_range: string | null; owner_name: string | null; owner_designation: string | null;
};

type Step = { step: string; status: string; completed_at: string | null };
type Claim = { id:number; restaurant_id:number; user_id:string; owner_name:string; phone:string|null; email:string|null; message:string|null; status:string; admin_note:string|null; created_at:string; restaurant?: { name:string; city:string } | null };

const supabase = createClient();

export default function AdminRestaurantsPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [search, setSearch] = useState("");
  const [claimFilter, setClaimFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", city: "Lucknow", category: "", address: "" });
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimBusy, setClaimBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/admin/login"); return; }
      const { data: adminUser } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adminUser) { await supabase.auth.signOut(); router.replace("/admin/login"); return; }
      const { data, error } = await supabase.from("restaurants")
        .select("id,name,city,category,address,current_bid,is_claimed,is_active,owner_id,created_at,claim_status,profile_completion_pct")
        .order("name");
      if (error) throw new Error(error.message);
      setRestaurants((data || []) as Restaurant[]);
      const { data: claimData, error: claimError } = await supabase.from("restaurant_claim_requests").select("id,restaurant_id,user_id,owner_name,phone,email,message,status,admin_note,created_at,restaurants(name,city)").eq("status","pending").order("created_at",{ascending:false});
      if (claimError) throw new Error(claimError.message);
      setClaims((claimData || []) as unknown as Claim[]);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load restaurants."); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function openDetails(r: Restaurant) {
    setSelected(r); setProfile(null); setSteps([]); setDetailLoading(true);
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from("restaurant_profiles").select("restaurant_id,phone,whatsapp,website_url,menu_url,instagram_url,google_maps_url,description,price_range,owner_name,owner_designation").eq("restaurant_id", r.id).maybeSingle(),
      supabase.from("restaurant_onboarding_steps").select("step,status,completed_at").eq("restaurant_id", r.id).order("id"),
    ]);
    setProfile((p || null) as Profile | null); setSteps((s || []) as Step[]); setDetailLoading(false);
  }

  async function updateRestaurant(id: number, patch: Partial<Restaurant>) {
    setBusyId(id); setError("");
    try {
      const { data, error: e } = await supabase.from("restaurants").update(patch).eq("id", id)
        .select("id,name,city,category,address,current_bid,is_claimed,is_active,owner_id,created_at,claim_status,profile_completion_pct").single();
      if (e) throw new Error(e.message);
      setRestaurants(cur => cur.map(r => r.id === id ? data as Restaurant : r));
      if (selected?.id === id) setSelected(data as Restaurant);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update restaurant."); }
    finally { setBusyId(null); }
  }

  async function reviewClaim(id:number,status:"approved"|"rejected"){
    setClaimBusy(id); setError("");
    try{
      const note=status==="rejected" ? window.prompt("Reason for rejection (optional):") : null;
      const {error:e}=await supabase.rpc("admin_review_restaurant_claim",{p_claim_id:id,p_status:status,p_admin_note:note||null,p_verification_method:"manual"});
      if(e) throw new Error(e.message);
      setClaims(cur=>cur.filter(x=>x.id!==id)); await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to review claim.");}
    finally{setClaimBusy(null)}
  }

  async function addRestaurant(e: React.FormEvent) {
    e.preventDefault(); if (!form.name.trim() || !form.city.trim()) return;
    setAdding(true); setError("");
    try {
      const { data, error: e } = await supabase.rpc("admin_create_restaurant", {
        p_name: form.name, p_city: form.city, p_category: form.category || null, p_address: form.address || null, p_is_active: true
      });
      if (e) throw new Error(e.message);
      setShowAdd(false); setForm({ name: "", city: "Lucknow", category: "", address: "" });
      await load();
      if (data) {
        const { data: created } = await supabase.from("restaurants").select("id,name,city,category,address,current_bid,is_claimed,is_active,owner_id,created_at,claim_status,profile_completion_pct").eq("id", data).single();
        if (created) openDetails(created as Restaurant);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add restaurant."); }
    finally { setAdding(false); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return restaurants.filter(r => {
      const text = [r.name, r.city, r.category || "", r.address || ""].join(" ").toLowerCase();
      return (!q || text.includes(q)) && (claimFilter === "all" || r.claim_status === claimFilter);
    });
  }, [restaurants, search, claimFilter]);

  return (
    <main style={page}>
      <header style={header}>
        <div><div style={crumb}>DineUp / Admin / Restaurants</div><h1 style={h1}>Restaurant Management</h1><p style={sub}>Onboard, verify and manage restaurant listings.</p></div>
        <div style={row}><button onClick={() => router.push("/admin/dashboard")} style={button(false)}>← Dashboard</button><button onClick={() => setShowAdd(true)} style={button(true)}>+ Add Restaurant</button></div>
      </header>

      {error && <div style={errorBox}>{error}</div>}

      <section style={{...card,marginBottom:18}}>
        <div style={toolbar}><div><strong style={{fontSize:15}}>Pending Restaurant Claims</strong><div style={muted}>{claims.length} awaiting review</div></div><span style={pill(claims.length?"pending":"verified")}>{claims.length?"Action required":"Clear"}</span></div>
        {!claims.length ? <div style={empty}>No pending ownership claims.</div> : <div style={{overflowX:"auto"}}><table style={table}><thead><tr>{["Restaurant","Claimant","Contact","Message","Submitted","Actions"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>
        {claims.map(x=><tr key={x.id}><td style={td}><strong>{x.restaurant?.name||("#"+x.restaurant_id)}</strong><small>{x.restaurant?.city||"—"}</small></td><td style={td}><strong>{x.owner_name}</strong><small>{x.email||"—"}</small></td><td style={td}>{x.phone||"—"}</td><td style={{...td,maxWidth:250,color:"#777"}}>{x.message||"No message provided"}</td><td style={{...td,color:"#777"}}>{new Date(x.created_at).toLocaleDateString("en-IN")}</td><td style={td}><div style={row}><button disabled={claimBusy===x.id} onClick={()=>reviewClaim(x.id,"approved")} style={button(true)}>Approve</button><button disabled={claimBusy===x.id} onClick={()=>reviewClaim(x.id,"rejected")} style={button(false)}>Reject</button></div></td></tr>)}
        </tbody></table></div>}
      </section>

      <section style={card}>
        <div style={toolbar}>
          <div><strong style={{fontSize:15}}>All Restaurants</strong><div style={muted}>{restaurants.length} listed</div></div>
          <div style={row}>
            <select value={claimFilter} onChange={e => setClaimFilter(e.target.value)} style={input}><option value="all">All claim states</option><option value="unclaimed">Unclaimed</option><option value="claimed">Claimed</option><option value="verification_pending">Verification pending</option><option value="verified">Verified</option></select>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search restaurant..." style={{...input,width:220}} />
          </div>
        </div>
        {loading ? <div style={empty}>Loading restaurants…</div> : !filtered.length ? <div style={empty}>No restaurants found.</div> : (
          <div style={{overflowX:"auto"}}><table style={table}><thead><tr>{["Restaurant","City","Bid","Claim","Profile","Active","Owner","Actions"].map(x=><th key={x} style={th}>{x}</th>)}</tr></thead><tbody>
          {filtered.map(r => <tr key={r.id}>
            <td style={td}><strong>{r.name}</strong><small>{r.category || "—"}</small></td><td style={td}>{r.city}</td><td style={{...td,fontWeight:800}}>{money(r.current_bid)}</td>
            <td style={td}><span style={pill(r.claim_status)}>{labelClaim(r.claim_status)}</span></td><td style={td}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={bar}><div style={{...barFill,width:r.profile_completion_pct+"%"}}/></div><span style={{fontSize:8}}>{r.profile_completion_pct}%</span></div></td>
            <td style={td}><span style={pill(r.is_active === false ? "inactive" : "verified")}>{r.is_active === false ? "Inactive" : "Active"}</span></td><td style={{...td,color:"#888",fontSize:9}}>{r.owner_id ? "Assigned" : "Unassigned"}</td>
            <td style={td}><button onClick={() => openDetails(r)} style={action}>Manage</button></td>
          </tr>)}</tbody></table></div>
        )}
      </section>

      {selected && <div style={overlay}><aside style={drawer}>
        <div style={drawerHead}><div><div style={crumb}>Restaurant #{selected.id}</div><h2 style={{margin:"5px 0",fontSize:21}}>{selected.name}</h2><div style={muted}>{selected.city} · {selected.category || "No category"}</div></div><button onClick={() => setSelected(null)} style={close}>×</button></div>
        {detailLoading ? <div style={empty}>Loading profile…</div> : <>
          <div style={statGrid}><Stat title="Claim" value={labelClaim(selected.claim_status)} /><Stat title="Profile" value={selected.profile_completion_pct+"%"} /><Stat title="Listing" value={selected.is_active === false ? "Inactive" : "Active"} /></div>
          <div style={section}><h3>Claim & Listing</h3><div style={row}><button disabled={busyId===selected.id} onClick={() => updateRestaurant(selected.id,{claim_status:selected.claim_status==="verified"?"unclaimed":"verified",is_claimed:selected.claim_status!=="verified"})} style={button(true)}>{selected.claim_status==="verified" ? "Mark Unclaimed" : "Verify Claim"}</button><button disabled={busyId===selected.id} onClick={() => updateRestaurant(selected.id,{is_active:selected.is_active===false})} style={button(false)}>{selected.is_active===false ? "Activate" : "Deactivate"}</button></div></div>
          <div style={section}><h3>Contact & Links</h3><Info label="Phone" value={profile?.phone}/><Info label="WhatsApp" value={profile?.whatsapp}/><Info label="Website" value={profile?.website_url}/><Info label="Instagram" value={profile?.instagram_url}/><Info label="Menu" value={profile?.menu_url}/><Info label="Maps" value={profile?.google_maps_url}/></div>
          <div style={section}><h3>Onboarding</h3>{steps.map(s=><div key={s.step} style={stepRow}><span>{pretty(s.step)}</span><span style={pill(s.status==="completed"?"verified":"neutral")}>{s.status}</span></div>)}</div>
          <div style={section}><h3>Owner</h3><Info label="Name" value={profile?.owner_name}/><Info label="Designation" value={profile?.owner_designation}/><Info label="Address" value={selected.address}/></div>
        </>}
      </aside></div>}

      {showAdd && <div style={overlay}><form onSubmit={addRestaurant} style={modal}><div style={drawerHead}><div><h2 style={{margin:0,fontSize:20}}>Add Restaurant</h2><div style={muted}>Create a new listing and start onboarding.</div></div><button type="button" onClick={() => setShowAdd(false)} style={close}>×</button></div>
        {["name","city","category","address"].map(k=><label key={k} style={label}>{pretty(k)}<input required={k==="name"||k==="city"} value={form[k as keyof typeof form]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={k==="name"?"Restaurant name":k==="city"?"City":"Optional"} style={input}/></label>)}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}><button type="button" onClick={()=>setShowAdd(false)} style={button(false)}>Cancel</button><button disabled={adding} style={button(true)}>{adding?"Creating…":"Create Restaurant"}</button></div>
      </form></div>}
    </main>
  );
}

function Stat({title,value}:{title:string,value:string}) { return <div style={stat}><span>{title}</span><strong>{value}</strong></div>; }
function Info({label,value}:{label:string,value:string|null|undefined}) { return <div style={info}><span>{label}</span><strong>{value || "Not provided"}</strong></div>; }
function money(v:number|null){return "₹"+Number(v||0).toLocaleString("en-IN")}
function labelClaim(v:string){return ({unclaimed:"Unclaimed",claimed:"Claimed",verification_pending:"Pending",verified:"Verified"} as Record<string,string>)[v]||v}
function pretty(v:string){return v.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase())}

const page={minHeight:"100vh",background:"#f5f6f8",padding:"28px 38px",color:"#171717",fontFamily:"Arial,Helvetica,sans-serif"};
const header={display:"flex",justifyContent:"space-between",gap:18,alignItems:"flex-start",marginBottom:22};
const crumb={color:"#92969c",fontSize:10,fontWeight:800}; const h1={margin:"6px 0 0",fontSize:28}; const sub={margin:"7px 0 0",color:"#8b8f95",fontSize:11}; const row={display:"flex",gap:8,alignItems:"center"};
const card={background:"#fff",border:"1px solid #e5e7ea",borderRadius:15,overflow:"hidden"}; const toolbar={padding:18,borderBottom:"1px solid #ececef",display:"flex",justifyContent:"space-between",gap:15,alignItems:"center"}; const muted={color:"#92959a",fontSize:9,marginTop:4};
const input={padding:"10px 11px",border:"1px solid #dedfe2",borderRadius:9,fontSize:10,outline:"none",background:"#fff"}; const button=(primary:boolean)=>({border:primary?"0":"1px solid #dcdfe3",background:primary?"#171717":"#fff",color:primary?"#fff":"#171717",borderRadius:9,padding:"10px 13px",fontSize:10,fontWeight:800,cursor:"pointer"});
const table={width:"100%",borderCollapse:"collapse" as const,minWidth:1050}; const th={background:"#fafafa",color:"#888b91",fontSize:8,textTransform:"uppercase" as const,letterSpacing:".8px",textAlign:"left" as const,padding:"13px 16px",borderBottom:"1px solid #e9eaec"}; const td={padding:"13px 16px",borderBottom:"1px solid #f0f0f1",fontSize:10}; const empty={padding:55,textAlign:"center" as const,color:"#999",fontSize:11}; const action={border:"1px solid #d9dce0",background:"#fff",borderRadius:8,padding:"7px 10px",fontSize:8,fontWeight:800,cursor:"pointer"}; const errorBox={background:"#fff1f1",border:"1px solid #f0c9c9",color:"#9b2929",padding:12,borderRadius:10,marginBottom:15,fontSize:11};
const bar={width:55,height:5,background:"#eceef0",borderRadius:9,overflow:"hidden" as const}; const barFill={height:"100%",background:"#171717",borderRadius:9};
function pill(v:string){const good=["verified","completed","active"].includes(v);const danger=["inactive"].includes(v);return {display:"inline-flex",padding:"5px 8px",borderRadius:999,fontSize:8,fontWeight:800,background:good?"#e9f7ef":danger?"#fff0f0":"#f0f1f3",color:good?"#258150":danger?"#a43b3b":"#777b80"}}
const overlay={position:"fixed" as const,inset:0,background:"rgba(0,0,0,.28)",display:"flex",justifyContent:"flex-end",zIndex:50}; const drawer={width:440,maxWidth:"92vw",height:"100%",background:"#fff",padding:24,overflowY:"auto" as const,boxShadow:"-10px 0 30px rgba(0,0,0,.12)"}; const modal={width:430,maxWidth:"92vw",background:"#fff",borderRadius:16,padding:24,alignSelf:"center",margin:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.18)"};
const drawerHead={display:"flex",justifyContent:"space-between",gap:15,alignItems:"flex-start",marginBottom:18}; const close={border:0,background:"#f1f2f4",width:32,height:32,borderRadius:8,fontSize:20,cursor:"pointer"}; const statGrid={display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}; const stat={background:"#f7f7f8",borderRadius:10,padding:12}; const section={borderTop:"1px solid #ececef",paddingTop:17,marginTop:17}; const info={display:"flex",justifyContent:"space-between",gap:15,padding:"7px 0",fontSize:9}; const stepRow={display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:10}; const label={display:"block",fontSize:9,fontWeight:800,textTransform:"uppercase" as const,letterSpacing:".5px",marginBottom:12};
