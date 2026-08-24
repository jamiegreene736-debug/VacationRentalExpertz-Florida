import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { StaySearchForm } from "./components/StaySearch";
import { ListingCard } from "./components/ListingCard";
import { getListings, isGuestyConfigured, type GuestyListing } from "../lib/guesty";

export const metadata: Metadata = {
  title: "Find Your Florida Stay",
  description:
    "Discover professionally managed Florida vacation rentals, from Orlando escapes to Gulf Coast retreats.",
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
          <p className="eyebrow">Sunshine is closer than you think</p>
          <h1>Your Florida stay,<br />made memorable.</h1>
          <p className="hero-copy">
            Beautiful homes, local expertise, and a booking experience that keeps
            your vacation refreshingly simple.
          </p>

          <StaySearchForm />
        </div>

        <div className="hero-proof" aria-label="Booking benefits">
          <span><strong>Local care</strong> when you need it</span>
          <span><strong>Guest-ready</strong> homes</span>
          <span><strong>Secure</strong> direct booking</span>
        </div>
      </section>

      <section className="intro" id="destinations">
        <p className="eyebrow dark">The best of the Sunshine State</p>
        <h2>Find the Florida that feels like yours.</h2>
        <p>
          From theme-park mornings to sunset walks on the Gulf, we connect you
          with the right home base for every kind of escape.
        </p>
      </section>

      <section className="destination-grid" aria-label="Florida destinations">
        <Link className="destination destination-orlando" href="/listings?destination=Orlando&guests=2">
          <span>Central Florida</span><strong>Orlando &amp; Disney</strong>
        </Link>
        <Link className="destination destination-gulf" href="/listings?destination=Naples&guests=2">
          <span>Southwest Florida</span><strong>Naples &amp; the Gulf</strong>
        </Link>
        <Link className="destination destination-keys" href="/listings?destination=Key+West&guests=2">
          <span>Island time</span><strong>The Florida Keys</strong>
        </Link>
        <Link className="destination destination-atlantic" href="/listings?destination=Miami&guests=2">
          <span>Atlantic energy</span><strong>Miami &amp; the Coast</strong>
        </Link>
      </section>

      {featuredListings.length > 0 && (
        <section className="featured-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow dark">Guest favorites</p>
              <h2>Featured Florida stays</h2>
            </div>
            <Link href="/listings">See all homes <span aria-hidden="true">→</span></Link>
          </div>
          <div className="listing-grid">
            {featuredListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        </section>
      )}

      <section className="why-section" id="why-us">
        <div className="why-copy">
          <p className="eyebrow dark">A better way to stay</p>
          <h2>Relax. We&apos;ve thought of the details.</h2>
          <p>
            Every home is selected and prepared with real vacations in mind—so
            you can spend less time sorting out logistics and more time making memories.
          </p>
          <Link href="/listings">Find your stay</Link>
        </div>
        <div className="promise-grid">
          <article><span>01</span><h3>Professionally managed</h3><p>Clean, cared-for homes with reliable standards from arrival to checkout.</p></article>
          <article><span>02</span><h3>Book with confidence</h3><p>Live availability and secure direct booking stay connected to Guesty.</p></article>
          <article><span>03</span><h3>Here when you need us</h3><p>Practical local support helps keep your Florida time easy.</p></article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
