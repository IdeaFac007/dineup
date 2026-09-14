"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function RestaurantLogin() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/restaurant/dashboard");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand">
          Dine<span>Up</span>
        </Link>

        <div className="eyebrow">RESTAURANT PARTNER</div>

        <h1>Grow your restaurant’s visibility.</h1>

        <p className="muted">
          Login to manage your restaurant profile, promotion and leaderboard
          position.
        </p>

        <form onSubmit={handleLogin} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@restaurant.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {error && (
            <p style={{ color: "crimson", marginTop: 8 }}>
              {error}
            </p>
          )}

          <button
            className="primary-btn"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Login to dashboard →"}
          </button>
        </form>

        <div className="demo-note">
          <strong>Secure login:</strong> Your credentials are handled by
          Supabase Authentication.
        </div>

        <p className="back-link">
          <Link href="/">← Back to DineUp</Link>
        </p>
      </div>
    </main>
  );
}
