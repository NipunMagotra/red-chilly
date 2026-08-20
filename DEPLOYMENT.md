# Subdomain Deployment Guide for DineScan (`stay.dinescan.fyi`)

This guide covers deploying the **DineScan / Red Chilly** smart dining system to **Vercel** and **Supabase**.

---

## 1. Supabase Database Setup (Step-by-Step)

1. **Create / Open Supabase Project**:
   - Go to [database.new](https://database.new) or your [Supabase Dashboard](https://supabase.com/dashboard).
2. **Execute Database Migration**:
   - Navigate to **SQL Editor** in the left sidebar.
   - Open and copy the contents of [`supabase/migrations/20260820_phase2_security_tab.sql`](supabase/migrations/20260820_phase2_security_tab.sql).
   - Paste and click **Run**.
   - This sets up all single-tenant tables (`locations`, `guest_sessions`, `menu_items`, `orders`, `order_items`, `invoice_sequences`, `audit_logs`), PL/pgSQL stored procedures, and WORM triggers.
3. **Copy API Keys**:
   - Go to **Project Settings &rarr; API**.
   - Copy:
     - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
     - **anon public key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
     - **service_role secret key** (`SUPABASE_SERVICE_ROLE_KEY`)

---

## 2. Deploying to Vercel (Step-by-Step)

1. **Push to GitHub**:
   ```bash
   git push origin main
   ```

2. **Import Project into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your `red-chilly` repository.
   - Framework Preset: **Next.js** (detected automatically).

3. **Configure Environment Variables in Vercel**:
   In **Project Settings &rarr; Environment Variables**, add:

   | Variable | Description | Source / Default |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Supabase Dashboard &rarr; API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Public Key | Supabase Dashboard &rarr; API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key | Supabase Dashboard &rarr; API |
   | `JWT_SECRET` | 32+ char secret for guest session tokens | `openssl rand -base64 32` |
   | `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | Upstash Console &rarr; REST API |
   | `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | Upstash Console &rarr; REST API |
   | `STAFF_ADMIN_SECRET` | Passcode for Reception Console (`/admin`) | e.g. `redchilly2026` |

4. **Deploy**:
   - Click **Deploy**. Vercel will build and launch your application.

---

## 3. Subdomain Configuration (`stay.dinescan.fyi`)

1. **Add CNAME in your DNS Provider** (Cloudflare, GoDaddy, Namecheap, Route 53):

   | Type | Name / Host | Target / Value | TTL | Proxy Status (Cloudflare) |
   | :--- | :--- | :--- | :--- | :--- |
   | **CNAME** | `stay` | `cname.vercel-dns.com` | Auto (or 3600) | DNS Only (or Proxied) |

2. **Attach Subdomain in Vercel**:
   - Go to **Settings &rarr; Domains** in your Vercel project dashboard.
   - Enter `stay.dinescan.fyi` and click **Add**.
   - Vercel will automatically provision SSL certificates.

---

## 4. Production URL Structure

| Purpose | Route |
| :--- | :--- |
| **Guest In-Room Dining (Room 404)** | `https://stay.dinescan.fyi/room/room-404` |
| **Guest Table Dining (Table 12)** | `https://stay.dinescan.fyi/table/table-12` |
| **Reception Admin Console** | `https://stay.dinescan.fyi/admin` |
| **Simulation Hub & Landing** | `https://stay.dinescan.fyi/` |

---

## 5. Security & Cookie Isolation

* The guest session cookie (`dinescan_guest_session`) is configured with `HttpOnly: true`, `SameSite: 'lax'`, and `Secure: true`.
* Because it is scoped to the subdomain (`stay.dinescan.fyi`), it operates in total isolation from any existing root domain (`dinescan.fyi`) cookies.
