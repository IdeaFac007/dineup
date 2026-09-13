import Link from "next/link";

export default function RestaurantLogin() {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand">Dine<span>Up</span></Link>
        <div className="eyebrow">RESTAURANT PARTNER</div>
        <h1>Grow your restaurant’s visibility.</h1>
        <p className="muted">Login to manage your profile, promotion and leaderboard position.</p>

        <form action="/restaurant/dashboard" className="auth-form">
          <label>Email
            <input type="email" name="email" placeholder="owner@restaurant.com" required />
          </label>
          <label>Password
            <input type="password" name="password" placeholder="••••••••" required />
          </label>
          <button className="primary-btn" type="submit">Login to dashboard →</button>
        </form>

        <div className="demo-note">
          <strong>MVP demo:</strong> This login opens the working restaurant dashboard. Real Supabase authentication can be connected next.
        </div>

        <p className="back-link"><Link href="/">← Back to DineUp</Link></p>
      </div>
    </main>
  );
}
