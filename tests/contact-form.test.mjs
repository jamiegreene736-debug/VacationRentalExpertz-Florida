import assert from "node:assert/strict";
import test from "node:test";
import {
  contactInquiryText,
  validateContactForm,
} from "../lib/contact-form.ts";

const now = Date.UTC(2026, 7, 25, 16, 0, 0);

function validInput(overrides = {}) {
  return {
    name: "Jamie Greene",
    email: "Jamie@Example.com",
    phone: "239 399 5563",
    topic: "availability",
    property: "Oceanwalk",
    checkIn: "2026-09-10",
    checkOut: "2026-09-15",
    guests: "4",
    message: "Please help me check rates for these dates.",
    website: "",
    startedAt: String(now - 10_000),
    ...overrides,
  };
}

test("normalizes and accepts a complete contact inquiry", () => {
  const result = validateContactForm(validInput(), now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.isSpam, false);
  assert.equal(result.inquiry.email, "jamie@example.com");
  assert.equal(result.inquiry.guests, 4);
  assert.match(contactInquiryText(result.inquiry), /Oceanwalk/);
  assert.match(contactInquiryText(result.inquiry), /2026-09-10 to 2026-09-15/);
});

test("rejects invalid fields and an inverted stay", () => {
  const result = validateContactForm(
    validInput({
      name: "J",
      email: "not-an-email",
      topic: "toString",
      checkOut: "2026-09-09",
      guests: "31",
      message: "Too short",
    }),
    now,
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.name);
  assert.ok(result.errors.email);
  assert.ok(result.errors.topic);
  assert.ok(result.errors.checkOut);
  assert.ok(result.errors.guests);
  assert.ok(result.errors.message);
});

test("requires both dates when either stay date is supplied", () => {
  const result = validateContactForm(validInput({ checkOut: "" }), now);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.checkIn);
  assert.ok(result.errors.checkOut);
});

test("silently flags honeypot and implausibly fast submissions as spam", () => {
  const honeypot = validateContactForm(validInput({ website: "spam.example" }), now);
  const tooFast = validateContactForm(validInput({ startedAt: String(now - 100) }), now);
  assert.equal(honeypot.ok && honeypot.isSpam, true);
  assert.equal(tooFast.ok && tooFast.isSpam, true);
});
