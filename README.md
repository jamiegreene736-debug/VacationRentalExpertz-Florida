# Vacation Rental Expertz Florida

A public, responsive Florida condo website connected securely to Guesty. It includes:

- a condo-only Florida marketing homepage;
- same-complex condo pairing for group trips, clearly presented as availability-dependent;
- owner-direct and local property-manager partnership positioning;
- live, searchable Guesty condo listings and availability;
- shareable condo detail pages using Guesty photos and descriptions;
- a secure handoff to the Florida Guesty Booking Engine;
- honest empty, configuration, and temporary-error states.

## Local setup

This project requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add the Florida-only Guesty values to `.env.local`. Never commit credentials.

| Variable | Purpose |
| --- | --- |
| `GUESTY_CLIENT_ID` | Guesty Open API application client ID |
| `GUESTY_CLIENT_SECRET` | Guesty Open API application secret |
| `GUESTY_BOOKING_ENGINE_URL` | HTTPS URL for the Florida Guesty Booking Engine |
| `GUESTY_LISTING_TAG` | Optional Guesty tag used to restrict the public collection |
| `GUESTY_CONDO_TAG` | Exact Guesty tag accepted as condo evidence; defaults to `condo` |
| `SITE_URL` | Canonical production origin |

The public inventory is intentionally fail-closed: a listing appears only when
its Guesty `propertyType` contains `condo` or it carries the exact
`GUESTY_CONDO_TAG`. Non-condo listings also return a not-found page when opened
directly by ID.

Create the API application in Guesty under **Integrations → API & Webhooks**. Guesty limits each API key to five token generations per day, so this application caches and reuses tokens until shortly before expiration. See [Guesty authentication](https://open-api-docs.guesty.com/reference/authentication-2) and [Guesty listing search](https://open-api-docs.guesty.com/docs/searching-for-available-listings-and-all-listings).

The booking button uses Guesty's Booking Engine rather than collecting payment details in this application. See [Guesty direct booking options](https://help.guesty.com/hc/en-gb/articles/9362217514141-Understanding-Guesty-s-direct-booking-solutions).

## Verification

```bash
npm run lint
npm test
```

The site is built with vinext for a Cloudflare Worker-compatible deployment.
