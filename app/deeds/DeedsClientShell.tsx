"use client";

import dynamic from "next/dynamic";

const HomeFeedClientPage = dynamic(() => import("../HomeFeedClientPage"), {
    ssr: false,
    loading: () => (
        <div className="min-h-screen flex items-center justify-center">
            Loading deeds...
        </div>
    ),
});

export default function DeedsClientShell() {
    return <HomeFeedClientPage />;
}