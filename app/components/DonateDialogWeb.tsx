"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

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
    usdDonationPresets?: number[]; // legacy setting, not used for KES uplift tiers
    kesUpliftPresets?: number[]; // optional enabled subset of the nine requested KES denominations
    platformSharePercent?: number; // e.g. 10
};

type PreferredCurrency = "KES" | "USD";

type WalletDoc = {
    pendingBalance?: number; // USD minor
};

type PayMethod = "wallet" | "paystack";

// Fixed KES uplift denominations requested by ekarihub.
// Keep the existing seven approved Apple product IDs; only KSh 49 and 99 are new.
// The server MUST independently verify the StoreKit transaction, SKU and credited amount.
type UpliftTier = {
    kes: number;
    appleProductId: string;
    appleUsdNominal: number;
};

const UPLIFT_TIERS: UpliftTier[] = [
    { kes: 49, appleProductId: "uplift_usd_0_39", appleUsdNominal: 0.39 },
    { kes: 99, appleProductId: "uplift_usd_0_79", appleUsdNominal: 0.79 },
    { kes: 129, appleProductId: "uplift_usd_1", appleUsdNominal: 1 },
    { kes: 649, appleProductId: "uplift_usd_5", appleUsdNominal: 5 },
    { kes: 1299, appleProductId: "uplift_usd_10", appleUsdNominal: 10 },
    { kes: 1949, appleProductId: "uplift_usd_15", appleUsdNominal: 15 },
    { kes: 2599, appleProductId: "uplift_usd_20", appleUsdNominal: 20 },
    { kes: 6499, appleProductId: "uplift_usd_50", appleUsdNominal: 50 },
    { kes: 12999, appleProductId: "uplift_usd_100", appleUsdNominal: 100 },
];

const FALLBACK_USD_TO_KES = 130;
const FALLBACK_PLATFORM_SHARE = 10;

function displayAmountForTier(kes: number, currency: PreferredCurrency, rate: number): number {
    return currency === "KES" ? kes : Math.round((kes / rate) * 100) / 100;
}

function formatUpliftAmount(amount: number, currency: PreferredCurrency): string {
    return currency === "KES" ? amount.toLocaleString("en-KE") : amount.toFixed(2);
}

