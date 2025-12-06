// app/admin/verification/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
  QuerySnapshot,
  DocumentData,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import {
  IoShieldCheckmarkOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoTimeOutline,
  IoSearch,
  IoAlertCircleOutline,
  IoDocumentTextOutline,
  IoInformationCircleOutline,
  IoIdCardOutline,
  IoCameraOutline,
} from "react-icons/io5";
import { deleteObject, ref as sRef, getStorage } from "firebase/storage";
import { ConfirmModal } from "@/app/components/ConfirmModal"; // 👈 global confirm modal

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  ink: "#111827",
  dim: "#6B7280",
  hair: "#E5E7EB",
  bgSoft: "#F3F4F6",
};

type VerificationStatus = "none" | "pending" | "approved" | "rejected";
type VerificationType = "individual" | "business" | "company";

type UserVerificationRow = {
  uid: string;
  handle?: string;
  name?: string;
  email?: string;
  phone?: string;

  // from verification subobject
  status: VerificationStatus;
  verificationType?: VerificationType;
  roleLabel?: string;
  notes?: string;
  evidenceUrls?: string[];
  requestedAt?: any;
  reviewedAt?: any;
  reviewerId?: string | null;
  rejectionReason?: string | null;
  paystackReference?: string | null;

  // ⭐ KYC images
  nationalIdFrontUrl?: string | null;
  nationalIdBackUrl?: string | null;
  selfieUrl?: string | null;

  // ⭐ Business / Company
  organizationName?: string | null;
};

