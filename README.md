# Recruitment Office CRM

Internal system for a recruitment agency that collects fees from candidates, works with overseas
partner agencies, and follows each candidate from first call to arrival in the destination country.

Everything hangs off two records — the **candidate** and the **job order** — so one candidate screen
shows their calls, fee ledger, payments, refunds, documents and visa progress together.

## What is in it

| Area | Highlights |
|---|---|
| **Candidate fees** | Fee packages per job order / country, installment plans (by date or linked to a stage, e.g. "after visa approval"), payments with automatic receipt numbers, printable receipt, WhatsApp share with a private receipt link, balance and next due date, refunds with management approval. Only Finance/Management can edit or delete a payment; every change is logged with a reason. Fee limits per origin and destination country are enforced. |
| **Payment follow-up** | Due today / this week / overdue lists, reminders before due dates for the assigned staff member, follow-up outcomes (promised / paid / no answer) logged from the call box. Daily cash and bank collection sheet to match with the bank. |
| **Partners** | Profile, contacts, partner type, agreements with expiry and reminder, agreed terms, job orders received, candidates supplied / submitted, selected and deployed counts, money owed both ways, communication notes and next follow-up, ranking by deployments and income. |
| **Visa & deployment** | Nine stages with date, staff member and note (appointment date & place, flight details, refusal reason). Stage time limits with alerts, passport expiry alerts (12 months or before contract end), refusal or withdrawal closes the case and opens a refund record. Overview per stage, job order and country. |
| **Call logging** | One-tap Call / WhatsApp, outcome buttons, next-call date picked automatically — two taps to log. Daily call list per staff member (new leads, call-backs, payment follow-ups), alert for leads not contacted in N days, daily and monthly counts. |
| **Campaigns** | Campaign records with spend; compulsory lead source on every candidate; report of leads, enrolled (paid first installment), deployed, cost per enrolment and money collected. `/api/leads` endpoint for Facebook/Instagram lead forms. |
| **Office expenses** | Recurring bills (rent, DEWA, internet, phones, software, licences) — paying one creates the next. One-time expenses with photo/PDF receipt and approval. Bills due in 7 / 30 days and overdue. Monthly income minus costs. |
| **Office** | Attendance with self check-in, payroll calculated from attendance and approved before payment, monthly targets with live progress, staff performance record, management dashboard, reminders page, WhatsApp templates, role-based logins, activity log, Excel/CSV exports, printable PDFs. |
| **Tools** | Ctrl+K search across candidates, partners, job orders, campaigns and receipts. Office calendar (fees due, call-backs, embassy appointments, flights, check-ins, bills, expiries). Insights: conversion funnel by source and staff, speed to first call, fees owed by age, 8-week collection forecast. WhatsApp sending queue with a per-candidate message log. Passport fill from the machine-readable lines (check digits verified) or a photo. Duplicate finder with merge. Facebook/Instagram Lead Ads webhook. Installable on phones. |
| **Working faster** | Quick views on the candidate list (fees overdue, due this week, call-backs, not contacted, no staff, passport expiring), sortable columns, bulk assign, one-tap WhatsApp payment reminders with the amount and date filled in, Excel/CSV import, visa board view, keyboard shortcuts, sign-in attempt limit, change-your-own-password. |

## Run it locally

