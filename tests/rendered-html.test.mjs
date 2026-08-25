import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(path = "/", env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...env,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function createGuestyCacheDb() {
  const responseRows = new Map();
  const tokenRow = {
    access_token: "cached-test-token",
    expires_at_ms: Date.now() + 60 * 60 * 1000,
  };

  return {
    responseRows,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("FROM guesty_token_cache")) return tokenRow;
              if (sql.includes("FROM guesty_response_cache")) {
                return responseRows.get(values[0]) ?? null;
              }
              throw new Error(`Unexpected test SELECT: ${sql}`);
            },
            async run() {
              if (sql.includes("INSERT INTO guesty_response_cache")) {
                const [cacheKey, lockUntil, lockOwner, now] = values;
                const row = responseRows.get(cacheKey);
                if (row && (row.expires_at_ms > now || row.refresh_lock_until_ms > now)) {
                  return { meta: { changes: 0 } };
                }
                responseRows.set(cacheKey, {
                  payload_json: row?.payload_json ?? null,
                  expires_at_ms: row?.expires_at_ms ?? 0,
                  stale_until_ms: row?.stale_until_ms ?? 0,
                  refresh_lock_until_ms: lockUntil,
                  refresh_lock_owner: lockOwner,
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET payload_json = ?")) {
                const [payloadJson, expiresAt, staleUntil, cacheKey, lockOwner] = values;
                const row = responseRows.get(cacheKey);
                if (!row || row.refresh_lock_owner !== lockOwner) {
                  return { meta: { changes: 0 } };
                }
                responseRows.set(cacheKey, {
                  ...row,
                  payload_json: payloadJson,
                  expires_at_ms: expiresAt,
                  stale_until_ms: staleUntil,
                  refresh_lock_until_ms: 0,
                  refresh_lock_owner: null,
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET refresh_lock_until_ms = ?")) {
                const [retryAt, cacheKey, lockOwner] = values;
                const row = responseRows.get(cacheKey);
                if (row?.refresh_lock_owner === lockOwner) {
                  responseRows.set(cacheKey, {
                    ...row,
                    refresh_lock_until_ms: retryAt,
                    refresh_lock_owner: null,
                  });
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              throw new Error(`Unexpected test write: ${sql}`);
            },
          };
        },
      };
    },
  };
}

test("server-renders the finished Florida homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Florida condo stays/);
  assert.match(html, /Vacation Rental Expertz/);
  assert.match(html, /Search condos/);
  assert.match(html, /Small team\. Big Florida ambition/);
  assert.match(html, /For condo owners/);
  assert.match(html, /For local property managers/);
  assert.match(html, /Vacation together\. Sleep under separate roofs/);
  assert.match(html, /Same complex · When available/);
  assert.match(html, /logo-mark\.png/);
  assert.doesNotMatch(html, /Vacation homes|See all homes|View home/);
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /SkeletonPreview|react-loading-skeleton|Starter Project/);
});

test("ships the Florida brand and homepage image assets", async () => {
  const [assets, styles] = await Promise.all([
    Promise.all([
      stat(new URL("../public/logo-mark.png", import.meta.url)),
      stat(new URL("../app/icon.png", import.meta.url)),
      stat(new URL("../app/apple-icon.png", import.meta.url)),
      stat(new URL("../app/favicon.ico", import.meta.url)),
      stat(new URL("../public/condo-high-rise-hero.jpg", import.meta.url)),
    ]),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const asset of assets) assert.ok(asset.size > 1_000);
  assert.match(styles, /background-image: url\("\/condo-high-rise-hero\.jpg"\)/);
});

test("shows an honest setup state before Guesty credentials are configured", async () => {
  delete process.env.GUESTY_CLIENT_ID;
  delete process.env.GUESTY_CLIENT_SECRET;

  const response = await render("/listings?destination=Orlando&guests=4");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Our Florida condos are being connected/);
  assert.match(html, /Orlando condos/);
  assert.match(html, /pairing two independently listed units in the same complex/);
  assert.doesNotMatch(html, /invalid_client|GUESTY_CLIENT_SECRET/);
});

test("rejects incomplete date searches without calling Guesty", async () => {
  const response = await render("/listings?checkIn=2026-12-20&guests=2");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Choose both check-in and check-out dates/);
});

test("documents but never commits Guesty secret values", async () => {
  const [example, gitignore] = await Promise.all([
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
  ]);
  assert.match(example, /^GUESTY_CLIENT_ID=$/m);
  assert.match(example, /^GUESTY_CLIENT_SECRET=$/m);
  assert.match(example, /^GUESTY_BOOTSTRAP_ACCESS_TOKEN=$/m);
  assert.match(example, /^GUESTY_CONDO_TAG=condo$/m);
  assert.doesNotMatch(example, /GUESTY_CLIENT_SECRET=.+/);
  assert.doesNotMatch(example, /GUESTY_BOOTSTRAP_ACCESS_TOKEN=.+/);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});

test("fails closed around the condo-only Guesty inventory contract", async () => {
  const source = await readFile(new URL("../lib/guesty.ts", import.meta.url), "utf8");
  assert.match(source, /"tags"/);
  assert.match(source, /GUESTY_CONDO_TAG/);
  assert.match(source, /propertyType\.includes\("condo"\)/);
  assert.match(source, /\.filter\(isCondoListing\)/);
  assert.match(source, /listing && isCondoListing\(listing\) \? listing : undefined/);
});