// small helper to detect images vs PDFs/others
function isImageUrl(url: string | undefined | null) {
  if (!url) return false;
  return /\.(jpe?g|png|webp|gif|heic|heif)(\?|#|$)/i.test(url);
}

function getVerificationTypeLabel(t?: VerificationType) {
  if (!t || t === "individual") return "Individual";
  if (t === "business") return "Business";
  return "Company";
}

// helper: build UserVerificationRow from a user doc snapshot
function buildRowFromDoc(docSnap: any): UserVerificationRow {
  const d = docSnap.data() as any;
  const v = d.verification || {};

  const row: UserVerificationRow = {
    uid: docSnap.id,
    handle: d.handle,
    name: d.name,
    email: d.email,
    phone: d.phone,
    status: (v.status as VerificationStatus) || "none",
    verificationType: (v.verificationType as VerificationType) || "individual",
    roleLabel: v.roleLabel || "",
    notes: v.notes || "",
    evidenceUrls: Array.isArray(v.evidenceUrls) ? v.evidenceUrls : [],
    requestedAt: v.requestedAt,
    reviewedAt: v.reviewedAt,
    reviewerId: v.reviewerId ?? null,
    rejectionReason: v.rejectionReason ?? null,
    paystackReference: v.paystackReference ?? null,
    // ⭐ KYC images
    nationalIdFrontUrl: v.nationalIdFrontUrl ?? null,
    nationalIdBackUrl: v.nationalIdBackUrl ?? null,
    selfieUrl: v.selfieUrl ?? null,
    // ⭐ business/company data
    organizationName: v.organizationName ?? null,
  };

  return row;
}

export default function AdminVerificationPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [rows, setRows] = useState<UserVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyActionUid, setBusyActionUid] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  // ⭐ Verified lookup states
  const [lookupTerm, setLookupTerm] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupRow, setLookupRow] = useState<UserVerificationRow | null>(null);

  // ⭐ Global Confirm + Feedback modals
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  } | null>(null);

  const [feedbackModal, setFeedbackModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  // ---- Check admin claim ----
  useEffect(() => {
    let cancelled = false;
    async function checkAdmin() {
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult();
        const admin = !!(tokenResult.claims as any)?.admin;
        if (!cancelled) {
          setIsAdmin(admin);
          setCheckingAdmin(false);
        }
      } catch (err) {
        console.warn("Failed to read admin claim:", err);
        if (!cancelled) {
          setIsAdmin(false);
          setCheckingAdmin(false);
        }
      }
    }
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ---- Subscribe to pending verification requests ----
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    const ref = collection(db, "users");

    // Only users with verification.status == "pending"
    const q = query(
      ref,
      where("verification.status", "==", "pending"),
      orderBy("verification.requestedAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const next: UserVerificationRow[] = [];
        snap.forEach((docSnap) => {
          next.push(buildRowFromDoc(docSnap));
        });
        setRows(next);
        setLoading(false);

        if (next.length > 0 && !next.find((r) => r.uid === selectedUid)) {
          setSelectedUid(next[0].uid);
          setRejectReason("");
        }
        if (next.length === 0) {
          setSelectedUid(null);
          setRejectReason("");
        }
      },
      (err) => {
        console.error("Error loading verification requests", err);
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const selectedRow = useMemo(
    () => rows.find((r) => r.uid === selectedUid) || null,
    [rows, selectedUid]
  );

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;

    const q = search.toLowerCase();
    return rows.filter((r) => {
      const fields = [
        r.handle || "",
        r.name || "",
        r.email || "",
        r.roleLabel || "",
        r.notes || "",
        r.organizationName || "",
        getVerificationTypeLabel(r.verificationType),
      ];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [rows, search]);

  // ⭐ Active row in the detail panel:
  //    - if we have a lookupRow (verified lookup), show that
  //    - otherwise show selected pending request
  const activeRow = lookupRow || selectedRow;
  const activeIsVerifiedLookup = !!lookupRow;

  const activeStatus = activeRow?.status;
  const isPendingActive = activeStatus === "pending";
  const isApprovedActive = activeStatus === "approved";

  // ---------- helpers to open modals ----------
  const openFeedback = (title: string, message: string) => {
    setFeedbackModal({ title, message });
  };

  const openConfirm = (cfg: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }) => {
    setConfirmConfig(cfg);
  };

  // ---- Core async actions (without confirms) ----
  const runApprove = async (row: UserVerificationRow) => {
    if (!user || !isAdmin) return;
    setBusyActionUid(row.uid);
    try {
      const ref = doc(db, "users", row.uid);
      await updateDoc(ref, {
        "verification.status": "approved",
        "verification.reviewedAt": serverTimestamp(),
        "verification.reviewerId": user.uid,
        "verification.rejectionReason": null,
      });
      setRejectReason("");

      // If this row was a lookup row, refresh its local status
      if (lookupRow && lookupRow.uid === row.uid) {
        setLookupRow({ ...lookupRow, status: "approved", rejectionReason: null });
      }
    } catch (err: any) {
      console.error("Approve failed", err);
      openFeedback("Approve failed", err?.message || "Failed to approve verification.");
    } finally {
      setBusyActionUid(null);
    }
  };

  const runReject = async (row: UserVerificationRow, reason: string) => {
    if (!user || !isAdmin) return;
    setBusyActionUid(row.uid);
    try {
      const ref = doc(db, "users", row.uid);
      await updateDoc(ref, {
        "verification.status": "rejected",
        "verification.reviewedAt": serverTimestamp(),
        "verification.reviewerId": user.uid,
        "verification.rejectionReason": reason,
      });
      setRejectReason("");

      if (lookupRow && lookupRow.uid === row.uid) {
        setLookupRow({
          ...lookupRow,
          status: "rejected",
          rejectionReason: reason,
        });
      }
    } catch (err: any) {
      console.error("Reject failed", err);
      openFeedback("Reject failed", err?.message || "Failed to reject verification.");
    } finally {
      setBusyActionUid(null);
    }
  };

  const runRevoke = async (row: UserVerificationRow) => {
    if (!user || !isAdmin) return;
    setBusyActionUid(row.uid);
    try {
      const ref = doc(db, "users", row.uid);

      // 1) Delete all associated files from Storage (best-effort)
      const urlsToDelete: (string | null | undefined)[] = [
        row.nationalIdFrontUrl,
        row.nationalIdBackUrl,
        row.selfieUrl,
        ...(row.evidenceUrls || []),
      ];

      // Delete in parallel, but ignore individual failures
      await Promise.all(urlsToDelete.map((u) => deleteFileIfPossible(u)));

      // 2) Clear verification status + URLs in Firestore
      await updateDoc(ref, {
        "verification.status": "none",
        "verification.reviewedAt": serverTimestamp(),
        "verification.reviewerId": user.uid,
        "verification.rejectionReason": null,
        "verification.nationalIdFrontUrl": null,
        "verification.nationalIdBackUrl": null,
        "verification.selfieUrl": null,
        "verification.evidenceUrls": [],
      });

      // 3) Update local state for active lookup row if needed
      if (lookupRow && lookupRow.uid === row.uid) {
        setLookupRow({
          ...lookupRow,
          status: "none",
          nationalIdFrontUrl: null,
          nationalIdBackUrl: null,
          selfieUrl: null,
          evidenceUrls: [],
        });
      }

      openFeedback(
        "Verification revoked",
        "Verification was revoked and all stored KYC documents were deleted."
      );
    } catch (err: any) {
      console.error("Revoke failed", err);
      openFeedback("Revoke failed", err?.message || "Failed to revoke verification.");
    } finally {
      setBusyActionUid(null);
    }
  };

  // ---- Approve (with ConfirmModal) ----
  const handleApprove = (row: UserVerificationRow) => {
    if (!user || !isAdmin) return;

    const label = row.handle || row.name || row.uid;
    const missing: string[] = [];
    if (!row.nationalIdFrontUrl) missing.push("ID front");
    if (!row.nationalIdBackUrl) missing.push("ID back");
    if (!row.selfieUrl) missing.push("selfie");

    const missingText =
      missing.length > 0
        ? `\n\nMissing: ${missing.join(
          ", "
        )}.\nYou can still approve, but please confirm you are comfortable with this.`
        : "";

    openConfirm({
      title: "Approve verification",
      message: `Approve verification for ${label}?${missingText}`,
      confirmText: "Approve",
      cancelText: "Cancel",
      onConfirm: () => {
        setConfirmConfig(null);
        void runApprove(row);
      },
    });
  };

  // ---- Reject (with ConfirmModal) ----
  const handleReject = (row: UserVerificationRow) => {
    if (!user || !isAdmin) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      openFeedback(
        "Rejection reason required",
        "Please provide a short rejection reason for the member before rejecting."
      );
      return;
    }

    const label = row.handle || row.name || row.uid;
    openConfirm({
      title: "Reject verification",
      message: `Reject verification for ${label}?\n\nReason:\n${trimmed}`,
      confirmText: "Reject",
      cancelText: "Cancel",
      onConfirm: () => {
        setConfirmConfig(null);
        void runReject(row, trimmed);
      },
    });
  };

  // ⭐ Revoke verification (for approved users) with ConfirmModal
  const handleRevoke = (row: UserVerificationRow) => {
    if (!user || !isAdmin) return;
    const label = row.handle || row.name || row.uid;

    openConfirm({
      title: "Revoke verification",
      message:
        `Revoke verification for ${label}?\n\n` +
        "This will remove their verified badge and delete all stored KYC documents.",
      confirmText: "Revoke",
      cancelText: "Cancel",
      onConfirm: () => {
        setConfirmConfig(null);
        void runRevoke(row);
      },
    });
  };

  async function deleteFileIfPossible(url?: string | null) {
    if (!url) return;
    try {
      const storage = getStorage();
      // ref can accept a gs:// or https download URL
      const fileRef = sRef(storage, url);
      await deleteObject(fileRef);
    } catch (err) {
      console.warn("Failed to delete storage file:", url, err);
    }
  }

  // ⭐ Lookup verified user by handle OR email
  const handleLookupVerified = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLookupError(null);
    setLookupRow(null);

    const term = lookupTerm.trim();
    if (!term) {
      setLookupError("Enter a handle or email first.");
      return;
    }

    setLookupBusy(true);
    try {
      const usersCol = collection(db, "users");

      // 1) exact handle match
      let snap = await getDocs(query(usersCol, where("handle", "==", term)));

      // 2) if not found, try email match
      if (snap.empty) {
        snap = await getDocs(query(usersCol, where("email", "==", term)));
      }

      if (snap.empty) {
        setLookupError("No user found with that handle or email.");
        return;
      }

      const docSnap = snap.docs[0];
      const row = buildRowFromDoc(docSnap);

      if (row.status !== "approved") {
        setLookupError(
          `User found, but not currently verified (status: ${row.status || "none"}).`
        );
        setLookupRow(row); // still show their data if you want
        return;
      }

      // We have a verified user 🎉
      setLookupRow(row);
      setSelectedUid(null); // unselect any pending row
      setRejectReason("");
    } catch (err: any) {
      console.error("Lookup failed", err);
      setLookupError(err?.message || "Lookup failed. Try again.");
    } finally {
      setLookupBusy(false);
    }
  };

  // ---- Loading / access states ----
  if (checkingAdmin) {
    return (
      <div className="p-6 text-sm" style={{ color: EKARI.dim }}>
        Checking admin access…
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-10 rounded-3xl border bg-white/80 shadow-sm text-center">
        <IoAlertCircleOutline
          className="mx-auto mb-3"
          size={30}
          color="#dc2626"
        />
        <h1
          className="text-lg font-extrabold mb-1"
          style={{ color: EKARI.ink }}
        >
          Admin access required
        </h1>
        <p className="text-sm mb-4" style={{ color: EKARI.dim }}>
          You need an administrator account to review verification requests.
        </p>
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center justify-center rounded-full px-4 py-2.5 text-xs md:text-sm font-semibold bg-[#233F39] text-white hover:bg-[#1b312d]"
        >
          Go back home
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 md:gap-6">
        {/* Header */}
        <header className="flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1
                className="text-lg md:text-xl font-extrabold flex items-center gap-2"
                style={{ color: EKARI.ink }}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <IoShieldCheckmarkOutline className="text-emerald-700" />
                </span>
                Profile verification review
              </h1>
              <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
                Review identity images and documents submitted by members and
                approve or reject their verification (Individual, Business or
                Company). You can also look up a verified member and revoke
                their verification if needed.
              </p>
            </div>

            {/* Search within pending list */}
            <div className="mt-2 md:mt-0 flex items-center gap-3">
              <div className="relative">
                <IoSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="Filter pending by handle, name, email, org…"
                  className="pl-8 pr-3 py-1.5 rounded-full border text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* ⭐ Verified member lookup */}
          <div className="rounded-3xl border bg-white/90 px-3 py-3 md:px-4 md:py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
              <span className="font-semibold text-emerald-800">
                Quick lookup of verified member
              </span>{" "}
              – search by @handle or email to view their KYC documents again and
              revoke verification if necessary.
            </div>
            <form
              onSubmit={handleLookupVerified}
              className="flex flex-col sm:flex-row gap-2 sm:items-center"
            >
              <div className="relative flex-1 min-w-[220px]">
                <IoSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={16}
                />
                <input
                  type="text"
                  placeholder="e.g. @ekari_user or user@example.com"
                  className="pl-8 pr-3 py-1.5 rounded-full border text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  value={lookupTerm}
                  onChange={(e) => {
                    setLookupTerm(e.target.value);
                    setLookupError(null);
                    // if clearing search, also clear lookup row
                    if (!e.target.value.trim()) {
                      setLookupRow(null);
                    }
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={lookupBusy}
                className="inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs md:text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {lookupBusy ? "Searching…" : "Search verified"}
              </button>
            </form>
          </div>
          {lookupError && (
            <p className="text-xs text-rose-600 pl-1">{lookupError}</p>
          )}
        </header>

        {/* Main layout: left list, right detail */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.8fr)_minmax(0,2.2fr)]">
          {/* LEFT: list of pending requests */}
          <section
            className="rounded-3xl bg-white/80 border shadow-sm p-3 md:p-4 flex flex-col"
            style={{ borderColor: EKARI.hair }}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="text-xs md:text-sm font-semibold"
                style={{ color: EKARI.dim }}
              >
                Pending requests:{" "}
                <span className="font-bold text-emerald-700">
                  {rows.length}
                </span>
              </div>
            </div>

            {loading ? (
              <div
                className="py-10 text-center text-sm"
                style={{ color: EKARI.dim }}
              >
                Loading verification requests…
              </div>
            ) : filteredRows.length === 0 ? (
              <div
                className="py-10 text-center text-sm"
                style={{ color: EKARI.dim }}
              >
                No pending verification requests.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-gray-100 max-h-[540px] overflow-auto">
                {filteredRows.map((r) => {
                  const isSelected = !lookupRow && r.uid === selectedUid;
                  const requested = r.requestedAt?.toDate
                    ? r.requestedAt.toDate().toLocaleString()
                    : "";
                  const typeLabel = getVerificationTypeLabel(
                    r.verificationType
                  );
                  const isIndividual =
                    !r.verificationType || r.verificationType === "individual";

                  return (
                    <button
                      key={r.uid}
                      type="button"
                      onClick={() => {
                        setLookupRow(null); // if we click a pending request, clear lookup
                        setSelectedUid(r.uid);
                        setRejectReason("");
                      }}
                      className={[
                        "w-full text-left px-2 py-2.5 md:px-3 md:py-3 flex flex-col gap-1",
                        isSelected ? "bg-emerald-50" : "hover:bg-gray-50",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className="text-sm font-extrabold truncate"
                            style={{ color: EKARI.ink }}
                          >
                            {r.handle || r.name || r.email || r.uid}
                          </div>
                          {r.name && (
                            <div className="text-[11px] text-gray-500 truncate">
                              {r.name}
                            </div>
                          )}
                          {r.organizationName && !isIndividual && (
                            <div className="text-[11px] text-emerald-800 truncate">
                              Org: {r.organizationName}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-700 border"
                            style={{ borderColor: EKARI.hair }}
                          >
                            {typeLabel}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800"
                            title="Verification status"
                          >
                            <IoTimeOutline size={12} />
                            Pending
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {r.roleLabel && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800">
                            {r.roleLabel}
                          </span>
                        )}
                        {requested && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                            <IoTimeOutline size={11} />
                            {requested}
                          </span>
                        )}
                      </div>

                      {r.notes && (
                        <p className="mt-1 text-[11px] line-clamp-2 text-gray-600">
                          {r.notes}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT: detail of selected request OR looked-up verified member */}
          <section
            className="rounded-3xl bg-white/80 border shadow-sm p-3 md:p-4 flex flex-col"
            style={{ borderColor: EKARI.hair }}
          >
            {!activeRow ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-sm gap-2">
                <IoShieldCheckmarkOutline
                  className="text-gray-300"
                  size={32}
                />
                <p style={{ color: EKARI.dim }}>
                  Select a pending request on the left, or search for a verified
                  member above to view their documents.
                </p>
              </div>
            ) : (
              <>
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2
                        className="text-sm md:text-base font-extrabold truncate"
                        style={{ color: EKARI.ink }}
                      >
                        {activeRow.handle || activeRow.name || activeRow.uid}
                      </h2>

                      {/* Badge depending on status + source */}
                      {isPendingActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800">
                          <IoTimeOutline size={12} />
                          Pending review
                        </span>
                      )}
                      {isApprovedActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800">
                          <IoShieldCheckmarkOutline size={12} />
                          Verified member
                        </span>
                      )}
                      {!isPendingActive &&
                        !isApprovedActive &&
                        activeStatus && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-700">
                            Status: {activeStatus}
                          </span>
                        )}

                      {activeIsVerifiedLookup && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-indigo-50 text-indigo-700">
                          Lookup result
                        </span>
                      )}
                    </div>
                    {activeRow.email && (
                      <div className="text-[11px] text-gray-500 truncate">
                        {activeRow.email}
                      </div>
                    )}

                    {/* Type + organization */}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 border"
                        style={{
                          borderColor: EKARI.hair,
                          color: EKARI.ink,
                        }}
                      >
                        {getVerificationTypeLabel(
                          activeRow.verificationType
                        )}
                      </span>
                      {activeRow.organizationName &&
                        activeRow.verificationType !== "individual" && (
                          <span className="text-[11px] font-semibold text-emerald-800">
                            {activeRow.organizationName}
                          </span>
                        )}
                      {activeRow.roleLabel && (
                        <span className="text-[11px] font-semibold text-emerald-800">
                          Role: {activeRow.roleLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {activeRow.paystackReference && (
                    <div className="flex flex-col items-end gap-1 text-[11px] text-slate-600">
                      <span className="font-semibold flex items-center gap-1">
                        <IoInformationCircleOutline size={12} />
                        Paystack ref
                      </span>
                      <span className="font-mono break-all">
                        {activeRow.paystackReference}
                      </span>
                    </div>
                  )}
                </div>

                {/* ⭐ Identity images: ID front, ID back, selfie */}
                <div className="mb-4">
                  <h3
                    className="text-xs font-bold mb-2 flex items-center gap-1"
                    style={{ color: EKARI.ink }}
                  >
                    <IoIdCardOutline
                      className="text-gray-500"
                      size={14}
                    />
                    Identity images (required)
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* ID front */}
                    <div className="rounded-xl border bg-slate-50 p-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-700">
                          ID – front
                        </span>
                        {!activeRow.nationalIdFrontUrl && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-700">
                            <IoAlertCircleOutline size={11} />
                            Missing
                          </span>
                        )}
                      </div>
                      {activeRow.nationalIdFrontUrl ? (
                        <a
                          href={activeRow.nationalIdFrontUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border bg-white hover:opacity-90"
                          style={{ borderColor: EKARI.hair }}
                        >
                          <img
                            src={activeRow.nationalIdFrontUrl}
                            alt="National ID front"
                            className="w-full h-32 object-cover"
                          />
                        </a>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400 border border-dashed rounded-lg py-6">
                          No image
                        </div>
                      )}
                    </div>

                    {/* ID back */}
                    <div className="rounded-xl border bg-slate-50 p-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-700">
                          ID – back
                        </span>
                        {!activeRow.nationalIdBackUrl && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-700">
                            <IoAlertCircleOutline size={11} />
                            Missing
                          </span>
                        )}
                      </div>
                      {activeRow.nationalIdBackUrl ? (
                        <a
                          href={activeRow.nationalIdBackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border bg-white hover:opacity-90"
                          style={{ borderColor: EKARI.hair }}
                        >
                          <img
                            src={activeRow.nationalIdBackUrl}
                            alt="National ID back"
                            className="w-full h-32 object-cover"
                          />
                        </a>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400 border border-dashed rounded-lg py-6">
                          No image
                        </div>
                      )}
                    </div>

                    {/* Selfie */}
                    <div className="rounded-xl border bg-slate-50 p-2 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                          <IoCameraOutline size={13} />
                          Selfie
                        </span>
                        {!activeRow.selfieUrl && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-700">
                            <IoAlertCircleOutline size={11} />
                            Missing
                          </span>
                        )}
                      </div>
                      {activeRow.selfieUrl ? (
                        <a
                          href={activeRow.selfieUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center py-3"
                        >
                          <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-emerald-500 shadow-sm">
                            <img
                              src={activeRow.selfieUrl}
                              alt="Selfie"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        </a>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-[11px] text-slate-400 border border-dashed rounded-lg py-6">
                          No image
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Documents (certificates & licences) */}
                <div className="mb-4">
                  <h3
                    className="text-xs font-bold mb-2 flex items-center gap-1"
                    style={{ color: EKARI.ink }}
                  >
                    <IoDocumentTextOutline
                      className="text-gray-500"
                      size={14}
                    />
                    Submitted documents (certificates & licences)
                  </h3>

                  {activeRow.evidenceUrls &&
                    activeRow.evidenceUrls.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-auto pr-1">
                      {activeRow.evidenceUrls.map((url, idx) => {
                        const isImg = isImageUrl(url);
                        if (isImg) {
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-3 rounded-xl border bg-slate-50 p-2"
                              style={{ borderColor: EKARI.hair }}
                            >
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block h-14 w-20 rounded-lg overflow-hidden border bg-white hover:opacity-90"
                                style={{ borderColor: EKARI.hair }}
                              >
                                <img
                                  src={url}
                                  alt={`Document image ${idx + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              </a>
                              <div className="flex-1">
                                <div className="text-[11px] font-semibold text-slate-700">
                                  Image document {idx + 1}
                                </div>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-emerald-700 underline break-all"
                                >
                                  Open full image
                                </a>
                              </div>
                            </div>
                          );
                        }

                        // Non-image: PDF or other type
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2 rounded-xl border bg-slate-50 px-2 py-2"
                            style={{ borderColor: EKARI.hair }}
                          >
                            <span className="inline-block h-6 w-6 rounded bg-emerald-50 grid place-items-center">
                              <IoDocumentTextOutline
                                size={12}
                                className="text-emerald-700"
                              />
                            </span>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-emerald-700 underline break-all"
                            >
                              Document {idx + 1}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-500">
                      No extra documents uploaded for this request.
                    </p>
                  )}
                </div>

                {/* Notes */}
                {activeRow.notes && (
                  <div className="mb-4">
                    <h3
                      className="text-xs font-bold mb-1"
                      style={{ color: EKARI.ink }}
                    >
                      Member notes
                    </h3>
                    <p className="text-[12px] text-gray-700 whitespace-pre-wrap">
                      {activeRow.notes}
                    </p>
                  </div>
                )}

                {/* Reject reason input – only relevant when we can reject (pending) */}
                {isPendingActive && (
                  <div className="mb-4">
                    <h3
                      className="text-xs font-bold mb-1 flex items-center gap-1"
                      style={{ color: EKARI.ink }}
                    >
                      <IoCloseCircleOutline
                        className="text-rose-500"
                        size={14}
                      />
                      Rejection reason (optional, but required when rejecting)
                    </h3>
                    <textarea
                      className="w-full rounded-xl border px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                      rows={3}
                      style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                      placeholder="Short explanation that will be visible to the member, e.g. 'ID photo not clear', 'Selfie missing', 'Certificate expired', etc."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                )}

                {/* Action buttons */}
                <div
                  className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3"
                  style={{ borderColor: EKARI.hair }}
                >
                  {/* Pending: Reject + Approve */}
                  {isPendingActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => activeRow && handleReject(activeRow)}
                        disabled={busyActionUid === activeRow.uid}
                        className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {busyActionUid === activeRow.uid ? (
                          "Working…"
                        ) : (
                          <>
                            <IoCloseCircleOutline size={14} />
                            Reject
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => activeRow && handleApprove(activeRow)}
                        disabled={busyActionUid === activeRow.uid}
                        className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"
                      >
                        {busyActionUid === activeRow.uid ? (
                          "Working…"
                        ) : (
                          <>
                            <IoCheckmarkCircleOutline size={14} />
                            Approve & mark verified
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {/* Approved: Revoke button */}
                  {isApprovedActive && (
                    <button
                      type="button"
                      onClick={() => activeRow && handleRevoke(activeRow)}
                      disabled={busyActionUid === activeRow.uid}
                      className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-60"
                    >
                      {busyActionUid === activeRow.uid ? (
                        "Working…"
                      ) : (
                        <>
                          <IoCloseCircleOutline size={14} />
                          Revoke verification
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* 🔹 Confirm modal (approve / reject / revoke) */}
      <ConfirmModal
        open={!!confirmConfig}
        title={confirmConfig?.title || ""}
        message={confirmConfig?.message || ""}
        confirmText={confirmConfig?.confirmText || "Confirm"}
        cancelText={confirmConfig?.cancelText || "Cancel"}
        onConfirm={() => {
          if (confirmConfig?.onConfirm) {
            confirmConfig.onConfirm();
          } else {
            setConfirmConfig(null);
          }
        }}
        onCancel={() => setConfirmConfig(null)}
      />

      {/* 🔹 Feedback / info modal (validation + errors + success) */}
      <ConfirmModal
        open={!!feedbackModal}
        title={feedbackModal?.title || ""}
        message={feedbackModal?.message || ""}
        confirmText="OK"
        cancelText="Close"
        onConfirm={() => setFeedbackModal(null)}
        onCancel={() => setFeedbackModal(null)}
      />
    </>
  );
}
