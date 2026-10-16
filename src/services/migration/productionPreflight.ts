/**
 * AuraPOS Phase 4A.8 — Validation-Only Production Preflight Procedure
 *
 * Strictly read-only: Never modifies production data or applies migrations.
 * Verifies:
 * 1. Project identity & endpoint configuration (project reference, API reachability).
 * 2. Actual remote migration ledger history (via Supabase CLI migration list).
 * 3. Existing schema state (inspects tables/functions without applying DDL).
 * 4. Deterministic candidate for earliest pending migration without hardcoding.
 *
 * FAILS CLOSED:
 * - If ledger cannot be retrieved or parsed, fails closed with non-zero exit code.
 * - If schema is unreachable or unknown, marks schema as 'unknown_inaccessible' (NEVER 'empty').
 * - Unverified ledgers NEVER produce a verified pending target migration.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { parseMigrationListLedger, MigrationStatus } from './migrationGuardService';

export interface DbUrlVerificationResult {
  valid: boolean;
  detectedProject: string | null;
  error?: string;
}

/**
 * Fail-closed target-project identity verification for database connection URLs.
 * Ensures the connection URL path/host/user strictly matches the designated target project
 * to prevent accidental connection or mutation against an unintended database.
 */
export function verifyTargetProjectDbUrl(dbUrl: string, expectedProjectId: string): DbUrlVerificationResult {
  try {
    if (!dbUrl || typeof dbUrl !== 'string' || dbUrl.trim() === '') {
      return { valid: false, detectedProject: null, error: 'Database URL is empty or undefined.' };
    }

    let parsed: URL;
    try {
      parsed = new URL(dbUrl);
    } catch (e: any) {
      return { valid: false, detectedProject: null, error: `Invalid database URL syntax: ${e.message}` };
    }

    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
      return {
        valid: false,
        detectedProject: null,
        error: `Invalid database protocol: expected postgres: or postgresql:, got '${parsed.protocol}'`
      };
    }

    const hostname = parsed.hostname.toLowerCase();
    const username = decodeURIComponent(parsed.username || '').toLowerCase();
    const expected = expectedProjectId.trim().toLowerCase();

    // Check 1: Direct Supabase hostname pattern: db.<project-ref>.supabase.co or db.<project-ref>.supabase.net
    const directMatch = hostname.match(/^db\.([a-z0-9_-]+)\.supabase\.(co|net)$/i);
    if (directMatch) {
      const detected = directMatch[1].toLowerCase();
      if (detected !== expected) {
        return {
          valid: false,
          detectedProject: detected,
          error: `DB URL target project mismatch in host: expected "${expected}", detected "${detected}". Aborting to prevent accidental mutation of wrong database.`
        };
      }
      return { valid: true, detectedProject: detected };
    }

    // Check 2: Pooler Supabase pattern: aws-0-<region>.pooler.supabase.com with username postgres.<project-ref>
    if (hostname.includes('pooler.supabase.com') || hostname.includes('supabase.co')) {
      const userParts = username.split('.');
      if (userParts.length >= 2 && userParts[0] === 'postgres') {
        const detected = userParts[1].toLowerCase();
        if (detected !== expected) {
          return {
            valid: false,
            detectedProject: detected,
            error: `DB URL target project mismatch in username: expected "${expected}", detected "${detected}". Aborting to prevent accidental mutation of wrong database.`
          };
        }
        return { valid: true, detectedProject: detected };
      }
    }

    // Check 3: Local disposable / loopback connection (e.g. 127.0.0.1, localhost)
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
      if (expected === 'local' || process.env.ALLOW_LOCAL_DB === 'true' || process.env.NODE_ENV === 'test') {
        return { valid: true, detectedProject: 'local' };
      }
      return {
        valid: false,
        detectedProject: 'localhost',
        error: `Local database URL provided (${hostname}) but target project is configured as production ("${expected}"). Local DB URLs are rejected in production preflight without explicit override.`
      };
    }

    // Check 4: Unrecognized host without explicit project verification fails closed
    return {
      valid: false,
      detectedProject: null,
      error: `Could not verify target project identity from DB URL host "${hostname}". Host must match db.<project-ref>.supabase.co or pooler.supabase.com with username postgres.<project-ref>.`
    };
  } catch (err: any) {
    return { valid: false, detectedProject: null, error: `Fail-closed target project identity check failed: ${err.message}` };
  }
}

