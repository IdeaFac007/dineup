# DineUp Functional MVP

This is a browser-based functional prototype for DineUp — "Where Restaurants Rise."

Included:
- Customer leaderboard
- Search and category filtering
- Restaurant profile
- Restaurant onboarding
- Demo restaurant dashboard
- Live bid/outbid logic
- Rank recalculation
- Local persistence with localStorage
- Call button on restaurant profile

Important:
- This version is NOT production backend.
- Payments are simulated; no money is charged.
- Authentication, PostgreSQL/Supabase, Razorpay, Maps, notifications and admin authentication still need production integration.

Suggested production stack:
Next.js + PostgreSQL/Supabase + Razorpay + Google Maps + Vercel.

To test:
1. Open index.html in a browser.
2. Click "List Your Restaurant".
3. Add a restaurant.
4. Use "Restaurant Login" to open its dashboard.
5. Increase the bid and watch the leaderboard reorder.
