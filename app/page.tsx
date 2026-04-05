// app/page.tsx
import type { Metadata } from "next";
import HomeFeedClientPage from "./deeds/HomeFeedClientPage";


export const metadata: Metadata = {
  title: "ekarihub | Deeds, agribusiness community, market and opportunities",
  description:
    "Discover public deeds, agribusiness stories, community updates, market opportunities, events, and discussions on ekarihub.",
  keywords: [
    "ekarihub",
    "deeds",
    "agribusiness community",
    "farmers network",
    "agriculture marketplace",
    "agribusiness Kenya",
    "farm discussions",
    "agribusiness opportunities",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "ekarihub | Deeds, agribusiness community, market and opportunities",
    description:
      "Discover public deeds, agribusiness stories, community updates, market opportunities, events, and discussions on ekarihub.",
    url: "https://ekarihub.com",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ekarihub deeds feed",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ekarihub | Deeds, agribusiness community, market and opportunities",
    description:
      "Discover public deeds, agribusiness stories, community updates, market opportunities, events, and discussions on ekarihub.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootPage() {
  return <HomeFeedClientPage />;
}