// app/admin/finance/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  IoCashOutline,
  IoSwapHorizontalOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoTrendingUpOutline,
} from "react-icons/io5";
import { ConfirmModal } from "@/app/components/ConfirmModal"; // 👈 global confirm

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  ink: "#111827",
  dim: "#6B7280",
  hair: "#E5E7EB",
  bgSoft: "#F3F4F6",
};

type FinanceSettings = {
  minWithdrawUSD?: number; // major units
  usdToKesRate?: number; // 1 USD = X KES
  processingFeePercent?: number; // e.g. 2.9
  donationPresetsUSD?: number[]; // e.g. [1,5,10,...]
  platformSharePercent?: number; // % to ekariHub, rest to creator
  updatedAt?: any;
  verificationFeeUSD?: number;
  // ✅ NEW: market posting gate
  requireVerifiedToPostProduct?: boolean;
};

export default function AdminFinancePage() {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requireVerifiedToPostProduct, setRequireVerifiedToPostProduct] = useState(true);

  // Local form state
  const [minWithdrawInput, setMinWithdrawInput] = useState("50");
  const [usdRateInput, setUsdRateInput] = useState("130");
  const [processingFeeInput, setProcessingFeeInput] = useState("0");
  const [usdPresetsInput, setUsdPresetsInput] = useState(
    "1,5,10,15,20,50,100"
  );
  const [platformShareInput, setPlatformShareInput] = useState("10");
  const [verificationFeeUSDInput, setVerificationFeeUSDInput] =
    useState("5");

  // 🔹 Global validation / error modal
  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // Subscribe to adminSettings/finance
  useEffect(() => {
    const ref = doc(db, "adminSettings", "finance");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as FinanceSettings) || {};
        setSettings(data);

        if (data.minWithdrawUSD != null) {
          setMinWithdrawInput(String(data.minWithdrawUSD));
        }

        if (data.usdToKesRate != null) {
          setUsdRateInput(String(data.usdToKesRate));
        }

        if (data.processingFeePercent != null) {
          setProcessingFeeInput(String(data.processingFeePercent));
        }

        if (
          Array.isArray(data.donationPresetsUSD) &&
          data.donationPresetsUSD.length
        ) {
          setUsdPresetsInput(data.donationPresetsUSD.join(","));
        }

        if (data.platformSharePercent != null) {
          setPlatformShareInput(String(data.platformSharePercent));
        }
        if (data.verificationFeeUSD != null) {
          setVerificationFeeUSDInput(String(data.verificationFeeUSD));
        }
        if (typeof data.requireVerifiedToPostProduct === "boolean") {
          setRequireVerifiedToPostProduct(data.requireVerifiedToPostProduct);
        } else {
          setRequireVerifiedToPostProduct(true); // default: require verification
        }

        setLoaded(true);
      },
      (err) => {
        console.error("Error loading finance settings", err);
        setSettings(null);
        setLoaded(true);
      }
    );

    return () => unsub();
  }, []);

  const currentMin = settings?.minWithdrawUSD ?? 50;
  const currentUsdRate = settings?.usdToKesRate ?? 130;
  const currentProcessing = settings?.processingFeePercent ?? 0;
  const currentPlatformShare = settings?.platformSharePercent ?? 10;
  const currentCreatorShare = 100 - currentPlatformShare;
  const currentVerificationFeeUSD = settings?.verificationFeeUSD ?? 5;

  const handleSaveAll = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (saving) return;

    // --- validate + parse ---
    const minWithdraw = parseInt(minWithdrawInput, 10);
    if (Number.isNaN(minWithdraw) || minWithdraw < 0) {
      setFeedbackModal({
        title: "Invalid minimum withdrawal",
        message:
          "Please enter a valid non-negative number for Minimum withdrawal (USD).",
      });
      return;
    }

    const usdRate = parseFloat(usdRateInput);
    if (!Number.isFinite(usdRate) || usdRate <= 0) {
      setFeedbackModal({
        title: "Invalid FX rate",
        message: "Please enter a valid positive number for USD → KES rate.",
      });
      return;
    }

    const processingFee = parseFloat(processingFeeInput);
    if (
      !Number.isFinite(processingFee) ||
      processingFee < 0 ||
      processingFee > 100
    ) {
      setFeedbackModal({
        title: "Invalid processing fee",
        message: "Processing fee (%) must be between 0 and 100.",
      });
      return;
    }

    // Parse presets: comma-separated list of numbers
    const presetsRaw = usdPresetsInput
      .split(/[, ]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const presetsNums = presetsRaw
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!presetsNums.length) {
      setFeedbackModal({
        title: "Invalid donation presets",
        message:
          "Please enter at least one valid USD preset amount (e.g. 1,5,10).",
      });
      return;
    }

    const platformShare = parseFloat(platformShareInput);
    if (
      !Number.isFinite(platformShare) ||
      platformShare < 0 ||
      platformShare > 100
    ) {
      setFeedbackModal({
        title: "Invalid platform share",
        message: "Platform share (%) must be between 0 and 100.",
      });
      return;
    }

    // verification fee (USD)
    const verificationFeeUSD = parseFloat(verificationFeeUSDInput);
    if (!Number.isFinite(verificationFeeUSD) || verificationFeeUSD < 0) {
      setFeedbackModal({
        title: "Invalid verification fee",
        message:
          "Please enter a valid non-negative number for verification fee (USD).",
      });
      return;
    }

    try {
      setSaving(true);
      const ref = doc(db, "adminSettings", "finance");

      await setDoc(
        ref,
        {
          minWithdrawUSD: minWithdraw,
          usdToKesRate: usdRate,
          processingFeePercent: processingFee,
          donationPresetsUSD: presetsNums,
          platformSharePercent: platformShare,
          verificationFeeUSD,
          requireVerifiedToPostProduct, // ✅ NEW
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // onSnapshot will refresh view
    } catch (err: any) {
      console.error("Error saving finance settings", err);
      setFeedbackModal({
        title: "Save failed",
        message: err?.message || "Unable to save finance settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const lastUpdated =
    settings?.updatedAt?.toDate?.() instanceof Date
      ? (settings.updatedAt.toDate() as Date)
      : null;

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: EKARI.bgSoft }}
    >
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
        {/* Header */}
        <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm border border-slate-200 mb-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: EKARI.forest }}
              >
                <IoSettingsOutline size={14} />
              </span>
              <span
                className="text-[11px] font-semibold tracking-wide uppercase"
                style={{ color: EKARI.dim }}
              >
                Finance control panel
              </span>
            </div>
            <h1
              className="text-2xl md:text-3xl font-black tracking-tight"
              style={{ color: EKARI.ink }}
            >
              Finance & payout settings
            </h1>
            <p
              className="mt-2 text-xs md:text-sm"
              style={{ color: EKARI.dim }}
            >
              Configure thresholds, FX rates, donation fees and revenue
              sharing used across EkariHub donations, wallet top-ups and
              payouts.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-1">
            {lastUpdated && (
              <p className="text-[11px] text-slate-500">
                Last updated:{" "}
                <span className="font-medium">
                  {lastUpdated.toLocaleString()}
                </span>
              </p>
            )}
            {saving && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">
                Saving changes…
              </span>
            )}
            {!saving && loaded && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                Settings in sync
              </span>
            )}
          </div>
        </header>

        {/* Overview row */}
        <section className="mb-6">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            {/* Min withdraw */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  Min withdrawal
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <IoCashOutline size={14} />
                </span>
              </div>
              <p
                className="text-sm font-bold tracking-tight"
                style={{ color: EKARI.ink }}
              >
                USD {currentMin}
              </p>
              <p
                className="mt-1 text-[11px]"
                style={{ color: EKARI.dim }}
              >
                Pending balance threshold.
              </p>
            </div>

            {/* FX */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  FX rate
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                  <IoSwapHorizontalOutline size={14} />
                </span>
              </div>
              <p
                className="text-sm font-bold tracking-tight"
                style={{ color: EKARI.ink }}
              >
                1 USD ≈ KSh {currentUsdRate}
              </p>
              <p
                className="mt-1 text-[11px]"
                style={{ color: EKARI.dim }}
              >
                Used for KSh estimates.
              </p>
            </div>

            {/* Processing fee */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  Processing fee
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                  <IoTrendingUpOutline size={14} />
                </span>
              </div>
              <p
                className="text-sm font-bold tracking-tight"
                style={{ color: EKARI.ink }}
              >
                {currentProcessing}%
              </p>
              <p
                className="mt-1 text-[11px]"
                style={{ color: EKARI.dim }}
              >
                Before revenue split.
              </p>
            </div>

            {/* Split */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  Revenue split
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-50 text-purple-700">
                  %
                </span>
              </div>
              <p
                className="text-sm font-bold tracking-tight"
                style={{ color: EKARI.ink }}
              >
                {currentPlatformShare}% Ekari / {currentCreatorShare}% creator
              </p>
              <p
                className="mt-1 text-[11px]"
                style={{ color: EKARI.dim }}
              >
                After fees, before payout.
              </p>
            </div>

            {/* Verification fee */}
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 px-3 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-slate-500">
                  Verification fee
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                  <IoShieldCheckmarkOutline size={14} />
                </span>
              </div>
              <p
                className="text-sm font-bold tracking-tight"
                style={{ color: EKARI.ink }}
              >
                USD {currentVerificationFeeUSD}
              </p>
              <p
                className="mt-1 text-[11px]"
                style={{ color: EKARI.dim }}
              >
                One-time account verification.
              </p>
            </div>
          </div>
        </section>

        {/* Main form card */}
        <form
          onSubmit={handleSaveAll}
          className="rounded-3xl bg-white shadow-sm border border-slate-200 p-4 md:p-6 space-y-6"
        >
          {/* Payout settings card */}
          <section className="space-y-3 border-b border-slate-100 pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
              <div className="flex-1">
                <h2
                  className="text-sm md:text-base font-bold"
                  style={{ color: EKARI.ink }}
                >
                  Payout threshold (USD)
                </h2>
                <p
                  className="mt-1 text-xs md:text-sm"
                  style={{ color: EKARI.dim }}
                >
                  Creators can request withdrawals once their pending
                  balance reaches this minimum amount.
                </p>
                {loaded && (
                  <p
                    className="mt-2 text-xs"
                    style={{ color: EKARI.dim }}
                  >
                    Current effective minimum:{" "}
                    <span className="font-semibold text-emerald-700">
                      USD {currentMin}
                    </span>
                  </p>
                )}
              </div>

              <div className="w-full max-w-xs space-y-2">
                <label
                  className="mb-1 block text-xs font-semibold"
                  style={{ color: EKARI.dim }}
                >
                  Minimum withdrawal (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-[color:#233F39]"
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  value={minWithdrawInput}
                  onChange={(e) => setMinWithdrawInput(e.target.value)}
                />
                <p
                  className="text-[11px]"
                  style={{ color: EKARI.dim }}
                >
                  Consider setting this high enough to avoid tiny payouts.
                </p>
              </div>
            </div>
          </section>

          {/* FX & processing card */}
          <section className="space-y-5 border-b border-slate-100 pb-5">
            <div className="grid gap-5 md:grid-cols-2">
              {/* USD→KES */}
              <div>
                <h2
                  className="text-sm md:text-base font-bold"
                  style={{ color: EKARI.ink }}
                >
                  Currency & FX (USD → KES)
                </h2>
                <p
                  className="mt-1 text-xs md:text-sm"
                  style={{ color: EKARI.dim }}
                >
                  Used when estimating KSh impact of USD donations or
                  reporting.
                </p>
                {loaded && (
                  <p
                    className="mt-2 text-xs"
                    style={{ color: EKARI.dim }}
                  >
                    Currently:{" "}
                    <span className="font-semibold text-emerald-700">
                      1 USD ≈ KSh {currentUsdRate}
                    </span>
                  </p>
                )}

                <label
                  className="mt-3 block text-xs font-semibold"
                  style={{ color: EKARI.dim }}
                >
                  1 USD = KSh
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-[color:#233F39]"
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  value={usdRateInput}
                  onChange={(e) => setUsdRateInput(e.target.value)}
                />
              </div>

              {/* Processing fee */}
              <div>
                <h2
                  className="text-sm md:text-base font-bold"
                  style={{ color: EKARI.ink }}
                >
                  Processing fee (%)
                </h2>
                <p
                  className="mt-1 text-xs md:text-sm"
                  style={{ color: EKARI.dim }}
                >
                  Platform-wide fee on each donation before splitting with
                  creators (e.g. card/payment gateway + EkariHub overhead).
                </p>
                {loaded && (
                  <p
                    className="mt-2 text-xs"
                    style={{ color: EKARI.dim }}
                  >
                    Current fee:{" "}
                    <span className="font-semibold text-emerald-700">
                      {currentProcessing}%
                    </span>
                  </p>
                )}

                <label
                  className="mt-3 block text-xs font-semibold"
                  style={{ color: EKARI.dim }}
                >
                  Processing fee (% of donation)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-[color:#233F39]"
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  value={processingFeeInput}
                  onChange={(e) => setProcessingFeeInput(e.target.value)}
                />
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: EKARI.dim }}
                >
                  This includes any gateway fees you want to account for
                  centrally.
                </p>
              </div>
            </div>
          </section>

          {/* Verification fee card */}
          <section className="space-y-3 border-b border-slate-100 pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
              <div className="flex-1">
                <h2
                  className="text-sm md:text-base font-bold"
                  style={{ color: EKARI.ink }}
                >
                  Account verification fee (USD)
                </h2>
                <p
                  className="mt-1 text-xs md:text-sm"
                  style={{ color: EKARI.dim }}
                >
                  One-time fee members pay when submitting their professional
                  profile for verification (e.g. veterinary doctor,
                  agronomist, trainer).
                </p>
                {loaded && (
                  <p
                    className="mt-2 text-xs"
                    style={{ color: EKARI.dim }}
                  >
                    Current fee:{" "}
                    <span className="font-semibold text-emerald-700">
                      USD {currentVerificationFeeUSD}
                    </span>
                  </p>
                )}
              </div>

              <div className="w-full max-w-xs space-y-2">
                <label
                  className="mb-1 block text-xs font-semibold"
                  style={{ color: EKARI.dim }}
                >
                  Verification fee (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-[color:#233F39]"
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  value={verificationFeeUSDInput}
                  onChange={(e) =>
                    setVerificationFeeUSDInput(e.target.value)
                  }
                />
                <p
                  className="text-[11px]"
                  style={{ color: EKARI.dim }}
                >
                  Stored in USD; converted to KSh using the active FX rate
                  when charging via Paystack.
                </p>
              </div>
            </div>
          </section>
          {/* Market posting gate */}
          <section className="space-y-3 border-b border-slate-100 pb-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
              <div className="flex-1">
                <h2 className="text-sm md:text-base font-bold" style={{ color: EKARI.ink }}>
                  ekariMarket posting rule
                </h2>
                <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                  Control whether users must verify their account before posting products for sale.
                </p>

                {loaded && (
                  <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                    Current rule:{" "}
                    <span className="font-semibold text-emerald-700">
                      {requireVerifiedToPostProduct ? "Verified accounts only" : "Any account can post"}
                    </span>
                  </p>
                )}
              </div>

              <div className="w-full max-w-xs">
                <label className="mb-1 block text-xs font-semibold" style={{ color: EKARI.dim }}>
                  Require verification to post
                </label>

                <button
                  type="button"
                  onClick={() => setRequireVerifiedToPostProduct((v) => !v)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm hover:bg-slate-50 flex items-center justify-between"
                  aria-pressed={requireVerifiedToPostProduct}
                >
                  <div className="text-left">
                    <div className="text-sm font-bold" style={{ color: EKARI.ink }}>
                      {requireVerifiedToPostProduct ? "ON" : "OFF"}
                    </div>
                    <div className="text-[11px]" style={{ color: EKARI.dim }}>
                      {requireVerifiedToPostProduct
                        ? "Unverified users cannot publish listings"
                        : "Unverified users can publish listings"}
                    </div>
                  </div>

                  <span
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${requireVerifiedToPostProduct ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                    role="switch"
                    aria-checked={requireVerifiedToPostProduct}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${requireVerifiedToPostProduct ? "translate-x-5" : "translate-x-1"
                        }`}
                    />
                  </span>
                </button>

                <p className="mt-2 text-[11px]" style={{ color: EKARI.dim }}>
                  Remember to click <span className="font-semibold">Save all settings</span> to apply.
                </p>
              </div>
            </div>
          </section>

          {/* Donation presets & sharing */}
          <section className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              {/* Presets */}
              <div>
                <h2
                  className="text-sm md:text-base font-bold"
                  style={{ color: EKARI.ink }}
                >
                  Donation presets (USD)
                </h2>
                <p
                  className="mt-1 text-xs md:text-sm"
                  style={{ color: EKARI.dim }}
                >
                  These amounts appear on the donation bottom sheet for USD
                  donors (e.g. 1, 5, 10, 20).
                </p>
                {loaded && (
                  <p
                    className="mt-2 text-xs"
                    style={{ color: EKARI.dim }}
                  >
                    Current presets:{" "}
                    <span className="font-semibold text-emerald-700">
                      {(
                        settings?.donationPresetsUSD ?? [
                          1, 5, 10, 15, 20, 50, 100,
                        ]
                      ).join(", ")}{" "}
                      USD
                    </span>
                  </p>
                )}

                <label
                  className="mt-3 block text-xs font-semibold"
                  style={{ color: EKARI.dim }}
                >
                  Presets (comma separated, in USD)
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-[color:#233F39]"
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  value={usdPresetsInput}
                  onChange={(e) => setUsdPresetsInput(e.target.value)}
                  placeholder="1,5,10,15,20,50,100"
                />
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: EKARI.dim }}
                >
                  We recommend small, medium and large tiers for better UX.
                </p>
              </div>

              {/* Sharing */}
              <div>
                <h2
                  className="text-sm md:text-base font-bold"
                  style={{ color: EKARI.ink }}
                >
                  Donation revenue sharing
                </h2>
                <p
                  className="mt-1 text-xs md:text-sm"
                  style={{ color: EKARI.dim }}
                >
                  Control how net donations are split between EkariHub
                  support and the deed owner.
                </p>
                {loaded && (
                  <p
                    className="mt-2 text-xs"
                    style={{ color: EKARI.dim }}
                  >
                    Current split:{" "}
                    <span className="font-semibold text-emerald-700">
                      {currentPlatformShare}% ekariHub /{" "}
                      {currentCreatorShare}% creator
                    </span>
                  </p>
                )}

                <label
                  className="mt-3 block text-xs font-semibold"
                  style={{ color: EKARI.dim }}
                >
                  Platform share (% to EkariHub)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-[color:#233F39]"
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  value={platformShareInput}
                  onChange={(e) => setPlatformShareInput(e.target.value)}
                />

                <p
                  className="mt-1 text-[11px]"
                  style={{ color: EKARI.dim }}
                >
                  Creator will receive:{" "}
                  <span className="font-semibold">
                    {Math.max(
                      0,
                      100 - (Number(platformShareInput) || 0)
                    )}
                    %
                  </span>{" "}
                  of the amount after processing fees.
                </p>
              </div>
            </div>
          </section>

          {/* Save button row */}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            {!loaded && (
              <p className="text-[11px]" style={{ color: EKARI.dim }}>
                Loading current settings…
              </p>
            )}
            {loaded && !saving && (
              <p className="text-[11px]" style={{ color: EKARI.dim }}>
                Changes are applied globally as soon as you save.
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className={`
                inline-flex items-center justify-center rounded-full px-5 py-2.5 
                text-xs md:text-sm font-semibold shadow-sm
                bg-[color:#233F39] text-white hover:bg-[#1b312d]
                disabled:opacity-60 disabled:cursor-not-allowed
              `}
            >
              {saving ? "Saving…" : "Save all settings"}
            </button>
          </div>
        </form>

        {/* 🔹 Global validation / error modal */}
        <ConfirmModal
          open={!!feedbackModal}
          title={feedbackModal?.title || ""}
          message={feedbackModal?.message || ""}
          confirmText="OK"
          cancelText="Close"
          onConfirm={() => setFeedbackModal(null)}
          onCancel={() => setFeedbackModal(null)}
        />
      </div>
    </div>
  );
}
