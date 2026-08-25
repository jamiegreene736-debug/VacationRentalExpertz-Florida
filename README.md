# Vacation Rental Expertz Florida

A public Florida condo website connected to Guesty. It includes:

- a condo-only Florida marketing homepage;
- same-complex condo pairing for group trips, clearly presented as availability-dependent;
- owner-direct and local property-manager partnership positioning;
- live, searchable Guesty condo listings and availability;
- shareable condo detail pages using Guesty photos and descriptions;
- live Guesty quotes and no-payment booking requests placed directly into Guesty;
- honest empty, configuration, and temporary-error states.

This is a standard Next.js app. It does not use ChatGPT Sites, vinext, or Cloudflare Workers.

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
| `GUESTY_CLIENT_ID` | Guesty Booking Engine API client ID |
| `GUESTY_CLIENT_SECRET` | Guesty Booking Engine API client secret |
| `GUESTY_LISTING_TAG` | Optional Guesty tag used to restrict the public collection |
| `GUESTY_CONDO_TAG` | Optional extra filter; when set, `propertyType` must contain `condo` or the listing must carry this exact tag |
| `GUESTY_CACHE_DIR` | Optional directory that stores the reused Booking Engine token and last listing snapshot |
| `SITE_URL` | Canonical production origin |

Public inventory comes from the Guesty Booking Engine API. Only listings
assigned to that Booking Engine instance appear. Leave `GUESTY_CONDO_TAG`
empty unless you want an extra condo-only filter.

Create the API key in Guesty under **Growth → Distribution → Booking Engine API**.
See [Booking Engine authentication](https://booking-api-docs.guesty.com/docs/authentication-1)
and [search capabilities](https://booking-api-docs.guesty.com/docs/search-capabilities).
Open API keys cannot authenticate this website.

Property pages create a live Guesty reservation quote for the selected dates and
guest count. They show availability, the average nightly rate, fees, taxes, and
the total, then let the guest send a **booking request without payment**.
Successful requests are created directly in Guesty with a 24-hour review hold.
They are not confirmed reservations, and this application never requests or
stores card details.

In Guesty, set this Booking Engine API instance to **Only inquiries** or
**Both**, and activate both the Manual and Booking Engine API sources before
launch. Guesty documents this flow in its
[Reservation Quote Flow](https://booking-api-docs.guesty.com/docs/new-reservation-creation-flow).

## Deploy

Build and run a normal Node server:

```bash
npm run build
npm start
```

Host it on any Next.js-compatible platform (Vercel, Railway, or a Node host). Set the same Guesty environment variables in that host's settings.

The contact form sends through authenticated SMTP. For the production IONOS
mailbox, set `SMTP_PASSWORD`; the app defaults to `smtp.ionos.com` on port 465
and the reservations address. The remaining `SMTP_*` and `CONTACT_EMAIL_TO`
variables in `.env.example` can override those defaults for another provider.

Guesty Booking Engine tokens last 24 hours and can only be minted a few times per day. This app reuses one token, caches listings for five minutes, and writes both to disk (`/data` when a volume is mounted, otherwise `/tmp`) so deploys do not request a new token or blank the catalog.

## Verification

```bash
npm run lint
npm test
```
