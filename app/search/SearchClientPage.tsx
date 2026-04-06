"use client";

import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import dynamic from "next/dynamic";

const SearchPageClient = dynamic(() => import("./SearchPageClient"), {
    ssr: false,
    loading: () => (
        <main className="min-h-screen w-full bg-gray-50 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <BouncingBallLoader />
            </div>
        </main>
    ),
});

export default function SearchPage() {
    return <SearchPageClient />;
}
