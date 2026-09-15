"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function RestaurantLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError || !data.user) {
        console.error("Login error:", loginError);

        if (
          loginError?.message?.toLowerCase().includes("email not confirmed")
        ) {
          setError(
            "Please verify your email before logging in."
          );
        } else {
          setError("Invalid email or password.");
        }

        setLoading(false);
        return;
      }

      const { data: restaurant, error: restaurantError } =
        await supabase
          .from("restaurants")
          .select(
            "id, name, city, category, owner_id, is_active, is_claimed"
          )
          .eq("owner_id", data.user.id)
          .eq("is_active", true)
          .maybeSingle();

      if (restaurantError) {
        console.error("Restaurant lookup error:", restaurantError);

        await supabase.auth.signOut();

        setError(
          "Unable to verify your restaurant account. Please try again."
        );

        setLoading(false);
        return;
      }

      if (!restaurant) {
        await supabase.auth.signOut();

        setError(
          "Your account is verified, but your restaurant has not been approved yet."
        );

        setLoading(false);
        return;
      }

      router.push("/restaurant/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Restaurant login error:", error);

      setError(
        "Something went wrong. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="loginShell">

        <div className="loginCard">

          <div className="brand">
            <div className="brandName">
              Dine<span>Up</span>
            </div>

            <div className="brandSub">
              RESTAURANT PARTNER
            </div>
          </div>

          <div className="intro">
            <h1>Welcome back.</h1>

            <p>
              Login to manage your restaurant visibility,
              campaign and leaderboard position.
            </p>
          </div>

          <form onSubmit={handleLogin}>

            <label>
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="owner@restaurant.com"
              autoComplete="email"
              required
            />

            <label>
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="errorBox">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Login to dashboard →"}
            </button>

          </form>

          <div className="forgot">
            <Link href="/restaurant/forgot-password">
              Forgot password?
            </Link>
          </div>

          <div className="secureBox">
            <strong>Secure login:</strong>{" "}
            Your account is authenticated through DineUp
            and Supabase. Only an approved restaurant
            account linked to DineUp can access the
            partner dashboard.
          </div>

          <div className="bottomLinks">
            <Link href="/">
              ← Back to DineUp
            </Link>

            <Link href="/restaurant/signup">
              Create restaurant account
            </Link>
          </div>

        </div>
      </div>

      <style jsx global>{`

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          background: #171717;
          color: #171717;
        }

        .loginPage {
          min-height: 100vh;
          background: #171717;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        .loginShell {
          width: 100%;
          max-width: 520px;
        }

        .loginCard {
          background: #fff;
          border-radius: 24px;
          padding: 48px;
          box-shadow:
            0 30px 80px rgba(0,0,0,.25);
        }

        .brandName {
          font-size: 30px;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        .brandName span {
          color: #c9792c;
        }

        .brandSub {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .intro {
          margin-top: 38px;
        }

        .intro h1 {
          margin: 0;
          font-size: 46px;
          line-height: 1;
          letter-spacing: -2px;
        }

        .intro p {
          margin: 18px 0 30px;
          color: #707070;
          font-size: 16px;
          line-height: 1.6;
        }

        form {
          display: flex;
          flex-direction: column;
        }

        label {
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        input {
          width: 100%;
          height: 54px;
          border: 1px solid #d9d9d9;
          border-radius: 10px;
          padding: 0 15px;
          font-size: 15px;
          margin-bottom: 20px;
          outline: none;
        }

        input:focus {
          border-color: #171717;
          box-shadow:
            0 0 0 3px rgba(201,121,44,.12);
        }

        button {
          height: 54px;
          border: 0;
          border-radius: 10px;
          background: #171717;
          color: #fff;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          margin-top: 2px;
        }

        button:hover {
          background: #000;
        }

        button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .errorBox {
          background: #fff1f1;
          border: 1px solid #ffd0d0;
          color: #c62828;
          padding: 13px 14px;
          border-radius: 10px;
          font-size: 14px;
          margin-bottom: 15px;
        }

        .forgot {
          text-align: center;
          margin-top: 18px;
        }

        .forgot a {
          color: #171717;
          font-size: 14px;
          font-weight: 700;
          text-decoration: underline;
        }

        .secureBox {
          margin-top: 28px;
          padding: 16px;
          border-radius: 12px;
          background: #f5f2ed;
          color: #666;
          font-size: 13px;
          line-height: 1.55;
        }

        .secureBox strong {
          color: #444;
        }

        .bottomLinks {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 28px;
          font-size: 14px;
        }

        .bottomLinks a {
          color: #555;
          text-decoration: underline;
        }

        @media (max-width: 600px) {
          .loginPage {
            padding: 20px;
          }

          .loginCard {
            padding: 30px 24px;
            border-radius: 18px;
          }

          .intro h1 {
            font-size: 38px;
          }

          .bottomLinks {
            flex-direction: column;
          }
        }

      `}</style>
    </main>
  );
}
