import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("ships the Florida brand and homepage image assets", async () => {
  const [assets, styles] = await Promise.all([
    Promise.all([
      stat(new URL("../public/logo-mark.png", import.meta.url)),
      stat(new URL("../app/icon.png", import.meta.url)),
      stat(new URL("../app/apple-icon.png", import.meta.url)),
      stat(new URL("../app/favicon.ico", import.meta.url)),
      stat(new URL("../public/condo-high-rise-hero.jpg", import.meta.url)),
      stat(new URL("../public/nsb-atlantic-beach.jpg", import.meta.url)),
      stat(new URL("../public/nsb-oceanfront-condos.jpg", import.meta.url)),
      stat(new URL("../public/nsb-pair-stays.jpg", import.meta.url)),
      stat(new URL("../public/tile-seascape.jpg", import.meta.url)),
      stat(new URL("../public/tile-oceanwalk.jpg", import.meta.url)),
    ]),
    source("../app/globals.css"),
  ]);
  for (const asset of assets) assert.ok(asset.size > 1_000);
  assert.match(styles, /background-image: url\("\/condo-high-rise-hero\.jpg"\)/);
});

test("keeps the homepage condo positioning and search", async () => {
  const [page, search] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/components/StaySearch.tsx"),
  ]);
  assert.match(page, /Florida condo stays/);
  assert.match(page, /Vacation together\. Sleep under separate roofs/);
  assert.match(page, /Same complex · When available/);
  assert.match(page, /For condo owners/);
  assert.match(page, /For local property managers/);
  assert.match(search, /Search condos/);
  assert.match(search, /New Smyrna Beach/);
  assert.match(page, /New Smyrna Beach condos/);
  assert.match(page, /destination-photo/);
  assert.match(page, /tile-seascape\.jpg|nsb-pair-stays\.jpg/);
  assert.doesNotMatch(page, /destination-orlando|Orlando resort condos|Florida Keys condos/);
  assert.doesNotMatch(page, /Vacation homes|See all homes|View home/);
});

test("documents but never commits Guesty secret values", async () => {
  const [example, gitignore] = await Promise.all([
    source("../.env.example"),
    source("../.gitignore"),
  ]);
  assert.match(example, /^GUESTY_CLIENT_ID=$/m);
  assert.match(example, /^GUESTY_CLIENT_SECRET=$/m);
  assert.match(example, /^GUESTY_CONDO_TAG=$/m);
  assert.match(example, /^GUESTY_CACHE_DIR=$/m);
  assert.doesNotMatch(example, /GUESTY_CLIENT_SECRET=.+/);
  assert.doesNotMatch(example, /GUESTY_BOOTSTRAP/);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});

test("loads public inventory from the Guesty Booking Engine API", async () => {
  const [sourceText, cache] = await Promise.all([
    source("../lib/guesty.ts"),
    source("../lib/guesty-cache.ts"),
  ]);
  assert.match(sourceText, /booking\.guesty\.com\/oauth2\/token/);
  assert.match(sourceText, /booking\.guesty\.com\/api/);
  assert.match(sourceText, /scope: "booking_engine:api"/);
  assert.match(sourceText, /matchesOptionalFilters/);
  assert.match(sourceText, /GUESTY_CONDO_TAG/);
  assert.match(sourceText, /tokenInFlight/);
  assert.match(sourceText, /readStoredToken|writeStoredToken/);
  assert.match(sourceText, /readStoredListings/);
  assert.match(cache, /\/data/);
  assert.match(cache, /guesty-token\.json/);
  assert.doesNotMatch(sourceText, /open-api\.guesty\.com/);
  assert.doesNotMatch(sourceText, /scope: "open-api"/);
  assert.doesNotMatch(sourceText, /active: "true"/);
  assert.doesNotMatch(sourceText, /listed: "true"/);
  assert.doesNotMatch(sourceText, /pmsActive/);
  assert.doesNotMatch(sourceText, /readSharedGuestyToken|__VACATION_RENTAL_EXPERTZ_DB__/);
});

test("fetches Guesty listings at request time and reuses the cached token", async () => {
  const [home, listings, detail] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/listings/page.tsx"),
    source("../app/listings/[id]/page.tsx"),
  ]);
  assert.match(home, /export const dynamic = "force-dynamic"/);
  assert.match(listings, /export const dynamic = "force-dynamic"/);
  assert.match(detail, /export const dynamic = "force-dynamic"/);
  assert.match(detail, /Check rates &amp; availability/);
  assert.match(detail, /Available for your dates/);
  assert.match(detail, /Continue to secure booking/);
  assert.match(listings, /search=\{search\}/);
});

test("uses Guesty's current reservation quote flow for rates and availability", async () => {
  const guesty = await source("../lib/guesty.ts");
  assert.match(guesty, /guestyFetch\("\/reservations\/quotes"/);
  assert.match(guesty, /checkInDateLocalized/);
  assert.match(guesty, /checkOutDateLocalized/);
  assert.match(guesty, /guestsCount/);
  assert.match(guesty, /bookingEngineUrlForStay/);
  assert.doesNotMatch(guesty, /\/api\/reservations\/money/);
});

test("uses a standard Next.js app with no ChatGPT Sites architecture", async () => {
  const [pkg, hostingGone, workerGone, layout] = await Promise.all([
    JSON.parse(await source("../package.json")),
    readdir(new URL("../.openai", import.meta.url)).then(() => false).catch(() => true),
    readdir(new URL("../worker", import.meta.url)).then(() => false).catch(() => true),
    source("../app/layout.tsx"),
  ]);
  assert.equal(pkg.dependencies.next, "16.2.6");
  assert.equal(pkg.scripts.dev, "next dev");
  assert.ok(!pkg.dependencies.vinext);
  assert.ok(!pkg.devDependencies?.vinext);
  assert.ok(!pkg.devDependencies?.wrangler);
  assert.ok(!pkg.devDependencies?.["@openai/sites-vite-plugin"]);
  assert.ok(hostingGone);
  assert.ok(workerGone);
  assert.doesNotMatch(layout, /next\/font|next\/headers|vinext|wrangler/);
});
