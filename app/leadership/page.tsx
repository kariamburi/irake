// app/leadership/page.tsx
import type { Metadata } from "next";
import LeadershipClientPage from "./LeadershipClientPage";

export const metadata: Metadata = {
  title: "Leadership | ekarihub",
  description:
    "Meet the leadership team behind ekarihub and learn how they are shaping the future of agribusiness through technology, data, AI, and community.",
  keywords: [
    "ekarihub leadership",
    "ekarihub executives",
    "agribusiness leadership",
    "African agriculture innovation",
    "agritech leadership",
    "ekarihub team",
  ],
  alternates: {
    canonical: "/leadership",
  },
  openGraph: {
    title: "Leadership | ekarihub",
    description:
      "Meet the leadership team behind ekarihub and learn how they are shaping the future of agribusiness.",
    url: "https://ekarihub.com/leadership",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/ceo.jpg",
        width: 1200,
        height: 630,
        alt: "ekarihub leadership",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leadership | ekarihub",
    description:
      "Meet the leadership team behind ekarihub and learn how they are shaping the future of agribusiness.",
    images: ["/ceo.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LeadershipPage() {
  return <LeadershipClientPage />;
}