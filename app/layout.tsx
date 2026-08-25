import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteDescription =
  "Florida condo stays with an uncommon advantage: when available, we pair two separate condos in the same complex for families and friends.";

export const viewport: Viewport = {
  themeColor: "#052F46",
};

function validOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost"
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = validOrigin(process.env.SITE_URL) ?? "http://localhost:3000";
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
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
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "Vacation Rental Expertz Florida — Florida condo stays, done right.",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Vacation Rental Expertz Florida",
      description: siteDescription,
      images: [socialImage],
    },
  };
}

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
