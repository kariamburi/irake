// app/dive/page.tsx
import type { Metadata } from "next";
import DiveClientPage from "./DiveClientPage";

export const metadata: Metadata = {
  title: "Dive | ekarihub",
  description:
    "Discover personalised profiles, events, and discussions on ekarihub based on your activity and interests.",
  keywords: [
    "ekarihub dive",
    "personalised suggestions",
    "agribusiness discussions",
    "agribusiness events",
    "recommended profiles",
    "ekarihub community",
    "African agriculture network",
  ],
  alternates: {
    canonical: "/dive",
  },
  openGraph: {
    title: "Dive | ekarihub",
    description:
      "Discover personalised profiles, events, and discussions on ekarihub.",
    url: "https://ekarihub.com/dive",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "dive on ekarihub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dive | ekarihub",
    description:
      "Discover personalised profiles, events, and discussions on ekarihub.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function DivePage() {
  return <DiveClientPage />;
}