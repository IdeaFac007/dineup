# DineUp Phase 2 — Real MVP Starter

This upgrades the static demo into a production-ready architecture.

Included:
- Next.js 16.2.6 + React 19
- Supabase browser client
- Magic-link restaurant login UI
- Supabase/Postgres schema with RLS
- Restaurants, campaigns and bids tables
- Public leaderboard UI
- Secure architecture notes for server-side bidding/payment
- Razorpay environment placeholders

Setup:
1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Fill Supabase URL and anon key.
5. Configure Supabase Auth email provider/redirect URL.
6. `npm install`
7. `npm run dev`
8. Add Razorpay keys only after server-side order creation + webhook routes are implemented.

This package intentionally does NOT pretend to take real money yet. Do not expose Razorpay secret keys in browser code. The next production implementation should add:
- `/api/bids` server route with transaction/row locking
- `/api/razorpay/order`
- `/api/razorpay/webhook`
- owner dashboard
- admin approval
- campaign start/end rules
- payment reconciliation
- rate limiting and audit logs
