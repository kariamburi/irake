// app/policy/page.tsx
import type { Metadata } from "next";
import PolicyClientPage from "./PolicyClientPage";

export const metadata: Metadata = {
  title: "Privacy Policy | ekarihub",
  description:
    "Read the ekarihub Privacy Policy to understand how personal data is collected, used, shared, stored, and protected.",
  keywords: [
    "ekarihub privacy policy",
    "ekarihub data protection",
    "ekarihub privacy",
    "privacy policy agribusiness platform",
    "Kenya data protection policy",
  ],
  alternates: {
    canonical: "/policy",
  },
  openGraph: {
    title: "Privacy Policy | ekarihub",
    description:
      "Read the ekarihub Privacy Policy and learn how personal data is collected, used, stored, and protected.",
    url: "https://ekarihub.com/policy",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ekarihub privacy policy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | ekarihub",
    description:
      "Read the ekarihub Privacy Policy and learn how personal data is collected, used, stored, and protected.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PolicyPage() {
  return <PolicyClientPage />;
}