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
  IoIdCardOutline,
  IoCameraOutline,
} from "react-icons/io5";

import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { db, app } from "@/lib/firebase";
import { SelfieCamera } from "@/app/components/SelfieCamera";

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
type VerificationType = "individual" | "business" | "company";

type FinanceSettings = {
  verificationFeeUSD?: number;
  usdToKesRate?: number;
};

type VerificationData = {
  status: VerificationStatus;
  // NEW: which kind of verification this is
  verificationType?: VerificationType;
  roleLabel?: string;
  notes?: string;
  evidenceUrls?: string[];
  requestedAt?: any;
  reviewedAt?: any;
  reviewerId?: string | null;
  rejectionReason?: string | null;
  paystackReference?: string | null;
  nationalIdFrontUrl?: string | null;
  nationalIdBackUrl?: string | null;
  selfieUrl?: string | null;

  // NEW: for Business / Company
  organizationName?: string | null;
};

const TOTAL_STEPS = 5;

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

  // wizard step: 1–5
  const [step, setStep] = useState<number>(1);

  // NEW: verification type (Individual / Business / Company)
  const [verificationType, setVerificationType] =
    useState<VerificationType>("individual");

  // NEW: organization / business name (for Business / Company)
  const [organizationName, setOrganizationName] = useState("");

  // KYC image files
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  // KYC image previews
  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

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
        const savedRolesFromUser: string[] =
          d?.professionalRoles || d?.roles || d?.profileSettings?.roles || [];
        setSavedRoles(savedRolesFromUser);
        const vRaw = d?.verification || null;

        const status: VerificationStatus =
          (vRaw?.status as VerificationStatus) || "none";

        const v: VerificationData = {
          status,
          verificationType:
            (vRaw?.verificationType as VerificationType) || "individual",
          roleLabel: vRaw?.roleLabel || "",
          notes: vRaw?.notes || "",
          evidenceUrls: vRaw?.evidenceUrls || [],
          requestedAt: vRaw?.requestedAt,
          reviewedAt: vRaw?.reviewedAt,
          reviewerId: vRaw?.reviewerId ?? null,
          rejectionReason: vRaw?.rejectionReason ?? null,
          paystackReference: vRaw?.paystackReference ?? null,
          nationalIdFrontUrl: vRaw?.nationalIdFrontUrl ?? null,
          nationalIdBackUrl: vRaw?.nationalIdBackUrl ?? null,
          selfieUrl: vRaw?.selfieUrl ?? null,
          organizationName: vRaw?.organizationName ?? null,
        };

        setVerification(v);

        if (v.verificationType) {
          setVerificationType(v.verificationType);
        }

        if (!roleLabel && v.roleLabel) setRoleLabel(v.roleLabel);
        if (!notes && v.notes) setNotes(v.notes);
        if (!organizationName && v.organizationName) {
          setOrganizationName(v.organizationName);
        }

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

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (idFrontPreview) URL.revokeObjectURL(idFrontPreview);
      if (idBackPreview) URL.revokeObjectURL(idBackPreview);
      if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    };
  }, [idFrontPreview, idBackPreview, selfiePreview]);

  const status: VerificationStatus =
    verification?.status || ("none" as VerificationStatus);

  const feeUSD =
    financeSettings?.verificationFeeUSD != null
      ? financeSettings.verificationFeeUSD
      : 5;

  const usdToKesRate =
    financeSettings?.usdToKesRate != null
      ? financeSettings.usdToKesRate
      : 130;

  const approxFeeKES = Math.round(feeUSD * usdToKesRate);

  const chargeCurrency: "USD" | "KES" =
    preferredCurrency === "USD" ? "USD" : "KES";
  const amountMajor =
    chargeCurrency === "USD" ? feeUSD : approxFeeKES;

  // Upload generic evidence files
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

  // Upload single KYC image
  async function uploadKycImage(
    uid: string,
    file: File,
    kind: "idFront" | "idBack" | "selfie"
  ): Promise<string> {
    const storage = getStorage(app);
    const safeName = file.name.replace(/\s+/g, "_");
    const path = `verificationDocs/${uid}/${kind}_${Date.now()}_${safeName}`;
    const ref = sRef(storage, path);
    await uploadBytes(ref, file);
    return await getDownloadURL(ref);
  }

  const handleEvidenceFilesChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (!list.length) return;

    setFiles((prev) => {
      // prevent duplicates by using a simple key
      const existingKeys = new Set(
        prev.map((f) => `${f.name}_${f.size}_${f.lastModified}`)
      );

      const newOnes = list.filter(
        (f) => !existingKeys.has(`${f.name}_${f.size}_${f.lastModified}`)
      );

      return [...prev, ...newOnes];
    });

    // allow selecting the same file again later if needed
    e.target.value = "";
  };

  // Finance settings
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

  // Handlers for KYC inputs (with preview)
  const handleIdFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setIdFrontFile(file);
    if (idFrontPreview) URL.revokeObjectURL(idFrontPreview);
    setIdFrontPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleIdBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setIdBackFile(file);
    if (idBackPreview) URL.revokeObjectURL(idBackPreview);
    setIdBackPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setSelfieFile(file);
    if (selfiePreview) URL.revokeObjectURL(selfiePreview);
    setSelfiePreview(file ? URL.createObjectURL(file) : null);
  };

  // Remove a supporting document from list
  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit verification request (Step 5)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user?.uid) {
      setErrorMsg("You must be logged in to request verification.");
      return;
    }

    if (!roleLabel.trim()) {
      setErrorMsg(
        verificationType === "individual"
          ? "Please specify your professional role."
          : "Please specify your role / capacity in the organization."
      );
      setStep(1);
      return;
    }

    if (verificationType !== "individual" && !organizationName.trim()) {
      setErrorMsg(
        "Please enter the name of your business / company before submitting."
      );
      setStep(1);
      return;
    }

    if (!idFrontFile || !idBackFile || !selfieFile) {
      setErrorMsg(
        "Please upload the front and back of the National ID and take a selfie using your camera."
      );
      setStep(2);
      return;
    }

    try {
      setSubmitting(true);

      const [nationalIdFrontUrl, nationalIdBackUrl, selfieUrl] =
        await Promise.all([
          uploadKycImage(user.uid, idFrontFile, "idFront"),
          uploadKycImage(user.uid, idBackFile, "idBack"),
          uploadKycImage(user.uid, selfieFile, "selfie"),
        ]);

      const evidenceUrls = await uploadEvidenceFiles(user.uid, files);

      const functions = getFunctions(app);
      const createVerificationCheckout = httpsCallable(
        functions,
        "createVerificationCheckout"
      );

      const amountMinor = Math.round(amountMajor * 100);

      const res = await createVerificationCheckout({
        amount: amountMinor,
        currency: chargeCurrency,
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

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        verification: {
          status: "pending",
          verificationType,
          roleLabel: roleLabel.trim(),
          notes: notes.trim() || null,
          evidenceUrls,
          organizationName:
            verificationType === "individual"
              ? null
              : organizationName.trim(),
          requestedAt: serverTimestamp(),
          reviewedAt: null,
          reviewerId: null,
          rejectionReason: null,
          paystackReference: reference || null,
          nationalIdFrontUrl,
          nationalIdBackUrl,
          selfieUrl,
        },
      });

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

  // ----- Step navigation -----

  const handleNext = () => {
    setErrorMsg(null);

    // Basic validation per step
    if (step === 1) {
      if (!roleLabel.trim()) {
        setErrorMsg(
          verificationType === "individual"
            ? "Please select or type your professional role before continuing."
            : "Please enter your role / capacity in the organization before continuing."
        );
        return;
      }
      if (verificationType !== "individual" && !organizationName.trim()) {
        setErrorMsg(
          "Please enter the name of your business / company before continuing."
        );
        return;
      }
    }

    if (step === 2) {
      if (!idFrontFile || !idBackFile || !selfieFile) {
        setErrorMsg(
          "Please upload the ID front, ID back and a selfie before continuing."
        );
        return;
      }
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    setErrorMsg(null);
    if (step > 1) setStep(step - 1);
  };

  const progressPercent = Math.round((step / TOTAL_STEPS) * 100);

  // ---------- Render helpers ----------

  function StatusBadge() {
    const labelType =
      verification?.verificationType || "individual";

    const typeLabel =
      labelType === "individual"
        ? "Individual"
        : labelType === "business"
          ? "Business"
          : "Company";

    if (status === "approved") {
      return (
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border"
          style={{
            borderColor: EKARI.forest,
            color: EKARI.forest,
            backgroundColor: "#E6F1EE",
          }}
        >
          <IoShieldCheckmarkOutline size={14} />
          <span>
            Verified {typeLabel}
            {verification?.organizationName
              ? ` • ${verification.organizationName}`
              : verification?.roleLabel
                ? ` • ${verification.roleLabel}`
                : ""}
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
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-10 text-sm text-gray-600">
          Redirecting to login…
        </div>
      </AppShell>
    );
  }

  const isIndividual = verificationType === "individual";

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
          Help ekarihub members trust your expertise or organization by
          verifying your profile. Upload ID and selfie, add supporting
          documents, then pay a one-time verification fee.
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
            Your profile is verified. If you need to update your details or
            submit new documents, contact ekarihub support.
          </div>
        )}

        {status === "pending" && (
          <div className="mt-8 rounded-lg border border-amber-100 bg-amber-50 p-4 text-xs text-amber-900">
            We have received your verification request and payment. An admin
            will review your documents. You’ll be notified once a decision is
            made.
          </div>
        )}

        {(status === "none" || status === "rejected") && !loading && (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
                <span>
                  Step {step} of {TOTAL_STEPS}
                </span>
                <span>{progressPercent}% complete</span>
              </div>
              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: EKARI.hair }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progressPercent}%`,
                    backgroundImage:
                      "linear-gradient(90deg, #233F39, #C79257)",
                  }}
                />
              </div>
            </div>

            {/* STEP 1: Type + Role / Organization details */}
            {step === 1 && (
              <>
                <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span
                    className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                    style={{ backgroundColor: EKARI.forest }}
                  >
                    1
                  </span>
                  <span>Step 1 – Select verification type & role</span>
                </div>

                {/* Verification type selector */}
                <div className="mt-3">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1">
                    I want to verify my:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "individual", label: "Individual" },
                      { key: "business", label: "Business" },
                      { key: "company", label: "Company" },
                    ].map((opt) => {
                      const key = opt.key as VerificationType;
                      const active = verificationType === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setVerificationType(key)}
                          className={`px-3 py-1 rounded-full text-[11px] border transition ${active
                            ? "font-bold shadow-sm"
                            : "font-medium bg-slate-50 hover:bg-slate-100"
                            }`}
                          style={{
                            borderColor: active ? EKARI.forest : EKARI.hair,
                            color: active ? EKARI.forest : EKARI.text,
                            backgroundColor: active ? "#E6F1EE" : undefined,
                          }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Use <span className="font-semibold">Individual</span> if
                    you are verifying yourself as a professional. Choose{" "}
                    <span className="font-semibold">Business</span> or{" "}
                    <span className="font-semibold">Company</span> if you want a
                    verified badge for your shop, clinic, organization or
                    brand.
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {/* Organization / business name (only for business / company) */}
                  {!isIndividual && (
                    <div>
                      <label
                        htmlFor="organizationName"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Business / company name
                      </label>
                      <input
                        id="organizationName"
                        type="text"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        placeholder="e.g. GreenFields Vet Clinic, AgroTech Ltd"
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-transparent"
                        style={{ borderColor: EKARI.hair }}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        This will be shown on your profile for Business / Company
                        verification.
                      </p>
                    </div>
                  )}

                  {/* Role / profession / capacity */}
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
                                borderColor: isActive
                                  ? EKARI.forest
                                  : EKARI.hair,
                                color: isActive
                                  ? EKARI.forest
                                  : EKARI.text,
                                backgroundColor: isActive
                                  ? "#E6F1EE"
                                  : undefined,
                              }}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Tap a role to use it for verification, or type a custom
                        one below.
                      </p>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="roleLabel"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      {isIndividual
                        ? "Role / profession"
                        : "Your role / capacity in the organization"}
                    </label>
                    <input
                      id="roleLabel"
                      type="text"
                      value={roleLabel}
                      onChange={(e) => setRoleLabel(e.target.value)}
                      placeholder={
                        isIndividual
                          ? "e.g. Veterinary doctor, Agronomist, Animal health technician"
                          : "e.g. Director, Co-founder, Practice owner, Manager"
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-transparent"
                      style={{ borderColor: EKARI.hair }}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      This will be shown next to your verified badge.
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: National ID + selfie */}
            {step === 2 && (
              <>
                <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span
                    className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                    style={{ backgroundColor: EKARI.forest }}
                  >
                    2
                  </span>
                  <span>
                    Step 2 – Identity verification (required)
                  </span>
                </div>

                <div className="space-y-4">
                  {/* ID */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <IoIdCardOutline
                        size={18}
                        style={{ color: EKARI.forest }}
                      />
                      <span className="text-xs font-semibold text-slate-700">
                        National ID (front & back)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Upload clear photos of the National ID of the person
                      linked to this account (for Business / Company, use the
                      main owner / director). Make sure all text is readable and
                      corners are visible.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Front */}
                      <label className="flex flex-col items-center justify-center text-center border border-dashed rounded-xl px-4 py-4 cursor-pointer hover:bg-slate-50 text-slate-600 text-xs">
                        <span className="mb-1 flex items-center gap-2">
                          <IoCloudUploadOutline
                            size={18}
                            className="opacity-80"
                          />
                          <span className="font-semibold">ID front side</span>
                        </span>
                        <span className="mt-0.5 text-[11px] text-slate-500">
                          Image file (JPG, PNG). Use a clear photo.
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleIdFrontChange}
                        />
                        {idFrontFile && (
                          <span className="mt-2 text-[11px] text-slate-600 break-all">
                            Selected: {idFrontFile.name}
                          </span>
                        )}
                        {idFrontPreview && (
                          <div className="mt-3 w-full">
                            <img
                              src={idFrontPreview}
                              alt="ID front preview"
                              className="w-full h-32 object-cover rounded-lg border"
                              style={{ borderColor: EKARI.hair }}
                            />
                          </div>
                        )}
                      </label>

                      {/* Back */}
                      <label className="flex flex-col items-center justify-center text-center border border-dashed rounded-xl px-4 py-4 cursor-pointer hover:bg-slate-50 text-slate-600 text-xs">
                        <span className="mb-1 flex items-center gap-2">
                          <IoCloudUploadOutline
                            size={18}
                            className="opacity-80"
                          />
                          <span className="font-semibold">ID back side</span>
                        </span>
                        <span className="mt-0.5 text-[11px] text-slate-500">
                          Image file (JPG, PNG). Make sure details are visible.
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleIdBackChange}
                        />
                        {idBackFile && (
                          <span className="mt-2 text-[11px] text-slate-600 break-all">
                            Selected: {idBackFile.name}
                          </span>
                        )}
                        {idBackPreview && (
                          <div className="mt-3 w-full">
                            <img
                              src={idBackPreview}
                              alt="ID back preview"
                              className="w-full h-32 object-cover rounded-lg border"
                              style={{ borderColor: EKARI.hair }}
                            />
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Selfie */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <IoCameraOutline size={18} style={{ color: EKARI.forest }} />
                      <span className="text-xs font-semibold text-slate-700">
                        Live selfie (required)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Take a selfie now using your device camera. Your whole face should be
                      visible, with good lighting. This helps us confirm that you are the
                      person on the ID.
                    </p>

                    {/* Strict webcam capture */}
                    <SelfieCamera
                      onCapture={(file, previewUrl) => {
                        setSelfieFile(file);
                        if (selfiePreview) URL.revokeObjectURL(selfiePreview);
                        setSelfiePreview(previewUrl);
                      }}
                      onError={(msg) => {
                        // optional: show toast / error text
                        console.error(msg);
                      }}
                    />

                    {selfiePreview && (
                      <div className="mt-3 w-full flex items-center justify-center">
                        <img
                          src={selfiePreview}
                          alt="Selfie preview"
                          className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-full border"
                          style={{ borderColor: EKARI.hair }}
                        />
                      </div>
                    )}
                  </div>

                </div>
              </>
            )}

            {/* STEP 3: Supporting documents */}
            {step === 3 && (
              <>
                <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span
                    className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                    style={{ backgroundColor: EKARI.forest }}
                  >
                    3
                  </span>
                  <span>Step 3 – Supporting documents</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Certificates & licences (optional)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1">
                    You can upload multiple files (PDF or images). For Business
                    / Company, you may include business registration, KRA pin
                    certificate, licences, etc. You may also combine everything
                    into a single PDF.
                  </p>
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
                        onChange={handleEvidenceFilesChange}
                      />
                    </label>
                    {files.length > 0 && (
                      <div className="text-[11px] text-slate-600">
                        Selected files:
                        <ul className="mt-1 space-y-0.5">
                          {files.map((f, i) => (
                            <li
                              key={i}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="break-all flex-1">{f.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(i)}
                                className="text-[10px] px-2 py-0.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* STEP 4: Extra info */}
            {step === 4 && (
              <>
                <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span
                    className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                    style={{ backgroundColor: EKARI.forest }}
                  >
                    4
                  </span>
                  <span>Step 4 – Extra information (optional)</span>
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
                    placeholder={
                      isIndividual
                        ? "Any additional details about your experience, licensing body, or registration number."
                        : "Any additional details about your business / company, registration details or anything else the reviewer should know."
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:#233F39] focus:border-transparent"
                    style={{ borderColor: EKARI.hair }}
                  />
                </div>
              </>
            )}

            {/* STEP 5: Payment */}
            {step === 5 && (
              <>
                <div className="flex gap-2 items-center text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span
                    className="h-6 w-6 rounded-full text-white grid place-items-center text-[11px] font-black"
                    style={{ backgroundColor: EKARI.forest }}
                  >
                    5
                  </span>
                  <span>Step 5 – Payment & submit</span>
                </div>
                <div className="flex flex-col gap-3 text-xs text-slate-600">
                  <p>
                    Verification type:{" "}
                    <span className="font-semibold">
                      {verificationType === "individual"
                        ? "Individual"
                        : verificationType === "business"
                          ? "Business"
                          : "Company"}
                    </span>
                    {organizationName
                      ? ` • ${organizationName}`
                      : ""}
                  </p>
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
                    )}{" "}
                    one-time.
                  </p>
                  <p>
                    We will redirect you to a secure Paystack checkout page.
                    After payment, an admin will review your documents and
                    update your verification status.
                  </p>
                </div>
              </>
            )}

            {errorMsg && (
              <div className="mt-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                ← Cancel
              </button>

              <div className="flex items-center gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="text-xs md:text-sm font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Back
                  </button>
                )}

                {step < TOTAL_STEPS && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs md:text-sm font-bold text-white shadow-sm hover:shadow-md"
                    style={{ backgroundColor: EKARI.forest }}
                  >
                    Next
                  </button>
                )}

                {step === TOTAL_STEPS && (
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
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
