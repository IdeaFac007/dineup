"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Application = {
  id: number;
  restaurant_name: string;
  email: string;
  phone: string | null;
  city: string;
  category: string;
  address: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
};

type Restaurant = {
  id: number;
  name: string;
  city: string;
  category: string;
  owner_id: string | null;
  is_active: boolean | null;
  is_claimed: boolean | null;
};

export default function RestaurantLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [application, setApplication] =
    useState<Application | null>(null);

  const [statusView, setStatusView] = useState<
    "login" | "pending" | "rejected"
  >("login");

  /*
   * After a successful login:
   *
   * 1. Check whether an approved restaurant is already linked.
   * 2. If not, check restaurant_applications.
   * 3. If no application exists, try creating one from
   *    the Auth user's metadata.
   */
  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setApplication(null);
    setStatusView("login");

    try {
      const cleanEmail = email.trim().toLowerCase();

      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError || !data.user) {
        console.error("Login error:", loginError);

        const loginMessage =
          loginError?.message?.toLowerCase() || "";

        if (
          loginMessage.includes("email not confirmed")
        ) {
          setError(
            "Please verify your email before logging in."
          );
        } else if (
          loginMessage.includes("invalid login credentials")
        ) {
          setError(
            "Invalid email or password."
          );
        } else {
          setError(
            loginError?.message ||
              "Unable to sign in. Please try again."
          );
        }

        setLoading(false);
        return;
      }

      const user = data.user;

      /*
       * ----------------------------------------------------
       * STEP 1 — Check approved restaurant
       * ----------------------------------------------------
       */
      const {
        data: restaurant,
        error: restaurantError,
      } = await supabase
        .from("restaurants")
        .select(
          "id, name, city, category, owner_id, is_active, is_claimed"
        )
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) {
        console.error(
          "Restaurant lookup error:",
          restaurantError
        );

        await supabase.auth.signOut();

        setError(
          "Unable to verify your restaurant account. Please try again."
        );

        setLoading(false);
        return;
      }

      /*
       * Approved + active restaurant
       */
      if (restaurant) {
        if (restaurant.is_active === false) {
          await supabase.auth.signOut();

          setError(
            "Your restaurant account is currently inactive. Please contact DineUp admin."
          );

          setLoading(false);
          return;
        }

        router.push("/restaurant/dashboard");
        router.refresh();

        return;
      }

      /*
       * ----------------------------------------------------
       * STEP 2 — Check existing application
       * ----------------------------------------------------
       */
      const {
        data: existingApplication,
        error: applicationLookupError,
      } = await supabase
        .from("restaurant_applications")
        .select(
          "id, restaurant_name, email, phone, city, category, address, status, rejection_reason, created_at"
        )
        .eq("owner_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (applicationLookupError) {
        console.error(
          "Application lookup error:",
          applicationLookupError
        );

        await supabase.auth.signOut();

        setError(
          "Unable to check your restaurant application. Please try again."
        );

        setLoading(false);
        return;
      }

      /*
       * Application already exists
       */
      if (existingApplication) {
        /*
         * Approved application but restaurant is not linked.
         *
         * We don't automatically create the restaurant
         * from the browser. Admin approval should perform
         * the actual restaurant creation/linking.
         */
        if (
          existingApplication.status ===
          "approved"
        ) {
          await supabase.auth.signOut();

          setError(
            "Your application is approved, but your restaurant account is still being linked. Please contact DineUp admin."
          );

          setLoading(false);
          return;
        }

        /*
         * Pending application
         */
        if (
          existingApplication.status ===
          "pending"
        ) {
          setApplication(
            existingApplication as Application
          );

          setStatusView("pending");
          setLoading(false);

          return;
        }

        /*
         * Rejected application
         */
        if (
          existingApplication.status ===
          "rejected"
        ) {
          setApplication(
            existingApplication as Application
          );

          setStatusView("rejected");
          setLoading(false);

          return;
        }
      }

      /*
       * ----------------------------------------------------
       * STEP 3 — No application exists
       *
       * Try to recover signup details from Auth metadata.
       *
       * This allows an existing verified test account to
       * continue without requiring another signup email.
       * ----------------------------------------------------
       */

      const metadata =
        user.user_metadata || {};

      const restaurantName =
        String(
          metadata.restaurant_name ||
            metadata.restaurantName ||
            ""
        ).trim();

      const phone =
        String(
          metadata.phone ||
            ""
        ).trim();

      const city =
        String(
          metadata.city ||
            ""
        ).trim();

      const category =
        String(
          metadata.category ||
            ""
        ).trim();

      const address =
        String(
          metadata.address ||
            ""
        ).trim();

      /*
       * If signup metadata exists, create the application.
       */
      if (
        restaurantName &&
        city &&
        category &&
        address
      ) {
        const {
          data: newApplication,
          error: createApplicationError,
        } = await supabase
          .from("restaurant_applications")
          .insert({
            owner_id: user.id,
            restaurant_name: restaurantName,
            email: cleanEmail,
            phone: phone || null,
            city,
            category,
            address,
            status: "pending",
          })
          .select(
            "id, restaurant_name, email, phone, city, category, address, status, rejection_reason, created_at"
          )
          .single();

        if (createApplicationError) {
          console.error(
            "Application creation error:",
            createApplicationError
          );

          await supabase.auth.signOut();

          setError(
            "Your account is verified, but we could not submit your restaurant application. Please try again."
          );

          setLoading(false);
          return;
        }

        setApplication(
          newApplication as Application
        );

        setStatusView("pending");
        setLoading(false);

        return;
      }

      /*
       * ----------------------------------------------------
       * STEP 4 — Metadata is missing
       *
       * This can happen for older/test Auth accounts.
       * Don't silently create incomplete applications.
       * ----------------------------------------------------
       */

      await supabase.auth.signOut();

      setError(
        "Your account is verified, but your restaurant application is not complete. Please create a restaurant application first."
      );

      setLoading(false);
    } catch (err) {
      console.error(
        "Restaurant login error:",
        err
      );

      setError(
        "Something went wrong. Please try again."
      );

      setLoading(false);
    }
  }

  /*
   * --------------------------------------------------------
   * PENDING APPROVAL SCREEN
   * --------------------------------------------------------
   */
  if (statusView === "pending" && application) {
    return (
      <main className="loginPage">
        <div className="loginShell">
          <div className="loginCard statusCard">

            <div className="brand">
              <div className="brandName">
                Dine<span>Up</span>
              </div>

              <div className="brandSub">
                RESTAURANT PARTNER
              </div>
            </div>

            <div className="statusIcon pendingIcon">
              ✓
            </div>

            <div className="statusIntro">
              <div className="statusEyebrow">
                APPLICATION SUBMITTED
              </div>

              <h1>
                You're almost there.
              </h1>

              <p>
                Your restaurant application has been
                successfully submitted and is waiting
                for DineUp admin approval.
              </p>
            </div>

            <div className="applicationBox">

              <div className="applicationRow">
                <span>Restaurant</span>
                <strong>
                  {application.restaurant_name}
                </strong>
              </div>

              <div className="applicationRow">
                <span>City</span>
                <strong>
                  {application.city}
                </strong>
              </div>

              <div className="applicationRow">
                <span>Category</span>
                <strong>
                  {application.category}
                </strong>
              </div>

              <div className="applicationRow">
                <span>Status</span>
                <span className="pendingBadge">
                  Pending approval
                </span>
              </div>

            </div>

            <div className="infoBox">
              <strong>
                What happens next?
              </strong>

              <p>
                Our team will review your restaurant
                listing. Once approved, you'll be able
                to access your restaurant dashboard and
                start competing for higher visibility.
              </p>
            </div>

            <Link
              href="/"
              className="primaryLink"
            >
              Back to DineUp
            </Link>

            <div className="bottomLinks single">
              <Link href="/restaurant/login">
                ← Back to login
              </Link>
            </div>

          </div>
        </div>

        <style jsx global>
          {styles}
        </style>
      </main>
    );
  }

  /*
   * --------------------------------------------------------
   * REJECTED APPLICATION SCREEN
   * --------------------------------------------------------
   */
  if (statusView === "rejected" && application) {
    return (
      <main className="loginPage">
        <div className="loginShell">
          <div className="loginCard statusCard">

            <div className="brand">
              <div className="brandName">
                Dine<span>Up</span>
              </div>

              <div className="brandSub">
                RESTAURANT PARTNER
              </div>
            </div>

            <div className="statusIcon rejectedIcon">
              !
            </div>

            <div className="statusIntro">
              <div className="statusEyebrow rejectedText">
                APPLICATION REVIEW
              </div>

              <h1>
                Application needs attention.
              </h1>

              <p>
                Your restaurant application was not
                approved at this time.
              </p>
            </div>

            <div className="applicationBox">

              <div className="applicationRow">
                <span>Restaurant</span>
                <strong>
                  {application.restaurant_name}
                </strong>
              </div>

              <div className="applicationRow">
                <span>Status</span>
                <span className="rejectedBadge">
                  Rejected
                </span>
              </div>

              {application.rejection_reason && (
                <div className="reasonBox">
                  <span>Admin note</span>
                  <p>
                    {application.rejection_reason}
                  </p>
                </div>
              )}

            </div>

            <div className="infoBox">
              <strong>
                Need help?
              </strong>

              <p>
                Please contact the DineUp admin team
                for clarification or to submit corrected
                restaurant information.
              </p>
            </div>

            <Link
              href="/restaurant/login"
              className="primaryLink"
            >
              Return to login
            </Link>

            <div className="bottomLinks single">
              <Link href="/">
                ← Back to DineUp
              </Link>
            </div>

          </div>
        </div>

        <style jsx global>
          {styles}
        </style>
      </main>
    );
  }

  /*
   * --------------------------------------------------------
   * LOGIN SCREEN
   * --------------------------------------------------------
   */
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
            <h1>
              Welcome back.
            </h1>

            <p>
              Login to manage your restaurant visibility,
              campaign and leaderboard position.
            </p>
          </div>

          {error && (
            <div className="errorBox">
              {error}
            </div>
          )}

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

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Checking account..."
                : "Login to dashboard →"}
            </button>

          </form>

          <div className="forgot">
            <Link href="/restaurant/forgot-password">
              Forgot password?
            </Link>
          </div>

          <div className="secureBox">
            <strong>
              Secure login:
            </strong>{" "}
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

      <style jsx global>
        {styles}
      </style>
    </main>
  );
}

