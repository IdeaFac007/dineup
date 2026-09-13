import Link from "next/link";

const restaurants = [
  ["01","Royal Awadh Kitchen","Awadhi • Hazratganj","₹5,000","Sponsored"],
  ["02","The Urban Terrace","North Indian • Gomti Nagar","₹4,250","Sponsored"],
  ["03","Saffron House","Fine Dining • Indira Nagar","₹3,600","Sponsored"],
];

export default function Home() {
  return (
    <main>
      <nav className="nav">
        <Link href="/" className="brand">Dine<span>Up</span></Link>
        <div className="nav-links">
          <a href="#leaderboard">Leaderboard</a>
          <a href="#how">How it works</a>
          <Link href="/restaurant/login" className="dark-btn">Restaurant Login</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow">LIVE PILOT • LUCKNOW</div>
        <h1>Discover where<br/>restaurants rise.</h1>
        <p>DineUp gives restaurants a transparent way to compete for attention while helping diners discover places rising in their city.</p>
        <a href="#leaderboard" className="dark-btn">Explore leaderboard ↓</a>
      </section>

      <section id="leaderboard" className="content">
        <div className="section-head">
          <div><div className="eyebrow">TODAY IN LUCKNOW</div><h2>Top restaurants today</h2></div>
          <span className="muted">Sponsored positions are clearly labelled.</span>
        </div>
        <div className="board">
          {restaurants.map((r) => (
            <div className="restaurant-row" key={r[0]}>
              <span className="rank">{r[0]}</span>
              <div className="rest-main"><strong>{r[1]}</strong><small>{r[2]}</small></div>
              <span className="sponsored">{r[4]}</span>
              <strong className="bid">{r[3]}</strong>
              <button className="outline-btn">View</button>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="how">
        <div className="eyebrow">FOR RESTAURANTS</div>
        <h2>Turn attention into footfall.</h2>
        <p>Set a bid, rise on the city leaderboard and let diners discover you. Your dashboard shows your rank, bid and customer actions.</p>
        <Link href="/restaurant/login" className="dark-btn">Open restaurant dashboard →</Link>
      </section>
    </main>
  );
}
