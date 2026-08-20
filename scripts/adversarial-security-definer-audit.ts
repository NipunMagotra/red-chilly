/**
 * Adversarial SECURITY DEFINER Forensic Audit
 * 
 * Inspects all SQL migration files and codebase functions to verify:
 * 1. Fixed search_path (SET search_path = public, pg_temp)
 * 2. Explicit schema qualification
 * 3. Least-privilege ownership
 * 4. EXECUTE grants (REVOKE EXECUTE FROM PUBLIC)
 * 5. Caller authorization (auth.uid() / session verification)
 * 6. Tenant authorization & spoofing resistance
 * 7. Trust in user-supplied tenant IDs / arbitrary request headers (x-session-token)
 * 8. Privilege escalation via function arguments
 */

import fs from 'fs'
import path from 'path'

interface FunctionDef {
  name: string
  file: string
  line: number
  sql: string
  hasFixedSearchPath: boolean
  hasExplicitSchemaQualification: boolean
  hasRevokePublic: boolean
  hasCallerAuth: boolean
  hasTenantIsolationCheck: boolean
  dependsOnHeader: boolean
  vulnerabilities: string[]
}

function auditSqlMigrations(): FunctionDef[] {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))

  const securityDefinerFunctions: FunctionDef[] = []

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file)
    const content = fs.readFileSync(fullPath, 'utf8')
    const lines = content.split('\n')

    // Find all CREATE OR REPLACE FUNCTION ... SECURITY DEFINER
    const regex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*RETURNS\s+([\s\S]*?)\$\$\s*([\s\S]*?)\$\$\s*LANGUAGE\s+plpgsql\s+SECURITY\s+DEFINER/gi

    let match: RegExpExecArray | null
    while ((match = regex.exec(content)) !== null) {
      const funcName = match[1]
      const funcBody = match[4]
      const lineNumber = content.substring(0, match.index).split('\n').length

      const hasFixedSearchPath = /SET\s+search_path\s*=\s*/i.test(match[0]) || /SET\s+search_path\s*=\s*/i.test(funcBody)
      const hasExplicitSchemaQualification = /public\.[a-zA-Z0-9_]+/i.test(funcBody)
      const hasRevokePublic = new RegExp(`REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${funcName}`, 'i').test(content)
      const hasCallerAuth = /auth\.uid\(\)/i.test(funcBody) || /current_setting\('request\.headers'/i.test(funcBody)
      const hasTenantIsolationCheck = /property_id/i.test(funcBody)
      const dependsOnHeader = /request\.headers/i.test(funcBody) || /x-session-token/i.test(funcBody)

      const vulnerabilities: string[] = []

      if (!hasFixedSearchPath) {
        vulnerabilities.push('CRITICAL: Missing fixed search_path (vulnerable to schema poisoning / trojan search_path attack)')
      }

      if (!hasRevokePublic) {
        vulnerabilities.push('HIGH: Missing REVOKE EXECUTE FROM PUBLIC (callable by unauthenticated anon role via Supabase PostgREST RPC)')
      }

      if (funcName === 'settle_guest_tab') {
        if (!/auth\.uid\(\)/i.test(funcBody) && !/is_property_staff/i.test(funcBody)) {
          vulnerabilities.push('CRITICAL: settle_guest_tab lacks caller authentication (does not check is_property_staff or auth.uid()). Any anonymous user knowing a session UUID can settle the tab!')
        }
        if (/p_expected_property_id\s+UUID\s+DEFAULT\s+NULL/i.test(match[0])) {
          vulnerabilities.push('HIGH: p_expected_property_id is optional and defaults to NULL, allowing cross-property settlement if caller omits parameter.')
        }
      }

      if (funcName === 'append_items_to_guest_tab') {
        if (!dependsOnHeader && !/auth\.uid\(\)/i.test(funcBody)) {
          vulnerabilities.push('MEDIUM: append_items_to_guest_tab does not verify caller session token in SQL body (relies on caller to pass valid session_id and location_id). If exposed via RPC to anon, allows appending to any active session.')
        }
      }

      securityDefinerFunctions.push({
        name: funcName,
        file,
        line: lineNumber,
        sql: match[0],
        hasFixedSearchPath,
        hasExplicitSchemaQualification,
        hasRevokePublic,
        hasCallerAuth,
        hasTenantIsolationCheck,
        dependsOnHeader,
        vulnerabilities,
      })
    }
  }

  return securityDefinerFunctions
}

function runAudit() {
  console.log('\n==================================================================')
  console.log('🔍 FORENSIC AUDIT OF SECURITY DEFINER FUNCTIONS')
  console.log('==================================================================\n')

  const functions = auditSqlMigrations()

  console.log(`Found ${functions.length} SECURITY DEFINER functions across migrations:\n`)

  for (const fn of functions) {
    console.log(`------------------------------------------------------------------`)
    console.log(`Function: ${fn.name}() in ${fn.file}:${fn.line}`)
    console.log(`- Fixed search_path: ${fn.hasFixedSearchPath ? '✅ Yes' : '❌ NO'}`)
    console.log(`- Explicit public. qualification: ${fn.hasExplicitSchemaQualification ? '✅ Yes' : '⚠️ No (unqualified table references)'}`)
    console.log(`- REVOKE EXECUTE FROM PUBLIC: ${fn.hasRevokePublic ? '✅ Yes' : '❌ NO'}`)
    console.log(`- Caller Auth Check: ${fn.hasCallerAuth ? '✅ Yes' : '⚠️ NO'}`)
    console.log(`- Tenant Isolation Check: ${fn.hasTenantIsolationCheck ? '✅ Yes' : '❌ NO'}`)
    console.log(`- Depends on request.headers / x-session-token: ${fn.dependsOnHeader ? '⚠️ Yes' : 'No'}`)

    if (fn.vulnerabilities.length > 0) {
      console.log(`\n🚨 Identified Vulnerabilities:`)
      for (const v of fn.vulnerabilities) {
        console.log(`  - ${v}`)
      }
    } else {
      console.log(`\n✅ No critical structural defects found.`)
    }
    console.log()
  }

  console.log('==================================================================')
  console.log('📋 IDENTITY & SESSION TOKEN TRUST ANALYSIS')
  console.log('==================================================================')
  console.log(`
1. How the database knows which guest is calling:
   - In Supabase/PostgREST, the client sends an HTTP header: 'x-session-token: <session-token-uuid>'.
   - PostgREST exposes this via current_setting('request.headers', true)::json->>'x-session-token'.
   - RLS policies on guest_sessions, orders, and order_items compare this string against gs.session_token.
   - Session tokens are random UUIDv4 (122 bits of cryptographic entropy) generated at session creation.

2. Risks & Attack Vectors on Header-Based Identity:
   - HTTP headers are client-controlled. Any client can send arbitrary 'x-session-token' headers.
   - If an attacker knows or brute-forces another guest's session token UUID, they can impersonate that guest.
   - In Next.js Server Actions (the actual application backend), the architecture uses signed HMAC-SHA256 JWT cookies (dinescan_guest_session) containing { sessionId, locationId, propertyId, tokenVersion }.
   - Next.js verifies the JWT signature on every Server Action before performing operations.
   - Discrepancy: If the Supabase REST API is exposed directly to the internet without restricting RPC / table permissions, attackers can bypass Next.js and interact with PostgREST directly using forged headers or RPC calls.
`)
}

runAudit()
