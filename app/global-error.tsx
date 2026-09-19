"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{margin:0}}>
        <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#f7f3ec",fontFamily:"Arial,sans-serif",color:"#171717"}}>
          <section style={{width:"min(100%,520px)",textAlign:"center",background:"#fff",border:"1px solid #e5ddd2",borderRadius:"24px",padding:"48px 28px",boxShadow:"0 20px 60px rgba(40,25,10,.08)"}}>
            <div style={{fontSize:"12px",fontWeight:900,letterSpacing:".16em",color:"#ed650c"}}>DINEUP</div>
            <h1 style={{fontSize:"38px",letterSpacing:"-.05em",margin:"12px 0 10px"}}>DineUp needs a refresh.</h1>
            <p style={{color:"#777",lineHeight:1.6,margin:"0 auto 24px",maxWidth:"390px"}}>A temporary application error occurred. Please try again.</p>
            <button type="button" onClick={() => reset()} style={{border:0,borderRadius:"10px",padding:"13px 18px",background:"#171717",color:"#fff",fontWeight:800,cursor:"pointer"}}>Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
