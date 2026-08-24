import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  assert.match(html, /Your Florida stay/);
  assert.match(html, /Vacation Rental Expertz/);
  assert.match(html, /Search stays/);
  assert.match(html, /Find the Florida that feels like yours/);
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /SkeletonPreview|react-loading-skeleton|Starter Project/);
});

test("shows an honest setup state before Guesty credentials are configured", async () => {
  delete process.env.GUESTY_CLIENT_ID;
  delete process.env.GUESTY_CLIENT_SECRET;

  const response = await render("/listings?destination=Orlando&guests=4");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Our Florida homes are being connected/);
  assert.match(html, /Orlando stays/);
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
  assert.doesNotMatch(example, /GUESTY_CLIENT_SECRET=.+/);
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});
