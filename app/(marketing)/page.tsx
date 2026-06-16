import type { Metadata } from "next";
import HomepageClient from "../../components/landing/HomepageClient";

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "tablo",
  url: "https://tablo.click",
  description:
    "Free real-time collaborative whiteboard. No sign-up, no installs — open a board, share the link, and sketch together instantly.",
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD"
  },
  featureList: [
    "Real-time collaboration",
    "No sign-up required",
    "Freehand drawing",
    "Shapes and sticky notes",
    "Built-in video calls",
    "Presenter mode",
    "Export to PDF",
    "Auto-save"
  ]
};

export const metadata: Metadata = {
  title: "tablo — Free Online Collaborative Whiteboard",
  description:
    "tablo is a free real-time collaborative whiteboard. No sign-up, no installs — open a board, share the link, and sketch together instantly.",
  alternates: {
    canonical: "https://tablo.click"
  },
  openGraph: {
    title: "tablo — Draw together, instantly.",
    description:
      "Free collaborative whiteboard. No sign-up, no setup — open a board, share the link, and sketch with anyone in real time.",
    url: "https://tablo.click",
    siteName: "tablo",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "tablo — Draw together, instantly.",
    description:
      "Free collaborative whiteboard. No sign-up, no setup — open a board, share the link, and sketch with anyone in real time."
  }
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
      />
      <HomepageClient />
    </>
  );
}
