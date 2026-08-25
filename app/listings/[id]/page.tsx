import type { Metadata } from "next";
/* Vinext currently stalls client-side route transitions here, so these links intentionally reload. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { notFound } from "next/navigation";
import { cache } from "react";
import { SiteFooter } from "../../components/SiteFooter";
import { SiteHeader } from "../../components/SiteHeader";
import {
  bookingEngineUrl,
  getListing,
  GuestyRequestError,
  isGuestyConfigured,
  type GuestyListing,
} from "../../../lib/guesty";

const loadListing = cache(getListing);

function imageUrl(listing: GuestyListing, index = 0): string | undefined {
  const picture = listing.pictures[index];
  return picture?.regular ?? picture?.original ?? picture?.thumbnail;
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

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const configured = isGuestyConfigured();
  if (!configured) {
    return (
      <main>
        <SiteHeader />
        <section className="detail-status"><p className="eyebrow dark">Almost ready</p><h1>Our Florida condo collection is being connected.</h1><p>Live condo pages will appear here as soon as the secure Guesty connection is complete.</p><a href="/listings">Back to Florida condos</a></section>
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
          <section className="detail-status"><p className="eyebrow dark">Please try again</p><h1>This condo couldn&apos;t be loaded.</h1><p>Live condo details are temporarily unavailable.</p><a href="/listings">View all Florida condos</a></section>
          <SiteFooter />
        </main>
      );
    }
    throw error;
  }
  if (!listing) notFound();

  const location = [listing.city, listing.state].filter(Boolean).join(", ") || "Florida";
  const bookingUrl = bookingEngineUrl();
  const gallery = listing.pictures.slice(0, 5);

  return (
    <main>
      <SiteHeader />
      <section className="detail-heading">
        <a href="/listings" className="back-link">← All Florida condos</a>
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
          const src = picture.regular ?? picture.original ?? picture.thumbnail;
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
          <span className="status-kicker">Secure direct booking</span>
          <h2>Make this stay yours.</h2>
          <p>Check live rates and availability, then complete your reservation securely through Guesty.</p>
          <div className="paired-stay-note">
            <strong>Bringing another household?</strong>
            <p>When availability allows, we try to pair this stay with a second, separately listed condo in the same complex.</p>
          </div>
          {bookingUrl ? (
            <a href={bookingUrl} target="_blank" rel="noreferrer">Check availability</a>
          ) : (
            <span className="booking-pending">Online booking is being connected</span>
          )}
          <small>You&apos;ll review the full price before booking.</small>
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}
