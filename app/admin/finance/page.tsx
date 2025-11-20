// app/admin/finance/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
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
  minWithdrawKES?: number; // in KSh (major units)
  updatedAt?: any;
};

export default function AdminFinancePage() {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [inputValue, setInputValue] = useState<string>("500");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Subscribe to adminSettings/finance
  useEffect(() => {
    const ref = doc(db, "adminSettings", "finance");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as FinanceSettings) || {};
        setSettings(data);
        if (data.minWithdrawKES != null) {
          setInputValue(String(data.minWithdrawKES));
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

  const currentMin = settings?.minWithdrawKES ?? 500;

  const handleSave = async (evt: React.FormEvent) => {
    evt.preventDefault();
    if (saving) return;

    const parsed = parseInt(inputValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      alert("Please enter a valid non-negative number.");
      return;
    }

    try {
      setSaving(true);

      const ref = doc(db, "adminSettings", "finance");
      await setDoc(
        ref,
        {
          minWithdrawKES: parsed,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // onSnapshot will update UI
    } catch (err: any) {
      console.error("Error saving finance settings", err);
      alert(err?.message || "Unable to save finance settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="space-y-4"
    >
      {/* Header */}
      <header>
        <h1
          className="text-lg md:text-xl font-extrabold"
          style={{ color: EKARI.ink }}
        >
          Finance & payouts
        </h1>
        <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
          Configure platform-wide payout thresholds for creator wallets.
        </p>
      </header>

      {/* Payout settings card */}
      <section
        className="rounded-3xl bg-white/80 p-4 md:p-5 shadow-sm border"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4">
          <div className="flex-1">
            <h2
              className="text-sm md:text-base font-bold"
              style={{ color: EKARI.ink }}
            >
              Payout threshold
            </h2>
            <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
              Creators can request withdrawals once their pending balance
              reaches this minimum amount.
            </p>
            {loaded && (
              <p className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                Current effective minimum:{" "}
                <span className="font-semibold text-emerald-700">
                  KSh {currentMin}
                </span>
              </p>
            )}
          </div>

          <form
            onSubmit={handleSave}
            className="w-full max-w-xs space-y-2"
          >
            <label className="block text-xs font-semibold mb-1" style={{ color: EKARI.dim }}>
              Minimum withdrawal (KSh)
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              style={{ borderColor: EKARI.hair, color: EKARI.ink }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />

            <button
              type="submit"
              disabled={saving}
              className={[
                "mt-1 inline-flex items-center justify-center rounded-full px-4 py-2 text-xs md:text-sm font-semibold",
                "bg-[color:#233F39] text-white hover:bg-[#1b312d] disabled:opacity-60 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {saving ? "Saving…" : "Save settings"}
            </button>

            {!loaded && (
              <p className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                Loading current settings…
              </p>
            )}
          </form>
        </div>
      </section>
    </div>
  );
}
