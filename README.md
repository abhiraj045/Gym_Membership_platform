# Gym Membership & Fee Management System (PERN)

PostgreSQL + Express + React (Vite) + Node.js. Owner/staff login, members, plans, billing periods,
partial payments, void-based corrections, email reminders, dashboard, CSV export, audit log.

**What has and has not been verified.** The backend was run against PostgreSQL 16 and exercised with real
HTTP requests (login, CSRF, roles, partial/split payments, voiding, duplicate protection, reminders, deactivation).
The 15 unit tests pass. The React app builds, but I could not click through it in a browser, so expect to
fix small UI bugs. Email was **not** tested against a real SMTP provider. No application is "completely
secure"; see the security section for what is and is not covered.

---

## 1. Run it on your computer (step by step)

### Step 1: check what you have
```
node -v        # need 20 or newer
npm -v
psql --version # need PostgreSQL 14 or newer (16 recommended)
```
If any command says "not found", install it: Node LTS from nodejs.org, PostgreSQL from postgresql.org
(Windows: EDB installer, remember the `postgres` password; Mac: `brew install postgresql@16 && brew services start postgresql@16`;
Ubuntu: `sudo apt install postgresql`). Reopen the terminal afterwards.

### Step 2: create the database and a limited user
```
psql -U postgres -h localhost
```
then inside psql:
```sql
CREATE USER gym_app WITH PASSWORD 'choose_a_strong_password';
CREATE DATABASE gym_db OWNER gym_app;
\q
```
(Linux: `sudo -u postgres psql`.)

### Step 3: configure and start the backend
```
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```
Edit `.env`:
- `DATABASE_URL` : use the password from Step 2 (URL-encode special characters).
- `JWT_SECRET` : run `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste the result.
- `OWNER_EMAIL` and `OWNER_PASSWORD` : the first owner login (min 10 characters).

Then:
```
npm run migrate        # creates all tables
npm run seed:owner     # creates the owner account (refuses to run twice)
npm run dev            # API on http://localhost:5000
```
Open http://localhost:5000/health. You should see `{"status":"ok","dbTime":...}`.
Now delete `OWNER_PASSWORD` from `.env`.

### Step 4: start the frontend (second terminal)
```
cd frontend
npm install
npm run dev            # http://localhost:5173
```
Log in with the owner email and password.

### Step 5: first things to do in the app
1. **Plans**: add Monthly (1 month), Six-monthly (6), Yearly (12) with prices.
2. **Members**: add a member (add an email if you want reminders).
3. Open the member, **Add membership**: bills are generated automatically.
4. **Record payment**: try a partial amount, then the rest. Watch the status go unpaid, partial, paid.
5. **Staff** (owner only): create a staff account, log in as staff in a private window, and confirm staff cannot see Plans, Staff or Reminders.

### Step 6: run the tests
```
cd backend && npm test
```

---

## 2. How the money logic works (read this first)

- `billing_periods.amount_due` is a **snapshot** taken when the membership is created. Changing a plan price later never changes old bills.
- A payment is split into `payment_allocations`, oldest unpaid period first (or the period you choose). One payment can cover several periods; one period can receive several payments.
- **Balance is never stored.** The view `v_billing_balances` calculates `amount_due - non-void allocations`. A bill is "paid" only when that is zero.
- Money is `NUMERIC(10,2)` in the database and integer cents in JavaScript. No floats.
- Payments are never edited or deleted. To correct one: **void** it (owner only, reason required, audited), then record the right one.
- Overpayments are rejected. Members are never hard-deleted (foreign keys use `ON DELETE RESTRICT`), only deactivated.
- Definitions: *outstanding* = unpaid on periods due today or earlier; *overdue* = unpaid on periods due before today.

## 3. Folder map (and which roadmap module each part belongs to)

```
backend/src
  config/        env + db pool                         (Phase 0)
  db/            migrations, migrate.js, seedOwner.js  (Phase 1)
  middleware/    auth, roles, CSRF guard, validation,
                 rate limits, error handler            (Phase 2, 9)
  routes/        URL wiring + role checks, thin handlers
  services/      business rules AND SQL (see note)
  validators/    zod schemas
  utils/         money, dates, allocation, csv, audit  (unit-tested)
  app.js / server.js
