"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RestaurantLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "error" | "success" | "info"
  >("error");

  function showMessage(
    text: string,
    type: "error" | "success" | "info" = "error"
  ) {
    setMessage(text);
    setMessageType(type);
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!email.trim() || !password) {
      showMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      /*
       * STEP 1
       * Authenticate with Supabase Auth
       */
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (authError) {
        console.error("LOGIN AUTH ERROR:", authError);

        showMessage("Invalid email or password.");
        setLoading(false);
        return;
      }

      const user = authData.user;

      if (!user) {
        showMessage("Unable to create login session. Please try again.");
        setLoading(false);
        return;
      }

      /*
       * STEP 2
       * First check whether this user has an application.
       *
       * IMPORTANT:
       * We deliberately do NOT use .single()
       * because duplicate/old applications should not
       * break login.
       */
      const {
        data: applications,
        error: applicationError,
      } = await supabase
        .from("restaurant_applications")
        .select(
          `
          id,
          owner_id,
          restaurant_name,
          email,
          phone,
          city,
          category,
          address,
          status,
          rejection_reason,
          reviewed_at,
          created_at,
          updated_at
        `
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (applicationError) {
        console.error("APPLICATION QUERY ERROR:", applicationError);

        await supabase.auth.signOut();

        showMessage(
          "Unable to check your restaurant application. Please try again."
        );

        setLoading(false);
        return;
      }

      const application =
        applications && applications.length > 0
          ? applications[0]
          : null;

      /*
       * STEP 3
       * If application exists, handle its status.
       */

      if (application) {
        /*
         * REJECTED
         */
        if (application.status === "rejected") {
          await supabase.auth.signOut();

          const reason =
            application.rejection_reason?.trim() ||
            "Your restaurant application was not approved.";

          showMessage(`Application rejected: ${reason}`, "error");

          setLoading(false);
          return;
        }

        /*
         * PENDING
         */
        if (application.status === "pending") {
          await supabase.auth.signOut();

          showMessage(
            "Your restaurant application is still pending approval.",
            "info"
          );

          setLoading(false);
          return;
        }

        /*
         * APPROVED
         *
         * Continue below and find the actual restaurant.
         */
        if (application.status === "approved") {
          // Continue to restaurant lookup.
        }
      }

      /*
       * STEP 4
       * Find the approved restaurant belonging to this user.
       *
       * We use maybeSingle() instead of single() so a missing
       * restaurant does not become a hard error.
       */
      const {
        data: restaurant,
        error: restaurantError,
      } = await supabase
        .from("restaurants")
        .select(
          `
          id,
          name,
          city,
          category,
          address,
          current_bid,
          is_claimed,
          is_active,
          owner_id
        `
        )
        .eq("owner_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (restaurantError) {
        console.error("RESTAURANT QUERY ERROR:", restaurantError);

        await supabase.auth.signOut();

        showMessage(
          "Unable to load your restaurant. Please try again."
        );

        setLoading(false);
        return;
      }

      /*
       * STEP 5
       * No restaurant yet.
       *
       * If an application exists and is pending, we already
       * handled it above.
       *
       * If no application exists, show a clean message.
       */
      if (!restaurant) {
        await supabase.auth.signOut();

        if (!application) {
          showMessage(
            "Your account is verified, but your restaurant application has not been submitted yet.",
            "info"
          );
        } else if (application.status === "approved") {
          showMessage(
            "Your application is approved, but your restaurant profile is not active yet. Please contact DineUp support.",
            "info"
          );
        } else {
          showMessage(
            "Your restaurant has not been approved yet.",
            "info"
          );
        }

        setLoading(false);
        return;
      }

      /*
       * STEP 6
       * Everything is good.
       *
       * Keep the Supabase session and go to dashboard.
       */
      showMessage("Login successful. Redirecting...", "success");

      router.push("/restaurant/dashboard");
      router.refresh();
    } catch (error) {
      console.error("UNEXPECTED LOGIN ERROR:", error);

      await supabase.auth.signOut();

      showMessage(
        "Something went wrong while logging in. Please try again."
      );

      setLoading(false);
    }
  }

  const messageClass =
    messageType === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : messageType === "info"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <main className="min-h-screen bg-[#111111] px-4 py-10 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[28px] bg-white p-7 shadow-2xl sm:p-10">
          {/* BRAND */}
          <div className="mb-8">
            <div className="text-3xl font-black tracking-tight">
              <span className="text-[#111111]">Dine</span>
              <span className="text-[#d97927]">Up</span>
            </div>

            <div className="mt-1 text-xs font-bold tracking-[0.22em] text-[#111111]">
              RESTAURANT PARTNER
            </div>
          </div>

          {/* HEADING */}
          <div className="mb-7">
            <h1 className="text-4xl font-black tracking-tight text-[#111111] sm:text-5xl">
              Welcome back.
            </h1>

            <p className="mt-3 max-w-md text-sm leading-6 text-gray-500 sm:text-base">
              Login to manage your restaurant visibility,
              campaign and leaderboard position.
            </p>
          </div>

          {/* MESSAGE */}
          {message && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${messageClass}`}
            >
              {message}
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* EMAIL */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-bold text-[#111111]"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="restaurant@example.com"
                autoComplete="email"
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-gray-400 focus:border-[#d97927] focus:ring-2 focus:ring-[#d97927]/10 disabled:bg-gray-100"
              />
            </div>

            {/* PASSWORD */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-bold text-[#111111]"
                >
                  Password
                </label>

                <Link
                  href="/restaurant/forgot-password"
                  className="text-sm font-semibold text-[#d97927] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm text-[#111111] outline-none transition placeholder:text-gray-400 focus:border-[#d97927] focus:ring-2 focus:ring-[#d97927]/10 disabled:bg-gray-100"
              />
            </div>

            {/* LOGIN */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#111111] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Checking..." : "Login to dashboard →"}
            </button>
          </form>

          {/* SIGNUP */}
          <div className="mt-8 border-t border-gray-100 pt-7 text-center">
            <p className="text-sm text-gray-500">
              Don&apos;t have a restaurant account?
            </p>

            <Link
              href="/restaurant/signup"
              className="mt-2 inline-block text-sm font-bold text-[#d97927] hover:underline"
            >
              Register your restaurant →
            </Link>
          </div>

          {/* FOOTER */}
          <div className="mt-8 text-center text-xs text-gray-400">
            DineUp · Where Restaurants Rise
          </div>
        </div>
      </div>
    </main>
  );
}
