import type { Metadata } from "next";
import ChildSafetyClientPage from "./ChildSafetyClientPage";


export const metadata: Metadata = {
  title: "Child Safety Standards | ekarihub",
  description:
    "Read ekarihub's child safety standards, reporting process, moderation approach, and contact information.",
  keywords: [
    "ekarihub child safety",
    "ekarihub safety standards",
    "ekarihub CSAE policy",
    "ekarihub child protection",
    "ekarihub reporting abuse",
  ],
  alternates: {
    canonical: "/child-safety",
  },
  openGraph: {
    title: "Child Safety Standards | ekarihub",
    description:
      "Learn about ekarihub's child safety standards, prohibited content, reporting tools, moderation, and compliance.",
    url: "https://ekarihub.com/child-safety",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ekarihub child safety standards",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Child Safety Standards | ekarihub",
    description:
      "Learn about ekarihub's child safety standards, prohibited content, reporting tools, moderation, and compliance.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ChildSafetyPage() {
  return <ChildSafetyClientPage />;
}