"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const redirectTo =
        `${window.location.origin}/restaurant/update-password`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo,
          }
        );

      if (resetError) {
        console.error(
          "Password reset error:",
          resetError
        );

        setError(
          resetError.message ||
            "Unable to send password reset email."
        );

        setLoading(false);
        return;
      }

      setMessage(
        "If an account exists with this email, a password reset link has been sent. Please check your inbox and spam folder."
      );
    } catch (error) {
      console.error(error);

      setError(
        "Something went wrong. Please try again."
      );
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

        <div className="brandSub">
          RESTAURANT PARTNER
        </div>

        <h1>Reset your password.</h1>

        <p className="intro">
          Enter the email address connected to your
          restaurant account and we'll send you a
          secure password reset link.
        </p>

        <form onSubmit={handleSubmit}>

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

          {error && (
            <div className="errorBox">
              {error}
            </div>
          )}

          {message && (
            <div className="successBox">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Sending..."
              : "Send reset link →"}
          </button>

        </form>

        <Link
          className="backLink"
          href="/restaurant/login"
        >
          ← Back to login
        </Link>

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
          opacity: .6;
          cursor: not-allowed;
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
