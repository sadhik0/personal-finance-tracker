# Finance Tracker

A personal finance tracker built with Next.js and MongoDB.

## What changed in this version

- **Database:** switched from PostgreSQL + Drizzle → **MongoDB + Mongoose**.
- **Folder structure:** the code is now split into clearly separated
  `backend/` and `frontend/` folders so it's easy to find and edit things
  after uploading to VS Code. Nothing about how the app *works* or *looks*
  changed — only where the code lives.

## Folder structure

```
src/
  app/                     Next.js routing (framework requirement — this
                           folder decides your URLs, so it can't move)
    api/                   Backend "routes" — the actual endpoints your
                           frontend calls (e.g. /api/transactions).
                           These files are intentionally thin: they just
                           check who's logged in and call into src/backend.
    (app)/                 Your pages (dashboard, transactions, accounts...)
    layout.tsx, page.tsx   Root layout + login/landing page

  backend/                 Everything server-side lives here
    db/
      connect.ts           Opens (and re-uses) the MongoDB connection
    models/                One file per MongoDB collection
      User.ts
      Session.ts
      Account.ts
      Category.ts
      Transaction.ts
      Settings.ts
      ExpectedRule.ts
      toJSON.ts            Shared helper: makes ids come out as clean
                           strings (e.g. "id": "65fa...") instead of
                           MongoDB's raw ObjectId format
    services/               The actual business logic (was "src/lib" before)
      auth.service.ts       Passwords, sessions, "who is logged in"
      finance.service.ts    Budget math (totals, balances, category grouping)
      report.service.ts     Builds the dashboard/report data
      seed.service.ts       Creates default accounts/categories for new users
    utils/
      response.ts           Small helpers used by every API route
                           (ok(), bad(), withUser())

  frontend/                Everything UI-related lives here
    components/
      AuthForm.tsx          Login / register form
      Shell.tsx              Page shell (nav, header)
      TxForm.tsx              Add/edit transaction form
      ui.tsx                  Shared UI bits (cards, bars, formatting)
    lib/
      client.ts               Tiny fetch() wrapper the frontend uses to
                              call your own /api routes, plus formatting
                              helpers (₹ currency, dates)
      export.ts                Excel / PDF export (runs in the browser)
```

### Why does `app/` still have API routes and pages in it?

Next.js decides your app's URLs based on the file paths inside `src/app/`
— that part is a framework rule and can't be moved. But we kept the logic
*inside* those files as thin as possible: an API route file mostly just
says "who's calling this?" and "call the right backend service", so the
real logic (and everything you'll be editing most often) lives in
`src/backend/` and `src/frontend/`.

## Setting up MongoDB

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) (or use a local MongoDB).
2. Get your connection string — it looks like:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/finance-tracker
   ```
3. Copy `.env.example` to `.env.local` and paste your connection string into `MONGODB_URI`.
4. Run the app:
   ```bash
   npm install
   npm run dev
   ```

That's it — there are no migrations to run. Mongoose creates collections
automatically the first time data is written (e.g. as soon as you register
your first user).

## Notes for tracking changes

- All **database schema** changes → edit files in `src/backend/models/`.
- All **API endpoint** changes → edit files in `src/app/api/` (routing) and
  `src/backend/services/` (actual logic).
- All **UI / page** changes → edit files in `src/app/(app)/` (pages) and
  `src/frontend/components/` (reusable pieces).
- IDs are now MongoDB ObjectId **strings** (e.g. `"65fa1c2e..."`) instead of
  plain numbers — this is a normal part of switching to MongoDB.
