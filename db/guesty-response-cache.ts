const REFRESH_LEASE_MS = 15_000;
const CACHE_WAIT_ATTEMPTS = 8;
const CACHE_WAIT_MS = 250;

export interface SharedGuestyResponse {
  payload: unknown;
  expiresAt: number;
  staleUntil: number;
}

interface ResponseRow {
  payload_json: string | null;
  expires_at_ms: number;
  stale_until_ms: number;
}

function database(): D1Database | undefined {
  const binding = (globalThis as typeof globalThis & {
    __VACATION_RENTAL_EXPERTZ_DB__?: D1Database;
  }).__VACATION_RENTAL_EXPERTZ_DB__;
  return binding?.prepare ? binding : undefined;
}

function responseFromRow(row: ResponseRow | null): SharedGuestyResponse | undefined {
  if (!row?.payload_json) return undefined;
  try {
    return {
      payload: JSON.parse(row.payload_json),
      expiresAt: row.expires_at_ms,
      staleUntil: row.stale_until_ms,
    };
  } catch {
    console.error("Guesty response cache contained invalid JSON");
    return undefined;
  }
}

export async function readSharedGuestyResponse(
  cacheKey: string,
): Promise<SharedGuestyResponse | undefined> {
  const db = database();
  if (!db) return undefined;

  try {
    const row = await db.prepare(
      `SELECT payload_json, expires_at_ms, stale_until_ms
       FROM guesty_response_cache WHERE cache_key = ?`,
    ).bind(cacheKey).first<ResponseRow>();
    return responseFromRow(row);
  } catch (error) {
    console.error("Guesty response cache read failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return undefined;
  }
}

export async function acquireGuestyResponseRefreshLease(
  cacheKey: string,
  now = Date.now(),
): Promise<string | null | undefined> {
  const db = database();
  if (!db) return undefined;

  const owner = crypto.randomUUID();
  try {
    const result = await db.prepare(`
      INSERT INTO guesty_response_cache (
        cache_key, payload_json, expires_at_ms, stale_until_ms,
        refresh_lock_until_ms, refresh_lock_owner, updated_at
      ) VALUES (?, NULL, 0, 0, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(cache_key) DO UPDATE SET
        refresh_lock_until_ms = excluded.refresh_lock_until_ms,
        refresh_lock_owner = excluded.refresh_lock_owner,
        updated_at = CURRENT_TIMESTAMP
      WHERE guesty_response_cache.expires_at_ms <= ?
        AND guesty_response_cache.refresh_lock_until_ms <= ?
    `).bind(cacheKey, now + REFRESH_LEASE_MS, owner, now, now).run();
    return (result.meta.changes ?? 0) > 0 ? owner : null;
  } catch (error) {
    console.error("Guesty response cache refresh lease failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return undefined;
  }
}

export async function writeSharedGuestyResponse(
  cacheKey: string,
  response: SharedGuestyResponse,
  leaseOwner: string,
): Promise<void> {
  const db = database();
  if (!db) return;

  try {
    await db.prepare(`
      UPDATE guesty_response_cache
      SET payload_json = ?, expires_at_ms = ?, stale_until_ms = ?,
          refresh_lock_until_ms = 0, refresh_lock_owner = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE cache_key = ? AND refresh_lock_owner = ?
    `).bind(
      JSON.stringify(response.payload),
      response.expiresAt,
      response.staleUntil,
      cacheKey,
      leaseOwner,
    ).run();
  } catch (error) {
    console.error("Guesty response cache write failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function releaseGuestyResponseRefreshLease(
  cacheKey: string,
  leaseOwner: string,
  retryAt = 0,
): Promise<void> {
  const db = database();
  if (!db) return;

  try {
    await db.prepare(`
      UPDATE guesty_response_cache
      SET refresh_lock_until_ms = ?, refresh_lock_owner = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE cache_key = ? AND refresh_lock_owner = ?
    `).bind(retryAt, cacheKey, leaseOwner).run();
  } catch (error) {
    console.error("Guesty response cache refresh lease release failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function waitForSharedGuestyResponse(
  cacheKey: string,
): Promise<SharedGuestyResponse | undefined> {
  for (let attempt = 0; attempt < CACHE_WAIT_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, CACHE_WAIT_MS));
    const response = await readSharedGuestyResponse(cacheKey);
    if (response && response.expiresAt > Date.now()) return response;
  }
  return undefined;
}
