# Subdomain Deployment Guide for DineScan (`stay.dinescan.fyi`)

Since you are already using your root domain (`dinescan.fyi`), you can easily deploy this smart restaurant & hotel dining system onto a dedicated subdomain such as **`stay.dinescan.fyi`**, **`app.dinescan.fyi`**, or **`room.dinescan.fyi`**.

---

## 1. Choose Your Subdomain

Recommended subdomain options:
* **`stay.dinescan.fyi`** &mdash; *Ideal for resort / hotel guest in-room dining & continuous tabs.*
* **`app.dinescan.fyi`** &mdash; *Ideal for general QR restaurant ordering & admin operations.*
* **`dine.dinescan.fyi`** &mdash; *Ideal for table dining and guest menus.*

---

## 2. DNS Configuration (Add CNAME Record)

In your DNS provider (Cloudflare, GoDaddy, Namecheap, Route 53, etc.), add the following record:

| Type | Name / Host | Target / Value | TTL | Proxy Status (Cloudflare) |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `stay` | `cname.vercel-dns.com` | Auto (or 3600) | DNS Only (or Proxied) |

> **Note**: If you are deploying to **Vercel**, Vercel automatically provisions free, auto-renewing SSL certificates for your subdomain.

---

## 3. Deploying to Vercel (Step-by-Step)

1. **Push to GitHub / GitLab / Bitbucket**:
   ```bash
   git add .
   git commit -m "Phase 3: Billing, Invoicing & Launch"
   git push origin main
   ```

2. **Import Project to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your repository (`Red Chilly` / `dinescan`).
   - Framework Preset: **Next.js**.

3. **Configure Environment Variables in Vercel**:
   Add the following in **Settings &rarr; Environment Variables**:
   * `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL.
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key.
   * `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key.
   * `JWT_SECRET`: A secure 32+ character random secret string for guest session tokens.

4. **Attach Subdomain**:
   - In your Vercel project dashboard, go to **Settings &rarr; Domains**.
   - Enter `stay.dinescan.fyi` and click **Add**.
   - Vercel will verify the CNAME record and activate SSL within 1–2 minutes.

---

## 4. Production URL Structure

Once deployed to `stay.dinescan.fyi`:

| Purpose | Route |
| :--- | :--- |
| **Guest In-Room Dining (Room 404)** | `https://stay.dinescan.fyi/room/room-404` |
| **Guest Table Dining (Table 12)** | `https://stay.dinescan.fyi/table/table-12` |
| **Reception Admin Console** | `https://stay.dinescan.fyi/admin` |
| **Simulation Hub & Landing** | `https://stay.dinescan.fyi/` |

---

## 5. Security & Cookie Domain Considerations

* The guest session cookie (`dinescan_guest_session`) is set with `HttpOnly: true`, `SameSite: 'lax'`, and `Secure: true` in production.
* Because it is scoped to the subdomain (`stay.dinescan.fyi`), it will not conflict with any existing authentication or cookies on your root domain (`dinescan.fyi`).
