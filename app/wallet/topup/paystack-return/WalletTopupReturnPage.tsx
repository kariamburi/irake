"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/app/components/AppShell";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
};

type TopupStatus = "pending" | "success" | "failed";

export default function WalletTopupReturnPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [status, setStatus] = useState<TopupStatus>("pending");
    const [reference, setReference] = useState<string | null>(null);

    useEffect(() => {
        if (!searchParams) return;

        // Paystack usually sends: status, reference, trxref
        const paystackStatus =
            searchParams.get("status") ||
            searchParams.get("message") ||
            searchParams.get("status_code");

        const ref = searchParams.get("reference") || searchParams.get("trxref");
        if (ref) {
            setReference(ref);
        }

        if (paystackStatus && paystackStatus.toLowerCase() === "success") {
            setStatus("success");
            // Optional: auto-redirect back to wallet after a short delay
            const t = setTimeout(() => {
                router.replace("/wallet");
            }, 4000);
            return () => clearTimeout(t);
        } else if (paystackStatus && paystackStatus.toLowerCase() === "cancelled") {
            setStatus("failed");
        } else if (paystackStatus && paystackStatus.toLowerCase() === "failed") {
            setStatus("failed");
        } else {
            // Unknown / missing => treat as failed for now
            setStatus("failed");
        }
    }, [router, searchParams]);

    const title =
        status === "success"
            ? "Wallet top-up successful"
            : status === "failed"
                ? "Wallet top-up not completed"
                : "Processing your wallet top-up…";

    const description =
        status === "success"
            ? "Your payment was successful. We’re updating your wallet balance. You’ll be redirected shortly."
            : status === "failed"
                ? "We were not able to confirm a successful payment. If money was deducted, please wait a few minutes or contact support."
                : "Please wait while we confirm your payment with Paystack.";

    return (
        <AppShell>
            <div className="w-full px-4 md:px-8 py-10 flex justify-center">
                <div className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
                    <h1
                        className="text-xl md:text-2xl font-black mb-2"
                        style={{ color: EKARI.text }}
                    >
                        {title}
                    </h1>

                    <p className="text-sm mb-4" style={{ color: EKARI.subtext }}>
                        {description}
                    </p>

                    {reference && (
                        <p className="text-xs text-slate-500 mb-4">
                            Reference:{" "}
                            <span className="font-mono break-all">{reference}</span>
                        </p>
                    )}

                    {status === "pending" && (
                        <div className="text-xs text-slate-500">
                            This may take a few seconds. Please do not close this page.
                        </div>
                    )}

                    {status !== "pending" && (
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={() => router.push("/wallet")}
                                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs md:text-sm font-bold text-white shadow-sm hover:shadow-md"
                                style={{ backgroundColor: EKARI.forest }}
                            >
                                Go to my wallet
                            </button>
                            <button
                                onClick={() => router.push("/")}
                                className="text-xs md:text-sm font-semibold text-slate-500 hover:text-slate-800"
                            >
                                Back to home
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
