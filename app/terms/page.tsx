// app/terms/page.tsx
import type { Metadata } from "next";
import TermsClientPage from "./TermsClientPage";

export const metadata: Metadata = {
  title: "Terms and Conditions | ekarihub",
  description:
    "Read the ekarihub Terms and Conditions for using the platform, trading on the hub, account responsibilities, privacy, liability, and dispute resolution.",
  keywords: [
    "ekarihub terms",
    "ekarihub terms and conditions",
    "ekarihub legal",
    "ekarihub trading terms",
    "agribusiness platform terms",
    "marketplace terms Kenya",
  ],
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms and Conditions | ekarihub",
    description:
      "Read the ekarihub Terms and Conditions for using the platform, trading on the hub, and account responsibilities.",
    url: "https://ekarihub.com/terms",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ekarihub terms and conditions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms and Conditions | ekarihub",
    description:
      "Read the ekarihub Terms and Conditions for using the platform, trading on the hub, and account responsibilities.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsPage() {
  return <TermsClientPage />;
}