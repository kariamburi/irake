"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IoCheckmarkCircleOutline, IoCloseCircleOutline, IoTimeOutline } from "react-icons/io5";
import { getFunctions, httpsCallable } from "firebase/functions";

import AppShell from "@/app/components/AppShell";
import { app } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
};

type VerifyResultStatus = "idle" | "checking" | "success" | "failed";

export default function VerificationCallbackPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();

    const [status, setStatus] = useState<VerifyResultStatus>("idle");
    const [message, setMessage] = useState<string | null>(null);

    const reference =
        searchParams.get("reference") || searchParams.get("trxref") || null;

    useEffect(() => {
        // wait for auth + query params
        if (user === undefined) return;

        // If no user, send to login & then back here
        if (!user) {
            const next = `/account/verification/callback?${searchParams.toString()}`;
            router.push(`/login?next=${encodeURIComponent(next)}`);
            return;
        }

        if (!reference) {
            setStatus("failed");
            setMessage("Missing transaction reference in the callback URL.");
            return;
        }

        const run = async () => {
            try {
                setStatus("checking");
                setMessage("Confirming your payment, please wait…");

                const functions = getFunctions(app);
                const confirmVerificationPayment = httpsCallable(
                    functions,
                    "confirmVerificationPayment"
                );

                const res = await confirmVerificationPayment({ reference });
                const data = res.data as any;

                if (data?.ok) {
                    setStatus("success");
                    setMessage(
                        data?.message ||
                        "Your payment was confirmed successfully. Your verification request is now awaiting review."
                    );
                } else {
                    setStatus("failed");
                    setMessage(
                        data?.message ||
                        "We could not confirm this payment. Please contact support if money was deducted."
                    );
                }
            } catch (err: any) {
                console.error("confirmVerificationPayment error:", err);
                setStatus("failed");
                setMessage(
                    err?.message ||
                    "Something went wrong while confirming your payment. Please try again or contact support."
                );
            }
        };

        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, reference]);

    function renderIcon() {
        if (status === "checking" || status === "idle") {
            return (
                <IoTimeOutline
                    size={48}
                    className="animate-pulse"
                    style={{ color: EKARI.forest }}
                />
            );
        }
        if (status === "success") {
            return (
                <IoCheckmarkCircleOutline
                    size={56}
                    style={{ color: EKARI.forest }}
                />
            );
        }
        return (
            <IoCloseCircleOutline size={56} className="text-rose-500" />
        );
    }

    return (
        <AppShell>
            <div className="w-full h-screen flex justify-center px-4 md:px-8 py-10 md:py-16">
                <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm text-center">
                    <div className="flex justify-center mb-4">{renderIcon()}</div>

                    <h1
                        className="text-xl md:text-2xl font-black mb-2"
                        style={{ color: EKARI.text }}
                    >
                        Verification payment
                    </h1>

                    <p className="text-xs text-slate-500 mb-1 break-all">
                        Reference: <span className="font-mono">{reference || "—"}</span>
                    </p>

                    <p className="mt-3 text-sm" style={{ color: EKARI.subtext }}>
                        {message ||
                            "Confirming your verification payment with Paystack…"}
                    </p>

                    <div className="mt-6 flex flex-col gap-3 items-center">
                        <button
                            type="button"
                            onClick={() => router.push("/account/verification")}
                            className="inline-flex items-center justify-center rounded-full px-5 py-2 text-xs md:text-sm font-bold text-white shadow-sm hover:shadow-md disabled:opacity-60"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            Go to verification page
                        </button>

                        {status === "failed" && (
                            <button
                                type="button"
                                onClick={() =>
                                    router.push("/support" as any) // adjust to your support route
                                }
                                className="text-xs text-slate-500 hover:text-slate-800"
                            >
                                Need help? Contact ekarihub support
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
