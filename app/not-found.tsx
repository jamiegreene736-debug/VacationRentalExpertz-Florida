import Link from "next/link";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";

export default function NotFound() {
  return (
    <main>
      <SiteHeader />
      <section className="detail-status">
        <p className="eyebrow dark">404</p>
        <h1>That stay has checked out.</h1>
        <p>The page may have moved, but your next Florida escape is still waiting.</p>
        <Link href="/listings">Explore vacation homes</Link>
      </section>
      <SiteFooter />
    </main>
  );
}
