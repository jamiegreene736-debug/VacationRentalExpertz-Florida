import Link from "next/link";
import {
  RESERVATIONS_EMAIL,
  RESERVATIONS_EMAIL_HREF,
  RESERVATIONS_PHONE_DISPLAY,
  RESERVATIONS_PHONE_HREF,
} from "../../lib/contact";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="footer-mark"
          src="/logo-mark.png"
          alt=""
          width={78}
          height={78}
        />
        <h2>Together for the trip. Separate for the night.</h2>
        <Link className="footer-cta" href="/listings">Find Florida condos</Link>
      </div>
      <div className="footer-contact" aria-label="Reservations contact information">
        <div>
          <span>Reservations &amp; stay support</span>
          <strong>We&apos;re here to help.</strong>
        </div>
        <a href={RESERVATIONS_PHONE_HREF}>{RESERVATIONS_PHONE_DISPLAY}</a>
        <a href={RESERVATIONS_EMAIL_HREF}>{RESERVATIONS_EMAIL}</a>
        <Link href="/contact">Contact us <span aria-hidden="true">→</span></Link>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Vacation Rental Expertz Florida</span>
        <span>Ask about two condos in the same complex</span>
      </div>
    </footer>
  );
}