function getEnabledTiers(finance: FinanceSettings | null): UpliftTier[] {
    const config = finance?.kesUpliftPresets;
    if (!Array.isArray(config) || !config.length) return UPLIFT_TIERS;
    // Do not allow an admin setting to expose an arbitrary denomination
    // without a corresponding Apple SKU in the iOS application.
    const enabled = UPLIFT_TIERS.filter((tier) => config.includes(tier.kes));
    return enabled.length ? enabled : UPLIFT_TIERS;
}

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

    // ✅ store selection in USD major (base), then derive display amount from currency
    const [selectedKesMajor, setSelectedKesMajor] = useState<number | null>(null);

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

    // ---------- Track auth uid ----------
    useEffect(() => {
        const auth = getAuth(app);
        const unsub = onAuthStateChanged(auth, (u) => {
            if (!u) {
                setAuthUid(null);
                setCurrency("KES");
                return;
            }
            setAuthUid(u.uid);
        });
        return () => unsub();
    }, []);

    // ---------- Subscribe to user preferred currency (real-time) ----------
    useEffect(() => {
        if (!authUid) return;

        const ref = doc(db, "users", authUid);
        const unsub = onSnapshot(
            ref,
            (snap) => {
                const d: any = snap.data() || {};
                const pref = d.preferredCurrency as PreferredCurrency | undefined;
                setCurrency(pref === "USD" ? "USD" : "KES");
            },
            (err) => {
                console.error("Error subscribing to preferred currency", err);
                setCurrency("KES");
            }
        );

        return () => unsub();
    }, [authUid]);

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

    // ---------- Derive the same exact KES denominations as Android and iOS ----------
    const {
        displayPresets,
        symbol,
        platformShare,
        creatorShare,
        processingFee,
        effectiveRate,
    } = useMemo(() => {
        const usdToKes =
            finance?.usdToKesRate && finance.usdToKesRate > 0
                ? finance.usdToKesRate
                : FALLBACK_USD_TO_KES;
        const platform = finance?.platformSharePercent ?? FALLBACK_PLATFORM_SHARE;
        return {
            displayPresets: getEnabledTiers(finance),
            symbol: currency === "USD" ? "USD" : "KSh",
            platformShare: platform,
            creatorShare: 100 - platform,
            processingFee: finance?.processingFeePercent ?? FALLBACK_PROCESSING_FEE,
            effectiveRate: usdToKes,
        };
    }, [finance, currency]);

    useEffect(() => {
        if (!displayPresets.length) return;
        setSelectedKesMajor((prev) =>
            prev != null && displayPresets.some((tier) => tier.kes === prev)
                ? prev
                : (displayPresets.find((tier) => tier.kes === 1299) ||
                    displayPresets[Math.floor(displayPresets.length / 2)]).kes
        );
    }, [displayPresets]);

    const selectedTier = useMemo(
        () => displayPresets.find((tier) => tier.kes === selectedKesMajor) || null,
        [displayPresets, selectedKesMajor]
    );

    const selectedDisplayAmount = useMemo(
        () => selectedTier == null
            ? null
            : displayAmountForTier(selectedTier.kes, currency, effectiveRate),
        [selectedTier, currency, effectiveRate]
    );

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
        if (!hasWallet || selectedTier == null) return false;
        const requiredUsdMinor = Math.round((selectedTier.kes / effectiveRate) * 100);
        return (wallet?.pendingBalance ?? 0) >= requiredUsdMinor;
    }, [hasWallet, selectedTier, wallet?.pendingBalance, effectiveRate]);

    if (!open) return null;

    const handleDonate = async () => {
        const displayAmount = selectedDisplayAmount;

        if (!displayAmount || displayAmount <= 0) {
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
            const amountInMinor = Math.round(displayAmount * 100);

            if (payMethod === "wallet") {
                if (!canUseWalletForCurrentAmount) {
                    setFeedbackModal({
                        title: "Insufficient wallet balance",
                        message:
                            "Your wallet balance is not enough for this uplift. You can top up from your earnings page or choose Paystack instead.",
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
                        title: "Wallet uplift failed",
                        message:
                            "We could not complete your wallet uplift. Please try again in a few moments.",
                    });
                    setLoading(false);
                    return;
                }

                // Success – show thank you, then close dialog when user taps OK
                setFeedbackModal({
                    title: "Thank you! 🌱",
                    message: "Your uplift from wallet was recorded successfully.",
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
                    "We were unable to start your uplift. Please try again shortly.",
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
                    <div className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white px-4 pb-5 pt-3 shadow-xl translate-y-0 transition-transform duration-200">
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
                                <span className="sr-only">Close</span>✕
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
                                            selectedDisplayAmount != null && (
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

                        {/* Exact KES uplift denominations; USD display uses finance exchange rate */}
                        <div className="mb-4 flex flex-wrap gap-2">
                            {displayPresets.map((tier) => {
                                const active = selectedKesMajor === tier.kes;
                                const amount = displayAmountForTier(tier.kes, currency, effectiveRate);
                                return (
                                    <button
                                        key={tier.kes}
                                        type="button"
                                        onClick={() => setSelectedKesMajor(tier.kes)}
                                        className={[
                                            "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                                            active
                                                ? "border-[color:#233F39] bg-[color:#233F39] text-white"
                                                : "border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100",
                                        ].join(" ")}
                                    >
                                        {symbol} {formatUpliftAmount(amount, currency)}
                                    </button>
                                );
                            })}
                        </div>

                        {/* CTA */}
                        <button
                            type="button"
                            onClick={handleDonate}
                            disabled={
                                !selectedDisplayAmount ||
                                loading ||
                                (payMethod === "wallet" && !canUseWalletForCurrentAmount)
                            }
                            className={[
                                "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition",
                                "bg-[color:#233F39] hover:bg-[#1b312d]",
                                (!selectedDisplayAmount ||
                                    loading ||
                                    (payMethod === "wallet" &&
                                        !canUseWalletForCurrentAmount)) &&
                                "opacity-60 cursor-not-allowed",
                            ].join(" ")}
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    {payMethod === "wallet"
                                        ? "Processing wallet uplift…"
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
                                            : `Continue* ${symbol} ${selectedDisplayAmount ?? ""}`}
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
                    if (feedbackModal?.closeOnConfirm) onClose();
                    setFeedbackModal(null);
                }}
                onCancel={() => setFeedbackModal(null)}
            />
        </>
    );
}
