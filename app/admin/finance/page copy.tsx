// app/admin/finance/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  DocumentData,
} from "firebase/firestore";
import { db, app } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

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
  minWithdrawKES?: number;
  updatedAt?: any;
};

type WithdrawalStatus = "pending" | "approved" | "rejected";

type WithdrawalRequest = {
  id: string;
  creatorId: string;
  amount: number;
  currency: string;
  status: WithdrawalStatus;
  requestedAt?: any;
  processedAt?: any;
  processedBy?: string;
  payoutRef?: string | null;
};

export default function AdminFinancePage() {
  /* --- Finance Settings --- */
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [inputValue, setInputValue] = useState<string>("500");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  /* --- Withdraw Requests --- */
  const [items, setItems] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  /* Load settings */
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "adminSettings", "finance"),
      (snap) => {
        const data = snap.data() as FinanceSettings | undefined;
        setSettings(data || {});
        if (data?.minWithdrawKES != null) {
          setInputValue(String(data.minWithdrawKES));
        }
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return () => unsub();
  }, []);

  const currentMin = settings?.minWithdrawKES ?? 500;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < 0) {
      alert("Enter a valid number");
      return;
    }

    try {
      setSaving(true);
      await setDoc(
        doc(db, "adminSettings", "finance"),
        {
          minWithdrawKES: parsed,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } finally {
      setSaving(false);
    }
  };

  /* Load withdrawal requests */
  useEffect(() => {
    const q = query(
      collection(db, "withdrawalRequests"),
      orderBy("requestedAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DocumentData),
      })) as WithdrawalRequest[];
      setItems(rows);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleDecision = async (req: WithdrawalRequest, decision: "approve" | "reject") => {
    if (actionBusyId) return;

    if (!confirm(`Confirm ${decision.toUpperCase()} KSh ${(req.amount / 100).toFixed(2)}?`))
      return;

    try {
      setActionBusyId(req.id);

      const fn = httpsCallable(
        getFunctions(app, "us-central1"),
        "processWithdrawalRequest"
      );

      await fn({ requestId: req.id, decision });
    } catch (err) {
      alert("Error processing request");
      console.error(err);
    } finally {
      setActionBusyId(null);
    }
  };

  const formatDate = (v: any) =>
    v?.toDate ? v.toDate().toLocaleString() : typeof v === "string" ? v : "";

  return (
    <div className="space-y-6">
      {/* FINANCE SETTINGS */}
      <section className="rounded-3xl bg-white p-4 shadow-sm border" style={{ borderColor: EKARI.hair }}>
        <h2 className="text-lg font-bold mb-2" style={{ color: EKARI.ink }}>
          Payout threshold
        </h2>
        <p className="text-xs mb-2" style={{ color: EKARI.dim }}>
          Minimum balance creators must reach to request withdrawal.
        </p>

        <form onSubmit={handleSave} className="flex items-end gap-2">
          <div>
            <label className="text-xs font-semibold" style={{ color: EKARI.dim }}>
              Min withdrawal (KSh)
            </label>
            <input
              type="number"
              min={0}
              className="border rounded-xl px-3 py-2 text-sm"
              style={{ borderColor: EKARI.hair, color: EKARI.ink }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-semibold"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>

        {loaded && (
          <p className="text-xs mt-2" style={{ color: EKARI.dim }}>
            Current: <strong>KSh {currentMin}</strong>
          </p>
        )}
      </section>

      {/* WITHDRAWAL REQUESTS */}
      <section className="rounded-3xl bg-white p-4 shadow-sm border" style={{ borderColor: EKARI.hair }}>
        <h2 className="text-lg font-bold mb-3" style={{ color: EKARI.ink }}>
          Withdrawal approvals
        </h2>

        {loading ? (
          <p>Loading…</p>
        ) : items.length === 0 ? (
          <p>No pending requests</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: EKARI.hair }}>
                  <th className="py-2 text-left">Creator</th>
                  <th className="py-2 text-left">Amount</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Requested</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((req) => {
                  const isBusy = actionBusyId === req.id;
                  const amountMajor = req.amount / 100;

                  return (
                    <tr key={req.id} className="border-b" style={{ borderColor: EKARI.hair }}>
                      <td className="py-2">{req.creatorId}</td>
                      <td className="py-2">{req.currency} {amountMajor.toFixed(2)}</td>
                      <td className="py-2">{req.status}</td>
                      <td className="py-2">{formatDate(req.requestedAt)}</td>
                      <td className="py-2 text-right">
                        {req.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleDecision(req, "approve")}
                              disabled={isBusy}
                              className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs"
                            >
                              {isBusy ? "..." : "Approve"}
                            </button>
                            <button
                              onClick={() => handleDecision(req, "reject")}
                              disabled={isBusy}
                              className="px-3 py-1 rounded-full bg-red-600 text-white text-xs"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          "✓"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
