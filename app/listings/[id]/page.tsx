import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import {
  bookingEngineUrlForStay,
  getListing,
  getListingStayQuote,
  GuestyRequestError,
  isGuestyConfigured,
  type GuestyListing,
  type GuestyStayResult,
} from "../../../lib/guesty";
import {
  listingStayQuery,
  parseListingStaySearch,
  todayIsoDate,
} from "../../../lib/stay-search";

export const dynamic = "force-dynamic";

const loadListing = cache(getListing);

function imageUrl(listing: GuestyListing, index = 0): string | undefined {
  const picture = listing.pictures[index];
  return picture?.regular ?? picture?.large ?? picture?.original ?? picture?.thumbnail;
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  if (!isGuestyConfigured()) return { title: "Florida Condo" };
  const { id } = await params;
  try {
    const listing = await loadListing(id);
    if (!listing) return { title: "Condo not found" };
    const description = listing.description?.slice(0, 155)
      ?? `Explore ${listing.title}, a professionally managed Florida condo.`;
    const primaryImage = imageUrl(listing);
    return {
      title: listing.title,
      description,
      openGraph: {
        title: listing.title,
        description,
        images: primaryImage ? [{ url: primaryImage, alt: listing.title }] : [],
      },
      twitter: {
        card: primaryImage ? "summary_large_image" : "summary",
        title: listing.title,
        description,
        images: primaryImage ? [primaryImage] : [],
      },
    };
  } catch {
    return { title: "Florida Condo" };
  }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const configured = isGuestyConfigured();
  if (!configured) {
    return (
      <main>
        <SiteHeader />
        <section className="detail-status"><p className="eyebrow dark">Almost ready</p><h1>Our Florida condo collection is being connected.</h1><p>Live condo pages will appear here as soon as the secure Guesty connection is complete.</p><Link href="/listings">Back to Florida condos</Link></section>
        <SiteFooter />
      </main>
    );
  }

  const { id } = await params;
  let listing: GuestyListing | undefined;
  try {
    listing = await loadListing(id);
  } catch (error) {
    if (error instanceof GuestyRequestError) {
      return (
        <main>
          <SiteHeader />
          <section className="detail-status"><p className="eyebrow dark">Please try again</p><h1>This condo couldn&apos;t be loaded.</h1><p>Live condo details are temporarily unavailable.</p><Link href="/listings">View all Florida condos</Link></section>
          <SiteFooter />
        </main>
      );
    }
    throw error;
  }
  if (!listing) notFound();

  const location = [listing.city, listing.state].filter(Boolean).join(", ") || "Florida";
  const { search, error: searchError } = parseListingStaySearch(await searchParams);
  let stayResult: GuestyStayResult | undefined;
  let quoteError: string | undefined;
  if (!searchError && search.checkIn && search.checkOut) {
    if (listing.accommodates && search.guests > listing.accommodates) {
      quoteError = `This condo sleeps up to ${listing.accommodates} guests. Choose a smaller party to check availability.`;
    } else {
      try {
        stayResult = await getListingStayQuote({
          listingId: listing.id,
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          guests: search.guests,
        });
      } catch (error) {
        quoteError = error instanceof GuestyRequestError
          ? "Live rates couldn’t be refreshed just now. Please try those dates again shortly."
          : "Something went wrong while checking this stay.";
      }
    }
  }
  const bookingUrl = stayResult?.available
    ? bookingEngineUrlForStay(listing.id, search)
    : undefined;
  const resultsQuery = listingStayQuery(search);
  const gallery = listing.pictures.slice(0, 5);
  const maxGuests = Math.min(30, Math.max(1, listing.accommodates ?? 12));
  const basePrice = listing.nightlyPrice && listing.nightlyPrice > 0
    ? money(listing.nightlyPrice, listing.currency ?? "USD")
    : undefined;

  return (
    <main>
      <SiteHeader />
      <section className="detail-heading">
        <Link href={`/listings?${resultsQuery}`} className="back-link">← All Florida condos</Link>
        <p className="eyebrow dark">{location}</p>
        <h1>{listing.title}</h1>
        <p className="detail-facts">
          {listing.propertyType || "Condo"}
          {listing.accommodates ? ` · Sleeps ${listing.accommodates}` : ""}
          {listing.bedrooms ? ` · ${listing.bedrooms} bedrooms` : ""}
          {listing.bathrooms ? ` · ${listing.bathrooms} baths` : ""}
        </p>
      </section>

      <section className={`detail-gallery gallery-${Math.min(gallery.length, 5)}`} aria-label={`${listing.title} photos`}>
        {gallery.length > 0 ? gallery.map((picture, index) => {
          const src = picture.regular ?? picture.large ?? picture.original ?? picture.thumbnail;
          return src ? (
            // Guesty controls the image hosts, so a fixed Next.js remote-host allowlist is not viable.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${src}-${index}`} src={src} alt={picture.caption || `${listing.title} photo ${index + 1}`} />
          ) : null;
        }) : <div className="detail-image-placeholder">Photos coming soon</div>}
      </section>

      <section className="detail-layout">
        <div className="detail-content">
          <p className="eyebrow dark">Your stay</p>
          <h2>A welcoming Florida condo</h2>
          <p className="detail-description">{listing.description || "Settle into a professionally managed condo prepared for an easy, memorable Florida stay."}</p>

          {listing.amenities.length > 0 && (
            <div className="amenities">
              <h2>What this condo offers</h2>
              <ul>{listing.amenities.slice(0, 16).map((amenity) => <li key={amenity}>{amenity}</li>)}</ul>
            </div>
          )}
        </div>
        <aside className="booking-card">
          <span className="status-kicker">Live Guesty rates</span>
          <h2>Check your stay.</h2>
          {basePrice && !stayResult?.available && (
            <p className="starting-rate">From <strong>{basePrice}</strong> per night before fees and taxes.</p>
          )}
          <form className="listing-stay-form" action={`/listings/${listing.id}`} method="get">
            <label>
              <span>Check in</span>
              <input
                type="date"
                name="checkIn"
                min={todayIsoDate()}
                defaultValue={search.checkIn}
                required
              />
            </label>
            <label>
              <span>Check out</span>
              <input
                type="date"
                name="checkOut"
                min={search.checkIn ?? todayIsoDate()}
                defaultValue={search.checkOut}
                required
              />
            </label>
            <label className="guest-field">
              <span>Guests</span>
              <select name="guests" defaultValue={String(search.guests)}>
                {Array.from({ length: maxGuests }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count} guest{count === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Check rates &amp; availability</button>
          </form>

          {(searchError || quoteError) && (
            <div className="stay-message stay-message-error" role="alert">
              <strong>We couldn&apos;t check that stay.</strong>
              <p>{searchError ?? quoteError}</p>
            </div>
          )}

          {stayResult && !stayResult.available && (
            <div className="stay-message stay-message-unavailable" role="status">
              <strong>Those dates aren&apos;t bookable.</strong>
              <p>
                {stayResult.reason === "dates"
                  ? "This condo is unavailable for part of that stay. Try nearby dates."
                  : "The stay doesn’t meet this condo’s current minimum-night or arrival rules. Try different dates."}
              </p>
            </div>
          )}

          {stayResult?.available && (
            <div className="stay-quote" aria-live="polite">
              <div className="availability-confirmation">
                <span aria-hidden="true">✓</span>
                <div>
                  <strong>Available for your dates</strong>
                  <small>{dateLabel(stayResult.checkIn)} – {dateLabel(stayResult.checkOut)} · {stayResult.nights} night{stayResult.nights === 1 ? "" : "s"}</small>
                </div>
              </div>
              <dl className="rate-breakdown">
                <div>
                  <dt>{money(stayResult.averageNightlyRate, stayResult.currency)} × {stayResult.nights} nights</dt>
                  <dd>{money(stayResult.accommodationTotal, stayResult.currency)}</dd>
                </div>
                <div><dt>Fees</dt><dd>{money(stayResult.fees, stayResult.currency)}</dd></div>
                <div><dt>Taxes</dt><dd>{money(stayResult.taxes, stayResult.currency)}</dd></div>
                <div className="quote-total"><dt>Stay total</dt><dd>{money(stayResult.total, stayResult.currency)}</dd></div>
              </dl>
              <p className="quote-note">Live Guesty quote for {stayResult.guests} guest{stayResult.guests === 1 ? "" : "s"}. Final terms are shown before booking.</p>
              {bookingUrl ? (
                <a className="booking-action" href={bookingUrl} target="_blank" rel="noreferrer">Continue to secure booking</a>
              ) : (
                <span className="booking-pending">Secure checkout is being connected</span>
              )}
            </div>
          )}

          {!search.checkIn && !searchError && (
            <p className="booking-prompt">Choose dates to see the exact nightly rate, fees, taxes, and total.</p>
          )}
          <div className="paired-stay-note">
            <strong>Bringing another household?</strong>
            <p>When availability allows, we try to pair this stay with a second, separately listed condo in the same complex.</p>
          </div>
          <small>Rates and availability come directly from Guesty and can change until booked.</small>
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}
