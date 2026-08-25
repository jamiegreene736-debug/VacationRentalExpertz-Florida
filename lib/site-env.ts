const SITE_ENV_KEYS = [
  "GUESTY_CLIENT_ID",
  "GUESTY_CLIENT_SECRET",
  "GUESTY_BOOKING_ENGINE_URL",
  "GUESTY_LISTING_TAG",
  "GUESTY_CONDO_TAG",
  "GUESTY_BOOTSTRAP_ACCESS_TOKEN",
  "GUESTY_BOOTSTRAP_EXPIRES_AT_MS",
  "SITE_URL",
] as const;

export function hydrateSiteEnv(env: object | undefined): void {
  if (!env) return;

  const bindings = env as Record<string, unknown>;
  for (const key of SITE_ENV_KEYS) {
    const value = bindings[key];
    if (typeof value === "string" && value.trim() && !process.env[key]?.trim()) {
      process.env[key] = value.trim();
    }
  }
}
