import type { Metadata } from "next";
import { ListingCard } from "../components/ListingCard";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import { StaySearchForm } from "../components/StaySearch";
import {
  getListings,
  GuestyRequestError,
  isGuestyConfigured,
  type GuestyListing,
} from "../../lib/guesty";
import { parseStaySearch } from "../../lib/stay-search";

export const metadata: Metadata = {
  title: "Florida Condos",
  description:
    "Browse Florida condos and look for two available stays in the same complex for your family or group trip.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  const { search, error: inputError } = parseStaySearch(await searchParams);
  let listings: GuestyListing[] = [];
  let serviceError: string | undefined;
  const configured = isGuestyConfigured();

  if (!inputError && configured) {
    try {
      listings = await getListings(search);
    } catch (error) {
      serviceError = error instanceof GuestyRequestError
        ? "We couldn’t refresh live availability just now. Please try again shortly."
        : "Something went wrong while loading these condos.";
    }
  }

  const searchSummary = search.checkIn && search.checkOut
    ? `${search.checkIn} to ${search.checkOut} · ${search.guests} guest${search.guests === 1 ? "" : "s"}`
    : `${search.guests} guest${search.guests === 1 ? "" : "s"}`;

  return (
    <main>
      <SiteHeader />
      <section className="listings-hero">
        <p className="eyebrow">Your Florida condo collection</p>
        <h1>Find one condo—or two close together.</h1>
        <p>Search our condo-only Florida collection. When availability aligns, we try to pair two separate stays in the same complex.</p>
        <StaySearchForm search={search} />
      </section>

      <section className="listings-results" aria-live="polite">
        <aside className="pairing-note">
          <span>Traveling with another household?</span>
          <p>Look for condos that fit your dates, and ask about pairing two independently listed units in the same complex. Pairings are subject to availability.</p>
        </aside>
        <div className="results-heading">
          <div>
            <p className="eyebrow dark">Available condos</p>
            <h2>{search.city ? `${search.city} condos` : "Florida condos"}</h2>
            {!inputError && configured && !serviceError && (
              <p>{listings.length} condo{listings.length === 1 ? "" : "s"} · {searchSummary}</p>
            )}
          </div>
        </div>

        {inputError && <div className="status-card status-error"><h3>Let&apos;s fix those dates</h3><p>{inputError}</p></div>}
        {!configured && (
          <div className="status-card">
            <span className="status-kicker">Collection coming online</span>
            <h3>Our Florida condos are being connected.</h3>
            <p>We&apos;re preparing live availability and secure direct booking. Please check back soon.</p>
          </div>
        )}
        {serviceError && <div className="status-card status-error"><h3>We&apos;ll be right back</h3><p>{serviceError}</p></div>}
        {!inputError && configured && !serviceError && listings.length === 0 && (
          <div className="status-card"><h3>No exact matches yet</h3><p>Try different dates, a nearby destination, or fewer guests.</p></div>
        )}
        {listings.length > 0 && (
          <div className="listing-grid">
            {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
