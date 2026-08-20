# DineScan &bull; Red Chilly

> **Next-Generation Multi-Tenant Smart Dining & Continuous Tab Platform**  
> Built with Next.js 14 App Router, PostgreSQL (Supabase), Upstash Redis, and Tailwind CSS.

---

## 🌟 Overview

**DineScan (Red Chilly)** is an adversarial-grade, multi-tenant digital dining platform designed for high-end resorts, boutique hotels, and high-volume restaurants. 

Unlike traditional single-shot QR ordering apps, DineScan implements a **Continuous Tab** lifecycle where guests can seamlessly append multiple rounds of food and beverages to an open tab throughout their stay or dining experience, secured by a **4-digit stay PIN**.

---

## 🚀 Key Features

- 🏨 **Multi-Tenant Physical Location Context:**
  - **In-Room Dining:** `/room/[identifier]` (e.g. `/room/room-404`) with room-scoped guest sessions.
  - **Table Dining:** `/table/[identifier]` (e.g. `/table/table-12`) with table-scoped guest sessions.
- 🔁 **The Continuous Tab Lifecycle:**
  - Guests place orders in rounds (`Round 1`, `Round 2`, `Round N`).
  - All rounds append to a single active tab with real-time subtotal, tax, and discount tracking.
- 🛡️ **Zero-Trust Security & Financial Immutability:**
  - **WORM (Write-Once-Read-Many) Triggers:** Closed tabs and settled invoices are cryptographically locked against `UPDATE` and `DELETE` queries.
  - **`SELECT ... FOR UPDATE` Row Locking:** Guarantees zero race conditions during simultaneous guest ordering and front-desk settlement.
  - **48-Hour Idempotency:** Eliminates double-billing from network retries or client double-clicks.
- 🔐 **Distributed PIN Rate Limiting:**
  - Edge sliding-window rate limiting (5 attempts/15m) powered by Upstash Redis with a strict **fail-closed** policy in production.
- 🛎️ **Reception & Staff Admin Console (`/admin`):**
  - Live occupancy and table grid overview.
  - One-click stay PIN generation and room check-in.
  - Instant tab settlement and room turnover management.
- 📄 **Certified PDF Invoicing:**
  - Instant client-side and server-side PDF invoice generation with digital verification badges powered by `@react-pdf/renderer`.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | [Next.js 14](https://nextjs.org/) (App Router, Server Actions) | Fullstack rendering, edge middleware, and server mutations |
| **Database** | [PostgreSQL 15+ via Supabase](https://supabase.com/) | Authoritative ledger, PL/pgSQL `SECURITY DEFINER` procs, WORM triggers, CDC Realtime |
| **Cache & Abuse Defense** | [Upstash Redis](https://upstash.com/) | Serverless sliding-window rate limiting for PIN protection |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/) | High-contrast, responsive mobile-first UI |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) | Optimistic client-side cart & UI state projection |
| **PDF Generation** | [@react-pdf/renderer](https://react-pdf.org/) | Compliant dining invoice and tax receipt export |

---

## 📂 Project Structure

```
.
├── DEPLOYMENT.md              # Subdomain & Vercel deployment guide
├── DEVELOPER_HANDOFF.md       # Master architectural & operational specification
├── SECURITY_AUDIT_HANDOFF.md  # Comprehensive security audit & threat surface matrix
├── scripts/                   # 26 adversarial, concurrency, & regression test suites
├── src/
│   ├── actions/               # Server Actions (auth-actions, tab-actions, admin-actions)
│   ├── app/                   # Next.js App Router routes & pages
│   │   ├── admin/             # Reception Admin Console
│   │   ├── room/[identifier]/ # In-Room Dining portal
│   │   ├── table/[identifier]/# Table Dining portal
│   │   └── page.tsx           # Interactive Demo Hub & Landing
│   ├── components/            # UI components (auth, dining, invoice, theme)
│   ├── lib/                   # Core business logic, rate-limiters, Supabase clients, Zustand store
│   └── types/                 # Database schema types & TypeScript interfaces
└── supabase/
    └── migrations/            # Phase 2 SQL migrations, PL/pgSQL functions, & WORM triggers
```

---

## ⚙️ Getting Started

### 1. Prerequisites
- **Node.js** 18.18+ or 20+
- **npm**, **pnpm**, or **yarn**

### 2. Installation
```bash
git clone https://github.com/NipunMagotra/red-chilly.git
cd red-chilly
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Guest Session Secret
JWT_SECRET=your-secure-32-char-jwt-secret

# Upstash Redis (Optional for local dev; required for production fail-closed rate limiting)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

### 4. Running the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the simulation hub.

---

## 🧪 Testing & Verification Suites

Execute the built-in adversarial and regression test harness:

```bash
# Run Master Regression Suite
npx tsx scripts/test-master-regression-suite.ts

# Run Concurrency & Zero-Gap Serialization Stress Test
npx tsx scripts/adversarial-concurrency-stress.ts

# Run Idempotency & Settlement Barrier Test
npx tsx scripts/adversarial-idempotency-test.ts

# Run Security & RLS Isolation Tests
npx tsx scripts/adversarial-security-definer-audit.ts
```

---

## 🚢 Production Deployment

For step-by-step production hosting instructions:
- **Subdomain Routing & Vercel Setup:** See [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- **Detailed Developer Architecture:** See [`DEVELOPER_HANDOFF.md`](./DEVELOPER_HANDOFF.md)
- **Security Audit & Invariants:** See [`SECURITY_AUDIT_HANDOFF.md`](./SECURITY_AUDIT_HANDOFF.md)

---

## 📄 License

Proprietary &mdash; All rights reserved.
