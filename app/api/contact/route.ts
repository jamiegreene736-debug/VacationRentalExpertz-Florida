import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { validateContactForm } from "../../../lib/contact-form";
import { deliverContactInquiry } from "../../../lib/contact-mailer";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 25_000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const RATE_LIMIT_MAX = 5;

type RateLimitEntry = { count: number; resetAt: number };

const globalForContact = globalThis as typeof globalThis & {
  contactRateLimits?: Map<string, RateLimitEntry>;
};
const rateLimits = globalForContact.contactRateLimits ?? new Map<string, RateLimitEntry>();
globalForContact.contactRateLimits = rateLimits;

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function isAllowedBrowserOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const allowedOrigins = new Set<string>([new URL(request.url).origin]);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost) allowedOrigins.add(`${forwardedProtocol}://${forwardedHost}`);

  if (process.env.SITE_URL) {
    try {
      allowedOrigins.add(new URL(process.env.SITE_URL).origin);
    } catch {
      // An invalid optional SITE_URL must not make the public endpoint permissive.
    }
  }

  return allowedOrigins.has(origin);
}

function isRateLimited(key: string, now: number): boolean {
  if (rateLimits.size > 1_000) {
    for (const [entryKey, entry] of rateLimits) {
      if (entry.resetAt <= now) rateLimits.delete(entryKey);
    }
  }

  const current = rateLimits.get(key);
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  if (!isAllowedBrowserOrigin(request)) {
    return NextResponse.json({ message: "This submission is not allowed." }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ message: "This submission format is not supported." }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { message: "That message is too large to submit." },
      { status: 413 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { message: "We could not read that submission. Please try again." },
      { status: 400 },
    );
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { message: "That message is too large to submit." },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { message: "We could not read that submission. Please try again." },
      { status: 400 },
    );
  }

  const validation = validateContactForm(body);
  if (!validation.ok) {
    return NextResponse.json(
      { message: "Please review the highlighted fields.", errors: validation.errors },
      { status: 400 },
    );
  }

  // Bots receive the same response as real visitors so the trap is not disclosed.
  if (validation.isSpam) {
    return NextResponse.json({ ok: true, requestId });
  }

  if (isRateLimited(clientAddress(request), Date.now())) {
    return NextResponse.json(
      { message: "Too many messages were sent. Please wait a few minutes or call us." },
      { status: 429 },
    );
  }

  try {
    await deliverContactInquiry(validation.inquiry);
    return NextResponse.json({ ok: true, requestId });
  } catch (error) {
    const deliveryError = error as { name?: string; code?: string };
    console.error("[contact-form] delivery failed", {
      requestId,
      errorName: deliveryError.name || "Error",
      errorCode: deliveryError.code || "unknown",
    });
    return NextResponse.json(
      {
        message:
          "We could not send your message right now. Your form is still here—please try again or call us.",
      },
      { status: 503 },
    );
  }
}
