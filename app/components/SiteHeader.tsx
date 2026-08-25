import Link from "next/link";
import {
  RESERVATIONS_EMAIL,
  RESERVATIONS_EMAIL_HREF,
  RESERVATIONS_PHONE_DISPLAY,
  RESERVATIONS_PHONE_HREF,
} from "../../lib/contact";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-contact-bar" aria-label="Reservations contact information">
        <Link href="/contact">Contact us</Link>
        <a href={RESERVATIONS_PHONE_HREF}>{RESERVATIONS_PHONE_DISPLAY}</a>
        <a href={RESERVATIONS_EMAIL_HREF}>{RESERVATIONS_EMAIL}</a>
      </div>
      <div className="header-main">
        <Link className="brand" href="/" aria-label="Vacation Rental Expertz Florida home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-mark"
            src="/logo-mark.png"
            alt=""
            width={58}
            height={58}
          />
          <span className="brand-copy">
            <strong>Vacation Rental Expertz</strong>
            <small>Florida</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/listings">Florida condos</Link>
          <Link href="/#destinations">Our condos</Link>
          <Link href="/#together">Group stays</Link>
          <Link href="/#partners">Owners &amp; managers</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <Link className="header-cta" href="/listings">Find a condo</Link>
      </div>
    </header>
  );
}
