// app/admin/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  IoCashOutline,
  IoFilmOutline,
  IoSettingsOutline,
  IoShieldCheckmarkOutline,
  IoStorefrontOutline,
  IoTrendingUpOutline,
} from "react-icons/io5";
import { ConfirmModal } from "@/app/components/ConfirmModal";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  ink: "#111827",
  dim: "#6B7280",
  bgSoft: "#F3F4F6",
};

type AppSettings = {
  minWithdrawUSD?: number;
  usdToKesRate?: number;
  processingFeePercent?: number;
  donationPresetsUSD?: number[];
  platformSharePercent?: number;
  verificationFeeUSD?: number;
  requireVerifiedToPostProduct?: boolean;
  maxVideoDurationSec?: number;
  maxPhotoMusicDurationSec?: number;
  maxMediaMb?: number;
  captionMaxLength?: number;
  videoDurationOptionsSec?: number[];
  updatedAt?: any;
};

const inputClass =
  "mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-[#233F39] focus:bg-white focus:ring-2 focus:ring-[#233F39]/10";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span
            className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: EKARI.forest }}
          >
            {icon}
          </span>

          <div>
            <h2 className="text-base font-black text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>

        {badge ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            {badge}
          </span>
        ) : null}
      </div>

      {children}
    </section>
  );
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [minWithdrawInput, setMinWithdrawInput] = useState("50");
  const [usdRateInput, setUsdRateInput] = useState("130");
  const [processingFeeInput, setProcessingFeeInput] = useState("0");
  const [platformShareInput, setPlatformShareInput] = useState("10");
  const [verificationFeeUSDInput, setVerificationFeeUSDInput] = useState("5");
  const [usdPresetsInput, setUsdPresetsInput] = useState("1,5,10,15,20,50,100");

  const [requireVerifiedToPostProduct, setRequireVerifiedToPostProduct] =
    useState(true);

  const [maxVideoDurationInput, setMaxVideoDurationInput] = useState("240");
  const [maxPhotoMusicDurationInput, setMaxPhotoMusicDurationInput] =
    useState("60");
  const [maxMediaMbInput, setMaxMediaMbInput] = useState("500");
  const [captionMaxLengthInput, setCaptionMaxLengthInput] = useState("1000");
  const [videoDurationOptionsInput, setVideoDurationOptionsInput] =
    useState("10,30,60,90");

  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const ref = doc(db, "adminSettings", "finance");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as AppSettings) || {};
        setSettings(data);

        if (data.minWithdrawUSD != null)
          setMinWithdrawInput(String(data.minWithdrawUSD));

        if (data.usdToKesRate != null)
          setUsdRateInput(String(data.usdToKesRate));

        if (data.processingFeePercent != null)
          setProcessingFeeInput(String(data.processingFeePercent));

        if (data.platformSharePercent != null)
          setPlatformShareInput(String(data.platformSharePercent));

        if (data.verificationFeeUSD != null)
          setVerificationFeeUSDInput(String(data.verificationFeeUSD));

        if (
          Array.isArray(data.donationPresetsUSD) &&
          data.donationPresetsUSD.length
        ) {
          setUsdPresetsInput(data.donationPresetsUSD.join(","));
        }

        if (typeof data.requireVerifiedToPostProduct === "boolean") {
          setRequireVerifiedToPostProduct(data.requireVerifiedToPostProduct);
        }

        if (data.maxVideoDurationSec != null)
          setMaxVideoDurationInput(String(data.maxVideoDurationSec));

        if (data.maxPhotoMusicDurationSec != null)
          setMaxPhotoMusicDurationInput(String(data.maxPhotoMusicDurationSec));

        if (data.maxMediaMb != null)
          setMaxMediaMbInput(String(data.maxMediaMb));

        if (data.captionMaxLength != null)
          setCaptionMaxLengthInput(String(data.captionMaxLength));

        if (
          Array.isArray(data.videoDurationOptionsSec) &&
          data.videoDurationOptionsSec.length
        ) {
          setVideoDurationOptionsInput(data.videoDurationOptionsSec.join(","));
        }

        setLoaded(true);
      },
      (err) => {
        console.error("Error loading settings", err);
        setSettings(null);
        setLoaded(true);
      }
    );

    return () => unsub();
  }, []);

  const handleSaveAll = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (saving) return;

    const minWithdraw = parseInt(minWithdrawInput, 10);
    const usdRate = parseFloat(usdRateInput);
    const processingFee = parseFloat(processingFeeInput);
    const platformShare = parseFloat(platformShareInput);
    const verificationFeeUSD = parseFloat(verificationFeeUSDInput);

    const maxVideoDurationSec = parseInt(maxVideoDurationInput, 10);
    const maxPhotoMusicDurationSec = parseInt(maxPhotoMusicDurationInput, 10);
    const maxMediaMb = parseInt(maxMediaMbInput, 10);
    const captionMaxLength = parseInt(captionMaxLengthInput, 10);

    const donationPresetsUSD = usdPresetsInput
      .split(/[, ]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    const videoDurationOptionsSec = videoDurationOptionsInput
      .split(/[, ]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!Number.isFinite(minWithdraw) || minWithdraw < 0) {
      setFeedbackModal({
        title: "Invalid minimum withdrawal",
        message: "Minimum withdrawal must be a valid non-negative number.",
      });
      return;
    }

    if (!Number.isFinite(usdRate) || usdRate <= 0) {
      setFeedbackModal({
        title: "Invalid FX rate",
        message: "USD to KES rate must be greater than 0.",
      });
      return;
    }

    if (
      !Number.isFinite(processingFee) ||
      processingFee < 0 ||
      processingFee > 100
    ) {
      setFeedbackModal({
        title: "Invalid processing fee",
        message: "Processing fee must be between 0 and 100.",
      });
      return;
    }

    if (
      !Number.isFinite(platformShare) ||
      platformShare < 0 ||
      platformShare > 100
    ) {
      setFeedbackModal({
        title: "Invalid platform share",
        message: "Platform share must be between 0 and 100.",
      });
      return;
    }

    if (!Number.isFinite(verificationFeeUSD) || verificationFeeUSD < 0) {
      setFeedbackModal({
        title: "Invalid verification fee",
        message: "Verification fee must be a valid non-negative number.",
      });
      return;
    }

    if (!donationPresetsUSD.length) {
      setFeedbackModal({
        title: "Invalid donation presets",
        message: "Enter at least one donation preset, for example 1,5,10.",
      });
      return;
    }

    if (
      !Number.isFinite(maxVideoDurationSec) ||
      maxVideoDurationSec < 5 ||
      maxVideoDurationSec > 600
    ) {
      setFeedbackModal({
        title: "Invalid video duration",
        message: "Video duration must be between 5 and 600 seconds.",
      });
      return;
    }

    if (
      !Number.isFinite(maxPhotoMusicDurationSec) ||
      maxPhotoMusicDurationSec < 5 ||
      maxPhotoMusicDurationSec > 300
    ) {
      setFeedbackModal({
        title: "Invalid photo music duration",
        message: "Photo music duration must be between 5 and 300 seconds.",
      });
      return;
    }

    if (!Number.isFinite(maxMediaMb) || maxMediaMb < 10) {
      setFeedbackModal({
        title: "Invalid media size",
        message: "Maximum media size must be at least 10 MB.",
      });
      return;
    }

    if (
      !Number.isFinite(captionMaxLength) ||
      captionMaxLength < 50 ||
      captionMaxLength > 5000
    ) {
      setFeedbackModal({
        title: "Invalid caption limit",
        message: "Caption limit must be between 50 and 5000 characters.",
      });
      return;
    }

    if (!videoDurationOptionsSec.length) {
      setFeedbackModal({
        title: "Invalid duration options",
        message: "Enter at least one option, for example 10,30,60,90.",
      });
      return;
    }

    if (videoDurationOptionsSec.some((n) => n > maxVideoDurationSec)) {
      setFeedbackModal({
        title: "Invalid duration options",
        message: "Duration options cannot exceed max video duration.",
      });
      return;
    }

    try {
      setSaving(true);

      await setDoc(
        doc(db, "adminSettings", "finance"),
        {
          minWithdrawUSD: minWithdraw,
          usdToKesRate: usdRate,
          processingFeePercent: processingFee,
          donationPresetsUSD,
          platformSharePercent: platformShare,
          verificationFeeUSD,
          requireVerifiedToPostProduct,
          maxVideoDurationSec,
          maxPhotoMusicDurationSec,
          maxMediaMb,
          captionMaxLength,
          videoDurationOptionsSec,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err: any) {
      setFeedbackModal({
        title: "Save failed",
        message: err?.message || "Unable to save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const currentPlatformShare = settings?.platformSharePercent ?? 10;
  const currentCreatorShare = 100 - currentPlatformShare;

  const lastUpdated =
    settings?.updatedAt?.toDate?.() instanceof Date
      ? (settings.updatedAt.toDate() as Date)
      : null;

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: EKARI.bgSoft }}>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 shadow-sm">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: EKARI.forest }}
              >
                <IoSettingsOutline size={15} />
              </span>
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                EkariHub Admin
              </span>
            </div>

            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-4xl">
              Platform Settings
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Manage finance, verification, market access, and media limits used across the mobile app.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            {lastUpdated ? (
              <p className="text-xs font-semibold text-slate-500">
                Last updated:{" "}
                <span className="text-slate-800">{lastUpdated.toLocaleString()}</span>
              </p>
            ) : null}

            <span
              className={`rounded-full border px-3 py-1 text-xs font-black ${saving
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : loaded
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-500"
                }`}
            >
              {saving ? "Saving…" : loaded ? "Settings in sync" : "Loading…"}
            </span>
          </div>
        </header>

        <form onSubmit={handleSaveAll} className="space-y-5">
          <SectionCard
            icon={<IoCashOutline size={18} />}
            title="Finance & Payout"
            subtitle="Configure withdrawal thresholds, FX rate, and processing fees."
            badge="Finance"
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Minimum withdrawal" hint="USD">
                <input
                  type="number"
                  min={0}
                  value={minWithdrawInput}
                  onChange={(e) => setMinWithdrawInput(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="USD to KES rate" hint="Used for local estimates">
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={usdRateInput}
                  onChange={(e) => setUsdRateInput(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Processing fee" hint="Percentage">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={processingFeeInput}
                  onChange={(e) => setProcessingFeeInput(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Verification fee" hint="USD">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={verificationFeeUSDInput}
                  onChange={(e) => setVerificationFeeUSDInput(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={<IoFilmOutline size={18} />}
            title="Deed & Media Limits"
            subtitle="Control upload duration, size, captions, and camera duration choices."
            badge="Mobile App"
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Field label="Max video duration" hint="Seconds">
                <input
                  type="number"
                  value={maxVideoDurationInput}
                  onChange={(e) => setMaxVideoDurationInput(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Photo music duration" hint="Seconds">
                <input
                  type="number"
                  value={maxPhotoMusicDurationInput}
                  onChange={(e) => setMaxPhotoMusicDurationInput(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Maximum media size" hint="MB">
                <input
                  type="number"
                  value={maxMediaMbInput}
                  onChange={(e) => setMaxMediaMbInput(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Caption max length" hint="Characters">
                <input
                  type="number"
                  value={captionMaxLengthInput}
                  onChange={(e) => setCaptionMaxLengthInput(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Duration buttons" hint="Comma separated seconds">
                <input
                  type="text"
                  value={videoDurationOptionsInput}
                  onChange={(e) => setVideoDurationOptionsInput(e.target.value)}
                  placeholder="10,30,60,90"
                  className={inputClass}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            icon={<IoStorefrontOutline size={18} />}
            title="Verification & Market Access"
            subtitle="Control who can publish products and how account verification is charged."
            badge="Market"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  ekariMarket posting rule
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Require account verification before users can publish products.
                </p>

                <button
                  type="button"
                  onClick={() => setRequireVerifiedToPostProduct((v) => !v)}
                  className="mt-4 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-900">
                      {requireVerifiedToPostProduct ? "Verified accounts only" : "Any account can post"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {requireVerifiedToPostProduct
                        ? "Unverified users cannot publish listings."
                        : "Unverified users can publish listings."}
                    </p>
                  </div>

                  <span
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${requireVerifiedToPostProduct ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                  >
                    <span
                      className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${requireVerifiedToPostProduct ? "translate-x-5" : "translate-x-1"
                        }`}
                    />
                  </span>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Current status
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500">Verification fee</p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      USD {verificationFeeUSDInput || "0"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold text-slate-500">Market rule</p>
                    <p className="mt-1 text-sm font-black text-slate-900">
                      {requireVerifiedToPostProduct ? "Verified only" : "Open posting"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            icon={<IoTrendingUpOutline size={18} />}
            title="Donation & Revenue Share"
            subtitle="Configure donation presets and how uplift revenue is split."
            badge="Uplifts"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Donation presets" hint="Comma separated USD amounts">
                <input
                  type="text"
                  value={usdPresetsInput}
                  onChange={(e) => setUsdPresetsInput(e.target.value)}
                  placeholder="1,5,10,15,20,50,100"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Platform share"
                hint={`Creator receives ${Math.max(0, 100 - (Number(platformShareInput) || 0))}% after fees`}
              >
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={100}
                  value={platformShareInput}
                  onChange={(e) => setPlatformShareInput(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-700">
                Current split:{" "}
                <span className="text-emerald-700">
                  {currentPlatformShare}% EkariHub / {currentCreatorShare}% creator
                </span>
              </p>
            </div>
          </SectionCard>

          <div className="sticky bottom-0 z-10 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-slate-500">
                Changes are applied globally after saving.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[#233F39] px-6 py-3 text-sm font-black text-white shadow-sm hover:bg-[#1b312d] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </div>
        </form>

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