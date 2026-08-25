import assert from "node:assert/strict";
import test from "node:test";

import {
  issueInquiryGrant,
  parseBookingInquiryGuest,
  verifyInquiryGrant,
} from "../lib/booking-inquiry.ts";

process.env.GUESTY_CLIENT_SECRET = "test-only-signing-secret";

const quote = {
  listingId: "66afac773445df0013074d3b",
  quoteId: "66afac773445df0013074d99",
  ratePlanId: "standard-rate",
  checkIn: "2026-11-10",
  checkOut: "2026-11-15",
  guests: 4,
};

test("requires valid guest details and the no-payment acknowledgement", () => {
  const guest = {
    firstName: "Jamie",
    lastName: "Traveler",
    email: "JAMIE@example.com",
    phone: "+1 302 555 0123",
    acceptedTerms: true,
  };
  assert.deepEqual(parseBookingInquiryGuest(guest), {
    guest: {
      firstName: "Jamie",
      lastName: "Traveler",
      email: "jamie@example.com",
      phone: "+1 302 555 0123",
    },
  });
  assert.match(parseBookingInquiryGuest({ ...guest, acceptedTerms: false }).error, /not a confirmed reservation/);
  assert.match(parseBookingInquiryGuest({ ...guest, email: "bad" }).error, /valid email/);
});

test("signs the Guesty quote identity and rejects tampering or expiry", () => {
  const now = Date.now();
  const token = issueInquiryGrant({
    ...quote,
    expiresAt: new Date(now + 60_000).toISOString(),
  });
  const valid = verifyInquiryGrant(token, now);
  assert.equal(valid.grant?.quoteId, quote.quoteId);
  assert.equal(valid.grant?.ratePlanId, quote.ratePlanId);

  const [payload, signature] = token.split(".");
  const replacement = payload.endsWith("A") ? "B" : "A";
  const tampered = `${payload.slice(0, -1)}${replacement}.${signature}`;
  assert.match(verifyInquiryGrant(tampered, now).error, /invalid/);
  assert.match(verifyInquiryGrant(token, now + 61_000).error, /expired/);
});
