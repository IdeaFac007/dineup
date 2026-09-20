export default function AccountPage(){
 const router=useRouter(),supabase=createClient();
 const[user,setUser]=useState<any>(null),[loading,setLoading]=useState(true),[favorites,setFavorites]=useState<any[]>([]),[recent,setRecent]=useState<any[]>([]);
 useEffect(()=>{(async()=>{
   const{data:{user}}=await supabase.auth.getUser();
   if(!user){router.replace("/login");return}
   setUser(user);
   const {data:favs}=await supabase.from("customer_favorites").select("restaurant_id,created_at").eq("user_id",user.id).order("created_at",{ascending:false});
   const favIds=(favs||[]).map((x:any)=>Number(x.restaurant_id));
   if(favIds.length){
     const {data:rs}=await supabase.from("restaurants").select("id,name,city,category,is_claimed").in("id",favIds).eq("is_active",true);
     const map=new Map((rs||[]).map((r:any)=>[Number(r.id),r]));
     setFavorites(favIds.map((id:number)=>map.get(id)).filter(Boolean));
   }
   try{
     const ids=JSON.parse(localStorage.getItem("dineup_recently_viewed")||"[]") as number[];
     if(ids.length){
       const {data:rs}=await supabase.from("restaurants").select("id,name,city,category,is_claimed").in("id",ids).eq("is_active",true);
       const map=new Map((rs||[]).map((r:any)=>[Number(r.id),r]));
       setRecent(ids.map(id=>map.get(id)).filter(Boolean));
     }
   }catch{}
   setLoading(false);
 })()},[router]);
 async function signOut(){await supabase.auth.signOut();router.replace("/");router.refresh()}
 if(loading)return <main className="page"><div className="loading">Loading your account...</div><style jsx>{css}</style></main>;
 const name=user?.user_metadata?.full_name||"DineUp diner";
 const firstName=name.split(" ")[0];
 const categoryCounts=new Map<string,number>();
 favorites.forEach((r:any)=>categoryCounts.set(r.category,(categoryCounts.get(r.category)||0)+1));
 const favoriteCategory=[...categoryCounts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
 const recentCity=recent[0]?.city;
 return <main className="page">
   <header><Link href="/" className="brand"><span>D</span><b>DineUp</b></Link><button onClick={signOut}>Sign out</button></header>
   <section className="hero"><small>YOUR DINEUP ACCOUNT</small><h1>Welcome, <em>{firstName}.</em></h1><p>Your saved places, recent discoveries and dining preferences — all in one place.</p>
     <div className="personalStats">
       <div><strong>{favorites.length}</strong><span>Saved places</span></div>
       <div><strong>{recent.length}</strong><span>Recent discoveries</span></div>
       <div><strong>{favoriteCategory||"—"}</strong><span>Favourite category</span></div>
       <div><strong>{recentCity||"—"}</strong><span>Latest city</span></div>
     </div>
   </section>
   <section className="grid">
     <div className="panel wide"><i>♥</i><h2>Your favourites <small className="count">({favorites.length})</small></h2>
       {favorites.length?<div className="savedList">{favorites.map((r:any)=><div className="savedItem" key={r.id}><Link href={"/restaurant/"+r.id}><div><b>{r.name}</b><span>{r.city} · {r.category}</span></div><span>→</span></Link><button onClick={async()=>{const {error}=await supabase.from("customer_favorites").delete().eq("user_id",user.id).eq("restaurant_id",r.id);if(!error)setFavorites(prev=>prev.filter(x=>x.id!==r.id))}} aria-label={"Remove "+r.name+" from favourites"}>♥</button></div>)}</div>:<p>Save restaurants you want to revisit. Your favourites will appear here.</p>}
       <Link href="/" className="action">Discover restaurants →</Link>
     </div>
     <div className="panel wide"><i>◷</i><h2>Recently viewed <small className="count">({recent.length})</small></h2>
       {recent.length?<div className="savedList">{recent.slice(0,8).map((r:any)=><Link className="recentItem" key={r.id} href={"/restaurant/"+r.id}><div><b>{r.name}</b><span>{r.city} · {r.category}</span></div><span>→</span></Link>)}</div>:<p>Restaurants you open on DineUp will appear here.</p>}
       <Link href="/" className="action">Discover restaurants →</Link>
     </div>
     <div className="panel wide"><i>✦</i><h2>Personalized for you</h2>
       {favoriteCategory||recentCity?<p className="personalText">Based on your activity, DineUp will keep your <b>{favoriteCategory||"saved"} {favoriteCategory?"restaurants":"places"}</b>{recentCity?<> and discoveries around <b>{recentCity}</b></>:null} easy to find.</p>:<p className="personalText">Save a few restaurants or explore places around a city to start building your DineUp preferences.</p>}
       <div className="personalActions"><Link href="/" className="action">Explore restaurants →</Link>{recentCity&&<Link href={"/?city="+encodeURIComponent(recentCity)} className="secondaryAction">Explore {recentCity}</Link>}</div>
     </div>
     <div className="panel wide"><i>◌</i><h2>Account details</h2><div className="details"><div><small>Name</small><b>{name}</b></div><div><small>Email</small><b>{user.email}</b></div></div></div>
   </section>
   <style jsx>{css}</style>
 </main>
}

const css=`*{box-sizing:border-box}.page{min-height:100vh;background:#f7f5f0;color:#171717;padding:28px max(18px,calc((100% - 1080px)/2));font-family:Arial,sans-serif}.page header{display:flex;justify-content:space-between;align-items:center}.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#171717}.brand span{width:38px;height:38px;border-radius:11px;background:#171717;color:#ed650c;display:grid;place-items:center;font-weight:900}.brand b{font-size:21px}.page header button{border:1px solid #ddd7ce;background:#fff;border-radius:9px;padding:10px 14px;font-size:11px;font-weight:800;cursor:pointer}.hero{padding:75px 0 35px}.hero>small{font-size:9px;letter-spacing:.17em;font-weight:900;color:#8a8177}.hero h1{font-size:58px;line-height:.95;letter-spacing:-.06em;margin:10px 0}.hero h1 em{font-family:Georgia,serif;color:#d86118;font-weight:400}.hero p{color:#777;font-size:14px}.personalStats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:28px}.personalStats>div{background:#fff;border:1px solid #e4dfd7;border-radius:14px;padding:15px 14px;display:flex;flex-direction:column;gap:5px}.personalStats strong{font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.personalStats span{font-size:10px;color:#888}.personalText{line-height:1.65!important}.personalActions{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.secondaryAction{font-size:11px;color:#d86118;text-decoration:none;font-weight:800;border-bottom:1px solid #e9c5ad;padding-bottom:3px}@media(max-width:700px){.personalStats{grid-template-columns:1fr 1fr}.personalStats>div{padding:12px}.personalStats strong{font-size:15px}}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{background:#fff;border:1px solid #e4dfd7;border-radius:18px;padding:24px;box-shadow:0 8px 28px rgba(45,30,15,.05)}.panel.wide{grid-column:1/-1}.count{font-size:11px;color:#999;font-weight:600}.savedList{margin-top:15px;border-top:1px solid #eee8df}.savedItem{display:flex;align-items:center;gap:8px;border-bottom:1px solid #eee8df}.savedItem a,.recentItem{flex:1;display:flex;align-items:center;justify-content:space-between;gap:12px;text-decoration:none;color:#171717;padding:13px 0}.savedItem a div,.recentItem div{display:flex;flex-direction:column;gap:4px}.savedItem b,.recentItem b{font-size:13px}.savedItem span,.recentItem span{font-size:11px;color:#888}.savedItem>button{width:32px;height:32px;border:1px solid #ead8cb;background:#fff;border-radius:50%;color:#ed650c;cursor:pointer}.recentItem{border-bottom:1px solid #eee8df}.panel i{font-style:normal;font-size:26px;color:#ed650c}.panel h2{font-size:21px;margin:12px 0 8px}.panel p{font-size:12px;line-height:1.6;color:#777;min-height:38px}.action,.disabled{display:inline-flex;margin-top:10px;border:0;border-radius:9px;background:#171717;color:#fff;text-decoration:none;padding:11px 14px;font-size:11px;font-weight:800}.disabled{opacity:.45;cursor:not-allowed}.details{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:17px}.details div{background:#f7f5f0;border-radius:10px;padding:13px}.details small,.details b{display:block}.details small{font-size:9px;color:#999;text-transform:uppercase;letter-spacing:.1em}.details b{font-size:12px;margin-top:5px}.loading{min-height:80vh;display:grid;place-items:center;color:#777;font-weight:700}@media(max-width:650px){.hero{padding:50px 0 28px}.hero h1{font-size:44px}.grid{grid-template-columns:1fr}.panel.wide{grid-column:auto}.details{grid-template-columns:1fr}}`;
