"use client";

import dynamic from "next/dynamic";

// Import the client component lazily, with SSR disabled
const SuggestionsPageClient = dynamic(
  () => import("./SuggestionsPageClient"),
  {
    ssr: false,
    // optional: simple loading shell
    loading: () => (
      <div className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent border-gray-500" />
      </div>
    ),
  }
);

export default function DivePage() {
  return <SuggestionsPageClient />;
}
