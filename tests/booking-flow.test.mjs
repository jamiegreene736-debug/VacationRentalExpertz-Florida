import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingEngineUrlForStay,
  normalizeStayQuote,
} from "../lib/guesty-quote.ts";
import {
  listingStayQuery,
  parseListingStaySearch,
  todayIsoDate,
} from "../lib/stay-search.ts";

test("normalizes the cheapest available Guesty rate plan with a complete total", () => {
  const quote = normalizeStayQuote({
    _id: "6b0000000000000000000001",
    expiresAt: "2027-01-01T00:00:00.000Z",
    rates: {
      ratePlans: [
        {
          days: [
            { date: "2027-02-10", currency: "USD", price: 240 },
            { date: "2027-02-11", currency: "USD", price: 240 },
            { date: "2027-02-12", currency: "USD", price: 240 },
            { date: "2027-02-13", currency: "USD", price: 240 },
          ],
          notApplicable: null,
          ratePlan: { _id: "standard-rate", name: "Standard", active: true },
          money: {
            rateId: "standard-rate",
            money: {
              currency: "USD",
              fareAccommodationAdjusted: 960,
              totalFees: 200,
              totalTaxes: 90,
              subTotalPrice: 1160,
            },
          },
        },
        {
          days: [],
          notApplicable: null,
          ratePlan: { _id: "premium-rate", name: "Flexible", active: true },
          money: {
            money: {
              currency: "USD",
              fareAccommodationAdjusted: 1100,
              totalFees: 200,
              totalTaxes: 100,
              subTotalPrice: 1300,
            },
          },
        },
      ],
    },
  }, "2027-02-10", "2027-02-14", 4);

  assert.deepEqual(quote, {
    available: true,
    quoteId: "6b0000000000000000000001",
    ratePlanId: "standard-rate",
    ratePlanName: "Standard",
    checkIn: "2027-02-10",
    checkOut: "2027-02-14",
    guests: 4,
    nights: 4,
    currency: "USD",
    accommodationTotal: 960,
    averageNightlyRate: 240,
    fees: 200,
    taxes: 90,
    total: 1250,
    expiresAt: "2027-01-01T00:00:00.000Z",
  });
});

test("reports calendar blocks separately from minimum-stay rules", () => {
  const blocked = normalizeStayQuote({
    _id: "6b0000000000000000000002",
    rates: {
      ratePlans: [{ notApplicable: { hardBlocked: true }, ratePlan: { active: true } }],
    },
  }, "2027-02-10", "2027-02-14", 2);
  const restricted = normalizeStayQuote({
    _id: "6b0000000000000000000003",
    rates: {
      ratePlans: [{ notApplicable: { minNights: true }, ratePlan: { active: true } }],
    },
  }, "2027-02-10", "2027-02-14", 2);

  assert.deepEqual(blocked, { available: false, reason: "dates" });
  assert.deepEqual(restricted, { available: false, reason: "stay-rules" });
});

test("builds a listing-specific secure booking handoff with the selected stay", () => {
  process.env.GUESTY_BOOKING_ENGINE_URL = "https://florida-example.guestybookings.com";
  try {
    const url = bookingEngineUrlForStay("6a8dab70e072ff0083c5e5c2", {
      checkIn: "2027-02-10",
      checkOut: "2027-02-14",
      guests: 4,
    });
    assert.ok(url);
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/en/properties/6a8dab70e072ff0083c5e5c2");
    assert.equal(parsed.searchParams.get("checkIn"), "2027-02-10");
    assert.equal(parsed.searchParams.get("checkOut"), "2027-02-14");
    assert.equal(parsed.searchParams.get("minOccupancy"), "4");
  } finally {
    delete process.env.GUESTY_BOOKING_ENGINE_URL;
  }
});

test("validates property-page dates and preserves the stay in navigation", () => {
  assert.equal(todayIsoDate(new Date("2026-08-26T02:30:00Z")), "2026-08-25");
  assert.deepEqual(
    parseListingStaySearch({ checkIn: "2026-08-24", checkOut: "2026-08-27", guests: "3" }, "2026-08-25"),
    { search: { guests: 3 }, error: "Check-in must be today or later." },
  );
  assert.deepEqual(
    parseListingStaySearch({ checkIn: "2027-01-01", checkOut: "2027-07-02", guests: "3" }, "2026-08-25"),
    { search: { guests: 3 }, error: "Choose a stay of 180 nights or fewer." },
  );
  assert.equal(
    listingStayQuery({ checkIn: "2027-02-10", checkOut: "2027-02-14", guests: 4 }),
    "guests=4&checkIn=2027-02-10&checkOut=2027-02-14",
  );
});
