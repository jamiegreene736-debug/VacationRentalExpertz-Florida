import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  const requestHeaders = await headers();
  const rawHost = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const host = rawHost && /^[a-z0-9.-]+(?::\d+)?$/i.test(rawHost) ? rawHost : undefined;
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : host?.startsWith("localhost")
      ? "http"
      : "https";
  const origin = (host ? `${protocol}://${host}` : undefined)
    ?? validOrigin(process.env.SITE_URL)
    ?? "http://localhost:3000";
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
