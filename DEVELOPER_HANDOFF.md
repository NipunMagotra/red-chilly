# DineScan (Red Chilly) &mdash; Master Developer Handoff

This document is the authoritative architectural and operational specification for the **DineScan / Red Chilly** codebase. Any AI agent or developer maintaining, deploying, or extending this repository must adhere to the invariants defined below.

---

## 1. System Overview

DineScan is an adversarial-grade, single-tenant smart dining and continuous tab platform purpose-built for luxury resorts, boutique hotels, and high-volume dining operations.

### Core Paradigms
- **Root-Level Physical Location Context:**  
  Guests scan QR codes tied directly to physical units with zero organizational overhead:
  - **In-Room Dining:** `/room/[identifier]` (e.g., `/room/101`, `/room/202`, `/room/room-404`)
  - **Table Dining:** `/table/[identifier]` (e.g., `/table/12`, `/table/table-5`, `/table/patio-3`)
- **The "Continuous Tab" Lifecycle:**  
  Unlike single-shot ordering systems, guests can continuously append order rounds (`Round 1`, `Round 2`, `Round N`) to an active open tab throughout their stay or meal with zero double-billing risk.
- **Dynamic On-Demand Location Lifecycle (Zero Pre-Seeded Clutter):**  
  The system starts in a clean zero-seed state (`SEED_LOCATIONS = []`). Front desk staff dynamically check in new rooms or tables from the console (`/admin`), assign guest names, randomize or specify stay PINs, and delete decommissioned units with full audit trails.
- **Single Settlement Authority:**  
  When the tab is closed (via the Reception Console at `/admin`), the entire ledger is finalized, certified PDF invoices are stamped with SHA-256 digital verification checksums, and the physical room/table is transitioned for turnover.
- **Interactive In-App System Guide:**  
  Built-in interactive tutorial modal available on both the landing portal and reception console explaining the 60-second quickstart, staff check-in/settlement flow, and guest ordering lifecycle.
