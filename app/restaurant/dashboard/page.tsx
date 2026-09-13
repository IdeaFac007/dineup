import Link from "next/link";

const stats = [
  ["Current rank", "#7", "in Lucknow"],
  ["Current bid", "₹2,500", "today"],
  ["Profile views", "1,284", "+18% this week"],
  ["Customer actions", "86", "calls + directions"],
];

export default function RestaurantDashboard() {
  return (
    <main className="dashboard-page">
      <header className="dash-nav">
        <Link href="/" className="brand">Dine<span>Up</span></Link>
        <div className="dash-right">
          <span className="partner-pill">Restaurant Partner</span>
          <Link href="/" className="text-link">View marketplace</Link>
        </div>
      </header>

      <section className="dashboard-shell">
        <div className="dash-heading">
          <div>
            <div className="eyebrow">RESTAURANT DASHBOARD</div>
            <h1>Royal Awadh Kitchen</h1>
            <p className="muted">Lucknow • Awadhi • Fine Dining</p>
          </div>
          <Link href="/restaurant/bid" className="primary-btn">   Increase visibility ↑ </Link>
        </div>

        <div className="stats-grid">
          {stats.map(([label, value, note]) => (
            <div className="stat-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-title">
              <div><span className="live-dot" /> Live campaign</div>
              <span className="status">ACTIVE</span>
            </div>
            <div className="rank-box">
              <div>
                <small>Your position</small>
                <strong>#7</strong>
              </div>
              <div className="rank-arrow">↑</div>
              <div>
                <small>Next position</small>
                <strong>#6</strong>
              </div>
            </div>
            <div className="bid-row"><span>Current bid</span><strong>₹2,500</strong></div>
            <div className="bid-row"><span>Bid to reach #6</span><strong>₹2,650</strong></div>
            <button className="primary-btn full">Set new bid</button>
          </section>

          <section className="panel">
            <div className="panel-title"><div>Campaign settings</div></div>
            <label>City
              <select defaultValue="Lucknow"><option>Lucknow</option><option>Delhi</option><option>Mumbai</option></select>
            </label>
            <label>Category
              <select defaultValue="Fine Dining"><option>Fine Dining</option><option>North Indian</option><option>Cafe</option><option>Family Restaurant</option></select>
            </label>
            <label>Daily budget
              <input defaultValue="5000" type="number" min="100" />
            </label>
            <button className="secondary-btn full">Save campaign</button>
          </section>
        </div>

        <section className="panel table-panel">
          <div className="panel-title">
            <div>Leaderboard preview</div>
            <Link href="/" className="text-link">Open public board →</Link>
          </div>
          <div className="leader-row header"><span>Rank</span><span>Restaurant</span><span>Bid</span><span>Status</span></div>
          {[
            ["#5","The Urban Terrace","₹3,100"],
            ["#6","Saffron House","₹2,650"],
            ["#7","Royal Awadh Kitchen","₹2,500"],
            ["#8","Tunday House","₹2,200"],
          ].map((r) => (
            <div className={"leader-row " + (r[0] === "#7" ? "you" : "")} key={r[0]}>
              <span>{r[0]}</span><strong>{r[1]}</strong><span>{r[2]}</span><span>{r[0] === "#7" ? "You" : "Sponsored"}</span>
            </div>
          ))}
        </section>
      </section>
    </main>
  );
}
