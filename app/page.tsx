import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { StaySearchForm } from "./components/StaySearch";
import { ListingCard } from "./components/ListingCard";
import { getListings, isGuestyConfigured, type GuestyListing } from "../lib/guesty";

export const metadata: Metadata = {
  title: "Florida Condo Stays",
  description:
    "Discover Florida condo stays backed by direct owner relationships and booking expertise for local property managers.",
};

export default async function Home() {
  let featuredListings: GuestyListing[] = [];
  if (isGuestyConfigured()) {
    try {
      featuredListings = (await getListings({ guests: 2 })).slice(0, 3);
    } catch (error) {
      console.error("Featured listings could not be loaded", {
        reason: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return (
    <main>
      <SiteHeader />

      <section className="hero" id="top">
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow">Condo specialists across the Sunshine State</p>
          <h1>Florida condo stays,<br />done right.</h1>
          <p className="hero-copy">
            Condo-only stays, direct owner relationships, and booking expertise
            that helps guests find the right Florida getaway.
          </p>

          <StaySearchForm />
        </div>

        <div className="hero-proof" aria-label="Booking benefits">
          <span><strong>Condo specialists</strong> across Florida</span>
          <span><strong>Owner-direct</strong> partnerships</span>
          <span><strong>Booking support</strong> for local managers</span>
        </div>
      </section>

      <section className="intro" id="destinations">
        <p className="eyebrow dark">Condo stays across the Sunshine State</p>
        <h2>Find your place in Florida.</h2>
        <p>
          From theme-park mornings to sunset walks on the Gulf, our condo-only
          collection gives every trip a comfortable home base.
        </p>
      </section>

      <section className="destination-grid" aria-label="Florida destinations">
        <Link className="destination destination-orlando" href="/listings?destination=Orlando&guests=2">
          <span>Central Florida</span><strong>Orlando resort condos</strong>
        </Link>
        <Link className="destination destination-gulf" href="/listings?destination=Naples&guests=2">
          <span>Southwest Florida</span><strong>Naples &amp; Gulf condos</strong>
        </Link>
        <Link className="destination destination-keys" href="/listings?destination=Key+West&guests=2">
          <span>Island time</span><strong>Florida Keys condos</strong>
        </Link>
        <Link className="destination destination-atlantic" href="/listings?destination=Miami&guests=2">
          <span>Atlantic energy</span><strong>Miami &amp; Atlantic condos</strong>
        </Link>
      </section>

      {featuredListings.length > 0 && (
        <section className="featured-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">Guest favorites</p>
              <h2>Featured Florida condos</h2>
            </div>
            <Link href="/listings">See all condos <span aria-hidden="true">→</span></Link>
          </div>
          <div className="listing-grid">
            {featuredListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        </section>
      )}

      <section className="why-section" id="why-us">
        <div className="why-copy">
          <p className="eyebrow dark">Focused now. Built to grow.</p>
          <h2>Small team. Big Florida ambition.</h2>
          <p>
            We&apos;re a small company today, building carefully around condos,
            strong partnerships, and better booking experiences as we expand rapidly across Florida.
          </p>
          <Link href="#partners">Partner with us</Link>
        </div>
        <div className="promise-grid">
          <article><span>01</span><h3>Condo-only focus</h3><p>A clear specialty helps guests search with confidence and keeps our collection consistent.</p></article>
          <article><span>02</span><h3>Owners first</h3><p>We work directly with condo owners and treat every property relationship with care.</p></article>
          <article><span>03</span><h3>Local manager support</h3><p>We can help local property managers generate bookings while they keep leading local operations.</p></article>
        </div>
      </section>

      <section className="partners-section" id="partners">
        <div className="partners-intro">
          <p className="eyebrow">Grow with Vacation Rental Expertz</p>
          <h2>One Florida condo at a time.</h2>
          <p>
            We&apos;re small today and expanding rapidly. That means every new relationship
            matters—and every condo gets the focused attention of a growing specialist team.
          </p>
        </div>
        <div className="partner-grid">
          <article>
            <span>For condo owners</span>
            <h3>Work directly with a team invested in your success.</h3>
            <p>We help position your condo, strengthen its booking presence, and grow demand while keeping the owner relationship personal.</p>
          </article>
          <article>
            <span>For local property managers</span>
            <h3>Add booking reach without replacing local expertise.</h3>
            <p>We can support visibility and reservations while your team remains at the center of local property operations and guest care.</p>
          </article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
