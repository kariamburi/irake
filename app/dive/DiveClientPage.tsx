// app/dive/DiveClientPage.tsx
"use client";

import dynamic from "next/dynamic";

const SuggestionsPageClient = dynamic(
    () => import("./SuggestionsPageClient"),
    {
        ssr: false,
        loading: () => (
            <div className="min-h-screen w-full bg-gray-100 flex items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent border-gray-500" />
            </div>
        ),
    }
);

export default function DiveClientPage() {
    return <SuggestionsPageClient />;
}