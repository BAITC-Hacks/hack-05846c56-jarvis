/**
 * Explicitly authorized shared hackathon demo, for test data only.
 * The published password is intentional; this account must not hold private data.
 * Run: node --env-file=.env.local --conditions=react-server --import tsx scripts/seed-demo-account.ts
 * Existing accounts are never updated, including their password or verification.
 */
import 'server-only';
import { neon } from '@neondatabase/serverless';
import { hashPassword } from 'better-auth/crypto';

async function main() {
 const connection = process.env.DATABASE_URL;
 if (!connection) throw new Error('DATABASE_URL is required');
 const sql = neon(connection);
 const email = 'demo@jarvis-ekt.example';
 const name = 'Demo user1';
 const passwordHash = await hashPassword('password123');
 // One statement: either both identity and credential are inserted or neither is.
 // ON CONFLICT never resets an existing account or elevates any role.
 const inserted = await sql`
  WITH created_user AS (
   INSERT INTO neon_auth."user" (name,email,"emailVerified",role,banned)
   VALUES (${name},${email},true,'user',false)
   ON CONFLICT (email) DO NOTHING
   RETURNING id
  ), created_account AS (
   INSERT INTO neon_auth.account ("accountId","providerId","userId",password,"updatedAt")
   SELECT id::text,'credential',id,${passwordHash},NOW() FROM created_user
   RETURNING "userId"
  ) SELECT COUNT(*)::integer AS count FROM created_account
 `;
 // Read only this explicitly authorized demo identity, never hashes or sessions.
 const rows = await sql`
  SELECT u.name,u.email,u."emailVerified",u.role,u.banned,
   EXISTS (SELECT 1 FROM neon_auth.account a WHERE a."userId"=u.id
    AND a."providerId"='credential' AND a."accountId"=u.id::text) AS has_credential
  FROM neon_auth."user" u WHERE u.email=${email}
 `;
 const user = rows[0];
 const valid = user?.name === name && user?.email === email && user?.emailVerified === true
  && user?.role === 'user' && !user?.banned && user?.has_credential === true;
 console.log(JSON.stringify({ status: inserted[0]?.count === 1 ? 'created' : 'exists-unmodified', metadataValid: valid, user }));
 if (!valid) throw new Error('Demo metadata differs from expected values; no existing data was changed');
}

main().catch(() => { console.error('Demo seed failed; no credentials or database error details are printed.'); process.exitCode = 1; });
