// app/admin/wallets/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  DocumentData,
  doc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "@/lib/firebase";
import Link from "next/link";
import Image from "next/image";
import { ConfirmModal } from "@/app/components/ConfirmModal"; // 🔹 Global modal

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  ink: "#111827",
  dim: "#6B7280",
  hair: "#E5E7EB",
  bgSoft: "#F3F4F6",
};

type WithdrawalStatus = "pending" | "approved" | "rejected";

type WithdrawalRequest = {
  id: string;
  creatorId: string;
  amount: number; // minor units
  currency: string;
  status: WithdrawalStatus;
  requestedAt?: any;
  processedAt?: any;
  processedBy?: string;
  payoutRef?: string | null;
  payoutMethod?: "mpesa" | "bank" | "manual" | null;
  mpesaReceiptCode?: string | null;
  note?: string | null;
};

type CreatorLite = {
  handle?: string | null;
  photoURL?: string | null;
};

function formatDate(v: any) {
  if (!v) return "";
  if (v.toDate) {
    return v.toDate().toLocaleString();
  }
  if (typeof v === "string") return v;
  return "";
}

/** Small hook to load creator handle + avatar for each row */
function useCreatorProfile(creatorId?: string): CreatorLite | null {
  const [profile, setProfile] = useState<CreatorLite | null>(null);

  useEffect(() => {
    if (!creatorId) {
      setProfile(null);
      return;
    }
    const ref = doc(db, "users", creatorId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as any | undefined;
        if (!data) {
          setProfile(null);
          return;
        }
        setProfile({
          handle: data.handle ?? null,
          photoURL: data.photoURL ?? null,
        });
      },
      () => setProfile(null)
    );
    return () => unsub();
  }, [creatorId]);

  return profile;
}

