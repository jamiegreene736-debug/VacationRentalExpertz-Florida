import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../components/SiteFooter";
import { SiteHeader } from "../components/SiteHeader";
import {
  RESERVATIONS_EMAIL,
  RESERVATIONS_EMAIL_HREF,
  RESERVATIONS_PHONE_DISPLAY,
  RESERVATIONS_PHONE_HREF,
} from "../../lib/contact";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Vacation Rental Expertz Florida for reservation help, condo availability, paired stays, and owner or property-manager partnerships.",
};

export default function ContactPage() {
  return (
    <main>
      <SiteHeader />
      <section className="contact-hero">
        <p className="eyebrow">Contact Vacation Rental Expertz Florida</p>
        <h1>Let&apos;s plan your Florida stay.</h1>
        <p>
          Reach our reservations team for booking help, condo availability,
          same-complex paired stays, or questions about working with us.
        </p>
      </section>

      <section className="contact-content">
        <div className="contact-intro">
          <p className="eyebrow dark">Reservations &amp; support</p>
          <h2>Talk with a real person.</h2>
          <p>
            We&apos;re happy to help you choose a condo, understand rates and
            availability, or explore two separate condos in the same complex.
          </p>
        </div>
        <div className="contact-methods">
          <a className="contact-card" href={RESERVATIONS_PHONE_HREF}>
            <span>Call our team</span>
            <strong>{RESERVATIONS_PHONE_DISPLAY}</strong>
            <small>Tap to call reservations</small>
          </a>
          <a className="contact-card" href={RESERVATIONS_EMAIL_HREF}>
            <span>Email reservations</span>
            <strong>{RESERVATIONS_EMAIL}</strong>
            <small>Tell us your dates, guest count, and preferred condo</small>
          </a>
        </div>
        <aside className="contact-partner-note">
          <div>
            <span>Owners &amp; property managers</span>
            <strong>Interested in working together?</strong>
          </div>
          <p>
            Call or email us to discuss listing visibility, reservation support,
            and same-complex pairing opportunities.
          </p>
          <Link href="/#partners">Learn about partnerships <span aria-hidden="true">→</span></Link>
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}
