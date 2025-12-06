"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

import { app, db } from "@/lib/firebase";
import { ConfirmModal } from "@/app/components/ConfirmModal"; // 👈 make sure path is correct

type Props = {
    open: boolean;
    onClose: () => void;
    deedId: string;
    creatorId: string;
    creatorName?: string;
};

type FinanceSettings = {
    usdToKesRate?: number; // e.g. 130
    processingFeePercent?: number; // e.g. 2.9
    usdDonationPresets?: number[]; // e.g. [1,5,10,15,20,50,100]
    platformSharePercent?: number; // e.g. 10
};

type PreferredCurrency = "KES" | "USD";

type WalletDoc = {
    pendingBalance?: number; // USD minor
};

type PayMethod = "wallet" | "paystack";

const FALLBACK_PRESETS_USD = [1, 5, 10, 15, 20, 50, 100];
const FALLBACK_USD_TO_KES = 130;
const FALLBACK_PLATFORM_SHARE = 10;
const FALLBACK_PROCESSING_FEE = 2.9;

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    ink: "#111827",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

// 🔹 Simple global feedback modal state
type FeedbackModalState =
    | {
        title: string;
        message: string;
        closeOnConfirm?: boolean;
    }
    | null;

export function DonateDialogWeb({
    open,
    onClose,
    deedId,
    creatorId,
    creatorName,
}: Props) {
    const [finance, setFinance] = useState<FinanceSettings | null>(null);
    const [currency, setCurrency] = useState<PreferredCurrency>("KES");
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // 🔹 Auth + wallet
    const [authUid, setAuthUid] = useState<string | null>(null);
    const [wallet, setWallet] = useState<WalletDoc | null>(null);

    // 🔹 Pay method: wallet vs Paystack
    const [payMethod, setPayMethod] = useState<PayMethod>("paystack");

    // 🔹 Global feedback modal
    const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>(null);

    // ---------- Load finance settings ----------
    useEffect(() => {
        const ref = doc(db, "adminSettings", "finance");
        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = (snap.data() as FinanceSettings) || {};
                setFinance(data);
            },
            (err) => {
                console.error("Error loading finance settings", err);
                setFinance(null);
            }
        );
        return () => unsub();
    }, []);

    // ---------- Load user preferred currency + uid ----------
    useEffect(() => {
        const auth = getAuth(app);
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!u) {
                setCurrency("KES");
                setAuthUid(null);
                return;
            }
            setAuthUid(u.uid);
            try {
                const snap = await getDoc(doc(db, "users", u.uid));
                if (snap.exists()) {
                    const d: any = snap.data();
                    const pref = d.preferredCurrency as PreferredCurrency | undefined;
                    setCurrency(pref === "USD" ? "USD" : "KES");
                } else {
                    setCurrency("KES");
                }
            } catch (err) {
                console.error("Error loading user preferred currency", err);
                setCurrency("KES");
            }
        });
        return () => unsub();
    }, []);

    // ---------- Subscribe to viewer wallet ----------
    useEffect(() => {
        if (!authUid) {
            setWallet(null);
            return;
        }
        const ref = doc(db, "wallets", authUid);
        const unsub = onSnapshot(
            ref,
            (snap) => {
                setWallet((snap.data() as WalletDoc) || null);
            },
            () => setWallet(null)
        );
        return () => unsub();
    }, [authUid]);

    // ---------- Derived values from finance settings ----------
    const {
        displayPresets,
        symbol,
        platformShare,
        creatorShare,
        processingFee,
        effectiveRate,
    } = useMemo(() => {
        const usdPresets =
            finance?.usdDonationPresets && finance.usdDonationPresets.length
                ? finance.usdDonationPresets
                : FALLBACK_PRESETS_USD;

        const usdToKes =
            finance?.usdToKesRate && finance.usdToKesRate > 0
                ? finance.usdToKesRate
                : FALLBACK_USD_TO_KES;

        let presets: number[];
        let sym: string;

        if (currency === "USD") {
            presets = usdPresets;
            sym = "USD";
        } else {
            // Display in KES -> convert from USD base presets
            presets = usdPresets.map((v) => Math.round(v * usdToKes));
            sym = "KSh";
        }

        if (!presets.length) {
            presets = FALLBACK_PRESETS_USD;
        }

        const platform = finance?.platformSharePercent ?? FALLBACK_PLATFORM_SHARE;
        const creator = 100 - platform;
        const fee = finance?.processingFeePercent ?? FALLBACK_PROCESSING_FEE;

        return {
            displayPresets: presets,
            symbol: sym,
            platformShare: platform,
            creatorShare: creator,
            processingFee: fee,
            effectiveRate: usdToKes,
        };
    }, [finance, currency]);

    // ---------- Wallet derived values ----------
    const walletUsdMajor = useMemo(
        () => (wallet?.pendingBalance != null ? wallet.pendingBalance / 100 : 0),
        [wallet?.pendingBalance]
    );

    const walletDisplayMajor = useMemo(() => {
        if (currency === "USD") return walletUsdMajor;
        return walletUsdMajor * effectiveRate;
    }, [walletUsdMajor, currency, effectiveRate]);

    const hasWallet = authUid != null && walletUsdMajor > 0;

    const canUseWalletForCurrentAmount = useMemo(() => {
        if (!hasWallet) return false;
        if (selectedAmount == null || selectedAmount <= 0) return false;

        // selectedAmount is in display currency
        let neededUsdMajor: number;
        if (currency === "USD") {
            neededUsdMajor = selectedAmount;
        } else {
            neededUsdMajor = selectedAmount / effectiveRate;
        }

        return neededUsdMajor <= walletUsdMajor;
    }, [hasWallet, selectedAmount, currency, effectiveRate, walletUsdMajor]);

    // ---------- Initialise default selected amount ----------
    useEffect(() => {
        if (!displayPresets.length) return;
        const mid = displayPresets[Math.floor(displayPresets.length / 2)];
        setSelectedAmount((prev) => (prev == null ? mid : prev));
    }, [displayPresets]);

    if (!open) return null;

    const handleDonate = async () => {
        if (!selectedAmount) {
            setFeedbackModal({
                title: "Select an amount",
                message: "Please pick an amount before continuing.",
            });
            return;
        }

        const auth = getAuth(app);
        if (!auth.currentUser) {
            setFeedbackModal({
                title: "Sign in required",
                message: "Please sign in to support this deed.",
            });
            return;
        }

        try {
            setLoading(true);

            const functions = getFunctions(app, "us-central1");
            const amountInMinor = Math.round(selectedAmount * 100);

            if (payMethod === "wallet") {
                if (!canUseWalletForCurrentAmount) {
                    setFeedbackModal({
                        title: "Insufficient wallet balance",
                        message:
                            "Your wallet balance is not enough for this donation. You can top up from your earnings page or choose Paystack instead.",
                    });
                    setLoading(false);
                    return;
                }

                const donateFromWallet = httpsCallable<
                    {
                        deedId: string;
                        handle: string;
                        amount: number; // minor units in display currency
                        currency: "USD" | "KES";
                    },
                    { ok: boolean; donationId?: string }
                >(functions, "donateFromWallet");

                const res = await donateFromWallet({
                    deedId,
                    handle: creatorName ?? "",
                    amount: amountInMinor,
                    currency,
                });

                if (!res.data.ok) {
                    setFeedbackModal({
                        title: "Wallet donation failed",
                        message:
                            "We could not complete your wallet donation. Please try again in a few moments.",
                    });
                    setLoading(false);
                    return;
                }

                // Success – show thank you, then close dialog when user taps OK
                setFeedbackModal({
                    title: "Thank you! 🌱",
                    message: "Your donation from wallet was recorded successfully.",
                    closeOnConfirm: true,
                });
                setLoading(false);
                return;
            }

            // 🔹 payMethod === "paystack"
            const createDonationCheckout = httpsCallable<
                {
                    deedId: string;
                    handle: string;
                    amount: number; // minor units
                    currency: string;
                    source?: "mobile" | "web";
                },
                { checkoutUrl: string }
            >(functions, "createDonationCheckout");

            const res = await createDonationCheckout({
                deedId,
                handle: creatorName ?? "",
                amount: amountInMinor,
                currency, // "KES" or "USD"
                source: "web",
            });

            const url = res.data.checkoutUrl;
            if (!url) {
                setFeedbackModal({
                    title: "Unable to start checkout",
                    message: "We could not start the payment checkout. Please try again.",
                });
                setLoading(false);
                return;
            }

            // Close sheet and redirect out to Paystack
            onClose();
            window.location.href = url;
        } catch (err: any) {
            console.error("Donation error", err);
            setFeedbackModal({
                title: "Donation error",
                message:
                    err?.message ||
                    "We were unable to start your donation. Please try again shortly.",
            });
            setLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[70]">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/40"
                    onClick={() => {
                        if (!loading) onClose();
                    }}
                />

                {/* Centered sheet container */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full max-w-[600px] rounded-3xl bg-white px-4 pb-5 pt-3 shadow-xl translate-y-0 transition-transform duration-200">
                        {/* handle bar */}
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />

                        {/* header */}
                        <div className="mb-3 flex items-start gap-3">
                            <div className="flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:#233F39]">
                                    Uplift this deed
                                </p>
                                <h2 className="text-[16px] font-extrabold text-gray-900">
                                    Uplift {creatorName || "this creator"}
                                </h2>

                                {/* Main share line + tooltip */}
                                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                    <span>
                                        About {creatorShare}% goes directly to the creator and{" "}
                                        {platformShare}% helps run ekarihub.
                                    </span>
                                    <span
                                        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] text-gray-500"
                                        title={
                                            "About 90% goes directly to the creator and 10% helps run ekarihub. Payment providers may charge an additional 2.9% fee, which is deducted from the creator's portion (not extra on top of what you pay)."
                                        }
                                    >
                                        ?
                                    </span>
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

                        {/* Pay method pill */}
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setPayMethod("wallet")}
                                    className={`px-3 py-1 rounded-full font-semibold transition ${payMethod === "wallet"
                                        ? "bg-white shadow-sm text-emerald-900"
                                        : "text-slate-600"
                                        }`}
                                >
                                    From wallet
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPayMethod("paystack")}
                                    className={`px-3 py-1 rounded-full font-semibold transition ${payMethod === "paystack"
                                        ? "bg-white shadow-sm text-emerald-900"
                                        : "text-slate-600"
                                        }`}
                                >
                                    Paystack
                                </button>
                            </div>
                        </div>

                        {/* Wallet balance info (when using wallet) */}
                        {payMethod === "wallet" && (
                            <div className="mb-3 rounded-2xl bg-slate-50 px-3 py-2">
                                {authUid ? (
                                    <>
                                        <p className="text-[11px] text-gray-600">
                                            Wallet balance:{" "}
                                            <span className="font-semibold">
                                                {currency === "USD" ? "USD" : "KSh"}{" "}
                                                {walletDisplayMajor.toFixed(
                                                    currency === "KES" ? 0 : 2
                                                )}
                                            </span>
                                        </p>
                                        {!hasWallet && (
                                            <p className="mt-0.5 text-[10px] text-red-500">
                                                Your wallet is empty. Top up from your earnings page.
                                            </p>
                                        )}
                                        {hasWallet &&
                                            !canUseWalletForCurrentAmount &&
                                            selectedAmount && (
                                                <p className="mt-0.5 text-[10px] text-red-500">
                                                    Your wallet balance is lower than the selected
                                                    amount.
                                                </p>
                                            )}
                                    </>
                                ) : (
                                    <p className="text-[11px] text-gray-600">
                                        Sign in to donate from your ekarihub wallet.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* amount chips */}
                        <div className="mb-4 flex flex-wrap gap-2">
                            {displayPresets.map((amt) => {
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
                                        {symbol} {amt}
                                    </button>
                                );
                            })}
                        </div>

                        {/* CTA */}
                        <button
                            type="button"
                            onClick={handleDonate}
                            disabled={
                                !selectedAmount ||
                                loading ||
                                (payMethod === "wallet" && !canUseWalletForCurrentAmount)
                            }
                            className={[
                                "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition",
                                "bg-[color:#233F39] hover:bg-[#1b312d]",
                                (!selectedAmount ||
                                    loading ||
                                    (payMethod === "wallet" && !canUseWalletForCurrentAmount)) &&
                                "opacity-60 cursor-not-allowed",
                            ].join(" ")}
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    {payMethod === "wallet"
                                        ? "Processing wallet donation…"
                                        : "Processing…"}
                                </span>
                            ) : (
                                <>
                                    <span role="img" aria-label="heart">
                                        🌱
                                    </span>
                                    <span>
                                        {payMethod === "wallet"
                                            ? "Uplift from wallet"
                                            : `Continue* ${symbol}.${selectedAmount ?? ""}`}
                                    </span>
                                </>
                            )}
                        </button>

                        <p className="mt-2 text-center text-[10px] text-gray-500">
                            Payments are processed securely. Some methods may be provided by
                            partners (cards, mobile money, etc.).
                        </p>
                    </div>
                </div>
            </div>

            {/* 🔹 Global feedback modal for all errors / info */}
            <ConfirmModal
                open={!!feedbackModal}
                title={feedbackModal?.title || ""}
                message={feedbackModal?.message || ""}
                confirmText="OK"
                cancelText="Close"
                onConfirm={() => {
                    if (feedbackModal?.closeOnConfirm) {
                        onClose();
                    }
                    setFeedbackModal(null);
                }}
                onCancel={() => setFeedbackModal(null)}
            />
        </>
    );
}
