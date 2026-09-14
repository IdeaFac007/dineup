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
  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      // Login with Supabase Auth
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (loginError || !data.user) {
        setError(
          loginError?.message || "Unable to login."
        );
        setLoading(false);
        return;
      }

      // Check whether this user is an approved DineUp admin
      const { data: adminUser, error: adminError } =
        await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", data.user.id)
          .maybeSingle();

      if (adminError) {
        console.error("Admin lookup error:", adminError);

        await supabase.auth.signOut();

        setError(
          "Unable to verify admin access."
        );

        setLoading(false);
        return;
      }

      if (!adminUser) {
        await supabase.auth.signOut();

        setError(
          "You do not have admin access."
        );

        setLoading(false);
        return;
      }

      // Admin verified
      router.push("/admin/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Admin login error:", error);

      setError(
        "Something went wrong. Please try again."
      );

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-5 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="w-full rounded-3xl border border-black/10 bg-white p-7 shadow-sm sm:p-9">
          <div className="mb-8">
            <div className="mb-4 inline-flex rounded-full bg-black px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white">
              DineUp Admin
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
              Admin Login
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#666]">
              Sign in to manage restaurants, approvals,
              bids and payments.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-[#222]"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="admin@dineupindia.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-[#222]"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#171717] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Signing in..."
                : "Sign in to Admin"}
            </button>
          </form>

          <div className="mt-7 border-t border-black/10 pt-5 text-center text-xs text-[#777]">
            DineUp • Where Restaurants Rise
          </div>
        </div>
      </div>
    </main>
  );
}
