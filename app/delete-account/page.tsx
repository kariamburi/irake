import type { Metadata } from "next";
import DeleteAccountClientPage from "./DeleteAccountClientPage";

export const metadata: Metadata = {
  title: "Delete Account | ekarihub",
  description:
    "Learn how to request deletion of your ekarihub account and associated data.",
  keywords: [
    "ekarihub delete account",
    "delete ekarihub account",
    "ekarihub account deletion",
    "remove ekarihub account",
    "ekarihub privacy",
  ],
  alternates: {
    canonical: "/delete-account",
  },
  openGraph: {
    title: "Delete Account | ekarihub",
    description:
      "Request deletion of your ekarihub account and associated data.",
    url: "https://ekarihub.com/delete-account",
    siteName: "ekarihub",
    type: "website",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Delete your ekarihub account",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Delete Account | ekarihub",
    description:
      "Request deletion of your ekarihub account and associated data.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DeleteAccountPage() {
  return <DeleteAccountClientPage />;
}