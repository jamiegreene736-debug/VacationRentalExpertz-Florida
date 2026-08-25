import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function render(path = "/") {
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
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
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
  assert.match(example, /^GUESTY_CONDO_TAG=condo$/m);
  assert.doesNotMatch(example, /GUESTY_CLIENT_SECRET=.+/);
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
