import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div>
        {/* The vinext client runtime does not reliably hydrate next/image in shared server components. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="footer-mark"
          src="/logo-mark.png"
          alt=""
          width={78}
          height={78}
        />
        <h2>Have a Florida condo? Let&apos;s grow together.</h2>
        <Link className="footer-cta" href="/#partners">Explore partnership options</Link>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Vacation Rental Expertz Florida</span>
        <span>Condo booking partnerships across Florida</span>
      </div>
    </footer>
  );
}
