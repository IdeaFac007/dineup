type SearchParams = Promise<{
  token_hash?: string;
  type?: string;
  next?: string;
}>;

function safeNextPath(value?: string) {
  if (!value) return "/restaurant/update-password";
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/restaurant/update-password";
  }
  return value;
}

export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash ?? "";
  const type = params.type ?? "";
  const next = safeNextPath(params.next);

  const isRecovery = tokenHash && type === "recovery";

  return (
    <main className="confirmPage">
      <div className="confirmCard">
        <div className="brand">
          Dine<span>Up</span>
        </div>

        <div className="brandSub">RESTAURANT PARTNER</div>

        {isRecovery ? (
          <>
            <h1>Confirm password reset.</h1>
            <p className="intro">
              For your security, click the button below to continue to the
              password reset page.
            </p>

            <form action="/auth/confirm/submit" method="post">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value="recovery" />
              <input type="hidden" name="next" value={next} />
              <button type="submit">Continue →</button>
            </form>

            <p className="hint">
              This confirmation page is safe to open from your email. Your
              reset token is only used when you press Continue.
            </p>
          </>
        ) : (
          <>
            <h1>Invalid reset link.</h1>
            <p className="intro">
              This password reset link is missing required information.
              Please request a new reset email.
            </p>

            <a className="resetLink" href="/restaurant/forgot-password">
              Request a new reset link →
            </a>
          </>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; }

        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #171717;
        }

        .confirmPage {
          min-height: 100vh;
          background: #171717;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
        }

        .confirmCard {
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
          font-size: 40px;
          line-height: 1.05;
          letter-spacing: -1.8px;
        }

        .intro {
          color: #707070;
          line-height: 1.6;
          margin-bottom: 26px;
        }

        button,
        .resetLink {
          width: 100%;
          min-height: 54px;
          border-radius: 10px;
          border: 0;
          background: #171717;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 15px;
          text-decoration: none;
          cursor: pointer;
        }

        .hint {
          color: #888;
          font-size: 13px;
          line-height: 1.5;
          margin-top: 20px;
        }

        @media (max-width: 600px) {
          .confirmCard { padding: 30px 24px; }
          h1 { font-size: 34px; }
        }
      `}</style>
    </main>
  );
}
