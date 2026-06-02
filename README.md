# Automation Clock Out

A local Next.js + shadcn/ui dashboard to clock **in and out** of attendance for
**multiple accounts**. Each account's credentials and tap payload are stored in
**Supabase**. Clicking **Clock In** / **Clock Out** logs the account in
(`/auth/login`), saves a fresh bearer token, then calls the attendance tap
endpoint (`/api/attendance/tap?method=Mobile`).

> **Clock-in and clock-out use the exact same request.** The tap endpoint is a
> toggle — the server decides in/out based on current state. The In/Out buttons
> and the two schedule times only express *intent* (and are recorded as the
> `action` in history/`last_action`); the HTTP call is identical.

## How it works

For each account, one clock-out does:

1. `POST {API_BASE}/auth/login` with `{ employee_id, password }` → get bearer token
2. Save the token to `accounts.last_bearer`
3. `POST {API_BASE}/api/attendance/tap?method=Mobile` with `Authorization: Bearer <token>` and:
   ```json
   {
     "ssid": "LT. 2 Bharata-5G",
     "mac_address": "C4:B2:5B:CE:DB:CF",
     "device_id": "Currently unused",
     "location": { "latitude": -7.7041953, "longitude": 109.0258285 }
   }
   ```
4. Record the result on the account row and in `clock_out_logs`.

Tokens are fetched fresh on every clock-out, so there's no expiry handling to worry about.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database tables

In the Supabase Dashboard → **SQL Editor**, paste and run the contents of
[`supabase/schema.sql`](supabase/schema.sql). This creates `accounts` +
`clock_out_logs` and enables RLS (no policies — secrets are server-only).

### 3. Configure environment variables

`.env.local` is already created with your project URL and publishable key.
You **must** add your **secret key** so the server can read/write the tables:

> Supabase Dashboard → **Project Settings → API keys** → copy the **Secret key**
> (`sb_secret_…`) — or the legacy **service_role** key — and paste it into
> `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://plutbhsolsajjthcetxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOUR_SECRET_KEY_HERE   # <-- required
ATTENDANCE_API_BASE_URL=https://api.bharatainternasional.com
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Usage

- **Add account** — label, employee_id, password, ssid, mac_address, device_id,
  latitude/longitude, plus optional clock-in/clock-out schedule times. The
  location/ssid defaults match the sample payload.
- **Clock In / Clock Out** (per row) — taps that one account.
- **Clock In All / Clock Out All** — taps every *active* account, one by one.
  Keeps going even if some fail, then shows a summary.
- **Edit / Delete** — manage stored accounts.

## Scheduling (auto clock-out by cron)

Each account can have a **scheduled clock-in time and a scheduled clock-out
time** (independently). While the app is running, an in-process cron (node-cron)
ticks **every minute** and taps any active account whose clock-in or clock-out
time has arrived (and that hasn't already auto-run that action that day).

- Set them per account in the **Add/Edit** dialog: tick **“Auto clock-IN”** /
  **“Auto clock-OUT”** and pick a time (24h) for each.
- Timezone is `CRON_TIMEZONE` (default `Asia/Jakarta`).
- If the server was briefly down at the exact minute, it still fires within
  `CRON_GRACE_MINUTES` (default 5) of the target time.
- Disable the whole scheduler with `SCHEDULER_ENABLED=false`.

> The scheduler only runs while the Next server is running. Keep `npm run dev`
> (or `npm run build && npm start`) alive — e.g. run it as a service, or keep
> the terminal open on the machine that should do the clock-outs.

### External cron (optional)

The same logic is exposed at **`POST /api/cron/run`** (also `GET`), so an
external scheduler can trigger it instead of / in addition to the in-process one:

- **Windows Task Scheduler** → run every minute:
  `curl -X POST http://localhost:3000/api/cron/run -H "x-cron-secret: YOUR_SECRET"`
- **Supabase pg_cron** (once the app is deployed and reachable) or **Vercel Cron**.

Protect it by setting `CRON_SECRET` and sending it as the `x-cron-secret`
header (or `Authorization: Bearer <secret>`). Left empty, the endpoint is open
(fine for local use).

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET`    | `/api/accounts`               | List accounts |
| `POST`   | `/api/accounts`               | Create account |
| `PATCH`  | `/api/accounts/:id`           | Update account |
| `DELETE` | `/api/accounts/:id`           | Delete account |
| `POST`   | `/api/accounts/:id/clock-in`  | Clock in one account |
| `POST`   | `/api/accounts/:id/clock-out` | Clock out one account |
| `POST`   | `/api/clock-in-all`           | Clock in all active accounts |
| `POST`   | `/api/clock-out-all`          | Clock out all active accounts |
| `POST`/`GET` | `/api/cron/run`           | Run due scheduled clock-ins & clock-outs (cron entry point) |
| `GET`    | `/api/logs`                   | Recent raw request/response logs |
| `DELETE` | `/api/logs`                   | Clear all request logs |

## Request logging

Every login and tap HTTP call is recorded raw in the **`request_logs`** table
(one row per step: `login` then `tap`), with the HTTP status and response body.
The dashboard shows them in a separate **“Request Logs”** section below the
accounts table, which auto-refreshes after each manual clock-in/out. This is
the place to look when a tap fails — you see exactly what the attendance API
returned. (The `clock_out_logs` table still holds the short per-attempt summary.)

`POST /api/clock-out-all` is also the route a scheduler (e.g. Supabase
`pg_cron`) can call later to automate a daily run — no code changes needed.

## A note on the Supabase quickstart snippet

The Supabase onboarding wizard suggests `@supabase/ssr` + browser client +
session-refresh middleware. That setup is for apps that use **Supabase Auth**
(users logging in with Supabase). This app has **no user login** (you chose
local-only) and does all database work **server-side**, so it doesn't need
`@supabase/ssr` or the middleware. Instead it uses a single server-only admin
client (`lib/supabase.ts`) with the secret key — which is also safer, because
the stored passwords/tokens are never reachable from the browser.

## Security

- This is meant to run **locally**. There is no auth on the dashboard.
- Passwords are stored as-is in Supabase (your requirement). RLS is enabled with
  no policies so the public key can't read them; only the server's secret key can.
- **Do not deploy this publicly** without adding dashboard authentication. If you
  do deploy, never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
```