const styles = `

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
  margin-bottom: 18px;
  line-height: 1.5;
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

.bottomLinks.single {
  justify-content: center;
}

.bottomLinks a {
  color: #555;
  text-decoration: underline;
}


/* STATUS SCREENS */

.statusCard {
  padding-bottom: 42px;
}

.statusIcon {
  width: 62px;
  height: 62px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 42px;
  font-size: 25px;
  font-weight: 900;
}

.pendingIcon {
  background: #f5f2ed;
  color: #c9792c;
}

.rejectedIcon {
  background: #fff1f1;
  color: #c62828;
}

.statusIntro {
  margin-top: 24px;
}

.statusEyebrow {
  color: #c9792c;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1.6px;
}

.rejectedText {
  color: #c62828;
}

.statusIntro h1 {
  margin: 9px 0 13px;
  font-size: 38px;
  line-height: 1.05;
  letter-spacing: -1.5px;
}

.statusIntro p {
  margin: 0;
  color: #707070;
  font-size: 15px;
  line-height: 1.6;
}

.applicationBox {
  margin-top: 28px;
  border: 1px solid #e3e3e3;
  border-radius: 14px;
  overflow: hidden;
}

.applicationRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 16px;
  border-bottom: 1px solid #eeeeee;
}

.applicationRow:last-child {
  border-bottom: 0;
}

.applicationRow > span:first-child {
  color: #858585;
  font-size: 12px;
}

.applicationRow strong {
  font-size: 13px;
  text-align: right;
}

.pendingBadge,
.rejectedBadge {
  padding: 6px 9px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 800;
}

.pendingBadge {
  background: #fff5e8;
  color: #a85d13;
}

.rejectedBadge {
  background: #fff0f0;
  color: #b72d2d;
}

.reasonBox {
  padding: 15px 16px;
  background: #fff8f8;
  border-top: 1px solid #eeeeee;
}

.reasonBox span {
  display: block;
  color: #777;
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 5px;
}

.reasonBox p {
  margin: 0;
  color: #555;
  font-size: 13px;
  line-height: 1.5;
}

.infoBox {
  margin-top: 18px;
  padding: 16px;
  border-radius: 12px;
  background: #f5f6f7;
}

.infoBox strong {
  font-size: 13px;
}

.infoBox p {
  margin: 7px 0 0;
  color: #6f6f6f;
  font-size: 12px;
  line-height: 1.55;
}

.primaryLink {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 52px;
  margin-top: 20px;
  border-radius: 10px;
  background: #171717;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 800;
}

.primaryLink:hover {
  background: #000;
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

  .statusIntro h1 {
    font-size: 32px;
  }

  .bottomLinks {
    flex-direction: column;
  }

  .bottomLinks.single {
    align-items: center;
  }

  .applicationRow {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  .applicationRow strong {
    text-align: left;
  }

}

`;
