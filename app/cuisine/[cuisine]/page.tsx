import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

function slugify(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")}
function titleCase(value:string){return value.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}

export async function generateMetadata({params}:{params:Promise<{cuisine:string}>}):Promise<Metadata>{
  const {cuisine}=await params;
  const name=titleCase(decodeURIComponent(cuisine||""));
  const canonical="https://dineupindia.com/cuisine/"+encodeURIComponent(cuisine);
  return {
    title:""+name+" Restaurants in India | DineUp",
    description:"Discover "+name+" restaurants across India on DineUp. Explore restaurant listings, locations and direct restaurant details.",
    alternates:{canonical},
    openGraph:{title:""+name+" Restaurants in India | DineUp",description:"Discover "+name+" restaurants across India on DineUp.",url:canonical,siteName:"DineUp",type:"website",locale:"en_IN"},
    twitter:{card:"summary",title:""+name+" Restaurants in India | DineUp",description:"Discover "+name+" restaurants across India on DineUp."},
    robots:{index:true,follow:true}
  };
}

export default async function CuisinePage({params}:{params:Promise<{cuisine:string}>}){
  const {cuisine:raw}=await params;
  const cuisineName=titleCase(decodeURIComponent(raw||""));
  const slug=slugify(cuisineName);
  const supabase=await createClient();
  const {data:profiles,error}=await supabase.from("restaurant_profiles").select("restaurant_id,cuisine_tags").eq("cuisine_tags","cs.{"+cuisineName+"}");
  let restaurants:any[]=[];
  if(!error && profiles?.length){
    const ids=profiles.map((p:any)=>Number(p.restaurant_id)).filter((id:number)=>Number.isInteger(id));
    const {data}=await supabase.from("restaurants").select("id,name,city,category,address,claim_status,current_bid").in("id",ids).eq("is_active",true).order("current_bid",{ascending:false,nullsFirst:false});
    restaurants=data||[];
  }
  if(!restaurants.length){
    const {data}=await supabase.from("restaurants").select("id,name,city,category,address,claim_status,current_bid").eq("is_active",true).ilike("category",cuisineName).order("current_bid",{ascending:false,nullsFirst:false});
    restaurants=data||[];
  }
  if(!restaurants.length) notFound();

  const pageUrl="https://dineupindia.com/cuisine/"+slug;
  const schema={"@context":"https://schema.org","@graph":[
    {"@type":"CollectionPage","@id":pageUrl+"#webpage",url:pageUrl,name:cuisineName+" Restaurants in India | DineUp",description:"Discover "+cuisineName+" restaurants across India on DineUp.",isPartOf:{"@id":"https://dineupindia.com/#website"},inLanguage:"en-IN"},
    {"@type":"ItemList","@id":pageUrl+"#restaurants",name:cuisineName+" Restaurants",numberOfItems:restaurants.length,itemListElement:restaurants.slice(0,50).map((r:any,index:number)=>({"@type":"ListItem",position:index+1,name:String(r.name||"Restaurant"),url:"https://dineupindia.com/restaurant/"+r.id}))},
    {"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem",position:1,name:"DineUp Marketplace",item:"https://dineupindia.com/marketplace"},{"@type":"ListItem",position:2,name:cuisineName,item:pageUrl}]}
  ]};

  return <main className="cuisinePage">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}} />
    <nav><Link href="/marketplace" className="brand">Dine<span>Up</span></Link><div><Link href="/marketplace">Marketplace</Link><Link href="/restaurant/apply">List your restaurant</Link></div></nav>
    <header><div className="wrap"><div className="crumb"><Link href="/marketplace">DineUp</Link><span>→</span><span>{cuisineName}</span></div><span className="kicker">DINEUP CUISINE GUIDE</span><h1>{cuisineName} <em>Restaurants</em> in India</h1><p>Discover {restaurants.length} {cuisineName.toLowerCase()} restaurant{restaurants.length===1?"":"s"} listed on DineUp across India.</p></div></header>
    <section className="wrap content"><div className="grid">{restaurants.map((r:any)=><Link key={r.id} href={"/restaurant/"+r.id} className="card"><span>{r.claim_status==="verified"?"✓ Verified":"DineUp listing"}{Number(r.current_bid||0)>0&&<b>Sponsored</b>}</span><h2>{r.name}</h2><p>{r.category||cuisineName} · {r.city}</p><small>{r.address||"Address available on restaurant profile"}</small><strong>View restaurant →</strong></Link>)}</div></section>
    <section className="more"><div className="wrap"><h2>Explore more on DineUp</h2><div className="links"><Link href="/marketplace">All restaurants</Link>{["north-indian","chinese","italian","south-indian","biryani","cafe","fast-food"].filter(x=>x!==slug).map(x=><Link key={x} href={"/cuisine/"+x}>{titleCase(x)}</Link>)}</div></div></section>
    <footer>DineUp · Discover restaurants across India</footer>
    <style dangerouslySetInnerHTML={{__html:css}} />
  </main>
}
const css=`*{box-sizing:border-box}.cuisinePage{min-height:100vh;background:#faf8f4;color:#171717;font-family:Arial,Helvetica,sans-serif}.wrap{width:min(1180px,calc(100% - 48px));margin:auto}nav{height:72px;background:#fff;border-bottom:1px solid #e8e2da;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100% - 1180px)/2));position:sticky;top:0;z-index:5}.brand{font-size:26px;font-weight:900;text-decoration:none;color:#171717}.brand span{color:#ed650c}nav div{display:flex;gap:22px}nav div a{font-size:12px;font-weight:800;color:#333;text-decoration:none}header{background:linear-gradient(120deg,#fff6e8,#f5e2c8);padding:48px 0;border-bottom:1px solid #eadfce}.crumb{display:flex;gap:8px;font-size:11px;color:#777;margin-bottom:22px}.crumb a{color:#222;text-decoration:none;font-weight:800}.kicker{font-size:10px;letter-spacing:.16em;font-weight:900;color:#ed650c}h1{font-size:clamp(44px,6vw,74px);line-height:.95;letter-spacing:-.06em;margin:10px 0 16px}h1 em{font-style:normal;color:#ed650c}header p{color:#665f58;max-width:720px;line-height:1.6}.content{padding:48px 0 65px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.card{background:#fff;border:1px solid #e5dfd7;border-radius:18px;padding:20px;text-decoration:none;color:#171717;min-height:190px;display:flex;flex-direction:column}.card>span{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#777;font-weight:900}.card>span b{float:right;color:#ed650c}.card h2{font-size:21px;margin:20px 0 5px}.card p{font-size:11px;color:#777;margin:0}.card small{font-size:11px;color:#777;line-height:1.5;margin:16px 0;flex:1}.card strong{font-size:10px;color:#ed650c}.more{background:#fff;border-top:1px solid #ebe5dd;padding:45px 0}.more h2{font-size:30px}.links{display:flex;gap:9px;flex-wrap:wrap}.links a{border:1px solid #e4ded6;border-radius:9px;padding:11px 14px;text-decoration:none;color:#222;font-size:11px;font-weight:800}footer{text-align:center;padding:30px;color:#888;font-size:11px}@media(max-width:850px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.wrap{width:calc(100% - 30px)}nav{padding:0 15px}nav div{gap:10px}nav div a{font-size:10px}.grid{grid-template-columns:1fr}h1{font-size:45px}}`;
