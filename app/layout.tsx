import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteDescription =
  "Florida condo stays with an uncommon advantage: when available, we pair two separate condos in the same complex for families and friends.";

export const viewport: Viewport = {
  themeColor: "#052F46",
};

export const metadata: Metadata = {
  title: {
    default: "Vacation Rental Expertz Florida",
    template: "%s | Vacation Rental Expertz Florida",
  },
  description: siteDescription,
  openGraph: {
    type: "website",
    title: "Vacation Rental Expertz Florida",
    description: siteDescription,
    images: [{
      url: "/og.png",
      width: 1200,
      height: 630,
      alt: "Vacation Rental Expertz Florida — Florida condo stays, done right.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vacation Rental Expertz Florida",
    description: siteDescription,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
