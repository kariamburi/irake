// app/admin/wallets/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { IoCashOutline } from "react-icons/io5";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
};

type DonationDoc = {
  id: string;
  deedId?: string;
  creatorId?: string;
  donorId?: string;
  amount?: number; // minor units
  currency?: string;
  creatorShare?: number; // minor units
  platformShare?: number; // minor units
  status?: string;
  createdAt?: any;
};

type CreatorWallet = {
  creatorId: string;
  currency: string;
  totalReceivedMinor: number;
  totalPlatformMinor: number;
  donationsCount: number;
  lastDonationAt: any | null;
};

function moneyMinor(n: number, currency: string) {
  const major = n / 100;
  return `${currency} ${major.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(ts: any) {
  if (!ts) return "";
  if (ts.toDate) {
    const d = ts.toDate();
    return d.toLocaleString();
  }
  return String(ts);
}

export default function AdminWalletsPage() {
  const [donations, setDonations] = useState<DonationDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const base = query(
          collection(db, "donations"),
          where("status", "==", "succeeded"),
          orderBy("createdAt", "desc"),
          limit(200) // top 200 recent; adjust as needed
        );
        const snap = await getDocs(base);
        if (cancelled) return;
        setDonations(
          snap.docs.map(
            (d) =>
            ({
              id: d.id,
              ...(d.data() as any),
            } as DonationDoc)
          )
        );
      } catch (err) {
        console.error("AdminWallets load error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { platformTotals, creators } = useMemo(() => {
    const byCreator = new Map<string, CreatorWallet>();
    let platformMinor = 0;
    let platformCurrency = "KES"; // default; overridden by first record
    let totalCount = 0;

    for (const d of donations) {
      if (!d.creatorId || !d.amount) continue;
      const currency = (d.currency || "KES").toUpperCase();
      const creatorShare = Number(d.creatorShare ?? Math.round(d.amount * 0.9));
      const platformShare = Number(d.platformShare ?? d.amount - creatorShare);

      // global platform
      platformMinor += platformShare;
      if (!platformCurrency && currency) platformCurrency = currency;
      totalCount++;

      // per creator
      const key = d.creatorId;
      const existing = byCreator.get(key);
      if (!existing) {
        byCreator.set(key, {
          creatorId: key,
          currency,
          totalReceivedMinor: creatorShare,
          totalPlatformMinor: platformShare,
          donationsCount: 1,
          lastDonationAt: d.createdAt ?? null,
        });
      } else {
        existing.totalReceivedMinor += creatorShare;
        existing.totalPlatformMinor += platformShare;
        existing.donationsCount += 1;
        if (
          !existing.lastDonationAt ||
          (d.createdAt &&
            d.createdAt?.toMillis &&
            existing.lastDonationAt?.toMillis &&
            d.createdAt.toMillis() > existing.lastDonationAt.toMillis())
        ) {
          existing.lastDonationAt = d.createdAt ?? existing.lastDonationAt;
        }
      }
    }

    const creatorsArr = Array.from(byCreator.values()).sort(
      (a, b) => b.totalReceivedMinor - a.totalReceivedMinor
    );

    return {
      platformTotals: {
        currency: platformCurrency,
        platformMinor,
        donationsCount: totalCount,
      },
      creators: creatorsArr,
    };
  }, [donations]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1
            className="text-2xl md:text-3xl font-extrabold"
            style={{ color: EKARI.text }}
          >
            Creator earnings
          </h1>
          <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
            Overview of tip-based donations. This view aggregates the last 200
            successful donations into per-creator “wallets” and shows ekarihub&apos;s
            platform share.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
        <div
          className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between bg-white"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="text-xs font-semibold text-gray-500 mb-1">
            Total succeeded donations (sample)
          </div>
          {loading ? (
            <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div
              className="text-2xl font-extrabold"
              style={{ color: EKARI.text }}
            >
              {platformTotals.donationsCount.toLocaleString("en-KE")}
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-500">
            Based on the last 200 successful donations.
          </div>
        </div>

        <div
          className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between bg-white"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="text-xs font-semibold text-gray-500 mb-1">
            Platform share (approx.)
          </div>
          {loading ? (
            <div className="h-6 w-28 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ color: EKARI.forest }}
            >
              <IoCashOutline />
              {platformTotals.platformMinor > 0
                ? moneyMinor(
                  platformTotals.platformMinor,
                  platformTotals.currency || "KES"
                )
                : "—"}
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-500">
            Using creatorShare / platformShare fields where present; falling back
            to 90/10 split.
          </div>
        </div>

        <div
          className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between bg-white"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="text-xs font-semibold text-gray-500 mb-1">
            Active tipped creators (sample)
          </div>
          {loading ? (
            <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div
              className="text-2xl font-extrabold"
              style={{ color: EKARI.text }}
            >
              {creators.length.toLocaleString("en-KE")}
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-500">
            Creators who have received at least one successful donation.
          </div>
        </div>
      </div>

      {/* Top creators table */}
      <div
        className="rounded-2xl border shadow-sm bg-white overflow-hidden"
        style={{ borderColor: EKARI.hair }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: EKARI.hair }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2
                className="text-sm font-extrabold"
                style={{ color: EKARI.text }}
              >
                Top creators by earnings
              </h2>
              <p className="text-xs" style={{ color: EKARI.dim }}>
                Aggregated from the most recent successful donations.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-4 py-2 font-semibold">Creator</th>
                <th className="text-left px-2 py-2 font-semibold">Earnings</th>
                <th className="text-left px-2 py-2 font-semibold">Platform</th>
                <th className="text-left px-2 py-2 font-semibold">Tips</th>
                <th className="text-left px-2 py-2 font-semibold">Last tip</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    Loading…
                  </td>
                </tr>
              ) : creators.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    No creator earnings yet.
                  </td>
                </tr>
              ) : (
                creators.slice(0, 30).map((c) => (
                  <tr
                    key={c.creatorId}
                    className="border-t text-gray-700 hover:bg-gray-50"
                    style={{ borderColor: EKARI.hair }}
                  >
                    <td className="px-4 py-2">
                      <div className="font-mono text-[11px]">
                        {c.creatorId.slice(0, 12)}…
                      </div>
                    </td>
                    <td className="px-2 py-2 font-extrabold text-[11px]">
                      {c.totalReceivedMinor > 0
                        ? moneyMinor(c.totalReceivedMinor, c.currency)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-gray-500">
                      {c.totalPlatformMinor > 0
                        ? moneyMinor(c.totalPlatformMinor, c.currency)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-gray-500">
                      {c.donationsCount.toLocaleString("en-KE")}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-gray-500">
                      {fmtDate(c.lastDonationAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
