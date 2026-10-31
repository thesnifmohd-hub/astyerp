# Asty ERP — Construction ERP + Double-Entry Accounting Web Application

Production web application (Desktop Office SPA + Mobile-First Installable Supervisor PWA) built for **Asty Constructions** (Kerala, India), combining site planning, GPS-verified daily site reporting, configurable approvals, procurement, labour, subcontractors, client billing, and full Indian double-entry accounting (replacing Smart Build).

- **Git Repository:** https://github.com/thesnifmohd-hub/astyerp.git
- **Specification:** `docs/SPEC.md`
- **Architecture & Database Schema:** `docs/PLAN.md`
- **Per-Position User Guides (incl. Malayalam Supervisor Guide):** `docs/guides/USER_GUIDES.md`

---

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript, Tailwind CSS, React Router v6, TanStack Query v5, React Hook Form + Zod, `i18next` (`en` + `ml` Malayalam), Leaflet + OpenStreetMap, Recharts, SheetJS (`xlsx`), `idb` (IndexedDB offline queue), `vite-plugin-pwa`.
- **Backend:** 100% **Supabase** (`ap-south-1` Mumbai) — PostgreSQL migrations (`supabase/migrations/0001`–`0005`), Row Level Security (`has_permission()` & `can_access_site()`), Triggers & RPCs, Storage, Edge Functions (`supabase/functions/`), `pg_cron` jobs, and Realtime.
- **Hosting:** **Vercel** (`vercel.json` SPA rewrites).

---

## Local Setup & Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment variables (Optional for Local Demo, Required for Live Supabase):**
   Copy `.env.example` to `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   *(Never place `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` — keep it strictly in Supabase Edge Function secrets).*
   If `.env.local` is left blank, the web app runs seamlessly in **Interactive Local DB Mode** pre-seeded with the 8 positions, 4 Kerala sites (*Hadi Bedroom, Talikulam Resort, Wayanad Resort PMC 12%, TKM Building*), 30 days of DPRs, 10 own workers, 5 subcontractors, 10 vendors, BOQs, Gantt schedules, vouchers, and GST invoices.

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Run automated business-rule & RLS test suite:**
   ```bash
   npm test
   ```

5. **Build production bundle:**
   ```bash
   npm run build
   ```

---

## Applying Supabase Migrations & Edge Functions

```bash
# Link your Mumbai (ap-south-1) Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# Push SQL migrations (0001 through 0005) and seed data
supabase db push

# Generate TypeScript types after schema updates
npm run supabase:types

# Deploy Edge Functions
supabase functions deploy dispatch-notifications
supabase functions deploy generate-pdf
supabase functions deploy excel-import-export
```

---

## Deploying to Vercel

1. Push this repository to GitHub (`https://github.com/thesnifmohd-hub/astyerp.git`).
2. In **Vercel**, click **Add New → Project** and import `thesnifmohd-hub/astyerp`.
3. Framework Preset: **Vite** (`npm run build`, output directory `dist`). `vercel.json` automatically configures SPA rewrites and PWA service-worker headers.
4. Add Environment Variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and click **Deploy**.

