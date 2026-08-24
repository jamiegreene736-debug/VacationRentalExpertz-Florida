import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Vacation Rental Expertz Florida home">
        <Image
          className="brand-mark"
          src="/logo-mark.png"
          alt=""
          width={58}
          height={58}
          priority
        />
        <span className="brand-copy">
          <strong>Vacation Rental Expertz</strong>
          <small>Florida</small>
        </span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/listings">Vacation homes</Link>
        <Link href="/#destinations">Destinations</Link>
        <Link href="/#why-us">Why book with us</Link>
      </nav>
      <Link className="header-cta" href="/listings">Find a stay</Link>
    </header>
  );
}
