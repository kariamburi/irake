// app/admin/finance/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  minWithdrawUSD?: number;          // major units
  usdToKesRate?: number;            // 1 USD = X KES
  processingFeePercent?: number;    // e.g. 2.9
  donationPresetsUSD?: number[];    // e.g. [1,5,10,...]
  platformSharePercent?: number;    // % to ekariHub, rest to creator
  updatedAt?: any;
};

export default function AdminFinancePage() {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local form state
  const [minWithdrawInput, setMinWithdrawInput] = useState("50");
  const [usdRateInput, setUsdRateInput] = useState("130");
  const [processingFeeInput, setProcessingFeeInput] = useState("0");
  const [usdPresetsInput, setUsdPresetsInput] = useState("1,5,10,15,20,50,100");
  const [platformShareInput, setPlatformShareInput] = useState("10");

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

        if (Array.isArray(data.donationPresetsUSD) && data.donationPresetsUSD.length) {
          setUsdPresetsInput(data.donationPresetsUSD.join(","));
        }

        if (data.platformSharePercent != null) {
          setPlatformShareInput(String(data.platformSharePercent));
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

  const handleSaveAll = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (saving) return;

    // --- validate + parse ---
    const minWithdraw = parseInt(minWithdrawInput, 10);
    if (Number.isNaN(minWithdraw) || minWithdraw < 0) {
      alert("Please enter a valid non-negative number for Minimum withdrawal (KSh).");
      return;
    }

    const usdRate = parseFloat(usdRateInput);
    if (!Number.isFinite(usdRate) || usdRate <= 0) {
      alert("Please enter a valid positive number for USD → KES rate.");
      return;
    }

    const processingFee = parseFloat(processingFeeInput);
    if (!Number.isFinite(processingFee) || processingFee < 0 || processingFee > 100) {
      alert("Processing fee (%) must be between 0 and 100.");
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
      alert("Please enter at least one valid USD preset amount (e.g. 1,5,10).");
      return;
    }

    const platformShare = parseFloat(platformShareInput);
    if (!Number.isFinite(platformShare) || platformShare < 0 || platformShare > 100) {
      alert("Platform share (%) must be between 0 and 100.");
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
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // onSnapshot will refresh view
    } catch (err: any) {
      console.error("Error saving finance settings", err);
      alert(err?.message || "Unable to save finance settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <header>
        <h1
          className="text-lg md:text-xl font-extrabold"
          style={{ color: EKARI.ink }}
        >
          Finance Settings
        </h1>
        <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
          Configure global payout thresholds, FX rates, donation fees, and revenue sharing.
        </p>
      </header>

      <form onSubmit={handleSaveAll} className="space-y-4">
        {/* Payout settings card */}
        <section
          className="rounded-3xl bg-white/80 p-4 md:p-5 shadow-sm border"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
            <div className="flex-1">
              <h2
                className="text-sm md:text-base font-bold"
                style={{ color: EKARI.ink }}
              >
                Payout threshold (USD)
              </h2>
              <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                Creators can request withdrawals once their pending balance reaches this
                minimum amount.
              </p>
              {loaded && (
                <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
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
                className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                value={minWithdrawInput}
                onChange={(e) => setMinWithdrawInput(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* FX & processing card */}
        <section
          className="rounded-3xl bg-white/80 p-4 md:p-5 shadow-sm border"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {/* USD→KES */}
            <div>
              <h2
                className="text-sm md:text-base font-bold"
                style={{ color: EKARI.ink }}
              >
                Currency & FX (USD → KES)
              </h2>
              <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                Used when estimating KSh impact of USD donations or reporting.
              </p>
              {loaded && (
                <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
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
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
              <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                Platform-wide fee on each donation before splitting with creators
                (e.g. card/payment gateway + ekariHub overhead).
              </p>
              {loaded && (
                <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
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
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                value={processingFeeInput}
                onChange={(e) => setProcessingFeeInput(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* Donation presets & sharing */}
        <section
          className="rounded-3xl bg-white/80 p-4 md:p-5 shadow-sm border"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {/* Presets */}
            <div>
              <h2
                className="text-sm md:text-base font-bold"
                style={{ color: EKARI.ink }}
              >
                Donation presets (USD)
              </h2>
              <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                These amounts appear on the donation bottom sheet for USD
                donors (e.g. 1, 5, 10, 20).
              </p>
              {loaded && (
                <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                  Current presets:{" "}
                  <span className="font-semibold text-emerald-700">
                    {(settings?.donationPresetsUSD ?? [1, 5, 10, 15, 20, 50, 100]).join(
                      ", "
                    )}{" "}
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
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                value={usdPresetsInput}
                onChange={(e) => setUsdPresetsInput(e.target.value)}
                placeholder="1,5,10,15,20,50,100"
              />
            </div>

            {/* Sharing */}
            <div>
              <h2
                className="text-sm md:text-base font-bold"
                style={{ color: EKARI.ink }}
              >
                Donation revenue sharing
              </h2>
              <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                Control how net donations are split between ekariHub support and the
                deed owner.
              </p>
              {loaded && (
                <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                  Current split:{" "}
                  <span className="font-semibold text-emerald-700">
                    {currentPlatformShare}% ekariHub / {currentCreatorShare}% creator
                  </span>
                </p>
              )}

              <label
                className="mt-3 block text-xs font-semibold"
                style={{ color: EKARI.dim }}
              >
                Platform share (% to ekariHub)
              </label>
              <input
                type="number"
                step="0.5"
                min={0}
                max={100}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                value={platformShareInput}
                onChange={(e) => setPlatformShareInput(e.target.value)}
              />

              <p className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                Creator will receive:{" "}
                <span className="font-semibold">
                  {Math.max(0, 100 - Number(platformShareInput) || 0)}%
                </span>{" "}
                of the amount after processing fees.
              </p>
            </div>
          </div>
        </section>

        {/* Save button + status */}
        <div className="flex items-center justify-end gap-3">
          {!loaded && (
            <p className="text-[11px]" style={{ color: EKARI.dim }}>
              Loading current settings…
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className={[
              "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs md:text-sm font-semibold",
              "bg-[color:#233F39] text-white hover:bg-[#1b312d] disabled:opacity-60 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {saving ? "Saving…" : "Save all settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
