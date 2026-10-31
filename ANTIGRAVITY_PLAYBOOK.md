# Asty ERP — Antigravity Playbook
Stack: React (Vite) + Supabase + Vercel

Two files work together:
- **SPEC.md**: the full requirements. It goes inside your project, and Antigravity reads it every time.
- **This playbook**: setup steps and the prompts to paste into Antigravity, one at a time, in order.

Don't paste everything at once. Antigravity does much better with one module per prompt, and you check each step before moving on.

---

## Step 0 — Setup (you do this once, about 30 minutes)

1. **Supabase:** create a new project called `asty-erp`. Choose the region **Mumbai (ap-south-1)** and save the database password. From Project Settings → API, copy the `Project URL`, the `anon key` and the `service_role key`.
2. **GitHub:** create an empty private repo called `asty-erp`.
3. **Vercel:** you'll connect the GitHub repo after Prompt 2 (Vercel needs code in the repo first).
4. **On your computer:** install Node.js (LTS), Git and the Supabase CLI (`npm i -g supabase`).
5. **Antigravity:** open an empty folder `asty-erp`. Create a folder `docs` and put **SPEC.md** inside it (`docs/SPEC.md`).
6. Create a file `.env.local` in the project root:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   Never put the `service_role` key in the frontend. It goes only into Supabase Edge Function secrets.
7. Use **Planning mode** in Antigravity (not Fast) for every prompt below, so it shows you a plan before it writes code.

---

## Step 1 — Workspace rules (add once)

Add this as a workspace rule in Antigravity's settings (Customizations → Rules). If you can't find that setting, paste it at the start of Prompt 1.

```
You are building Asty ERP. The full requirements are in docs/SPEC.md — read the relevant section before every task and follow it exactly.

Fixed stack: React 18 + Vite + TypeScript, Tailwind + shadcn/ui, React Router, TanStack Query, React Hook Form + Zod, Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron, Realtime), deployed on Vercel. No other backend server.

Rules:
- All schema changes are SQL migration files in supabase/migrations. Never change the database by hand.
- Never hard-code person names or position names in code, RLS or approval logic. Positions and permissions are data (SPEC section 3.2). Every table has Row Level Security that checks has_permission() and can_access_site(), not position names.
- The system must allow new positions to be added later from the Admin screen without code changes.
- Money is stored as bigint in paise. Never use float for money.
- Approval limits, anti-splitting, stock and accounting rules live in Postgres functions/triggers, not only in React.
- Every insert/update/delete on business tables is written to an audit_log table by trigger.
- Financial records are never hard-deleted; use status = cancelled or a reversal entry.
- Regenerate Supabase TypeScript types after every migration.
- Supervisor screens are mobile-first, large buttons, English + Malayalam (i18n keys, no hard-coded text).
- INR formatting (₹1,00,000), dates DD-MM-YYYY, timezone Asia/Kolkata, financial year April–March.
- After each task: run the app, test the flow in the browser, fix errors, and give me a short summary of what was built and how to test it.
- Ask me before any assumption that changes money, approvals or accounting rules.
- Do not start the next module until I say so.
```

---

## Step 2 — Prompts to paste (in order)

Wait for each one to finish, test it yourself, then paste the next one.

### PHASE 1 — Control and visibility

**Prompt 1 — Plan only**
```
Read docs/SPEC.md completely. Do not write any code yet.
Give me:
1. The overall architecture (React app on Vercel, Supabase for everything else).
2. The full Supabase database schema for all 3 phases: tables, key columns, relations, and an ER diagram (Mermaid).
3. The positions + permissions model (SPEC section 3.2) and how RLS uses it.
4. Which logic goes in Postgres functions/triggers, which in Edge Functions, which in pg_cron jobs.
5. Folder structure.
6. The task list for Phase 1, in build order.
Save this as docs/PLAN.md and wait for my approval.
```

**Prompt 2 — Project setup, login, positions and permissions, Admin**
```
Approved. Start Phase 1, task 1:
- Create the Vite + React + TypeScript project with Tailwind, shadcn/ui, React Router, TanStack Query, i18n (English + Malayalam), vite-plugin-pwa.
- Set up the Supabase client, `supabase init`, and the first migration: profiles (linked to auth.users), positions, permissions, position_permissions, user_positions, user_site_access, reporting line (reports_to), has_permission() and can_access_site() functions; audit_log table and generic audit trigger.
- Seed the 8 starting positions from SPEC section 3.1 with their default permissions, and one demo user per position (named by position, no real names).
- Admin screens: users (create, assign positions and sites, deactivate), positions (create, rename, deactivate, set reports-to), permission matrix (module × view/create/edit/approve/delete/export).
- Login with email/phone OTP. Menus and home screen are decided by the user's permissions, not by a hard-coded role.
- App layout: sidebar for office users (desktop), bottom tab bar for supervisors (mobile).
- Asty branding from SPEC section 6.
- Add vercel.json with SPA rewrites. Push to GitHub.
Then tell me exactly how to connect the repo to Vercel and which environment variables to add.
```

