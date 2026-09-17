"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleRequestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const normalizedEmail = email.trim();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail
        );

      if (resetError) {
        console.error("Password reset error:", resetError);
        setError(
          resetError.message ||
            "Unable to send password reset email."
        );
        return;
      }

      setStep("verify");
      setMessage(
        "Check your email for the 8-digit password reset code. Enter it here without opening the email link."
      );
    } catch (error) {
      console.error(error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndReset(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    const normalizedEmail = email.trim();
    const normalizedToken = token.trim();

    if (!/^\d{8}$/.test(normalizedToken)) {
      setError("Enter the 8-digit code from your email.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: normalizedToken,
        type: "recovery",
      });

      if (verifyError) {
        console.error("Recovery verification error:", verifyError);
        setError(
          verifyError.message ||
            "The reset code is invalid or has expired."
        );
        return;
      }

      const { error: updateError } =
        await supabase.auth.updateUser({ password });

      if (updateError) {
        console.error("Password update error:", updateError);
        setError(
          updateError.message ||
            "Unable to update password."
        );
        return;
      }

      setMessage(
        "Password updated successfully. Redirecting to login..."
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href = "/restaurant/login";
      }, 1200);
    } catch (error) {
      console.error("Password reset error:", error);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="forgotPage">
      <div className="forgotCard">
        <div className="brand">
          Dine<span>Up</span>
        </div>

        <div className="brandSub">RESTAURANT PARTNER</div>

        {step === "request" ? (
          <>
            <h1>Reset your password.</h1>

            <p className="intro">
              Enter the email address connected to your restaurant account.
              We'll send an 8-digit reset code that you can enter here.
            </p>

            <form onSubmit={handleRequestReset}>
              <label>Email</label>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="owner@restaurant.com"
                autoComplete="email"
                required
              />

              {error && <div className="errorBox">{error}</div>}

              {message && (
                <div className="successBox">{message}</div>
              )}

              <button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send reset code →"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>Enter reset code.</h1>

            <p className="intro">
              Enter the 8-digit code sent to <strong>{email}</strong>, then
              choose your new password.
            </p>

            <form onSubmit={handleVerifyAndReset}>
              <label>8-digit code</label>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{8}"
                maxLength={8}
                value={token}
                onChange={(event) =>
                  setToken(event.target.value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="12345678"
                autoComplete="one-time-code"
                required
              />

              <label>New password</label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                required
              />

              <label>Confirm password</label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
              />

              {error && <div className="errorBox">{error}</div>}

              {message && (
                <div className="successBox">{message}</div>
              )}

              <button type="submit" disabled={loading}>
                {loading
                  ? "Updating..."
                  : "Verify code & update password →"}
              </button>
            </form>

            <button
              type="button"
              className="secondaryButton"
              onClick={() => {
                setStep("request");
                setToken("");
                setPassword("");
                setConfirmPassword("");
                setMessage("");
                setError("");
              }}
            >
              ← Use another email
            </button>
          </>
        )}

        <Link className="backLink" href="/restaurant/login">
          ← Back to login
        </Link>
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #171717;
        }

        .forgotPage {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
          background: #171717;
        }

        .forgotCard {
          width: 100%;
          max-width: 520px;
          background: #fff;
          border-radius: 24px;
          padding: 48px;
        }

        .brand {
          font-size: 30px;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        .brand span {
          color: #c9792c;
        }

        .brandSub {
          margin-top: 4px;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        h1 {
          margin: 42px 0 14px;
          font-size: 42px;
          line-height: 1;
          letter-spacing: -1.8px;
        }

        .intro {
          color: #707070;
          line-height: 1.6;
          margin-bottom: 30px;
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
          height: 54px;
          border: 1px solid #d9d9d9;
          border-radius: 10px;
          padding: 0 15px;
          font-size: 15px;
          margin-bottom: 18px;
          outline: none;
        }

        input:focus {
          border-color: #171717;
        }

        button {
          height: 54px;
          border: 0;
          border-radius: 10px;
          background: #171717;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
          font-size: 15px;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondaryButton {
          margin-top: 12px;
          background: #f2f2f2;
          color: #171717;
        }

        .errorBox,
        .successBox {
          padding: 13px;
          border-radius: 10px;
          font-size: 14px;
          margin-bottom: 15px;
          line-height: 1.5;
        }

        .errorBox {
          background: #fff1f1;
          border: 1px solid #ffd0d0;
          color: #c62828;
        }

        .successBox {
          background: #edf9f0;
          border: 1px solid #c9ebd0;
          color: #24753a;
        }

        .backLink {
          display: block;
          margin-top: 25px;
          color: #555;
          font-size: 14px;
          text-decoration: underline;
        }

        @media (max-width: 600px) {
          .forgotCard {
            padding: 30px 24px;
          }

          h1 {
            font-size: 36px;
          }
        }
      `}</style>
    </main>
  );
}
