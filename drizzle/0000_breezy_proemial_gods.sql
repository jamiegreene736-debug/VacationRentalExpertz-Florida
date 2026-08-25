CREATE TABLE `guesty_token_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`access_token` text,
	`expires_at_ms` integer DEFAULT 0 NOT NULL,
	`refresh_lock_until_ms` integer DEFAULT 0 NOT NULL,
	`refresh_lock_owner` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