**Prompt 3 — Site master**
```
Build SPEC section 4.1 Site Master.
Migration for sites, clients, site_assignments; RLS using can_access_site() so Site Supervisors see only their assigned sites, and has_permission('report.profit.view') for contract value and profit-share fields.
Screens: site list with status filters, create/edit site form, site detail page with tabs (Overview, Team, Documents).
Pick GPS location on a map (Leaflet + OpenStreetMap) and set radius (default 150 m).
Seed: the 4 sites in the SPEC (Hadi Bedroom, Talikulam Resort, Wayanad Resort PMC 12%, TKM Building) assigned to the demo users.
```

**Prompt 4 — Supervisor daily reporting (most important)**
```
Build SPEC section 4.4 Daily Site Reporting as the supervisor PWA.
- Morning, afternoon and evening check-ins with configurable time windows per site.
- GPS check: block check-in outside the site radius; store lat, lng, accuracy; flag low accuracy.
- Live camera capture only (no gallery). Stamp each photo with date, time, GPS and site name before upload to a private Storage bucket.
- Morning: labour count by trade (own workers by name for attendance, subcontractor head count), today's activities, materials received with bill photo.
- Afternoon: minimum 3 photos.
- Evening: quantity done per activity, materials used, problems with urgent flag, tomorrow's plan, minimum 3 photos. Day cannot close without it.
- Offline queue in IndexedDB that syncs when the network is back.
- Office view: DPR page per site per day with all photos and data, printable PDF.
Test it on a mobile-sized browser window and show me screenshots.
```

**Prompt 5 — Approvals**
```
Build SPEC section 4.5 Approvals.
- Generic approval engine: request types, approval chain, status history, comments, attachments.
- Configurable chains per request type (SPEC section 3.2): each step = position + optional amount range. Default chain: Site Supervisor raises → Project Coordinator technical check → amount ≤ ₹3,000: Operations Executive approves; > ₹3,000: Operations Executive reviews then Management approves.
- Admin screen to edit chains, limits and add steps/positions.
- Anti-splitting rule in a Postgres function: same site + same item within 7 days are summed for the limit check.
- Plan changes and client bills always need Management (default chain, editable).
- pg_cron job: escalate requests pending more than 24 hours.
- "My approvals" inbox with one-tap approve/reject on mobile; Realtime updates.
- Write tests for the limit, the anti-splitting rule and escalation.
```

**Prompt 6 — Basic materials**
```
Build the Phase 1 part of SPEC section 4.6: item master, vendor master, material request → purchase order → goods receipt at site (supervisor confirms quantity + challan photo). Material requests and POs use the approval engine. Show the last 3 purchase rates for an item when creating a PO. PO as PDF on Asty letterhead.
```

**Prompt 7 — Management dashboard and alerts**
```
Build the Phase 1 dashboard and notifications from SPEC sections 4.4 and 4.11:
- Management home: all sites with today's status (reports done/missing, urgent problems), pending approvals with waiting time, latest photos.
- Notifications table + in-app bell + web push. Notification provider interface ready for WhatsApp later.
- Notifications are addressed to positions, not people (configurable in Admin).
- pg_cron jobs: missed check-in alert to Project Coordinator + Operations Executive 30 min after the window; urgent problem alert to Management immediately; daily 8:00 pm summary of all sites to Management + Operations Executive.
```

**Prompt 8 — Phase 1 testing and deploy**
```
Phase 1 review:
1. Seed 30 days of realistic daily reports for the 4 sites.
2. Log in as each position and test every Phase 1 flow; fix all bugs.
   Also add a new test position (e.g. "Site Engineer") from the Admin screen, give it permissions, assign a user, and confirm it works with no code change.
3. Check RLS: confirm a Site Supervisor cannot read another site's data or any costs, and a Junior Accountant cannot post vouchers or see profit, even through the API directly.
4. Write the README (local setup, migrations, edge functions, Vercel deploy) and a one-page user guide per position (supervisor guide also in Malayalam).
5. Deploy to Vercel production and give me the checklist to go live.
```

