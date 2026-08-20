import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Privileged Supabase Service-Role Admin Client.
 * 
 * SECURITY CONTRACT:
 * 1. This module is strictly protected with `import 'server-only'`.
 *    If any client component attempts to import this file, Next.js compilation will fail immediately.
 * 2. SUPABASE_SERVICE_ROLE_KEY has NO `NEXT_PUBLIC_` prefix and is NEVER bundled into client JS.
 * 3. Any Server Action or background job using this client MUST independently authenticate
 *    and authorize the caller (e.g. via verifyStaffSession()) before invoking database queries.
 * 4. Never trust client-provided IDs without verifying tenant ownership.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. Privileged admin client cannot be initialized.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
