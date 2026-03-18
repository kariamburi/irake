// app/careers/page.tsx
import type { Metadata } from "next";
import CareersClientPage from "./CareersClientPage";

export const metadata: Metadata = {
  title: "Careers at ekarihub",
  description:
    "Explore careers at ekarihub and learn about our mission, culture, hiring process, and future opportunities in building the digital rails of African agriculture.",
  keywords: [
    "ekarihub careers",
    "careers at ekarihub",
    "jobs at ekarihub",
    "agriculture jobs Africa",
    "agribusiness careers",
    "remote agritech jobs",
    "African agriculture careers",
    "ekarihub talent network",
  ],
  alternates: {
    canonical: "/careers",
  },
  openGraph: {
    title: "Careers at ekarihub",
    description:
      "Learn about careers, culture, hiring process, and future opportunities at ekarihub.",
    url: "https://ekarihub.com/careers",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "careers at ekarihub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Careers at ekarihub",
    description:
      "Learn about careers, culture, hiring process, and future opportunities at ekarihub.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CareersPage() {
  return <CareersClientPage />;
}