import Link from "next/link";
import type { GuestyListing } from "../../lib/guesty";

function priceLabel(listing: GuestyListing): string | undefined {
  if (!listing.nightlyPrice) return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: listing.currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(listing.nightlyPrice);
}

export function ListingCard({ listing }: { listing: GuestyListing }) {
  const image = listing.pictures[0];
  const imageUrl = image?.regular ?? image?.original ?? image?.thumbnail;
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  const price = priceLabel(listing);

  return (
    <article className="listing-card">
      <Link className="listing-image" href={`/listings/${listing.id}`}>
        {imageUrl ? (
          // Guesty controls the image hosts, so a fixed Next.js remote-host allowlist is not viable.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={image?.caption || `${listing.title} vacation rental`} />
        ) : (
          <span className="image-placeholder">Florida awaits</span>
        )}
      </Link>
      <div className="listing-card-body">
        <p className="listing-location">{location || "Florida"}</p>
        <h3><Link href={`/listings/${listing.id}`}>{listing.title}</Link></h3>
        <p className="listing-facts">
          {listing.accommodates ? `Sleeps ${listing.accommodates}` : "Private stay"}
          {listing.bedrooms ? ` · ${listing.bedrooms} bedrooms` : ""}
          {listing.bathrooms ? ` · ${listing.bathrooms} baths` : ""}
        </p>
        <div className="listing-card-footer">
          <span>{price ? <><strong>{price}</strong> / night</> : "View availability"}</span>
          <Link href={`/listings/${listing.id}`}>View home <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}