At this point, **stop and use Phase 1 at real sites for 2–3 weeks** before you start Phase 2.

---

### PHASE 2 — Planning and site costs

**Prompt 9 — BOQ and quotation**
```
Build SPEC section 4.2 BOQ, Estimation and Quotation exactly as described: company rate sheet + per-project copy, Residential/Commercial defaults, item list, automatic BOQ, material purchase list, quotation in both print styles (11-column commercial and residential BOQ/per sq.ft) as Excel and PDF. Excel import of an item list. BOQ versioning with a locked approved version.
```

**Prompt 10 — Site planning and Gantt**
```
Build SPEC section 4.3 Site Planning: activities generated from the approved BOQ, dependencies, durations from quantity ÷ labour output, crews, materials and drawings with needed-by dates. Gantt view + simple list view. Management approval creates the baseline; changes need reason + Management approval. Connect evening reports to activity progress. pg_cron daily alerts: material not ordered, drawing not received, crew clash, activity behind plan. Site status On track / At risk / Delayed with days behind. 14-day look-ahead report.
```

**Prompt 11 — Inventory, labour, subcontractors**
```
Build SPEC sections 4.6 (rest), 4.7 and 4.8: site stock (received − used − transferred), site-to-site transfers, usage vs BOQ with wastage flag; own worker master, attendance from morning check-in, weekly wage sheet with advances, crew calendar; subcontractor master, work orders, measured bills through approvals, subcontractor ledger with retention and TDS 194C.
```

---

### PHASE 3 — Accounting and billing

**Prompt 12 — Accounting core**
```
Build SPEC section 4.10 accounting core: chart of accounts with Indian standard groups, cost centres = sites (+ Head Office), all voucher types with per-financial-year numbering, a Postgres constraint/trigger that every voucher's debits equal its credits, ledgers, day book, trial balance, P&L, balance sheet, locked periods. Write accounting tests first.
```

**Prompt 13 — Auto-posting, petty cash, bank**
```
Build auto-posting: approved purchase bills, wage sheets, subcontractor bills and petty cash settlements create draft vouchers in a "pending posting" queue. Junior Accountant enters and prepares drafts; Accounts Head reviews and posts (permission voucher.post). Petty cash per site/supervisor. Multiple bank accounts and bank reconciliation by importing a bank statement (Excel/CSV) and matching entries.
```

**Prompt 14 — GST, TDS, fixed assets, loans**
```
Build GST (input/output, CGST+SGST/IGST, ITC, reverse charge, GSTR-1 and GSTR-3B summary export), TDS (194C, 194J, payable report), fixed asset register with WDV depreciation at Income Tax rates, and loan EMI schedules — SPEC section 4.10.
```

**Prompt 15 — Client billing**
```
Build SPEC section 4.9 Client Billing: RA bill from completed quantities (previous / this / cumulative, retention, advance recovery), final bill, labour bill, extra work bill (only approved extra items with client approval), PMC fee bill (% of actual cost). GST tax invoice PDF on Asty letterhead. Operations Executive checks, Management approves, then a sales voucher is posted. Receipts, outstanding ageing, reminders.
```

**Prompt 16 — Reports and Smart Build import**
```
Build the remaining reports in SPEC section 4.11 (site-wise P&L, partner profit-share statement for Management only, supervisor performance, Tuesday meeting pack generated every Tuesday 7 am) with Excel/PDF export. Add an Excel import for opening balances and open bills from our old software Smart Build — give me the Excel template first.
```

---

## Useful prompts when something goes wrong

- **Bug:** `This is broken: [what you did] → [what happened] → [what you expected]. Find the cause, fix it, and test it again.`
- **Change:** `Change [screen/rule] so that [new behaviour]. Update SPEC.md too so the spec stays correct.`
- **Review:** `Review the code you wrote for [module] against docs/SPEC.md. List anything missing or different, then fix it.`
- **Security check:** `Audit all RLS policies and Edge Functions. Try to read or change data as a supervisor that a supervisor should not access. Report and fix.`

## Tips
- Commit to GitHub after every working prompt (`commit and push with a clear message`), so you can always go back.
- If Antigravity starts going in circles, start a new conversation and say: `Read docs/SPEC.md and docs/PLAN.md, then continue with [task].`
- Use a separate Supabase project for testing; use the real one only after Phase 1 testing is done.
