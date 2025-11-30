"use client";

import dynamic from "next/dynamic";

const SearchPageClient = dynamic(() => import("./SearchPageClient"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen w-full bg-gray-50 flex items-center justify-center">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="h-3 w-3 animate-spin rounded-full border border-emerald-800 border-t-transparent" />
        <span>Loading search…</span>
      </div>
    </main>
  ),
});

export default function SearchPage() {
  return <SearchPageClient />;
}
