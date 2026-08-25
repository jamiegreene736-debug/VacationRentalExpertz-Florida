/* Vinext currently stalls client-side route transitions here, so this link intentionally reloads. */
/* eslint-disable @next/next/no-html-link-for-pages */
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
        <h2>Together for the trip. Separate for the night.</h2>
        <a className="footer-cta" href="/listings">Find Florida condos</a>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Vacation Rental Expertz Florida</span>
        <span>Ask about two condos in the same complex</span>
      </div>
    </footer>
  );
}
