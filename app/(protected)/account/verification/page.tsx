"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  IoShieldCheckmarkOutline,
  IoCloudUploadOutline,
  IoTimeOutline,
  IoInformationCircleOutline,
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { db, app } from "@/lib/firebase";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
};

type VerificationStatus = "none" | "pending" | "approved" | "rejected";
type PreferredCurrency = "KES" | "USD";

type FinanceSettings = {
  verificationFeeUSD?: number;
  usdToKesRate?: number;
};
type VerificationData = {
  status: VerificationStatus;
  roleLabel?: string;
  notes?: string;
  evidenceUrls?: string[];
  requestedAt?: any;
  reviewedAt?: any;
  reviewerId?: string | null;
  rejectionReason?: string | null;
  paystackReference?: string | null;
};

export default function VerificationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<VerificationData | null>(
    null
  );
  const [savedRoles, setSavedRoles] = useState<string[]>([]);
  const [roleLabel, setRoleLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [financeSettings, setFinanceSettings] =
    useState<FinanceSettings | null>(null);

  const [preferredCurrency, setPreferredCurrency] =
    useState<PreferredCurrency>("KES");

  // Redirect to login if not logged in
  useEffect(() => {
    if (user === undefined) return; // still determining auth
    if (!user) {
      const next = "/account/verification";
      router.push(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [user, router]);

  // Load verification state from Firestore
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data() as any | undefined;
        // 🔹 NEW: load saved roles
        const savedRolesFromUser: string[] =
          d?.professionalRoles || d?.roles || d?.profileSettings?.roles || [];
        setSavedRoles(savedRolesFromUser);
        const vRaw = d?.verification || null;

        const status: VerificationStatus =
          (vRaw?.status as VerificationStatus) || "none";

        const v: VerificationData = {
          status,
          roleLabel: vRaw?.roleLabel || "",
          notes: vRaw?.notes || "",
          evidenceUrls: vRaw?.evidenceUrls || [],
          requestedAt: vRaw?.requestedAt,
          reviewedAt: vRaw?.reviewedAt,
          reviewerId: vRaw?.reviewerId ?? null,
          rejectionReason: vRaw?.rejectionReason ?? null,
          paystackReference: vRaw?.paystackReference ?? null,
        };

        setVerification(v);
        if (!roleLabel && v.roleLabel) setRoleLabel(v.roleLabel);
        if (!notes && v.notes) setNotes(v.notes);

        // Currency preference
        const pref =
          d?.preferredCurrency ||
          d?.settings?.preferredCurrency ||
          d?.profileSettings?.preferredCurrency;

        if (pref === "USD" || pref === "KES") {
          setPreferredCurrency(pref);
        } else {
          setPreferredCurrency("KES");
        }

        setLoading(false);
      },
      (err) => {
        console.warn("verification listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const status: VerificationStatus =
    verification?.status || ("none" as VerificationStatus);

  // Fee in admin base (USD)
  const feeUSD =
    financeSettings?.verificationFeeUSD != null
      ? financeSettings.verificationFeeUSD
      : 5; // fallback

  const usdToKesRate =
    financeSettings?.usdToKesRate != null
      ? financeSettings.usdToKesRate
      : 130; // fallback

  const approxFeeKES = Math.round(feeUSD * usdToKesRate);

  // Amount to actually charge, per user preference
  const chargeCurrency: "USD" | "KES" =
    preferredCurrency === "USD" ? "USD" : "KES";
  const amountMajor =
    chargeCurrency === "USD" ? feeUSD : approxFeeKES; // major units

  // Upload files to Storage and return URLs
  async function uploadEvidenceFiles(uid: string, files: File[]) {
    if (!files.length) return [] as string[];
    const storage = getStorage(app);
    const urls: string[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, "_");
      const path = `verificationDocs/${uid}/${Date.now()}_${safeName}`;
      const ref = sRef(storage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      urls.push(url);
    }
    return urls;
  }

  // Load finance settings (verification fee in USD + FX rate)
  useEffect(() => {
    const ref = doc(db, "adminSettings", "finance");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as any) || {};
        setFinanceSettings({
          verificationFeeUSD: data.verificationFeeUSD,
          usdToKesRate: data.usdToKesRate,
        });
      },
      (err) => {
        console.warn("finance settings listener error:", err);
        setFinanceSettings(null);
      }
    );
    return () => unsub();
  }, []);

  // Submit verification request and start Paystack checkout
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user?.uid) {
      setErrorMsg("You must be logged in to request verification.");
      return;
    }

    if (!roleLabel.trim()) {
      setErrorMsg("Please specify your professional role.");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Upload supporting docs (if any)
      const evidenceUrls = await uploadEvidenceFiles(user.uid, files);

      // 2) Call Cloud Function to create Paystack checkout
      const functions = getFunctions(app);
      const createVerificationCheckout = httpsCallable(
        functions,
        "createVerificationCheckout"
      );

      const amountMinor = Math.round(amountMajor * 100);

      const res = await createVerificationCheckout({
        amount: amountMinor,
        currency: chargeCurrency, // "USD" or "KES"
        purpose: "account_verification",
        source: "web",
      });

      const data = res.data as any;
      const authorizationUrl =
        data?.authorizationUrl ||
        data?.authorization_url ||
        data?.data?.authorization_url;
      const reference =
        data?.reference || data?.data?.reference || data?.data?.reference_id;

      if (!authorizationUrl) {
        throw new Error(
          "Failed to create verification payment. Please try again."
        );
      }

      // 3) Write verification object to user doc
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        verification: {
          status: "pending",
          roleLabel: roleLabel.trim(),
          notes: notes.trim() || null,
          evidenceUrls,
          requestedAt: serverTimestamp(),
          reviewedAt: null,
          reviewerId: null,
          rejectionReason: null,
          paystackReference: reference || null,
        },
      });

      // 4) Redirect to Paystack
      if (typeof window !== "undefined") {
        window.location.href = authorizationUrl;
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err?.message ||
        "Something went wrong while starting verification. Please try again."
      );
      setSubmitting(false);
    }
  };

  // ---------- Render helpers ----------

  function StatusBadge() {
    if (status === "approved") {
      return (
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border"
          style={{
            borderColor: EKARI.forest,
            color: EKARI.forest,
            backgroundColor: "#E6F1EE", // soft forest tint
          }}
        >
          <IoShieldCheckmarkOutline size={14} />
          <span>
            Verified
            {verification?.roleLabel ? ` • ${verification.roleLabel}` : ""}
          </span>
        </div>
      );
    }
    if (status === "pending") {
      return (
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
          <IoTimeOutline size={14} />
          <span>Verification pending review</span>
        </div>
      );
    }
    if (status === "rejected") {
      return (
        <div className="inline-flex flex-col gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 border border-rose-200">
          <div className="flex items-center gap-2 font-bold">
            <IoInformationCircleOutline size={14} />
            <span>Verification rejected</span>
          </div>
          {verification?.rejectionReason && (
            <p className="text-[11px] leading-snug">
              Reason: {verification.rejectionReason}
            </p>
          )}
          <p className="text-[11px] leading-snug mt-1">
            You can review your details and submit a new request below.
          </p>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 border border-slate-200">
        <IoInformationCircleOutline size={14} />
        <span>Not verified yet</span>
      </div>
    );
  }

  // ---------- MAIN RENDER ----------

  if (!user) {
    // short placeholder; redirect happens in useEffect
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-10 text-sm text-gray-600">
          Redirecting to login…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full px-4 md:px-8 py-8 md:py-10">
        <h1
          className="text-2xl md:text-3xl font-black"
          style={{ color: EKARI.text }}
        >
          Account verification
        </h1>
        <p className="mt-2 text-sm" style={{ color: EKARI.subtext }}>
          Help ekarihub members trust your expertise by verifying your
          professional profile. Upload supporting documents and pay a one-time
          verification fee.
        </p>

        <div className="mt-5">
          <StatusBadge />
        </div>

        {loading && (
          <div className="mt-10 text-sm text-gray-500">Loading…</div>
        )}

        {/* Existing evidence */}
        {!loading &&
          verification?.evidenceUrls &&
          verification.evidenceUrls.length > 0 && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-bold text-slate-700 mb-2">
                Submitted documents
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700">
                {verification.evidenceUrls.map((url, idx) => (
                  <li key={idx}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline break-all hover:opacity-80"
                      style={{ color: EKARI.forest }}
                    >
                      Document {idx + 1}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* If approved or pending, show info */}
        {status === "approved" && (
          <div
            className="mt-8 rounded-lg p-4 text-xs"
            style={{
              borderColor: EKARI.forest,
              backgroundColor: "#E6F1EE",
              color: EKARI.forest,
              borderWidth: 1,
              borderStyle: "solid",
            }}
          >
            Your profile is verified. If you need to update your professional
            details or submit new documents, contact ekarihub support.
          </div>
        )}

        {status === "pending" && (
          <div className="mt-8 rounded-lg border border-amber-100 bg-amber-50 p-4 text-xs text-amber-900">
            We have received your verification request and payment. An admin
            will review your documents. You’ll be notified once a decision is
            made.
          </div>
        )}

        {/* Form is available when status is none or rejected */}
        {(status === "none" || status === "rejected") && !loading && (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            {/* Step 1 */}
            {/* Step 1 */}
            <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500">
              <span
                className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                style={{ backgroundColor: EKARI.forest }}
              >
                1
              </span>
              <span>Your professional role</span>
            </div>

            <div className="space-y-3">
              {/* Saved roles selector, if any */}
              {savedRoles.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-600 mb-1">
                    Choose from your saved roles
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {savedRoles.map((r) => {
                      const isActive = roleLabel === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRoleLabel(r)}
                          className={`px-3 py-1 rounded-full text-[11px] border transition ${isActive
                            ? "font-bold shadow-sm"
                            : "font-medium bg-slate-50 hover:bg-slate-100"
                            }`}
                          style={{
                            borderColor: isActive ? EKARI.forest : EKARI.hair,
                            color: isActive ? EKARI.forest : EKARI.text,
                            backgroundColor: isActive ? "#E6F1EE" : undefined,
                          }}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tap a role to use it for verification, or type a custom one below.
                  </p>
                </div>
              )}

              {/* Free text input (always available) */}
              <div>
                <label
                  htmlFor="roleLabel"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Role / profession
                </label>
                <input
                  id="roleLabel"
                  type="text"
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  placeholder="e.g. Veterinary doctor, Agronomist, Animal health technician"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-transparent"
                  style={{ borderColor: EKARI.hair }}
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  This will be shown on your profile next to your verified badge.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500 mt-4">
              <span
                className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                style={{ backgroundColor: EKARI.forest }}
              >
                2
              </span>
              <span>Supporting documents</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Certificates & licences
              </label>
              <div className="mt-1 flex flex-col gap-3">
                <label className="flex flex-col items-center justify-center text-center border border-dashed rounded-xl px-4 py-6 cursor-pointer hover:bg-slate-50 text-slate-600 text-xs">
                  <IoCloudUploadOutline size={20} className="mb-1 opacity-80" />
                  <span className="font-semibold">Upload documents</span>
                  <span className="mt-0.5 text-[11px] text-slate-500">
                    PDF or image files. You can select multiple files.
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) =>
                      setFiles(Array.from(e.target.files || []))
                    }
                  />
                </label>
                {files.length > 0 && (
                  <div className="text-[11px] text-slate-600">
                    Selected files:
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {files.map((f, i) => (
                        <li key={i} className="break-all">
                          {f.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500 mt-4">
              <span
                className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                style={{ backgroundColor: EKARI.forest }}
              >
                3
              </span>
              <span>Extra information (optional)</span>
            </div>
            <div>
              <label
                htmlFor="notes"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Notes for the reviewer
              </label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details about your experience, licensing body, or registration number."
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-transparent"
                style={{ borderColor: EKARI.hair }}
              />
            </div>

            {/* Step 4 */}
            <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500 mt-4">
              <span
                className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                style={{ backgroundColor: EKARI.forest }}
              >
                4
              </span>
              <span>Payment & submit</span>
            </div>
            <div className="flex flex-col gap-3 text-xs text-slate-600">
              <p>
                Verification fee:{" "}
                {preferredCurrency === "USD" ? (
                  <>
                    <span
                      className="font-extrabold"
                      style={{ color: EKARI.forest }}
                    >
                      USD {feeUSD.toFixed(2)}
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="font-extrabold"
                      style={{ color: EKARI.forest }}
                    >
                      KSh {approxFeeKES.toLocaleString("en-KE")}
                    </span>{" "}
                    <span className="text-[11px] text-slate-500">
                      (≈ USD {feeUSD.toFixed(2)})
                    </span>{" "}
                  </>
                )}
                {" "}one-time.
              </p>
              <p>
                We will redirect you to a secure Paystack checkout page. After
                payment, an admin will review your documents and update your
                verification status.
              </p>
            </div>

            {errorMsg && (
              <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                ← Back
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs md:text-sm font-bold text-white shadow-sm hover:shadow-md disabled:opacity-60"
                style={{ backgroundColor: EKARI.forest }}
              >
                {submitting
                  ? "Preparing checkout…"
                  : "Submit & pay via Paystack"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