- **Handcrafted Minimal Hospitality Design:**  
  Bespoke scalable vector icons for hotel suites, restaurant dining cloches, gourmet meals, cutlery, cocktails, and keycards with high-contrast slate surfaces and `blue-600` / `rose-600` brand accents.

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
│ - Key: dinescan:pin-rate:<id>│ │ - Realtime CDC WebSocket Hub │
└──────────────────────────────┘ └──────────────────────────────┘
```

| Layer | Technology | Hosting / Provider | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Frontend & Compute** | Next.js 14 (App Router, Server Actions) | **Vercel** | High-density UI rendering, optimistic projections, route orchestration, PDF invoice generation. |
| **Database & Ledger** | PostgreSQL 15+ (PL/pgSQL, `pgcrypto`) | **Supabase** | Authoritative financial ledger, row locking, WORM triggers, Realtime CDC. |
| **Abuse Defense** | Redis (HTTP REST / Pipeline) | **Upstash** | Edge sliding-window rate limiting on 4-digit PIN space (Fail-Closed). |
| **Iconography & UI** | Custom Minimal SVG Icons + Lucide | Next.js Component Library | Handcrafted luxury hospitality icons (`hospitality-icons.tsx`). |
| **Typography Stack** | `Inter` (sans) + `JetBrains Mono` (mono) | Google Fonts / Next Font | High readability for UI scanning & fixed-width alignment for prices and stay PINs. |
| **Design System** | Tailwind CSS (Strict Light Palette) | Vercel Static CDN | Glare-free, high-contrast monochrome slate surfaces with `blue-600` primary brand. |

---

## 3. Security & Database Architecture

The system operates under a **Zero-Trust Database Model**. The application runtime (Next.js) is treated as an untrusted client proxy. All critical financial mutations and state transitions are enforced inside PostgreSQL.

### 3.1 Single-Tenant Root Schema (`supabase/migrations/20260820_phase2_security_tab.sql`)
- **`locations`:** Physical units (`id`, `name`, `qr_code_identifier UNIQUE`, `location_type`, `pin_salt`, `pin_hash`, `token_version`).
- **`guest_sessions`:** Continuous tab root (`id`, `location_id`, `session_token`, `guest_name`, `token_version`, `status`, `subtotal`, `tax`, `total_amount`, `invoice_number UNIQUE`, `invoice_checksum`).
- **`menu_items`:** Active food & beverage catalog (`id`, `category`, `name`, `price`, `is_available`).
- **`orders`:** Order rounds appended to tab (`id`, `guest_session_id`, `location_id`, `round_number`, `idempotency_key`, `tax_rate_snapshot`, `subtotal`, `tax`, `total`).
- **`order_items`:** Historical dish snapshots (`id`, `order_id`, `menu_item_id`, `item_name`, `unit_price`, `quantity`, `subtotal`, `is_voided`).
- **`invoice_sequences`:** Atomic sequential counter for invoice generation with RLS enabled.
- **`audit_logs`:** Append-only security audit trail (`GUEST_CHECK_IN`, `PIN_ROTATION`, `ITEM_VOID`, `TAB_SETTLED`, `LOCATION_DELETED`).

### 3.2 PL/pgSQL `SECURITY DEFINER` Boundaries
Sensitive mutations (creating order rounds, adding items, closing tabs) are encapsulated inside `SECURITY DEFINER` stored procedures:
- `append_items_to_guest_tab`: Acquires `SELECT ... FOR UPDATE` row lock on `guest_sessions`, checks session token / service_role authorization, verifies active status, looks up authoritative database prices, computes taxes, inserts order round, and increments running tab totals.
- `settle_guest_tab`: Acquires `SELECT ... FOR UPDATE` lock, increments sequential invoice counter, calculates deterministic SHA-256 digital verification checksum, and transitions tab to `settled`.
- No client-facing code has direct `UPDATE` or `DELETE` access to financial tables.

### 3.3 WORM (Write-Once-Read-Many) Financial Triggers
Financial records are immutable once closed:
- Triggers on `guest_sessions`, `orders`, and `order_items` block any `UPDATE` or `DELETE` statements on settled tabs (`status = 'settled'` or `status = 'closed'`).
- Any attempt to tamper with historical pricing, line items, or taxes raises an immediate PostgreSQL exception (`ERRCODE 'AC002'`).
- TRUNCATE operations are physically prohibited across all financial tables.

### 3.4 Physical Locking (`SELECT ... FOR UPDATE`)
To prevent double-orders or race conditions between simultaneous guest orders and staff settlements:
```sql
-- Atomic Tab Critical Section
SELECT * INTO v_session
FROM guest_sessions
WHERE id = p_session_id AND location_id = p_location_id
FOR UPDATE;
```
- **Serialization Guarantee:** Concurrent append requests queue deterministically without lost updates.
- **Settlement Barrier:** If a tab transitions to `settled`, any waiting order requests immediately abort with state conflict error `AC001` rather than creating orphaned charges.

### 3.5 Idempotency & TTL Deduplication
- Order requests transmit an `idempotency_key` with a 48-hour TTL.
- Duplicate submissions (e.g., guest double-clicking "Place Order" or network retries) return the existing transaction receipt without duplicate billing.

---

## 4. Authentication & Session Flow

```
Guest Enters 4-Digit Stay PIN
           │
           ▼
[ Upstash Redis Rate Limiter ] ──(Exceeded 5 Attempts/15m)──► 429 Locked Out
           │ (Allowed)
           ▼
[ Next.js Server Action: verifyStayPin ]
           │
           ▼
[ Constant-Time PBKDF2 PIN Verification & Token Generation ]
           │
           ├─► Sets HttpOnly Cookie: `dinescan_guest_session`
           └─► Issues Session JWT (HMAC-SHA256: sessionId, locationId, locationIdentifier, tokenVersion)
