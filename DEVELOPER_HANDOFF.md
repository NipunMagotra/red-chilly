# DineScan (Red Chilly) &mdash; Master Developer Handoff

This document is the authoritative architectural and operational specification for the **DineScan / Red Chilly** codebase. Any AI agent or developer maintaining, deploying, or extending this repository must adhere to the invariants defined below.

---

## 1. System Overview

DineScan is an adversarial-grade, multi-tenant smart dining platform purpose-built for luxury resorts, hotels, and high-volume restaurants.

### Core Paradigms
- **Multi-Tenant Physical Location Context:**  
  Guests scan QR codes tied directly to physical units:
  - **In-Room Dining:** `/room/[identifier]` (e.g., `/room/room-404`)
  - **Table Dining:** `/table/[identifier]` (e.g., `/table/table-12`)
- **The "Continuous Tab" Lifecycle:**  
  Unlike single-shot ordering systems, guests can continuously append order rounds (`Round 1`, `Round 2`, `Round N`) to an active open tab throughout their stay or meal.
- **Single Settlement Authority:**  
  When the tab is closed (via the Reception/Staff Admin Console at `/admin`), the entire ledger is finalized, certified PDF invoices are stamped with cryptographic signatures, and the physical room/table is transitioned for turnover.

---

## 2. Tech Stack & Hosting Matrix

The system distributes responsibilities across specialized managed cloud services:

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Edge Network                      │
│   - Next.js 14 App Router (React Server Components)         │
│   - Server Actions & API Route Handlers                     │
│   - Subdomain Routing (stay.dinescan.fyi) + Automatic SSL   │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼ (HTTP/REST)                   ▼ (PostgREST / CDC WebSockets)
┌──────────────────────────────┐ ┌──────────────────────────────┐
│        Upstash Redis         │ │      Supabase / PostgreSQL   │
│ - Distributed Sliding Window │ │ - Zero-Trust Stored Procs    │
│ - Rate Limiting (5 fail/15m) │ │ - WORM Financial Triggers    │
│ - Fail-Closed Edge Policy    │ │ - SELECT ... FOR UPDATE Lock │
│                              │ │ - Realtime CDC WebSocket Hub │
└──────────────────────────────┘ └──────────────────────────────┘
```

| Layer | Technology | Hosting / Provider | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend & Compute** | Next.js 14 (App Router, Server Actions) | **Vercel** | UI rendering, optimistic projections, route orchestration, PDF invoice generation. |
| **Database & Ledger** | PostgreSQL 15+ (PL/pgSQL, `pgcrypto`) | **Supabase** | Authoritative financial ledger, row locking, WORM triggers, Realtime CDC. |
| **Abuse Defense** | Redis (HTTP REST / Pipeline) | **Upstash** | Edge sliding-window rate limiting on 4-digit PIN space (Fail-Closed). |
| **Design System** | Tailwind CSS + Lucide Icons | Vercel Static CDN | Responsive mobile-first guest interface & admin console. |

---

## 3. Security & Database Architecture

The system operates under a **Zero-Trust Database Model**. The application runtime (Next.js) is treated as an untrusted client proxy. All critical financial mutations and state transitions are enforced inside PostgreSQL.

### 3.1 PL/pgSQL `SECURITY DEFINER` Boundaries
Sensitive mutations (creating order rounds, adding items, closing tabs) are encapsulated inside `SECURITY DEFINER` stored procedures in [`supabase/migrations/20260820_phase2_security_tab.sql`](file:///d:/Client%20Projects/Red%20Chilly/supabase/migrations/20260820_phase2_security_tab.sql).
- Stored procedures bypass direct client table permissions but perform **explicit cryptographic checks** on session tokens and permissions before mutating rows.
- No client-facing code has direct `UPDATE` or `DELETE` access to financial tables.

### 3.2 WORM (Write-Once-Read-Many) Financial Triggers
Financial records are immutable once closed:
- An `AFTER UPDATE` / `BEFORE UPDATE` trigger actively blocks any `UPDATE` or `DELETE` statements on settled tabs (`status = 'closed'`) or generated invoice records.
- Any attempt to tamper with historical pricing, discount totals, or taxes raises an immediate PostgreSQL exception (`ERRCODE 'AC002'`).

### 3.3 Physical Locking (`SELECT ... FOR UPDATE`)
To prevent double-orders or race conditions between simultaneous guest orders and staff settlements:
```sql
-- Atomic Tab Critical Section
SELECT id, status, total_amount 
FROM tabs 
WHERE id = p_tab_id 
FOR UPDATE;
```
- **Serialization Guarantee:** If 100 requests arrive concurrently, the first request acquires the row lock; the remaining requests queue deterministically.
- **Settlement Barrier:** If a tab transitions to `closed`, any waiting order requests immediately abort with a state conflict error rather than creating orphaned charges.

### 3.4 Idempotency & TTL Deduplication
- Order requests transmit an `idempotency_key` with a 48-hour TTL.
- Duplicate submissions (e.g., guest double-clicking "Place Order" or network retries) return the existing transaction receipt without executing duplicate billing or inventory deduction.

---

## 4. Authentication & Session Flow

```
Guest Enters 4-Digit Stay PIN
           │
           ▼