Requires Node.js 20+ and a PostgreSQL database (a local server, Docker, or a free Neon / Supabase database).

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env   — then set DATABASE_URL and SESSION_SECRET
npm run setup             # creates the tables and loads demo data
npm run dev               # http://localhost:3000
```

No Postgres installed? `docker run -d --name crm-db -e POSTGRES_PASSWORD=crm -e POSTGRES_DB=crm -p 5432:5432 postgres:16`
and use `DATABASE_URL="postgresql://postgres:crm@localhost:5432/crm"`. Or just look around first: without a
`DATABASE_URL`, `npm run dev` starts in [demo mode](#demo-mode-no-database).

Demo logins (password `office123` for all):

| Email | Role |
|---|---|
| admin@office.test | Admin |
| manager@office.test | Management |
| finance@office.test | Finance |
| ops@office.test | Operations (visa & documents) |
| sunita@office.test, imran@office.test, grace@office.test | Sales |

### Start with your own data (no demo records)

```bash
npm run setup:empty -- --email you@company.com --name "Your Name" --password "a-long-password"
```

This creates an empty database and one admin login. Then: set the company details under **Settings**,
add staff under **Settings → Users & roles**, add partners, job orders and fee packages, and bring in an
existing candidate list with **Candidates → Import** (Excel or CSV; a template is provided on that page).

Forgot the admin password? `npm run create-admin -- --email you@company.com --password "new-password"`.

### Keyboard shortcuts

`Ctrl K` search everything · `/` search candidates · `n` new candidate · `c` call list ·
in lists `j` / `k` move, `Enter` open, `x` tick, `Esc` let go.

### Look and feel

Day and Night themes (or Auto, following the device), switched at the bottom of the sidebar and remembered per
person. Confirmations appear as short notes in the corner; a thin bar at the top shows a page is loading. Long
candidate records keep a slim bar at the top with the balance, Call / WhatsApp and section jumps. Lists can be
saved as named views, and on phones the candidate list shows cards with filters folded away.

## Roles

- **Admin / Management** — everything; approve refunds, expenses and payroll; manage users.
- **Finance** — fee plans, payments (including edits and deletes), refund payouts, expenses, payroll, reports.
- **Sales** — their own candidates and call list, record payments, see campaigns.
- **Operations** — visa stages, documents, job orders, partners.

## Deploy on Vercel

Import the repository in Vercel (*Add New → Project*) and deploy. Nothing needs configuring: the build command is
picked up from `package.json` (`vercel-build`). Without a database the site runs in demo mode (below); connect one
when you are ready to keep real records. Vercel has no writable disk, so records **and** uploaded files are stored
in the database.

### Demo mode (no database)

While no database is connected, the app runs on built-in sample data: an in-memory PostgreSQL
([PGlite](https://pglite.dev)) inside the server, filled with the same demo data as `npm run setup`. Sign in with any
demo login (password `office123`, e.g. `admin@office.test`). Everything works, but **nothing is kept**: changes reset
whenever the server restarts, and on Vercel separate server instances can each show their own copy. A yellow bar on
every page says so. The build saves the sample database once (`scripts/demo-snapshot.ts`) so a server starts in about a
second. Demo mode switches off by itself on the first deploy that has a database connection string.

### Connect a database

1. **Create the database.** In Vercel: *Project → Storage → Create Database*, pick **Supabase** or **Neon** and connect
   it to the project. That adds the connection settings for you. Or use any PostgreSQL host and add its connection
   string yourself as `DATABASE_URL`.
2. **Add environment variables** (*Project → Settings → Environment Variables*):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | The PostgreSQL connection string. Not needed when a Vercel integration added `POSTGRES_PRISMA_URL` / `POSTGRES_URL` (Supabase) or `DATABASE_URL` (Neon): those are picked up. |
   | `SESSION_SECRET` | A long random text, 32+ characters. `openssl rand -base64 48` makes one. Required with a database. |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your first login (password 8+ characters). Optional `ADMIN_NAME`. |
   | `OFFICE_TIMEZONE` | Optional, e.g. `Asia/Dubai` (the default). |
   | `LEADS_API_KEY`, `META_*`, `ANTHROPIC_API_KEY` | Optional, see below. |

3. **Redeploy** (*Deployments → newest deployment → ⋯ → Redeploy*). Every build creates or updates the database tables
   (`prisma migrate deploy`) and, only while there are no users yet, creates the admin from `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`. Later deploys never change passwords. You can remove `ADMIN_PASSWORD` once you have signed in.

If something is missing (a wrong connection string, no tables, no login, no secret key), the sign-in page sends you to
**`/setup`**, which lists what is left and how to fix each item. The demo data is not copied into the new database.

Good to know:

- If your host gives a pooled and a direct connection string, keep the pooled one in `DATABASE_URL`. Set the direct
  one as `DIRECT_URL` (Neon's `DATABASE_URL_UNPOOLED` and Supabase's `POSTGRES_URL_NON_POOLING` are picked up
  automatically) — migrations use it. Supabase's pooled string (port 6543) needs `?pgbouncer=true` at the end when
  you paste it yourself; the integration's `POSTGRES_PRISMA_URL` already has it.
- Preview deployments also run the migrations against their database. Give *Preview* its own database (or leave it
  without one: it then runs in demo mode) so a branch can't change the production tables.
- Uploads are limited to 4 MB on Vercel (its request-size limit); elsewhere 10 MB.
- Backups are your database host's job (Neon/Supabase point-in-time restore). Excel/CSV exports are under *Reports & export*.
- Start without demo data: don't run the seed. To load demo data into a *test* database, run
  `DATABASE_URL=<test db> npm run setup` locally.

## Production on your own server

```bash
npm run build
npm start
```

- Set `SESSION_SECRET`, `DATABASE_URL` (PostgreSQL) and `LEADS_API_KEY` in the environment, and run
  `npm run db:migrate` once (and after each update) to create/update the tables.
- Uploaded files are stored in the database, so nothing but the database needs to be kept safe and backed up.
- "Today" lists and month totals follow `OFFICE_TIMEZONE` (default `Asia/Dubai`), wherever the server is hosted.
- **Settings → Setup checks** lists anything still to do before real use (secret key, demo logins, company details).

### Using it from other office computers and phones

Run `npm run build` then `npm start -- -H 0.0.0.0` on the office server and open `http://<server-ip>:3000` from
any device on the same network. Sign-in works over plain http on the office network; put it behind https
(e.g. a reverse proxy with a certificate) before opening it to the internet. On a phone, use the browser's
"Add to Home screen" to install it like an app.

### Passport photo reading (optional)

Set `ANTHROPIC_API_KEY` to show an "Upload photo" button on the candidate form. The photo is sent to
Anthropic's API (model `claude-opus-5-5`), read, and the form is filled for staff to check; the CRM does not
store the photo. Without a key, staff can still paste the two lines from the bottom of the passport page —
those are read and checked locally.

### Lead forms (Facebook / Instagram)

Send leads from Zapier, Make or a Meta webhook relay:

```
POST /api/leads
x-api-key: <LEADS_API_KEY>
{ "name": "…", "phone": "+971…", "nationality": "Nepal", "adId": "<id saved on the campaign>" }
```

The lead is created as a new candidate with the matching campaign as its source. Duplicates (same phone) are ignored.

**Direct from Meta (no Zapier):** in your Meta app add a Webhooks subscription for the Page's `leadgen` field with
callback URL `https://<your-domain>/api/leads/meta` and verify token = `META_VERIFY_TOKEN`. Set `META_APP_SECRET`
(used to check each delivery's signature) and a Page access token with `leads_retrieval` as `META_PAGE_TOKEN`.
Put the ad ID or lead form ID on the campaign so leads are credited to it.

## Tech

Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL · ExcelJS.
