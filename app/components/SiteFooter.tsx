import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div>
        <Image
          className="footer-mark"
          src="/logo-mark.png"
          alt=""
          width={78}
          height={78}
        />
        <h2>Ready for a little more sunshine?</h2>
        <Link className="footer-cta" href="/listings">Explore Florida stays</Link>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Vacation Rental Expertz Florida</span>
        <span>Secure booking powered by Guesty</span>
      </div>
    </footer>
  );
}
