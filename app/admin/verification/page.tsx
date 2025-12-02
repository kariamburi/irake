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
} from "react-icons/io5";

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

type UserVerificationRow = {
  uid: string;
  handle?: string;
  name?: string;
  email?: string;
  phone?: string;
  // from verification subobject
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
          const d = docSnap.data() as any;
          const v = d.verification || {};

          const row: UserVerificationRow = {
            uid: docSnap.id,
            handle: d.handle,
            name: d.name,
            email: d.email,
            phone: d.phone,
            status: (v.status as VerificationStatus) || "pending",
            roleLabel: v.roleLabel || "",
            notes: v.notes || "",
            evidenceUrls: Array.isArray(v.evidenceUrls) ? v.evidenceUrls : [],
            requestedAt: v.requestedAt,
            reviewedAt: v.reviewedAt,
            reviewerId: v.reviewerId ?? null,
            rejectionReason: v.rejectionReason ?? null,
            paystackReference: v.paystackReference ?? null,
          };

          next.push(row);
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
      ];
      return fields.some((f) => f.toLowerCase().includes(q));
    });
  }, [rows, search]);

  // ---- Approve ----
  const handleApprove = async (row: UserVerificationRow) => {
    if (!user || !isAdmin) return;
    const label = row.handle || row.name || row.uid;
    const ok = window.confirm(`Approve verification for ${label}?`);
    if (!ok) return;

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
    } catch (err: any) {
      console.error("Approve failed", err);
      alert(err?.message || "Failed to approve verification.");
    } finally {
      setBusyActionUid(null);
    }
  };

  // ---- Reject ----
  const handleReject = async (row: UserVerificationRow) => {
    if (!user || !isAdmin) return;
    if (!rejectReason.trim()) {
      alert("Please provide a short rejection reason for the member.");
      return;
    }
    const label = row.handle || row.name || row.uid;
    const ok = window.confirm(`Reject verification for ${label}?`);
    if (!ok) return;

    setBusyActionUid(row.uid);
    try {
      const ref = doc(db, "users", row.uid);
      await updateDoc(ref, {
        "verification.status": "rejected",
        "verification.reviewedAt": serverTimestamp(),
        "verification.reviewerId": user.uid,
        "verification.rejectionReason": rejectReason.trim(),
      });
      setRejectReason("");
    } catch (err: any) {
      console.error("Reject failed", err);
      alert(err?.message || "Failed to reject verification.");
    } finally {
      setBusyActionUid(null);
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
        <IoAlertCircleOutline className="mx-auto mb-3" size={30} color="#dc2626" />
        <h1 className="text-lg font-extrabold mb-1" style={{ color: EKARI.ink }}>
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
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Header */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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
            Review documents submitted by members (vets, agronomists, trainers, etc.)
            and approve or reject their profile verification.
          </p>
        </div>

        <div className="mt-2 md:mt-0 flex items-center gap-3">
          <div className="relative">
            <IoSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by handle, name, email…"
              className="pl-8 pr-3 py-1.5 rounded-full border text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              style={{ borderColor: EKARI.hair, color: EKARI.ink }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Main layout: left list, right detail */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.8fr)_minmax(0,2.2fr)]">
        {/* LEFT: list of requests */}
        <section
          className="rounded-3xl bg-white/80 border shadow-sm p-3 md:p-4 flex flex-col"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs md:text-sm font-semibold" style={{ color: EKARI.dim }}>
              Pending requests:{" "}
              <span className="font-bold text-emerald-700">
                {rows.length}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm" style={{ color: EKARI.dim }}>
              Loading verification requests…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: EKARI.dim }}>
              No pending verification requests.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100 max-h-[540px] overflow-auto">
              {filteredRows.map((r) => {
                const isSelected = r.uid === selectedUid;
                const requested = r.requestedAt?.toDate
                  ? r.requestedAt.toDate().toLocaleString()
                  : "";

                return (
                  <button
                    key={r.uid}
                    type="button"
                    onClick={() => {
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
                      </div>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800"
                        title="Verification status"
                      >
                        <IoTimeOutline size={12} />
                        Pending
                      </span>
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

        {/* RIGHT: detail of selected request */}
        <section
          className="rounded-3xl bg-white/80 border shadow-sm p-3 md:p-4 flex flex-col"
          style={{ borderColor: EKARI.hair }}
        >
          {!selectedRow ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-sm gap-2">
              <IoShieldCheckmarkOutline className="text-gray-300" size={32} />
              <p style={{ color: EKARI.dim }}>
                Select a request on the left to review documents and approve or reject.
              </p>
            </div>
          ) : (
            <>
              {/* Header info */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2
                      className="text-sm md:text-base font-extrabold truncate"
                      style={{ color: EKARI.ink }}
                    >
                      {selectedRow.handle || selectedRow.name || selectedRow.uid}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800">
                      <IoTimeOutline size={12} />
                      Pending review
                    </span>
                  </div>
                  {selectedRow.email && (
                    <div className="text-[11px] text-gray-500 truncate">
                      {selectedRow.email}
                    </div>
                  )}
                  {selectedRow.roleLabel && (
                    <div className="mt-1 text-[12px] font-semibold text-emerald-800">
                      Role: {selectedRow.roleLabel}
                    </div>
                  )}
                </div>

                {selectedRow.paystackReference && (
                  <div className="flex flex-col items-end gap-1 text-[11px] text-slate-600">
                    <span className="font-semibold flex items-center gap-1">
                      <IoInformationCircleOutline size={12} />
                      Paystack ref
                    </span>
                    <span className="font-mono break-all">
                      {selectedRow.paystackReference}
                    </span>
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="mb-4">
                <h3
                  className="text-xs font-bold mb-2 flex items-center gap-1"
                  style={{ color: EKARI.ink }}
                >
                  <IoDocumentTextOutline className="text-gray-500" size={14} />
                  Submitted documents
                </h3>

                {selectedRow.evidenceUrls && selectedRow.evidenceUrls.length > 0 ? (
                  <ul className="space-y-1.5 max-h-40 overflow-auto pr-1">
                    {selectedRow.evidenceUrls.map((url, idx) => (
                      <li key={idx}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline break-all"
                        >
                          <span className="inline-block h-4 w-4 rounded bg-emerald-50 grid place-items-center">
                            <IoDocumentTextOutline size={10} />
                          </span>
                          <span>Document {idx + 1}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    No documents uploaded for this request.
                  </p>
                )}
              </div>

              {/* Notes */}
              {selectedRow.notes && (
                <div className="mb-4">
                  <h3
                    className="text-xs font-bold mb-1"
                    style={{ color: EKARI.ink }}
                  >
                    Member notes
                  </h3>
                  <p className="text-[12px] text-gray-700 whitespace-pre-wrap">
                    {selectedRow.notes}
                  </p>
                </div>
              )}

              {/* Reject reason input */}
              <div className="mb-4">
                <h3
                  className="text-xs font-bold mb-1 flex items-center gap-1"
                  style={{ color: EKARI.ink }}
                >
                  <IoCloseCircleOutline className="text-rose-500" size={14} />
                  Rejection reason (optional, but required when rejecting)
                </h3>
                <textarea
                  className="w-full rounded-xl border px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  rows={3}
                  style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                  placeholder="Short explanation that will be visible to the member, e.g. 'Certificate expired', 'Name mismatch on license', etc."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>

              {/* Action buttons */}
              <div
                className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t pt-3"
                style={{ borderColor: EKARI.hair }}
              >
                <button
                  type="button"
                  onClick={() => selectedRow && handleReject(selectedRow)}
                  disabled={busyActionUid === selectedRow.uid}
                  className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-60"
                >
                  {busyActionUid === selectedRow.uid ? (
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
                  onClick={() => selectedRow && handleApprove(selectedRow)}
                  disabled={busyActionUid === selectedRow.uid}
                  className="inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-[12px] font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  {busyActionUid === selectedRow.uid ? (
                    "Working…"
                  ) : (
                    <>
                      <IoCheckmarkCircleOutline size={14} />
                      Approve & mark verified
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
