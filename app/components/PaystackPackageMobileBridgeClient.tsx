"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function PaystackMobileBridgeClient() {
    const searchParams = useSearchParams();
    const checkoutId = searchParams.get("checkoutId") ?? "";
    const [showFallback, setShowFallback] = useState(false);

    const deepLink = useMemo(() => {
        const base = "ekarihub://subscription/paystack-callback";
        return checkoutId ? `${base}?checkoutId=${checkoutId}` : base;
    }, [checkoutId]);

    useEffect(() => {
        if (!checkoutId) {
            setShowFallback(true);
            return;
        }

        try {
            window.location.href = deepLink;
        } catch { }

        const t = setTimeout(() => setShowFallback(true), 1500);
        return () => clearTimeout(t);
    }, [deepLink, checkoutId]);

    return (
        <main className="min-h-screen flex items-center justify-center px-4">
            <div className="max-w-md text-center">
                <h1 className="text-lg font-extrabold">Finishing checkout…</h1>
                <p className="text-sm opacity-70">
                    Opening ekarihub app to activate your plan.
                </p>

                {showFallback && (
                    <button
                        onClick={() => (window.location.href = deepLink)}
                        className="mt-4 rounded-full px-4 py-2 bg-[#233F39] text-white font-semibold"
                    >
                        Open ekarihub app
                    </button>
                )}
            </div>
        </main>
    );
}
