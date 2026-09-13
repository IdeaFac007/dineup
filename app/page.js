'use client'

import { useMemo, useState } from 'react'
import { supabaseBrowser } from '../lib/supabase-browser'

const demo = [
  {name:'The Urban Terrace', category:'North Indian', area:'Gomti Nagar', bid:5100},
  {name:'Cafe Mocha', category:'Cafe', area:'Hazratganj', bid:5000},
  {name:'Spice Route', category:'Chinese', area:'Indira Nagar', bid:4200},
  {name:'Oven Story', category:'Pizza', area:'Aliganj', bid:3500}
]

export default function Home() {
  const [q,setQ]=useState('')
  const [show,setShow]=useState(false)
  const [email,setEmail]=useState('')
  const [msg,setMsg]=useState('')
  const list=useMemo(()=>demo.filter(x=>(x.name+' '+x.category+' '+x.area).toLowerCase().includes(q.toLowerCase())),[q])

  async function login(e){
    e.preventDefault()
    setMsg('')
    if(!process.env.NEXT_PUBLIC_SUPABASE_URL){setMsg('Supabase is not configured yet. Add .env.local from .env.example.');return}
    const supabase=supabaseBrowser()
    const {error}=await supabase.auth.signInWithOtp({email})
    setMsg(error ? error.message : 'Magic-link sent. Check your email.')
  }

  return <>
    <nav className="nav">
      <div className="logo">Dine<span>Up</span></div>
      <div className="navlinks"><a href="#leaderboard">Leaderboard</a><a href="#how">How it works</a><button className="btn primary" onClick={()=>setShow(true)}>Restaurant Login</button></div>
    </nav>

    <header className="hero">
      <div className="wrap" style={{padding:'0'}}>
        <span className="pill">LIVE PILOT · LUCKNOW</span>
        <h1>Discover where restaurants rise.</h1>
        <p>DineUp gives restaurants a transparent way to compete for attention while helping diners discover places rising in their city.</p>
        <button className="btn primary" onClick={()=>document.getElementById('leaderboard').scrollIntoView({behavior:'smooth'})}>Explore leaderboard ↓</button>
      </div>
    </header>

    <main id="leaderboard" className="wrap">
      <h2>Top restaurants today</h2><p className="muted">Sponsored positions are clearly labelled.</p>
      <div style={{margin:'18px 0'}}><input aria-label="Search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search restaurants, cuisines or areas..." style={{width:'100%',maxWidth:520,padding:14,border:'1px solid #ddd',borderRadius:10}}/></div>
      <div className="grid">{list.map((x,i)=><article className="card" key={x.name}><div className="row"><div className="rank">#{i+1}</div><span className="pill">SPONSORED</span></div><h3>{x.name}</h3><p className="muted">{x.category} · {x.area}</p><div className="row"><span>Current bid</span><span className="price">₹{x.bid.toLocaleString('en-IN')}</span></div><button className="btn primary" style={{marginTop:15}} onClick={()=>alert('Production flow: sign in → create campaign → pay → bid is recorded in database.')}>View restaurant</button></article>)}</div>
    </main>

    <section id="how" className="wrap">
      <h2>Built for real restaurant growth</h2>
      <div className="grid">
        <div className="card feature"><h3>Restaurant accounts</h3><p className="muted">Magic-link authentication with Supabase Auth.</p></div>
        <div className="card feature"><h3>Live bidding</h3><p className="muted">Database-backed campaigns and bids, with server-side validation.</p></div>
        <div className="card feature"><h3>Payments</h3><p className="muted">Razorpay integration point is ready for secure server-side order creation.</p></div>
      </div>
    </section>

    <footer className="footer">DineUp © 2026 · Where Restaurants Rise</footer>

    {show && <div onClick={e=>e.target===e.currentTarget&&setShow(false)} style={{position:'fixed',inset:0,background:'#0008',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div className="card" style={{width:'min(450px,100%)'}}><h2>Restaurant Login</h2><p className="muted">Enter your email and we will send a secure magic link.</p>
      <form onSubmit={login}><div className="field"><label>Email</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@restaurant.com"/></div><button className="btn primary" type="submit">Send login link</button><button className="btn" type="button" onClick={()=>setShow(false)}>Cancel</button></form>
      {msg&&<div className="notice">{msg}</div>}</div>
    </div>}
  </>
}