[ Upstash Redis Rate Limiter ] ──(Exceeded 5 Attempts/15m)──► 429 Locked Out
           │ (Allowed)
           ▼
[ Next.js Server Action: verifyPinAction ]
           │
           ▼
[ Postgres PIN Verification & Token Generation ]
           │
           ├─► Sets HttpOnly Cookie: `dinescan_guest_session`
           └─► Returns Session JWT (HMAC-SHA256, contains property_id, location_id, token_version)
```

### 4.1 Distributed Edge Rate Limiter (`src/lib/auth/rate-limiter.ts`)
- **Key Schema:** `dinescan:pin-rate:${propertyId}:${locationIdentifier}`
- **Algorithm:** Atomic sliding-window using Redis sorted sets (`ZREMRANGEBYSCORE`, `ZADD`, `ZCARD`, `ZRANGE`).
- **Fail-Closed Invariant:** In production (`NODE_ENV === 'production'`), if Redis credentials are missing or unreachable, the system fails closed (denies PIN verification) to protect the 10,000-combination PIN space from brute force.

### 4.2 Session Token & Realtime CDC Injection
- Guest tokens are signed with `JWT_SECRET` (HMAC-SHA256) and stored in `HttpOnly`, `SameSite: Lax`, `Secure` cookies.
- Realtime Supabase CDC channels listen for tab invalidations scoped strictly by `location_id` and `property_id`.

---

## 5. State Management & Deterministic Error Handling

### 5.1 Zustand as Optimistic UI Projection
- **Zustand (`src/lib/store/useStore.ts`):** Used exclusively for client-side cart drafting, menu filtering, and transient modal states.
- **Zero Financial Authority:** The client never calculates taxes, discounts, or total billable amounts for settlement. All math is recomputed in PostgreSQL.

### 5.2 Deterministic `ERRCODE` Mappings
When a database invariant fails, PostgreSQL raises an explicit error code mapped in the client:

| SQL `ERRCODE` | Meaning | Client Action |
| :--- | :--- | :--- |
| `AC001` | **Stale / Invalid Tab:** Tab is no longer active. | Purges local cart, resets UI state to checkout screen. |
| `AC002` | **WORM Immutability Violation:** Attempt to modify settled ledger. | Hard UI rejection, prompts admin refresh. |
| `AC003` | **Concurrent State Race:** Tab state changed during transaction. | Prompts user with fresh state from Supabase Realtime. |

---

## 6. Directory Structure Conventions

```
src/
├── actions/             # Next.js Server Actions (auth, tabs, admin mutations)
├── app/                 # Next.js App Router (pages, layouts, route handlers)
│   ├── admin/           # Reception / Staff Admin Console
│   ├── room/[identifier]# In-room guest dining portal
│   └── table/[identifier]# Table guest dining portal
├── components/          # Reusable UI Components
│   ├── auth/            # PIN lock screen & auth widgets
│   ├── dining/          # Menu catalog, cart sheet, continuous tab bar
│   ├── invoice/         # PDF invoice template & download triggers
│   └── ui/              # Base design components (BlurFade, MagicCard)
├── lib/                 # Core Utilities & Infrastructure
│   ├── auth/            # JWT signing, Upstash Redis rate limiter
│   ├── data/            # Mock/seed restaurant catalog & locations
│   ├── logging/         # Structured audit logger
│   ├── store/           # Zustand client store
│   ├── supabase/        # Supabase client/server/admin wrappers
│   └── validation/      # Zod runtime validation schemas
└── types/               # TypeScript definitions & Database schema types
```

---

## 7. Operational Runbook

1. **Local Development:**
   ```bash
   npm run dev
   ```
2. **Execute Adversarial & Regression Test Suites:**
   ```bash
   npx tsx scripts/test-master-regression-suite.ts
   npx tsx scripts/adversarial-concurrency-stress.ts
   npx tsx scripts/adversarial-idempotency-test.ts
   ```
3. **Database Migration:**
   Apply [`supabase/migrations/20260820_phase2_security_tab.sql`](file:///d:/Client%20Projects/Red%20Chilly/supabase/migrations/20260820_phase2_security_tab.sql) via Supabase Dashboard or CLI.
4. **Deploying to Vercel:**
   Push to `main` branch connected to Vercel with required environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
