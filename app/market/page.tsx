import type { Metadata } from "next";
import MarketClientPage from "./MarketClientPage";

const baseUrl = "https://ekarihub.com";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "ekariMarket | Buy, Sell & Lease on ekarihub",
  description:
    "Browse products, services, equipment, rentals and lease listings on ekariMarket by ekarihub.",
  alternates: {
    canonical: `${baseUrl}/market`,
  },
  openGraph: {
    title: "ekariMarket | Buy, Sell & Lease on ekarihub",
    description:
      "Browse products, services, equipment, rentals and lease listings on ekariMarket by ekarihub.",
    url: `${baseUrl}/market`,
    siteName: "ekarihub",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ekariMarket | Buy, Sell & Lease on ekarihub",
    description:
      "Browse products, services, equipment, rentals and lease listings on ekariMarket by ekarihub.",
  },
};

function buildMarketJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ekariMarket",
    description:
      "Browse products, services, equipment, rentals and lease listings on ekariMarket by ekarihub.",
    url: `${baseUrl}/market`,
    isPartOf: {
      "@type": "WebSite",
      name: "ekarihub",
      url: baseUrl,
    },
  };
}

export default function MarketPage() {
  const jsonLd = buildMarketJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketClientPage />
    </>
  );
}