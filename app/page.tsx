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
    "Discover Florida condo stays, including same-complex pairing for families and friends when two nearby condos are available.",
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
          <p className="eyebrow">Stay together. Keep your own front door.</p>
          <h1>Florida condo stays,<br />done right.</h1>
          <p className="hero-copy">
            We specialize in condos—and when availability lines up, we try to pair
            two stays in the same complex so families can vacation together without sharing one roof.
          </p>

          <StaySearchForm />
        </div>

        <div className="hero-proof" aria-label="Booking benefits">
          <span><strong>Paired stays</strong> when available</span>
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

      <section className="together-section" id="together">
        <div className="together-copy">
          <p className="eyebrow dark">Our signature group-stay approach</p>
          <h2>Vacation together. Sleep under separate roofs.</h2>
          <p>
            When two condos are available in the same complex, we try to pair them
            for the same trip. Families and friends stay close for beach days,
            dinners, and memories—then each household returns to its own private space.
          </p>
          <p className="availability-note">
            Condo pairings depend on dates, inventory, and each listing&apos;s availability.
          </p>
          <Link href="/listings">Explore condo stays <span aria-hidden="true">→</span></Link>
        </div>
        <div className="together-pair" aria-label="Two private condos paired within one complex">
          <p>One shared trip</p>
          <div className="paired-units">
            <article><span>Private condo</span><h3>Your space</h3><p>Your own bedrooms, living area, and front door.</p></article>
            <span className="pair-connector" aria-hidden="true">+</span>
            <article><span>Private condo</span><h3>Their space</h3><p>Close enough to gather, separate enough to recharge.</p></article>
          </div>
          <strong>Same complex · When available</strong>
        </div>
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
          <article><span>01</span><h3>A new angle for group trips</h3><p>We look for two available condos in one complex so families can be together without giving up privacy.</p></article>
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
            <p>We help position your condo, strengthen its booking presence, and—when nearby inventory aligns—pair it with another listing for group demand.</p>
          </article>
          <article>
            <span>For local property managers</span>
            <h3>Add booking reach without replacing local expertise.</h3>
            <p>We can support visibility and reservations, including same-complex pairing opportunities, while your team leads local operations and guest care.</p>
          </article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
