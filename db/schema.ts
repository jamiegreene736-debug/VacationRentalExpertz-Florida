import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guestyTokenCache = sqliteTable("guesty_token_cache", {
  cacheKey: text("cache_key").primaryKey(),
  accessToken: text("access_token"),
  expiresAtMs: integer("expires_at_ms").notNull().default(0),
  refreshLockUntilMs: integer("refresh_lock_until_ms").notNull().default(0),
  refreshLockOwner: text("refresh_lock_owner"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