export default function AdminWalletsPage() {
  const [items, setItems] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // filters/search
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [search, setSearch] = useState("");

  // 🔹 Global confirm + feedback modals
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

  const openFeedback = (title: string, message: string) => {
    setFeedbackModal({ title, message });
  };

  useEffect(() => {
    const q = query(
      collection(db, "withdrawalRequests"),
      orderBy("requestedAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: WithdrawalRequest[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as DocumentData),
        })) as any;
        setItems(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading withdrawalRequests", err);
        setItems([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((req) => {
      if (statusFilter !== "all" && req.status !== statusFilter) return false;

      if (!q) return true;

      const haystack =
        (req.creatorId || "").toLowerCase() +
        " " +
        (req.id || "").toLowerCase() +
        " " +
        (req.payoutRef || "").toLowerCase();

      return haystack.includes(q);
    });
  }, [items, statusFilter, search]);

  // 🔹 Core processing (no alerts/confirm here)
  const processDecision = async (
    req: WithdrawalRequest,
    decision: "approve" | "reject"
  ) => {
    if (actionBusyId) return;

    // Optional extra info: MPesa receipt code / reason
    let payoutRef: string | undefined;
    let note: string | undefined;
    let payoutMethod: "mpesa" | "manual" | undefined;

    if (decision === "approve") {
      payoutMethod = "mpesa";
      // still using prompt for free-text input (not a simple alert)
      const refInput = window.prompt(
        "Optionally enter the M-Pesa receipt or bank reference code (you can leave this blank and fill later):"
      );
      if (refInput && refInput.trim()) {
        payoutRef = refInput.trim();
      }
    } else {
      const reason = window.prompt(
        "Optionally enter a short reason for rejecting this withdrawal (will be visible in logs / email):"
      );
      if (reason && reason.trim()) {
        note = reason.trim();
      }
    }

    try {
      setActionBusyId(`${req.id}:${decision}`);

      const functions = getFunctions(app, "us-central1");
      const processWithdrawalRequest = httpsCallable<
        {
          requestId: string;
          decision: "approve" | "reject";
          payoutMethod?: "mpesa" | "manual";
          payoutRef?: string;
          note?: string;
        },
        { ok: boolean }
      >(functions, "processWithdrawalRequest");

      await processWithdrawalRequest({
        requestId: req.id,
        decision,
        payoutMethod,
        payoutRef,
        note,
      });

      // onSnapshot will update table automatically
    } catch (err: any) {
      console.error("processWithdrawalRequest error", err);
      openFeedback(
        "Unable to process withdrawal",
        err?.message ||
        "Unable to process this withdrawal. Please check logs and try again."
      );
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDecision = async (
    req: WithdrawalRequest,
    decision: "approve" | "reject"
  ) => {
    if (actionBusyId) return;

    const amountMajor = req.amount / 100;

    const confirmMessage =
      decision === "approve"
        ? `Approve withdrawal of KSh ${amountMajor.toFixed(
          2
        )} for creator ${req.creatorId}?\n\nMake sure you have already sent the M-Pesa / bank payout or are about to do so.`
        : `Reject withdrawal of KSh ${amountMajor.toFixed(
          2
        )} for creator ${req.creatorId}?\n\nThis will mark the request as rejected and notify the creator.`;

    setConfirmConfig({
      title: decision === "approve" ? "Approve withdrawal" : "Reject withdrawal",
      message: confirmMessage,
      confirmText: decision === "approve" ? "Approve" : "Reject",
      cancelText: "Cancel",
      onConfirm: () => {
        setConfirmConfig(null);
        void processDecision(req, decision);
      },
    });
  };

  return (
    <>
      <div
        className="rounded-3xl bg-white/80 p-4 md:p-5 shadow-sm border space-y-4"
        style={{ borderColor: EKARI.hair }}
      >
        {/* Header */}
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1
              className="text-lg md:text-xl font-extrabold"
              style={{ color: EKARI.ink }}
            >
              Creator withdrawals
            </h1>
            <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
              Review and approve withdrawal requests from creator wallets.
              Approved payouts should match M-Pesa / bank transfers you make.
            </p>
          </div>

          {/* Filters + search */}
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs">
              {(["pending", "approved", "rejected", "all"] as const).map(
                (s) => {
                  const active = statusFilter === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={[
                        "px-3 py-1 rounded-full font-semibold transition",
                        active
                          ? "bg-white shadow-sm"
                          : "text-slate-500 hover:bg-white/70",
                      ].join(" ")}
                      style={
                        active
                          ? { color: EKARI.ink }
                          : { color: "rgba(55,65,81,0.9)" }
                      }
                    >
                      {s === "all"
                        ? "All"
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  );
                }
              )}
            </div>

            <input
              type="text"
              placeholder="Search by creator UID, request ID, reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full md:w-64 rounded-full border px-3 py-1.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              style={{ borderColor: EKARI.hair, color: EKARI.ink }}
            />
          </div>
        </header>

        {/* Table / states */}
        {loading ? (
          <div className="flex items-center gap-2 py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-800 border-t-transparent" />
            <p className="text-xs" style={{ color: EKARI.dim }}>
              Loading withdrawal requests…
            </p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-5 py-6 text-center">
            <p
              className="mb-1 text-sm font-extrabold"
              style={{ color: EKARI.ink }}
            >
              No matching withdrawal requests
            </p>
            <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
              Try changing the status filter or search text.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: EKARI.hair }}>
                  <th className="py-2 pr-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                    Creator
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                    Amount
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                    Requested
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                    Payout ref / method
                  </th>
                  <th className="py-2 px-3 text-left font-semibold text-xs uppercase tracking-wide text-slate-500">
                    Processed
                  </th>
                  <th className="py-2 pl-3 text-right font-semibold text-xs uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((req) => {
                  const amountMajor = req.amount / 100;
                  const isPending = req.status === "pending";
                  const busyApprove = actionBusyId === `${req.id}:approve`;
                  const busyReject = actionBusyId === `${req.id}:reject`;

                  let statusColor = "#F97316"; // pending
                  let statusBg = "#FFEDD5";
                  if (req.status === "approved") {
                    statusColor = "#16A34A";
                    statusBg = "#DCFCE7";
                  }
                  if (req.status === "rejected") {
                    statusColor = "#DC2626";
                    statusBg = "#FEE2E2";
                  }

                  return (
                    <WithdrawalRow
                      key={req.id}
                      req={req}
                      amountMajor={amountMajor}
                      statusColor={statusColor}
                      statusBg={statusBg}
                      isPending={isPending}
                      busyApprove={busyApprove}
                      busyReject={busyReject}
                      handleDecision={handleDecision}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🔹 Confirm modal (approve / reject) */}
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

      {/* 🔹 Feedback / error modal */}
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

/** Row separated so we can use hooks inside (for creator profile). */
function WithdrawalRow(props: {
  req: WithdrawalRequest;
  amountMajor: number;
  statusColor: string;
  statusBg: string;
  isPending: boolean;
  busyApprove: boolean;
  busyReject: boolean;
  handleDecision: (
    req: WithdrawalRequest,
    decision: "approve" | "reject"
  ) => Promise<void> | void;
}) {
  const {
    req,
    amountMajor,
    statusColor,
    statusBg,
    isPending,
    busyApprove,
    busyReject,
    handleDecision,
  } = props;

  const creator = useCreatorProfile(req.creatorId);

  const displayHandle =
    creator?.handle && typeof creator.handle === "string"
      ? creator.handle
      : null;

  const initialId = req.creatorId?.slice(0, 6) || "creator";

  return (
    <tr
      className="border-b last:border-b-0"
      style={{ borderColor: EKARI.hair }}
    >
      <td className="py-2 pr-3 align-top">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
            {creator?.photoURL ? (
              <Image
                src={creator.photoURL}
                alt={displayHandle ?? initialId}
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initialId.toUpperCase()}</span>
            )}
          </div>
          <div className="flex flex-col">
            {displayHandle ? (
              <Link
                href={`/${displayHandle}`}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                {displayHandle}
              </Link>
            ) : (
              <span className="text-xs font-semibold text-slate-800">
                {initialId}…
              </span>
            )}
            <span
              className="text-[10px] text-slate-500"
              title={req.creatorId}
            >
              {req.creatorId.slice(0, 12)}…
            </span>
          </div>
        </div>
      </td>

      <td className="py-2 px-3 align-top">
        <span className="font-semibold" style={{ color: EKARI.ink }}>
          {req.currency || "KES"} {amountMajor.toFixed(2)}
        </span>
      </td>

      <td className="py-2 px-3 align-top">
        <span
          className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-semibold"
          style={{
            backgroundColor: statusBg,
            color: statusColor,
          }}
        >
          {req.status.toUpperCase()}
        </span>
      </td>

      <td className="py-2 px-3 align-top">
        <span className="text-xs" style={{ color: EKARI.dim }}>
          {formatDate(req.requestedAt)}
        </span>
      </td>

      <td className="py-2 px-3 align-top">
        <div className="flex flex-col gap-0.5">
          {req.payoutRef && (
            <span className="text-xs font-mono" style={{ color: EKARI.ink }}>
              {req.payoutRef}
            </span>
          )}
          {req.payoutMethod && (
            <span className="text-[10px] text-slate-500">
              Method: {req.payoutMethod.toUpperCase()}
            </span>
          )}
          {req.note && (
            <span className="text-[10px] text-slate-500">
              Note: {req.note}
            </span>
          )}
        </div>
      </td>

      <td className="py-2 px-3 align-top">
        {req.processedAt ? (
          <span className="text-xs" style={{ color: EKARI.dim }}>
            {formatDate(req.processedAt)}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>

      <td className="py-2 pl-3 align-top text-right">
        {isPending ? (
          <div className="inline-flex gap-2">
            <button
              type="button"
              disabled={busyApprove}
              onClick={() => handleDecision(req, "approve")}
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {busyApprove ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={busyReject}
              onClick={() => handleDecision(req, "reject")}
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {busyReject ? "Rejecting…" : "Reject"}
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">Processed</span>
        )}
      </td>
    </tr>
  );
}
