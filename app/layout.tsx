import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://tablo.click"),
  title: {
    default: "tablo — Free Online Collaborative Whiteboard",
    template: "%s"
  },
  description:
    "tablo is a free real-time collaborative whiteboard. No sign-up, no installs — open a board, share the link, and sketch together instantly.",
  verification: {
    google: "DstN039RYoMVpNDGZMgh8NLGkWJpnq7BcpLEU25dSuo"
  },
  openGraph: {
    siteName: "tablo",
    type: "website",
    locale: "en_US"
  },
  twitter: {
    card: "summary_large_image",
    site: "@tablo"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
