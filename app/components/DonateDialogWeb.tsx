"use client";

import React, { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";

type Props = {
    open: boolean;
    onClose: () => void;
    deedId: string;
    creatorId: string;
    creatorName?: string;
};

const AMOUNTS = [1, 5, 10, 15, 20, 50, 100]; // Ksh

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    ink: "#111827",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

export function DonateDialogWeb({
    open,
    onClose,
    deedId,
    creatorId,
    creatorName,
}: Props) {
    const [selectedAmount, setSelectedAmount] = useState<number | null>(10);
    const [loading, setLoading] = useState(false);

    if (!open) return null;

    const handleDonate = async () => {
        if (!selectedAmount) {
            window.alert("Please pick an amount to continue.");
            return;
        }

        try {
            setLoading(true);

            const functions = getFunctions(app, "us-central1");
            const createDonationCheckout = httpsCallable<
                {
                    deedId: string;
                    amount: number;
                    currency: string;
                    source?: "mobile" | "web";
                },
                { checkoutUrl: string }
            >(functions, "createDonationCheckout");

            const amountInMinor = selectedAmount * 100;

            const res = await createDonationCheckout({
                deedId,
                amount: amountInMinor,
                currency: "KES",
                source: "web", // 👈 web flow
            });

            const url = res.data.checkoutUrl;
            if (!url) {
                window.alert("Unable to start checkout. Please try again.");
                setLoading(false);
                return;
            }

            onClose();
            window.location.href = url; // open Paystack hosted page
        } catch (err: any) {
            console.error("Donation error", err);
            window.alert(
                err?.message || "Unable to start donation. Please try again."
            );
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40">
            {/* click backdrop to close if not loading */}
            <button
                type="button"
                className="absolute inset-0 w-full h-full cursor-default"
                onClick={() => {
                    if (!loading) onClose();
                }}
            />

            <div className="relative w-full max-w-md rounded-t-3xl bg-white px-4 pb-5 pt-3 shadow-xl">
                {/* handle bar */}
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />

                {/* header */}
                <div className="flex items-start gap-3 mb-3">
                    <div className="flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:#233F39]">
                            Support this deed
                        </p>
                        <h2 className="text-[16px] font-extrabold text-gray-900">
                            Send a tip to {creatorName || "this creator"}
                        </h2>
                        <p className="mt-1 text-xs text-gray-500">
                            90% goes directly to the creator, 10% helps run ekariHub.
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                    >
                        <span className="sr-only">Close</span>
                        ✕
                    </button>
                </div>

                {/* amount chips */}
                <div className="mb-4 flex flex-wrap gap-2">
                    {AMOUNTS.map((amt) => {
                        const active = selectedAmount === amt;
                        return (
                            <button
                                key={amt}
                                type="button"
                                onClick={() => setSelectedAmount(amt)}
                                className={[
                                    "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                                    active
                                        ? "border-[color:#233F39] bg-[color:#233F39] text-white"
                                        : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100",
                                ].join(" ")}
                            >
                                Ksh {amt}
                            </button>
                        );
                    })}
                </div>

                {/* CTA */}
                <button
                    type="button"
                    onClick={handleDonate}
                    disabled={!selectedAmount || loading}
                    className={[
                        "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition",
                        "bg-[color:#233F39] hover:bg-[#1b312d]",
                        (!selectedAmount || loading) && "opacity-60 cursor-not-allowed",
                    ].join(" ")}
                >
                    {loading ? (
                        <span className="inline-flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Processing…
                        </span>
                    ) : (
                        <>
                            <span role="img" aria-label="heart">
                                💚
                            </span>
                            <span>Donate Ksh {selectedAmount ?? ""}</span>
                        </>
                    )}
                </button>

                <p className="mt-2 text-center text-[10px] text-gray-500">
                    Payments are processed securely. Some methods may be provided by
                    partners (cards, mobile money, etc.).
                </p>
            </div>
        </div>
    );
}
