import Link from "next/link";
import type { GuestyListing } from "../../lib/guesty";
import type { StaySearch } from "../../lib/stay-search";
import { listingStayQuery } from "../../lib/stay-search";

function priceLabel(listing: GuestyListing): string | undefined {
  if (!listing.nightlyPrice) return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: listing.currency ?? "USD",
    maximumFractionDigits: 0,
  }).format(listing.nightlyPrice);
}

export function ListingCard({ listing, search }: { listing: GuestyListing; search?: StaySearch }) {
  const image = listing.pictures[0];
  const imageUrl = image?.regular ?? image?.large ?? image?.original ?? image?.thumbnail;
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  const price = priceLabel(listing);
  const detailHref = search
    ? `/listings/${listing.id}?${listingStayQuery(search)}`
    : `/listings/${listing.id}`;

  return (
    <article className="listing-card">
      <Link className="listing-image" href={detailHref}>
        {imageUrl ? (
          // Guesty controls the image hosts, so a fixed Next.js remote-host allowlist is not viable.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={image?.caption || `${listing.title} Florida condo`} />
        ) : (
          <span className="image-placeholder">Your Florida condo awaits</span>
        )}
      </Link>
      <div className="listing-card-body">
        <p className="listing-location">{location || "Florida"}</p>
        <h3><Link href={detailHref}>{listing.title}</Link></h3>
        <p className="listing-facts">
          {listing.accommodates ? `Sleeps ${listing.accommodates}` : "Private condo"}
          {listing.bedrooms ? ` · ${listing.bedrooms} bedrooms` : ""}
          {listing.bathrooms ? ` · ${listing.bathrooms} baths` : ""}
        </p>
        <div className="listing-card-footer">
          <span>{price ? <><strong>{price}</strong> / night</> : "View availability"}</span>
          <Link href={detailHref}>View condo <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </article>
  );
}
