// app/about/page.tsx
import type { Metadata } from "next";
import AboutClientPage from "./AboutClientPage";

export const metadata: Metadata = {
  title: "About ekarihub",
  description:
    "Learn about ekarihub, a digital agribusiness hub connecting farmers, agronomists, suppliers, buyers, exporters, and stakeholders through community, trade, learning, and innovation.",
  keywords: [
    "ekarihub",
    "about ekarihub",
    "agribusiness platform",
    "agriculture marketplace",
    "farmers network",
    "agribusiness community",
    "agriculture technology Kenya",
    "farm marketplace",
    "agribusiness ecosystem",
  ],
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About ekarihub",
    description:
      "Discover ekarihub’s mission, vision, and how it connects the agribusiness ecosystem through technology, data, AI, and community.",
    url: "https://ekarihub.com/about",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "about ekarihub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About ekarihub",
    description:
      "Discover ekarihub’s mission, vision, and how it connects the agribusiness ecosystem.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AboutPage() {
  return <AboutClientPage />;
}