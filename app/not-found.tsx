import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#f7f3ec",fontFamily:"Arial,sans-serif",color:"#171717"}}>
      <section style={{width:"min(100%,520px)",textAlign:"center",background:"#fff",border:"1px solid #e5ddd2",borderRadius:"24px",padding:"48px 28px",boxShadow:"0 20px 60px rgba(40,25,10,.08)"}}>
        <div style={{fontSize:"12px",fontWeight:900,letterSpacing:".16em",color:"#ed650c"}}>DINEUP</div>
        <h1 style={{fontSize:"42px",letterSpacing:"-.05em",margin:"12px 0 10px"}}>Page not found.</h1>
        <p style={{color:"#777",lineHeight:1.6,margin:"0 auto 24px",maxWidth:"390px"}}>The page you are looking for may have moved or is no longer available.</p>
        <Link href="/" style={{display:"inline-flex",padding:"13px 18px",borderRadius:"10px",background:"#171717",color:"#fff",textDecoration:"none",fontWeight:800,fontSize:"13px"}}>Back to DineUp →</Link>
      </section>
    </main>
  );
}
