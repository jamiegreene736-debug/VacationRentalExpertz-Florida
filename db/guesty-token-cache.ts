const CACHE_KEY = "open-api";
const REFRESH_LEASE_MS = 15_000;
const TOKEN_WAIT_ATTEMPTS = 8;
const TOKEN_WAIT_MS = 250;

export interface SharedGuestyToken {
  accessToken: string;
  expiresAt: number;
}

interface TokenRow {
  access_token: string | null;
  expires_at_ms: number;
}

function database(): D1Database | undefined {
  const binding = (globalThis as typeof globalThis & {
    __VACATION_RENTAL_EXPERTZ_DB__?: D1Database;
  }).__VACATION_RENTAL_EXPERTZ_DB__;
  return binding?.prepare ? binding : undefined;
}

export async function readSharedGuestyToken(
  now = Date.now(),
): Promise<SharedGuestyToken | undefined> {
  const db = database();
  if (!db) return undefined;

  try {
    const row = await db.prepare(
      "SELECT access_token, expires_at_ms FROM guesty_token_cache WHERE cache_key = ?",
    ).bind(CACHE_KEY).first<TokenRow>();
    if (!row?.access_token || row.expires_at_ms <= now) return undefined;
    return { accessToken: row.access_token, expiresAt: row.expires_at_ms };
  } catch (error) {
    console.error("Guesty shared token cache read failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return undefined;
  }
}

export async function acquireGuestyTokenRefreshLease(
  now = Date.now(),
): Promise<string | null | undefined> {
  const db = database();
  if (!db) return undefined;

  const owner = crypto.randomUUID();
  try {
    const result = await db.prepare(`
      INSERT INTO guesty_token_cache (
        cache_key, expires_at_ms, refresh_lock_until_ms, refresh_lock_owner, updated_at
      ) VALUES (?, 0, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(cache_key) DO UPDATE SET
        refresh_lock_until_ms = excluded.refresh_lock_until_ms,
        refresh_lock_owner = excluded.refresh_lock_owner,
        updated_at = CURRENT_TIMESTAMP
      WHERE guesty_token_cache.expires_at_ms <= ?
        AND guesty_token_cache.refresh_lock_until_ms <= ?
    `).bind(CACHE_KEY, now + REFRESH_LEASE_MS, owner, now, now).run();
    return (result.meta.changes ?? 0) > 0 ? owner : null;
  } catch (error) {
    console.error("Guesty shared token refresh lease failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return undefined;
  }
}

export async function writeSharedGuestyToken(
  token: SharedGuestyToken,
  leaseOwner: string,
): Promise<void> {
  const db = database();
  if (!db) return;

  try {
    await db.prepare(`
      UPDATE guesty_token_cache
      SET access_token = ?, expires_at_ms = ?, refresh_lock_until_ms = 0,
          refresh_lock_owner = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE cache_key = ? AND refresh_lock_owner = ?
    `).bind(token.accessToken, token.expiresAt, CACHE_KEY, leaseOwner).run();
  } catch (error) {
    console.error("Guesty shared token cache write failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function seedSharedGuestyToken(token: SharedGuestyToken): Promise<void> {
  const db = database();
  if (!db) return;

  try {
    await db.prepare(`
      INSERT INTO guesty_token_cache (
        cache_key, access_token, expires_at_ms, refresh_lock_until_ms,
        refresh_lock_owner, updated_at
      ) VALUES (?, ?, ?, 0, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(cache_key) DO UPDATE SET
        access_token = excluded.access_token,
        expires_at_ms = excluded.expires_at_ms,
        refresh_lock_until_ms = 0,
        refresh_lock_owner = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE excluded.expires_at_ms > guesty_token_cache.expires_at_ms
    `).bind(CACHE_KEY, token.accessToken, token.expiresAt).run();
  } catch (error) {
    console.error("Guesty shared token cache seed failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function invalidateSharedGuestyToken(accessToken: string): Promise<void> {
  const db = database();
  if (!db) return;

  try {
    await db.prepare(`
      UPDATE guesty_token_cache
      SET expires_at_ms = 0, updated_at = CURRENT_TIMESTAMP
      WHERE cache_key = ? AND access_token = ?
    `).bind(CACHE_KEY, accessToken).run();
  } catch (error) {
    console.error("Guesty shared token invalidation failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function releaseGuestyTokenRefreshLease(leaseOwner: string): Promise<void> {
  const db = database();
  if (!db) return;

  try {
    await db.prepare(`
      UPDATE guesty_token_cache
      SET refresh_lock_until_ms = 0, refresh_lock_owner = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE cache_key = ? AND refresh_lock_owner = ?
    `).bind(CACHE_KEY, leaseOwner).run();
  } catch (error) {
    console.error("Guesty shared token refresh lease release failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function deferGuestyTokenRefreshLease(
  leaseOwner: string,
  retryAt: number,
): Promise<void> {
  const db = database();
  if (!db) return;

  try {
    await db.prepare(`
      UPDATE guesty_token_cache
      SET refresh_lock_until_ms = ?, refresh_lock_owner = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE cache_key = ? AND refresh_lock_owner = ?
    `).bind(retryAt, CACHE_KEY, leaseOwner).run();
  } catch (error) {
    console.error("Guesty shared token refresh backoff failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function waitForSharedGuestyToken(): Promise<SharedGuestyToken | undefined> {
  for (let attempt = 0; attempt < TOKEN_WAIT_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, TOKEN_WAIT_MS));
    const token = await readSharedGuestyToken();
    if (token) return token;
  }
  return undefined;
}
