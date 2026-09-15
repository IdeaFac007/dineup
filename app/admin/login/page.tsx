"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // 1. Authenticate admin
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (authError) {
        console.error("ADMIN LOGIN ERROR:", authError);
        setMessage("Invalid email or password.");
        setLoading(false);
        return;
      }

      const user = authData.user;

      if (!user) {
        setMessage("Unable to create login session.");
        setLoading(false);
        return;
      }

      // 2. Check admin_users
      const { data: adminUser, error: adminError } =
        await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

      if (adminError) {
        console.error("ADMIN ACCESS CHECK ERROR:", adminError);

        await supabase.auth.signOut();

        setMessage(
          "Unable to verify admin access. Please try again."
        );

        setLoading(false);
        return;
      }

      // 3. User is authenticated but not an admin
      if (!adminUser) {
        await supabase.auth.signOut();

        setMessage(
          "You do not have admin access."
        );

        setLoading(false);
        return;
      }

      // 4. Success
      router.push("/admin/dashboard");
      router.refresh();
    } catch (error) {
      console.error("UNEXPECTED ADMIN LOGIN ERROR:", error);

      await supabase.auth.signOut();

      setMessage(
        "Something went wrong. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#111111",
        padding: "40px 16px",
        boxSizing: "border-box",
        fontFamily:
          "Inter, Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          minHeight: "calc(100vh - 80px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "520px",
            background: "#ffffff",
            borderRadius: "28px",
            padding: "42px",
            boxSizing: "border-box",
            boxShadow:
              "0 25px 70px rgba(0,0,0,0.35)",
          }}
        >
          {/* LOGO */}

          <div style={{ marginBottom: "34px" }}>
            <div
              style={{
                fontSize: "32px",
                fontWeight: 900,
                letterSpacing: "-1.5px",
                lineHeight: 1,
              }}
            >
              <span style={{ color: "#111111" }}>
                Dine
              </span>

              <span style={{ color: "#d97927" }}>
                Up
              </span>
            </div>

            <div
              style={{
                marginTop: "9px",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "3px",
                color: "#111111",
              }}
            >
              ADMIN PANEL
            </div>
          </div>

          {/* HEADING */}

          <div style={{ marginBottom: "28px" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "48px",
                lineHeight: 1.05,
                fontWeight: 900,
                letterSpacing: "-2px",
                color: "#111111",
              }}
            >
              Admin Login
            </h1>

            <p
              style={{
                margin: "14px 0 0",
                fontSize: "16px",
                lineHeight: 1.6,
                color: "#6b7280",
              }}
            >
              Sign in to manage restaurants,
              approvals, bids and payments.
            </p>
          </div>

          {/* ERROR */}

          {message && (
            <div
              style={{
                marginBottom: "22px",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: "14px",
                lineHeight: 1.5,
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}

          {/* FORM */}

          <form onSubmit={handleLogin}>
            {/* EMAIL */}

            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#111111",
                }}
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="admin@dineupindia.com"
                autoComplete="email"
                disabled={loading}
                style={{
                  width: "100%",
                  height: "54px",
                  padding: "0 16px",
                  boxSizing: "border-box",
                  border: "1px solid #d1d5db",
                  borderRadius: "12px",
                  background: "#ffffff",
                  color: "#111111",
                  fontSize: "15px",
                  outline: "none",
                }}
              />
            </div>

            {/* PASSWORD */}

            <div style={{ marginBottom: "26px" }}>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: 800,
                  color: "#111111",
                }}
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                style={{
                  width: "100%",
                  height: "54px",
                  padding: "0 16px",
                  boxSizing: "border-box",
                  border: "1px solid #d1d5db",
                  borderRadius: "12px",
                  background: "#ffffff",
                  color: "#111111",
                  fontSize: "15px",
                  outline: "none",
                }}
              />
            </div>

            {/* BUTTON */}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: "56px",
                border: "none",
                borderRadius: "12px",
                background: loading
                  ? "#444444"
                  : "#111111",
                color: "#ffffff",
                fontSize: "15px",
                fontWeight: 800,
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {loading
                ? "Checking..."
                : "Sign in to Admin →"}
            </button>
          </form>

          {/* FOOTER */}

          <div
            style={{
              marginTop: "30px",
              paddingTop: "26px",
              borderTop: "1px solid #eeeeee",
              textAlign: "center",
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            DineUp · Where Restaurants Rise
          </div>
        </div>
      </div>

      {/* MOBILE */}

      <style jsx>{`
        @media (max-width: 600px) {
          main {
            padding: 20px 12px !important;
          }
        }
      `}</style>
    </main>
  );
}