```

### 4.1 Distributed Edge Rate Limiter (`src/lib/auth/rate-limiter.ts`)
- **Key Schema:** `dinescan:pin-rate:${locationIdentifier}`
- **Algorithm:** Atomic sliding-window using Redis sorted sets (`ZREMRANGEBYSCORE`, `ZADD`, `ZCARD`, `ZRANGE`).
- **Fail-Closed Invariant:** In production (`NODE_ENV === 'production'`), if Redis credentials are missing or unreachable, the system fails closed (denies PIN verification) to protect the 10,000-combination PIN space from brute force.

### 4.2 Session Token & Anti-Session Fixation
- Guest tokens are signed with `JWT_SECRET` (HMAC-SHA256) and stored in `HttpOnly`, `SameSite: Lax`, `Secure` cookies.
- **Token Version Invalidation:** When a guest checks in or reception rotates a room PIN, `token_version` is incremented, instantly invalidating all existing JWTs for that location.

### 4.3 Staff Authentication
- Front desk console `/admin` is protected by `STAFF_ADMIN_SECRET` (default: `redchilly2026`).
- Staff session cookie `dinescan_staff_session` is securely signed and verified via server actions.

---

## 5. State Management & Money Correctness

### 5.1 Zustand as Optimistic UI Projection (`src/lib/store/useStore.ts`)
- Used exclusively for client-side cart drafting, menu filtering, and transient modal states.
- **Zero Financial Authority:** The client never calculates taxes or final billable amounts for settlement. All math is calculated server-side in minor units (paise).

### 5.2 Minor-Unit (Paise) Financial Calculation
To eliminate floating-point rounding errors:
- All unit prices and line totals are computed in integer minor units (paise) before converting to rupees for display:
  $$\text{Line Total (Paise)} = \text{Unit Price (Paise)} \times \text{Quantity}$$
  $$\text{Tax (Paise)} = \text{Round}(\text{Subtotal (Paise)} \times 0.0825)$$

### 5.3 Deterministic `ERRCODE` Mappings
When a database invariant fails, PostgreSQL raises an explicit error code mapped in the client:

| SQL `ERRCODE` | Meaning | Client Action |
| :--- | :--- | :--- |
| `AC001` | **Settled Tab:** Tab has been closed at checkout. | Forces checkout screen and displays settled folio. |
| `AC002` | **Closed Tab / Token Revoked:** Stay ended or PIN rotated. | Prompts guest to re-authenticate with current PIN. |
| `AC003` | **Inactive Tab:** Tab is not in active state. | Halts submission and fetches fresh state. |

---

## 6. Directory Structure

```
src/
├── actions/             # Next.js Server Actions (auth, tabs, admin console, location management)
├── app/                 # Next.js App Router (pages, layouts, route handlers)
│   ├── admin/           # Reception / Front Desk Console (high-density table, check-in, deletion)
│   ├── room/[identifier]# In-room guest dining portal
│   ├── table/[identifier]# Table guest dining portal
│   ├── page.tsx         # Guest dining portal launcher & hospitality showcase
│   └── layout.tsx       # Root layout configuring Inter & JetBrains Mono
├── components/          # Reusable UI Components
│   ├── auth/            # PIN lock screen & keypad
│   ├── dining/          # Menu catalog, cart sheet, continuous tab bar, folio drawer
│   ├── invoice/         # PDF invoice template & download triggers
│   ├── tutorial/        # Interactive Tutorial & System Guide modal
│   └── ui/              # Handcrafted minimal hospitality SVG icons (hospitality-icons.tsx)
├── lib/                 # Core Utilities & Infrastructure
│   ├── auth/            # JWT signing & Upstash Redis rate limiter
│   ├── data/            # Single-tenant restaurant catalog & TabManager
│   ├── logging/         # Structured audit logger
│   ├── store/           # Zustand client store
│   ├── supabase/        # Supabase client/server wrappers
│   └── validation/      # Zod runtime validation schemas
└── types/               # TypeScript definitions & Supabase database schema types
```

---

## 7. Operational Runbook

1. **Local Development:**
   ```bash
   npm run dev
   ```
2. **Execute Adversarial & Regression Test Suites:**
   ```bash
   npx tsx scripts/test-money-invoice-statemachine.ts
   npx tsx scripts/adversarial-state-machine-test.ts
   npx tsx scripts/adversarial-idempotency-test.ts
   npx tsx scripts/adversarial-financial-invariants.ts
   ```
3. **Database Migration:**
   Apply [`supabase/migrations/20260820_phase2_security_tab.sql`](file:///d:/Client%20Projects/Red%20Chilly/supabase/migrations/20260820_phase2_security_tab.sql) via Supabase Dashboard SQL Editor or Supabase CLI.
4. **Deploying to Vercel:**
   Push to `main` branch connected to Vercel with required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `STAFF_ADMIN_SECRET`
