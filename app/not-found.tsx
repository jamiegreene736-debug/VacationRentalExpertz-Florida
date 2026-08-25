/* Vinext currently stalls client-side route transitions here, so this link intentionally reloads. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";

export default function NotFound() {
  return (
    <main>
      <SiteHeader />
      <section className="detail-status">
        <p className="eyebrow dark">404</p>
        <h1>That stay has checked out.</h1>
        <p>The page may have moved, but your next Florida condo is still waiting.</p>
        <a href="/listings">Explore Florida condos</a>
      </section>
      <SiteFooter />
    </main>
  );
}