frontend/src     pages, components, api client, auth context
scripts/backup.sh
```
Note: to keep the project a manageable size, controllers and repositories are merged into routes and
services. When you rebuild it module by module, splitting them out is a good exercise.

Suggested study order: `001_init.sql` -> `utils/` + `tests/` -> `authService` + `middleware/auth.js` ->
`memberService` -> `membershipService` -> `paymentService` (the hardest) -> `dashboardService` -> `reminderService`.

## 4. API summary (all under `/api`, cookie session, `X-Requested-With: XMLHttpRequest` required on writes)

| Area | Endpoints | Who |
|---|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | all |
| Staff | `GET/POST /users`, `PUT /users/:id` | owner |
| Plans | `GET /plans` (staff see active only), `POST /plans`, `PUT /plans/:id` | owner writes |
| Members | `GET /members?q=&status=&overdue=&page=`, `POST`, `GET/PUT /:id`, `POST /:id/memberships` | all |
| | `POST /members/:id/deactivate`, `/activate`, `GET /members/export.csv` | owner |
| Memberships | `POST /memberships/:id/renew` (all), `POST /memberships/:id/cancel` (owner) | |
| Payments | `GET /payments`, `POST /payments` (all), `POST /payments/:id/void`, `GET /payments/export.csv` (owner) | |
| Reports | `GET /reports/dashboard`, `/overdue`, `/expiring`, `/monthly-collections` (all); `/overdue.csv`, `/audit-logs` (owner) | |
| Reminders | `GET/PUT /reminders/settings`, `POST /reminders/run`, `GET /reminders/notifications` | owner |
| Scheduler | `POST /jobs/run-reminders` with header `x-job-secret` | external cron |

## 5. Security: what is implemented, and what is not

Implemented: bcrypt (cost 12) password hashes; httpOnly + SameSite + Secure (production) session cookie; session
re-checked against the database on every request (deactivation is immediate); per-account lockout after 5 failures plus
IP rate limit on login; global API rate limit; Helmet headers; CORS allow-list; custom-header CSRF guard; zod validation on
every input; parameterised SQL everywhere (sorting and filters never interpolate user text into SQL); role checks on the server;
no public registration; CSV formula-injection protection; generic error messages (no stack traces); audit log for logins and all important changes;
secrets only in environment variables.

Not covered / your responsibility: HTTPS (hosting provides it), restricting database network access, dependency updates
(`npm audit`), password reset by email (owner resets staff passwords manually), 2FA, backups, monitoring, and a penetration test
before storing real customer data. If you store members' personal data, check the privacy laws that apply to you.

## 6. Reminders and email

Any SMTP provider works (set `SMTP_*` in `.env`; many email services offer SMTP credentials on a free plan, check their current limits).
With `SMTP_HOST` empty, reminders are recorded as **failed** with "SMTP is not configured" so you can see the pipeline working.

- Schedule is editable in the app (Reminders page): days before due, days after due.
- A reminder is claimed through a unique database index, so running the job twice in one day never double-sends. Failed sends are retried by the next run that day.
- Locally, set `ENABLE_CRON=true` to run daily at `REMINDER_CRON`.
- **On free hosting, do not rely on in-process cron**: free servers can sleep or restart. Use an external trigger instead:

```yaml
# .github/workflows/reminders.yml  (set repo secrets API_URL and JOB_SECRET; also set JOB_SECRET on the server)
name: reminders
on:
  schedule: [{ cron: "30 3 * * *" }]   # UTC. GitHub scheduled runs can be delayed or skipped; treat as best-effort
  workflow_dispatch:
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -X POST "${{ secrets.API_URL }}/api/jobs/run-reminders" -H "x-job-secret: ${{ secrets.JOB_SECRET }}"
```
The first request after a sleep can take a while (cold start); `curl --max-time 120` is a sensible addition.

## 7. Deploy (free-tier path)

Free-tier limits, sleep behaviour and database expiry rules **change often. Read each provider's current pricing and limits page before you commit.**

1. **Git:** push to GitHub (check that `.env` is not committed).
2. **Database:** create a managed PostgreSQL (e.g. Neon or Supabase). Copy its connection string. Run migrations from your computer:
   `DATABASE_URL="<connection string>" DB_SSL=true npm run migrate` then `npm run seed:owner` with `OWNER_*` set.
3. **Backend:** deploy `backend/` to a Node host (e.g. Render). Build: `npm install`. Start: `npm start`.
   Environment variables: `NODE_ENV=production`, `DATABASE_URL`, `DB_SSL=true`, `JWT_SECRET`, `CORS_ORIGINS=<your frontend URL>`, `APP_TIMEZONE`, SMTP settings, `JOB_SECRET`.
4. **Frontend:** deploy `frontend/` (e.g. Vercel/Netlify): build `npm run build`, output `dist`, env `VITE_API_URL=https://<backend>/api`.
   Add a rewrite so all paths serve `index.html` (React Router).
5. **Cookies across domains:** frontend and API on different domains means a *third-party* cookie, which some browsers block. The robust fix is to serve both under one site
   (custom domain with `app.` and `api.` subdomains) or proxy `/api` through the frontend host so the browser only talks to one origin. In that case use `VITE_API_URL=/api`.
   Cross-site mode uses `SameSite=None; Secure` (default in production here); override with `COOKIE_SAMESITE`.
6. **Scheduler:** add the GitHub Actions workflow above.
7. **Backups (do this before real data):**
   ```
   ./scripts/backup.sh                       # needs pg_dump installed; set DATABASE_URL
   createdb gym_restore_test
   pg_restore --no-owner -d gym_restore_test gym_backup_XXXX.dump
   psql gym_restore_test -c "SELECT count(*) FROM payments;"   # compare with production
   ```
   A backup you have never restored is not a backup. Know your provider's own backup/retention rules and whether free databases are paused or deleted after inactivity.

## 8. Known gaps / next steps (good practice tasks)

- Integration tests for the API (supertest + a test database).
- Split `routes` into route + controller files and `services` into service + repository.
- Audit-log screen in the UI (the API endpoint exists).
- Retry/backoff for email, per-member reminder opt-out, WhatsApp/SMS.
- Edit-member and filter UI polish; accessibility review.