test("uses only supported Guesty listing-status filters", async () => {
  const source = await readFile(new URL("../lib/guesty.ts", import.meta.url), "utf8");
  assert.match(source, /active: "true"/);
  assert.match(source, /listed: "true"/);
  assert.doesNotMatch(source, /pmsActive/);
});

test("uses full-page navigation for condo routes", async () => {
  const [header, search, card] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/StaySearch.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ListingCard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(header, /<a className="header-cta" href="\/listings">Find a condo<\/a>/);
  assert.doesNotMatch(header, /next\/link/);
  assert.match(search, /action="\/listings" method="get"/);
  assert.doesNotMatch(card, /next\/link/);
});

test("shares Guesty tokens and listing responses across server instances", async () => {
  const [hosting, guesty, tokenCache, responseCache, schema, migration, worker] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/guesty.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/guesty-token-cache.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/guesty-response-cache.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_nosy_thunderbolt.sql", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.match(guesty, /readSharedGuestyToken/);
  assert.match(guesty, /acquireGuestyTokenRefreshLease/);
  assert.match(guesty, /deferGuestyTokenRefreshLease/);
  assert.match(guesty, /TOKEN_RATE_LIMIT_BACKOFF_MS/);
  assert.match(guesty, /invalidateSharedGuestyToken/);
  assert.match(tokenCache, /ON CONFLICT\(cache_key\) DO UPDATE/);
  assert.match(responseCache, /guesty_response_cache/);
  assert.match(responseCache, /refresh_lock_until_ms/);
  assert.match(guesty, /Serving cached Guesty response after refresh failure/);
  assert.match(guesty, /COLLECTION_CACHE_TTL_MS/);
  assert.match(schema, /guestyResponseCache/);
  assert.match(migration, /CREATE TABLE `guesty_response_cache`/);
  assert.match(worker, /hydrateSiteEnv/);
  assert.match(worker, /if \(!env\.IMAGES\)/);
});

test("serves the last successful condo response when Guesty rate-limits a refresh", async () => {
  process.env.GUESTY_CLIENT_ID = "test-client";
  process.env.GUESTY_CLIENT_SECRET = "test-secret";
  const database = createGuestyCacheDb();
  const originalFetch = globalThis.fetch;
  let guestyCalls = 0;

  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (!url.startsWith("https://open-api.guesty.com/v1/listings?")) {
        throw new Error(`Unexpected test request: ${url}`);
      }
      guestyCalls += 1;
      if (guestyCalls > 1) return new Response("rate limited", { status: 429 });
      return Response.json({
        results: [{
          _id: "6a8dab70e072ff0083c5e5c2",
          title: "Cached Oceanwalk Condo",
          propertyType: "Condominium",
          accommodates: 6,
          pictures: [],
          amenities: [],
          tags: [],
        }],
      });
    };

    const initialResponse = await render("/listings?guests=2", { DB: database });
    assert.equal(initialResponse.status, 200);
    assert.match(await initialResponse.text(), /Cached Oceanwalk Condo/);

    const [cacheKey, cachedRow] = database.responseRows.entries().next().value;
    database.responseRows.set(cacheKey, {
      ...cachedRow,
      expires_at_ms: 0,
      stale_until_ms: Date.now() + 60 * 1000,
    });

    const fallbackResponse = await render("/listings?guests=2", { DB: database });
    assert.equal(fallbackResponse.status, 200);
    const fallbackHtml = await fallbackResponse.text();
    assert.match(fallbackHtml, /Cached Oceanwalk Condo/);
    assert.doesNotMatch(fallbackHtml, /We(?:'|&#x27;|&apos;)ll be right back/);
    assert.equal(guestyCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GUESTY_CLIENT_ID;
    delete process.env.GUESTY_CLIENT_SECRET;
  }
});

test("keeps the root layout free of vinext-unsafe Next font and header APIs", async () => {
  const source = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /next\/font/);
  assert.doesNotMatch(source, /next\/headers/);
  assert.doesNotMatch(source, /next\/image/);
});

test("hydrates Guesty secrets from the worker environment", async () => {
  delete process.env.GUESTY_CLIENT_ID;
  delete process.env.GUESTY_CLIENT_SECRET;
  const originalFetch = globalThis.fetch;
  let listingCalls = 0;

  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url === "https://open-api.guesty.com/oauth2/token") {
        return Response.json({ access_token: "worker-env-token", expires_in: 3600 });
      }
      if (url.startsWith("https://open-api.guesty.com/v1/listings?")) {
        listingCalls += 1;
        return Response.json({
          results: [{
            _id: "6a8dab70e072ff0083c5e5c3",
            title: "Worker Env Gulf Condo",
            propertyType: "Condominium",
            accommodates: 4,
            pictures: [],
            amenities: [],
            tags: [],
          }],
        });
      }
      throw new Error(`Unexpected test request: ${url}`);
    };

    const response = await render("/listings?guests=2", {
      GUESTY_CLIENT_ID: "worker-client",
      GUESTY_CLIENT_SECRET: "worker-secret",
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Worker Env Gulf Condo/);
    assert.equal(listingCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.GUESTY_CLIENT_ID;
    delete process.env.GUESTY_CLIENT_SECRET;
  }
});
