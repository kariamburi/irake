// app/deeds/page.tsx
import type { Metadata } from "next";
import HomeFeedClientPage from "../HomeFeedClientPage";

export const metadata: Metadata = {
  title: "Deeds | ekarihub",
  description:
    "Browse public deeds on ekarihub including agribusiness stories, community updates, farming insights, opportunities, and shared experiences.",
  keywords: [
    "ekarihub deeds",
    "public deeds",
    "agribusiness stories",
    "farming updates",
    "agriculture community",
    "farm insights",
    "Kenya agriculture platform",
  ],
  alternates: {
    canonical: "/deeds",
  },
  openGraph: {
    title: "Deeds | ekarihub",
    description:
      "Browse public deeds on ekarihub including agribusiness stories, community updates, farming insights, opportunities, and shared experiences.",
    url: "https://ekarihub.com/deeds",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ekarihub deeds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deeds | ekarihub",
    description:
      "Browse public deeds on ekarihub including agribusiness stories, community updates, farming insights, opportunities, and shared experiences.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DeedsPage() {
  return <HomeFeedClientPage />;
}