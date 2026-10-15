import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

// Embedded public Supabase Root 2021 CA certificate for strict TLS validation
const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

export function getTrustedCaCert(): string {
  const customCertPath = process.env.PG_SSL_CA_PATH || path.join(process.cwd(), 'certs', 'supabase-prod-ca-2021.crt');
  if (fs.existsSync(customCertPath)) {
    try {
      return fs.readFileSync(customCertPath, 'utf8');
    } catch {
      // Fallback to embedded certificate
    }
  }
  return SUPABASE_ROOT_CA;
}

function loadEnvFallback() {
  if (process.env.DATABASE_URL || process.env.TEST_DATABASE_URL) return;
  for (const envFile of ['.env.local', '.env']) {
    if (fs.existsSync(envFile)) {
      const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  }
}

export function isPostgresConfigured(): boolean {
  loadEnvFallback();
  const url = (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  return Boolean(url && (url.startsWith('postgres://') || url.startsWith('postgresql://')));
}

export function getPgPool(): pg.Pool {
  if (poolInstance) return poolInstance;

  loadEnvFallback();
  const databaseUrl = (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured for PostgreSQL connection.');
  }

  // Strip query-string sslmode to let pg.Pool ssl options manage strict validation cleanly
  let sanitizedUrl = databaseUrl;
  try {
    const parsed = new URL(databaseUrl);
    parsed.searchParams.delete('sslmode');
    sanitizedUrl = parsed.toString();
  } catch {
    sanitizedUrl = databaseUrl.replace(/[?&]sslmode(=[^&]*)?(&|$)/, '$2').replace(/\?$/, '');
  }
  const caCert = getTrustedCaCert();

  poolInstance = new Pool({
    connectionString: sanitizedUrl,
    ssl: {
      rejectUnauthorized: true,
      ca: caCert,
    },
    // Tailored for Supabase Transaction Pooler and Render Free Tier (512MB RAM)
    max: parseInt(process.env.PG_MAX_CONNECTIONS || '5', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  poolInstance.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]:', err.message);
  });

  return poolInstance;
}

export async function queryPg<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const pool = getPgPool();
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryPgOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await queryPg<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function withPgTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function checkPgHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const pool = getPgPool();
    const res = await pool.query('SELECT 1 as alive');
    const latencyMs = Date.now() - start;
    if (res.rows[0]?.alive === 1) {
      return { ok: true, latencyMs };
    }
    return { ok: false, latencyMs, error: 'Unexpected response from database' };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    // Sanitize any sensitive details from the error message
    const safeError = err.message ? err.message.replace(/:[^@:]+@/, ':***@') : 'Database connection error';
    return { ok: false, latencyMs, error: safeError };
  }
}
