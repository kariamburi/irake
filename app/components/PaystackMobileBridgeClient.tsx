// app/donations/paystack-mobile-bridge/PaystackMobileBridgeClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    ink: "#111827",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

export default function PaystackMobileBridgeClient() {
    const searchParams = useSearchParams();
    const donationId = searchParams.get("donationId") ?? "";
    const reference = searchParams.get("reference") ?? "";

    const [showFallback, setShowFallback] = useState(false);

    const deepLink = React.useMemo(() => {
        const base = "ekarihub://donations/paystack-callback";
        const params = new URLSearchParams();
        if (donationId) params.set("donationId", donationId);
        if (reference) params.set("reference", reference);
        const qs = params.toString();
        return qs ? `${base}?${qs}` : base;
    }, [donationId, reference]);

    useEffect(() => {
        if (!donationId && !reference) {
            setShowFallback(true);
            return;
        }

        try {
            window.location.href = deepLink;
        } catch {
            // ignore – fallback UI will appear
        }

        const t = setTimeout(() => setShowFallback(true), 1500);
        return () => clearTimeout(t);
    }, [deepLink, donationId, reference]);

    return (
        <main className="min-h-screen w-full flex items-center justify-center bg-gray-100 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-[0_20px_40px_rgba(0,0,0,0.10)] p-5 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(35,63,57,0.06)]">
                    <span className="text-lg" role="img" aria-label="seedling">
                        🌱
                    </span>
                </div>
                <h1 className="text-lg font-extrabold" style={{ color: EKARI.forest }}>
                    Thank you for supporting ekariHub
                </h1>
                <p className="mt-2 text-sm" style={{ color: EKARI.dim }}>
                    We’re finishing up your donation and opening the EkariHub app so you
                    can see your updated balance and support history.
                </p>

                {reference ? (
                    <p className="mt-2 text-xs text-gray-400">
                        Reference: <span className="font-mono">{reference}</span>
                    </p>
                ) : null}

                {showFallback && (
                    <div className="mt-5 space-y-2">
                        <button
                            type="button"
                            onClick={() => {
                                window.location.href = deepLink;
                            }}
                            className="inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            Open ekariHub app
                        </button>
                        <p className="text-[11px]" style={{ color: EKARI.dim }}>
                            If the app doesn’t open automatically, tap the button above. Make
                            sure EkariHub is installed on your phone.
                        </p>
                    </div>
                )}

                {!showFallback && (
                    <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                        <span>Trying to open ekariHub…</span>
                    </div>
                )}
            </div>
        </main>
    );
}
