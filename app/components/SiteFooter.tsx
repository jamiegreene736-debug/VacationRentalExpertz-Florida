import Link from "next/link";

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
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Vacation Rental Expertz Florida</span>
        <span>Ask about two condos in the same complex</span>
      </div>
    </footer>
  );
}
