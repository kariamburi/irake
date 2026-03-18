// app/search/page.tsx
import type { Metadata } from "next";
import SearchClientPage from "./SearchClientPage";

export const metadata: Metadata = {
  title: "Search | ekarihub",
  description: "Search across ekarihub.",
  alternates: {
    canonical: "/search",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function SearchPage() {
  return <SearchClientPage />;
}