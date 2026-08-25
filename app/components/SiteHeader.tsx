/* Vinext currently stalls client-side route transitions here, so these links intentionally reload. */
/* eslint-disable @next/next/no-html-link-for-pages */
export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Vacation Rental Expertz Florida home">
        {/* The vinext client runtime does not reliably hydrate next/image in shared server components. */}
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
      </a>
      <nav aria-label="Primary navigation">
        <a href="/listings">Florida condos</a>
        <a href="/#destinations">Destinations</a>
        <a href="/#together">Group stays</a>
        <a href="/#partners">Owners &amp; managers</a>
      </nav>
      <a className="header-cta" href="/listings">Find a condo</a>
    </header>
  );
}
