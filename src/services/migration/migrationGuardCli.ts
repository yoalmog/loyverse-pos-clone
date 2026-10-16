import fs from 'fs';
import path from 'path';
import {
  parseMigrationListLedger,
  validateStagingEnvironment,
  verifyLedgerTransition,
  runMigrationSmokeCheck,
  verifyMigrationIntegrity,
  verifyTargetDatabaseIdentity
} from './migrationGuardService';

export async function runGuardVerificationCli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'parse-ledger') {
    const filePath = args[1];
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(`Ledger file not found: ${filePath}`);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      const records = parseMigrationListLedger(content);
      console.log(JSON.stringify(records, null, 2));
      process.exit(0);
    } catch (err: any) {
      console.error(`::error::${err.message}`);
      process.exit(1);
    }
  }

  if (command === 'find-earliest-pending') {
    const ledgerFile = args[1];
    const migrationsDir = args[2] || 'supabase/migrations';

    const localFiles = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let appliedSet = new Set<string>();
    if (ledgerFile && fs.existsSync(ledgerFile)) {
      const content = fs.readFileSync(ledgerFile, 'utf8');
      const records = parseMigrationListLedger(content);
      for (const r of records) {
        if (r.isApplied) {
          if (r.local) appliedSet.add(r.local);
          if (r.remote) appliedSet.add(r.remote);
        }
      }
    }

    const pending = localFiles.filter(f => !appliedSet.has(f.split('_')[0]));
    if (pending.length === 0) {
      console.log(JSON.stringify({ hasPending: false, earliest: null, pendingCount: 0 }));
      process.exit(0);
    }

    const earliest = pending[0];
    console.log(JSON.stringify({
      hasPending: true,
      earliest,
      earliestTs: earliest.split('_')[0],
      pendingCount: pending.length,
      allPending: pending
    }));
    process.exit(0);
  }

  if (command === 'validate-staging') {
    const stagingDir = args[1];
    const targetFile = args[2];
    const ledgerFile = args[3];

    let appliedSet = new Set<string>();
    if (ledgerFile && fs.existsSync(ledgerFile)) {
      const content = fs.readFileSync(ledgerFile, 'utf8');
      const records = parseMigrationListLedger(content);
      for (const r of records) {
        if (r.isApplied) {
          if (r.local) appliedSet.add(r.local);
          if (r.remote) appliedSet.add(r.remote);
        }
      }
    }

    try {
      const res = validateStagingEnvironment(stagingDir, targetFile, appliedSet);
      console.log(res.message);
      process.exit(0);
    } catch (err: any) {
      console.error(`::error::${err.message}`);
      process.exit(1);
    }
  }

  if (command === 'verify-transition') {
    const beforeLedgerFile = args[1];
    const afterLedgerFile = args[2];
    const targetFile = args[3];
    const migrationsDir = args[4] || 'supabase/migrations';

    if (!beforeLedgerFile || !fs.existsSync(beforeLedgerFile)) {
      console.error(`::error::Before ledger file not found: ${beforeLedgerFile}`);
      process.exit(1);
    }
    if (!afterLedgerFile || !fs.existsSync(afterLedgerFile)) {
      console.error(`::error::After ledger file not found: ${afterLedgerFile}`);
      process.exit(1);
    }
    if (!targetFile) {
      console.error(`::error::Target migration file argument missing!`);
      process.exit(1);
    }

    const beforeRaw = fs.readFileSync(beforeLedgerFile, 'utf8');
    const afterRaw = fs.readFileSync(afterLedgerFile, 'utf8');

    try {
      const result = verifyLedgerTransition(beforeRaw, afterRaw, targetFile, migrationsDir);
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err: any) {
      console.error(`::error::${err.message}`);
      process.exit(1);
    }
  }

  if (command === 'smoke-check') {
    const targetFile = args[1];
    const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!targetFile) {
      console.error(`::error::Target file argument missing for smoke check!`);
      process.exit(1);
    }

    try {
      const result = await runMigrationSmokeCheck(targetFile, supabaseUrl, supabaseAnonKey);
      console.log(JSON.stringify(result, null, 2));
      if (!result.passed) {
        console.error(`::error::Smoke check failed: ${result.summary}`);
        process.exit(1);
      }
      process.exit(0);
    } catch (err: any) {
      console.error(`::error::Smoke check fatal error: ${err.message}`);
      process.exit(1);
    }
  }

  if (command === 'verify-db-url') {
    const dbUrl = args[1] || process.env.SUPABASE_DB_URL || '';
    const expectedProject = args[2] || process.env.SUPABASE_PROJECT_ID || 'zchadhvfffmmarpznyxi';

    if (!dbUrl) {
      console.error('::error::Database URL missing for verify-db-url!');
      process.exit(1);
    }

    try {
      const result = await verifyTargetDatabaseIdentity(dbUrl, expectedProject);
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) {
        console.error(`::error::FAIL-CLOSED TARGET DB IDENTITY MISMATCH: ${result.error}`);
        process.exit(1);
      }
      process.exit(0);
    } catch (err: any) {
      console.error(`::error::Target DB identity fatal error: ${err.message}`);
      process.exit(1);
    }
  }

  if (command === 'verify-migration-integrity') {
    const migrationsDir = args[1] || path.resolve(process.cwd(), 'supabase/migrations');
    try {
      const result = verifyMigrationIntegrity(migrationsDir);
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) {
        console.error(`::error::MIGRATION FILE INTEGRITY VIOLATION: ${result.summary}`);
        if (result.mismatches.length > 0) {
          result.mismatches.forEach(m => console.error(`  - Hash mismatch: ${m}`));
        }
        if (result.missingFiles.length > 0) {
          result.missingFiles.forEach(f => console.error(`  - Missing migration file: ${f}`));
        }
        process.exit(1);
      }
      process.exit(0);
    } catch (err: any) {
      console.error(`::error::Migration integrity fatal error: ${err.message}`);
      process.exit(1);
    }
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

if (process.argv[1] && (import.meta.url === `file://${process.argv[1]}` || import.meta.url.includes(path.basename(process.argv[1])))) {
  runGuardVerificationCli();
}
