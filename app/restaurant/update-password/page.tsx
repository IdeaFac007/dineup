"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === "PASSWORD_RECOVERY") {
          setReady(true);
          setError("");
          return;
        }

        if (event === "SIGNED_IN" && session) {
          setReady(true);
        }
      }
    );

    // Check if Supabase already established the recovery session.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      if (data.session) {
        setReady(true);
      } else {
        setError(
          "This password reset link is invalid or has expired. Please request a new link."
        );
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) {
        console.error(
          "Password update error:",
          updateError
        );

        setError(
          updateError.message ||
            "Unable to update password."
        );

        setSaving(false);
        return;
      }

      setSuccess(
        "Password updated successfully."
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.replace("/restaurant/login");
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error(
        "Password reset error:",
        error
      );

      setError(
        "Something went wrong. Please try again."
      );

      setSaving(false);
    }
  }

  if (!ready && !error) {
    return (
      <main className="resetPage">
        <div className="resetCard">

          <div className="brand">
            Dine<span>Up</span>
          </div>

          <div className="brandSub">
            RESTAURANT PARTNER
          </div>

          <div className="loading">
            Verifying your reset link...
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
          }

          .resetPage {
            min-height: 100vh;
            background: #171717;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px 20px;
          }

          .resetCard {
            width: 100%;
            max-width: 520px;
            background: white;
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

          .loading {
            margin-top: 45px;
            color: #777;
            font-size: 15px;
          }

        `}</style>
      </main>
    );
  }

  if (error) {
    return (
      <main className="resetPage">
        <div className="resetCard">

          <div className="brand">
            Dine<span>Up</span>
          </div>

          <div className="brandSub">
            RESTAURANT PARTNER
          </div>

          <h1>Reset link expired.</h1>

          <p className="intro">
            This password reset link is invalid,
            expired, or has already been used.
          </p>

          <div className="errorBox">
            {error}
          </div>

          <Link
            className="resetAgain"
            href="/restaurant/forgot-password"
          >
            Request a new reset link →
          </Link>

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
          }

          .resetPage {
            min-height: 100vh;
            background: #171717;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px 20px;
          }

          .resetCard {
            width: 100%;
            max-width: 520px;
            background: white;
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
            margin-bottom: 22px;
          }

          .errorBox {
            background: #fff1f1;
            border: 1px solid #ffd0d0;
            color: #c62828;
            padding: 14px;
            border-radius: 10px;
            font-size: 14px;
            line-height: 1.5;
          }

          .resetAgain {
            display: block;
            margin-top: 20px;
            height: 54px;
            border-radius: 10px;
            background: #171717;
            color: white;
            text-decoration: none;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
          }

          .backLink {
            display: block;
            margin-top: 22px;
            color: #555;
            font-size: 14px;
            text-decoration: underline;
          }

        `}</style>
      </main>
    );
  }

  return (
    <main className="resetPage">

      <div className="resetCard">

        <div className="brand">
          Dine<span>Up</span>
        </div>

        <div className="brandSub">
          RESTAURANT PARTNER
        </div>

        <h1>Create a new password.</h1>

        <p className="intro">
          Choose a new secure password for your
          restaurant account.
        </p>

        <form onSubmit={handleSubmit}>

          <label>
            New password
          </label>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            required
          />

          <label>
            Confirm password
          </label>

          <input
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value
              )
            }
            placeholder="Repeat your password"
            autoComplete="new-password"
            required
          />

          {error && (
            <div className="errorBox">
              {error}
            </div>
          )}

          {success && (
            <div className="successBox">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Updating..."
              : "Update password →"}
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
        }

        .resetPage {
          min-height: 100vh;
          background: #171717;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
        }

        .resetCard {
          width: 100%;
          max-width: 520px;
          background: white;
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
          margin-bottom: 20px;
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
          color: white;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
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

          .resetCard {
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