export interface PreflightReport {
  timestamp: string;
  projectId: string;
  projectUrl: string;
  hasDirectCredentials: boolean;
  actualMigrationHistory: MigrationStatus[];
  appliedTimestamps: string[];
  localMigrations: string[];
  pendingMigrations: string[];
  earliestPendingMigration: string | null;
  ledgerVerified: boolean;
  existingSchemaObjects: {
    testedTables: string[];
    detectedTables: string[];
    schemaState: 'empty' | 'partial' | 'complete' | 'unknown_inaccessible';
    schemaAccessible: boolean;
  };
  validationVerdict:
    | 'READY_FOR_NEXT_MIGRATION'
    | 'BLOCKED_CREDENTIALS'
    | 'BLOCKED_LEDGER_ERROR'
    | 'BLOCKED_DRIFT'
    | 'BLOCKED_SCHEMA_INACCESSIBLE'
    | 'NO_PENDING_MIGRATIONS';
  blockers: string[];
}

export async function runProductionPreflight(options?: {
  ledgerFilePath?: string;
  silent?: boolean;
}): Promise<PreflightReport> {
  const timestamp = new Date().toISOString();
  const projectId = process.env.SUPABASE_PROJECT_ID || 'zchadhvfffmmarpznyxi';
  const projectUrl = process.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
  const dbUrl = process.env.SUPABASE_DB_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  const hasDirectCredentials = Boolean(dbUrl || (accessToken && dbPassword));
  const blockers: string[] = [];

  // Fail-closed target-project identity verification for DB URL path if provided
  let dbUrlVerified = false;
  if (dbUrl) {
    const urlCheck = verifyTargetProjectDbUrl(dbUrl, projectId);
    if (!urlCheck.valid) {
      blockers.push(`FAIL-CLOSED DB URL IDENTITY MISMATCH: ${urlCheck.error}`);
    } else {
      dbUrlVerified = true;
    }
  }

  if (!options?.silent) {
    console.log('======================================================================');
    console.log('AURAPOS PHASE 4A.8 — VALIDATION-ONLY PRODUCTION PREFLIGHT PROCEDURE');
    console.log('======================================================================');
    console.log(`Execution Timestamp: ${timestamp}`);
    console.log(`Project Ref:         ${projectId}`);
    console.log(`Project URL:         ${projectUrl}`);
    console.log(`Direct Credentials:  ${hasDirectCredentials ? 'Configured' : 'Missing'}`);
    if (dbUrl) {
      console.log(`DB URL Identity:     ${dbUrlVerified ? 'VERIFIED MATCH' : 'REJECTED (FAIL-CLOSED)'}`);
    }
    console.log('');
  }

  // 1. Read Local Migrations
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`CRITICAL: Migrations directory does not exist: ${migrationsDir}`);
  }
  const localFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (localFiles.length === 0) {
    throw new Error(`CRITICAL: Zero migration files found in ${migrationsDir}`);
  }

  // 2. Retrieve Remote Migration Ledger
  let ledgerOutput = '';
  let ledgerVerified = false;

  if (options?.ledgerFilePath) {
    if (!fs.existsSync(options.ledgerFilePath)) {
      blockers.push(`Specified ledger file not found: ${options.ledgerFilePath}`);
    } else {
      ledgerOutput = fs.readFileSync(options.ledgerFilePath, 'utf8');
    }
  } else if (hasDirectCredentials) {
    // If dbUrl was provided but failed verification, do NOT connect using it
    if (dbUrl && !dbUrlVerified) {
      blockers.push('Refusing to execute remote ledger query using unverified or mismatched database URL.');
    } else {
      try {
        if (dbUrl) {
          ledgerOutput = execSync(`supabase migration list --db-url "${dbUrl}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
        } else {
          execSync(`supabase link --project-ref "${projectId}" --password "${dbPassword}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          ledgerOutput = execSync(`supabase migration list`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
        }
      } catch (err: any) {
        blockers.push(`Failed to retrieve remote migration ledger: ${err.message}`);
      }
    }
  } else {
    blockers.push('No direct database credentials configured and no ledger artifact provided. Remote ledger is unverified.');
  }

  // Parse Ledger (Fail closed if corrupt or unparsed)
  let parsedLedger: MigrationStatus[] = [];
  const appliedTimestamps: string[] = [];

  if (ledgerOutput && ledgerOutput.trim().length > 0) {
    try {
      parsedLedger = parseMigrationListLedger(ledgerOutput);
      ledgerVerified = true;
      for (const item of parsedLedger) {
        if (item.isApplied && item.remote) {
          appliedTimestamps.push(item.remote);
        }
        if (item.isMismatched) {
          blockers.push(`Ledger drift detected: local ${item.local} does not match remote ${item.remote}`);
        }
      }
    } catch (err: any) {
      blockers.push(`Failed to parse migration ledger: ${err.message}`);
      ledgerVerified = false;
    }
  }

  // Compute Pending Migrations ONLY IF ledger is verified
  let pendingMigrations: string[] = [];
  let earliestPendingMigration: string | null = null;

  if (ledgerVerified) {
    const appliedSet = new Set(appliedTimestamps);
    pendingMigrations = localFiles.filter(f => {
      const ts = f.split('_')[0];
      return !appliedSet.has(ts);
    });
    earliestPendingMigration = pendingMigrations.length > 0 ? pendingMigrations[0] : null;
  } else {
    // Unverified ledger: NEVER produce a verified pending target migration
    pendingMigrations = [];
    earliestPendingMigration = null;
    blockers.push('Unverified ledger cannot determine pending migration candidates: failing closed');
  }

  // 3. Inspect Schema Existence (Non-Destructive)
  const coreTables = ['stores', 'terminals', 'roles', 'permissions', 'products', 'sales', 'cash_shifts'];
  const detectedTables: string[] = [];
  let schemaAccessible = false;
  let schemaState: 'empty' | 'partial' | 'complete' | 'unknown_inaccessible' = 'unknown_inaccessible';

  try {
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!anonKey) {
      blockers.push('VITE_SUPABASE_ANON_KEY not configured; schema inspection endpoint inaccessible.');
      schemaAccessible = false;
      schemaState = 'unknown_inaccessible';
    } else {
      const response = await fetch(`${projectUrl}/rest/v1/`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
      });
      if (response && response.ok) {
        schemaAccessible = true;
        const openApiSpec = await response.json().catch(() => null);
        if (openApiSpec && openApiSpec.definitions) {
          for (const tbl of coreTables) {
            if (openApiSpec.definitions[tbl]) {
              detectedTables.push(tbl);
            }
          }
        }
        if (detectedTables.length === 0) {
          schemaState = 'empty';
        } else if (detectedTables.length === coreTables.length) {
          schemaState = 'complete';
        } else {
          schemaState = 'partial';
        }
      } else {
        schemaAccessible = false;
        schemaState = 'unknown_inaccessible';
        blockers.push(`Remote schema API returned non-OK status (${response ? response.status : 'No response'}): schema cannot be determined.`);
      }
    }
  } catch (err: any) {
    schemaAccessible = false;
    schemaState = 'unknown_inaccessible';
    blockers.push(`Remote schema inspection connection failed: ${err.message}`);
  }

  // 4. Verdict computation (Strict fail-closed logic)
  let validationVerdict:
    | 'READY_FOR_NEXT_MIGRATION'
    | 'BLOCKED_CREDENTIALS'
    | 'BLOCKED_LEDGER_ERROR'
    | 'BLOCKED_DRIFT'
    | 'BLOCKED_SCHEMA_INACCESSIBLE'
    | 'NO_PENDING_MIGRATIONS';

  if (!ledgerVerified) {
    if (!hasDirectCredentials && !options?.ledgerFilePath) {
      validationVerdict = 'BLOCKED_CREDENTIALS';
    } else {
      validationVerdict = 'BLOCKED_LEDGER_ERROR';
    }
  } else if (blockers.some(b => b.includes('drift'))) {
    validationVerdict = 'BLOCKED_DRIFT';
  } else if (!schemaAccessible) {
    validationVerdict = 'BLOCKED_SCHEMA_INACCESSIBLE';
  } else if (pendingMigrations.length === 0 && appliedTimestamps.length > 0) {
    validationVerdict = 'NO_PENDING_MIGRATIONS';
  } else if (earliestPendingMigration !== null) {
    validationVerdict = 'READY_FOR_NEXT_MIGRATION';
  } else {
    validationVerdict = 'BLOCKED_LEDGER_ERROR';
  }

  const report: PreflightReport = {
    timestamp,
    projectId,
    projectUrl,
    hasDirectCredentials,
    actualMigrationHistory: parsedLedger,
    appliedTimestamps,
    localMigrations: localFiles,
    pendingMigrations,
    earliestPendingMigration,
    ledgerVerified,
    existingSchemaObjects: {
      testedTables: coreTables,
      detectedTables,
      schemaState,
      schemaAccessible
    },
    validationVerdict,
    blockers
  };

  if (!options?.silent) {
    console.log('--- Preflight Findings ---');
    console.log(`Local Migration Files (${localFiles.length}):`);
    localFiles.forEach(f => console.log(`  - ${f}`));
    console.log(`\nLedger Verified:                    ${ledgerVerified}`);
    console.log(`Applied Remote Migrations (${appliedTimestamps.length}):`);
    if (appliedTimestamps.length === 0) {
      console.log('  (None or unverified)');
    } else {
      appliedTimestamps.forEach(ts => console.log(`  - ${ts}`));
    }
    console.log(`\nPending Migrations (${pendingMigrations.length}):`);
    pendingMigrations.forEach(p => console.log(`  - ${p}`));
    console.log(`\nEarliest Pending Migration Target: ${earliestPendingMigration || 'None (Unverified)'}`);
    console.log(`Schema Accessibility:              ${schemaAccessible ? 'Accessible' : 'INACCESSIBLE / UNKNOWN'}`);
    console.log(`Detected Schema State:              ${schemaState} (${detectedTables.length}/${coreTables.length} tables verified)`);
    console.log(`Preflight Verdict:                  ${validationVerdict}`);
    if (blockers.length > 0) {
      console.log('\nActive Blockers:');
      blockers.forEach(b => console.log(`  - ${b}`));
    }
    console.log('======================================================================\n');
  }

  return report;
}

if (process.argv[1] && (import.meta.url === `file://${process.argv[1]}` || import.meta.url.includes(path.basename(process.argv[1])))) {
  const ledgerArg = process.argv[2];
  runProductionPreflight({ ledgerFilePath: ledgerArg }).then(report => {
    if (report.validationVerdict !== 'READY_FOR_NEXT_MIGRATION' && report.validationVerdict !== 'NO_PENDING_MIGRATIONS') {
      console.error(`::error::Production preflight failed closed with verdict: ${report.validationVerdict}`);
      process.exit(1);
    }
    process.exit(0);
  }).catch(err => {
    console.error(`::error::Fatal preflight execution error: ${err.message}`);
    process.exit(1);
  });
}
