"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function RestaurantLogin() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError("Please enter your email and password.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data.user) {
        throw new Error("Login failed. Please try again.");
      }

      /*
       * Check that this logged-in user is connected
       * to a DineUp restaurant.
       */
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, city, category, owner_id")
        .eq("owner_id", data.user.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (restaurantError) {
        throw restaurantError;
      }

      if (!restaurant) {
        await supabase.auth.signOut();

        throw new Error(
          "No active restaurant is linked to this account. Please contact DineUp support."
        );
      }

      /*
       * Real authenticated user found and connected
       * to a restaurant.
       */
      router.push("/restaurant/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to login. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand">
          Dine<span>Up</span>
        </Link>

        <div className="eyebrow">RESTAURANT PARTNER</div>

        <h1>Welcome back.</h1>

        <p className="muted">
          Login to manage your restaurant visibility, campaign and leaderboard
          position.
        </p>

        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@restaurant.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div
              style={{
                marginTop: 4,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fff1f1",
                border: "1px solid #ffd1d1",
                color: "#b42318",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          <button
            className="primary-btn"
            type="submit"
            disabled={loading}
            style={{
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Logging in..." : "Login to dashboard →"}
          </button>
        </form>

        <div className="demo-note">
          <strong>Secure login:</strong> Your account is authenticated through
          DineUp and Supabase. Only an approved restaurant account linked to
          DineUp can access the partner dashboard.
        </div>

        <p className="back-link">
          <Link href="/">← Back to DineUp</Link>
        </p>
      </div>
    </main>
  );
}
