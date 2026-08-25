import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
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
        <Link href="/#destinations">Destinations</Link>
        <Link href="/#together">Group stays</Link>
        <Link href="/#partners">Owners &amp; managers</Link>
      </nav>
      <Link className="header-cta" href="/listings">Find a condo</Link>
    </header>
  );
}
