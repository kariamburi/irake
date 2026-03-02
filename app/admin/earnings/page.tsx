// app/admin/earnings/page.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  documentId,
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

  // legacy / gateway-ish fields
  amount?: number; // minor units, old style
  currency?: string;
  creatorShare?: number; // minor units (old)
  platformShare?: number; // minor units (old)
  createdAt?: any;
  paidAt?: any;

  // canonical USD fields (from webhook)
  grossAmountUsdMinor?: number;
  creatorShareNetUsdMinor?: number;
  platformShareUsdMinor?: number;
  providerFeeUsdMinorEstimated?: number;
};

type CreatorWallet = {
  creatorId: string;
  totalReceivedMinorUsd: number;
  totalPlatformMinorUsd: number;
  donationsCount: number;
  lastDonationAt: any | null;
};

type UserLite = {
  id: string;
  handle?: string | null; // e.g "@skya"
  photoURL?: string | null;
  firstName?: string | null;
  surname?: string | null;
  isDeactivated?: boolean;
  isSuspended?: boolean;
};

function moneyMinorUsd(n: number) {
  const major = n / 100;
  return `USD ${major.toLocaleString("en-US", {
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

function handleSlug(handle?: string | null) {
  // Stored as "@skya" -> route should be "/skya"
  if (!handle) return "";
  return String(handle).replace(/^@+/, "").trim();
}

function initialsFrom(handle?: string | null, id?: string) {
  const base = handleSlug(handle) || (id ? id.slice(0, 2) : "U");
  return base.slice(0, 2).toUpperCase();
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function AdminEarningsPage() {
  const [donations, setDonations] = useState<DonationDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ user cache for creatorId -> user info
  const [usersById, setUsersById] = useState<Record<string, UserLite>>({});
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const base = query(
          collection(db, "donations"),
          where("status", "==", "succeeded"),
          orderBy("createdAt", "desc"),
          limit(200)
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
        console.error("AdminEarnings load error", err);
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

    let platformMinorUsd = 0;
    let totalCount = 0;

    for (const d of donations) {
      if (!d.creatorId) continue;

      const grossUsd =
        typeof d.grossAmountUsdMinor === "number"
          ? d.grossAmountUsdMinor
          : typeof d.amount === "number"
            ? d.amount
            : 0;

      if (grossUsd <= 0) continue;

      const creatorUsd =
        typeof d.creatorShareNetUsdMinor === "number"
          ? d.creatorShareNetUsdMinor
          : typeof d.creatorShare === "number"
            ? d.creatorShare
            : Math.round(grossUsd * 0.9);

      const platformUsd =
        typeof d.platformShareUsdMinor === "number"
          ? d.platformShareUsdMinor
          : typeof d.platformShare === "number"
            ? d.platformShare
            : grossUsd - creatorUsd;

      platformMinorUsd += platformUsd;
      totalCount++;

      const key = d.creatorId;
      const existing = byCreator.get(key);
      const lastTime = d.paidAt || d.createdAt || null;

      if (!existing) {
        byCreator.set(key, {
          creatorId: key,
          totalReceivedMinorUsd: creatorUsd,
          totalPlatformMinorUsd: platformUsd,
          donationsCount: 1,
          lastDonationAt: lastTime,
        });
      } else {
        existing.totalReceivedMinorUsd += creatorUsd;
        existing.totalPlatformMinorUsd += platformUsd;
        existing.donationsCount += 1;

        const prev = existing.lastDonationAt;
        if (
          !prev ||
          (lastTime &&
            lastTime?.toMillis &&
            prev?.toMillis &&
            lastTime.toMillis() > prev.toMillis())
        ) {
          existing.lastDonationAt = lastTime;
        }
      }
    }

    const creatorsArr = Array.from(byCreator.values()).sort(
      (a, b) => b.totalReceivedMinorUsd - a.totalReceivedMinorUsd
    );

    return {
      platformTotals: {
        platformMinorUsd,
        donationsCount: totalCount,
      },
      creators: creatorsArr,
    };
  }, [donations]);

  // ✅ Fetch user profiles for the top creators (avatar + handle)
  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      const top = creators.slice(0, 60); // load a bit more than visible rows
      const ids = Array.from(new Set(top.map((c) => c.creatorId).filter(Boolean)));

      // only fetch what we don't already have
      const missing = ids.filter((id) => !usersById[id]);

      if (missing.length === 0) return;

      setUsersLoading(true);
      try {
        const batches = chunk(missing, 10); // Firestore "in" supports up to 10
        const next: Record<string, UserLite> = {};

        for (const batch of batches) {
          const q = query(collection(db, "users"), where(documentId(), "in", batch));
          const snap = await getDocs(q);

          snap.docs.forEach((docSnap) => {
            const u = docSnap.data() as any;
            next[docSnap.id] = {
              id: docSnap.id,
              handle: u.handle ?? null,
              photoURL: u.photoURL ?? null,
              firstName: u.firstName ?? null,
              surname: u.surname ?? null,
              isDeactivated: !!u.isDeactivated,
              isSuspended: !!u.isSuspended,
            };
          });
        }

        if (!cancelled) {
          setUsersById((prev) => ({ ...prev, ...next }));
        }
      } catch (e) {
        console.error("AdminEarnings loadUsers error", e);
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    }

    loadUsers();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creators]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold" style={{ color: EKARI.text }}>
            Creator earnings (USD)
          </h1>
          <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
            Overview of tip-based uplifts. This view aggregates the last 200 successful uplifts into
            per-creator wallets, using canonical USD amounts from the Paystack webhook.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
        <div
          className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between bg-white"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="text-xs font-semibold text-gray-500 mb-1">Total succeeded uplifts (sample)</div>
          {loading ? (
            <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-extrabold" style={{ color: EKARI.text }}>
              {platformTotals.donationsCount.toLocaleString("en-US")}
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-500">Based on the last 200 successful uplifts.</div>
        </div>

        <div
          className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between bg-white"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="text-xs font-semibold text-gray-500 mb-1">Platform share (USD, approx.)</div>
          {loading ? (
            <div className="h-6 w-28 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div
              className="text-2xl font-extrabold flex items-center gap-2"
              style={{ color: EKARI.forest }}
            >
              <IoCashOutline />
              {platformTotals.platformMinorUsd > 0 ? moneyMinorUsd(platformTotals.platformMinorUsd) : "—"}
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-500">
            Uses canonical creator/platform shares when present; falls back to a 90/10 split for older
            uplifts.
          </div>
        </div>

        <div
          className="rounded-2xl border shadow-sm p-4 flex flex-col justify-between bg-white"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="text-xs font-semibold text-gray-500 mb-1">Active tipped creators (sample)</div>
          {loading ? (
            <div className="h-6 w-24 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-extrabold" style={{ color: EKARI.text }}>
              {creators.length.toLocaleString("en-US")}
            </div>
          )}
          <div className="mt-2 text-[11px] text-gray-500">Creators who have received at least one successful uplift.</div>
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
              <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                Top creators by earnings (USD)
              </h2>
              <p className="text-xs" style={{ color: EKARI.dim }}>
                Aggregated from the most recent successful uplifts in USD minor units.
                {usersLoading ? " (Loading creator profiles…)" : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="text-left px-4 py-2 font-semibold">Creator</th>
                <th className="text-left px-2 py-2 font-semibold">Earnings (USD)</th>
                <th className="text-left px-2 py-2 font-semibold">Platform (USD)</th>
                <th className="text-left px-2 py-2 font-semibold">Tips</th>
                <th className="text-left px-2 py-2 font-semibold">Last tip</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : creators.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                    No creator earnings yet.
                  </td>
                </tr>
              ) : (
                creators.slice(0, 30).map((c) => {
                  const u = usersById[c.creatorId];
                  const h = u?.handle || null;
                  const slug = handleSlug(h);
                  const href = slug ? `/${slug}` : null;
                  const initials = initialsFrom(h, c.creatorId);
                  const name =
                    (u?.firstName || u?.surname) ? `${u?.firstName || ""} ${u?.surname || ""}`.trim() : null;

                  const suspended = !!u?.isSuspended;
                  const deactivated = !!u?.isDeactivated;

                  return (
                    <tr
                      key={c.creatorId}
                      className="border-t text-gray-700 hover:bg-gray-50"
                      style={{ borderColor: EKARI.hair }}
                    >
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2 min-w-[220px]">
                          {/* Avatar */}
                          {href ? (
                            <Link href={href} className="shrink-0" title={h ?? c.creatorId}>
                              <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-[11px] font-extrabold text-slate-700">
                                {u?.photoURL ? (
                                  <Image
                                    src={u.photoURL}
                                    alt={h ?? c.creatorId}
                                    width={32}
                                    height={32}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>{initials}</span>
                                )}
                              </div>
                            </Link>
                          ) : (
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center text-[11px] font-extrabold text-slate-700">
                              <span>{initials}</span>
                            </div>
                          )}

                          {/* Handle + meta */}
                          <div className="min-w-0 flex flex-col">
                            {href && h ? (
                              <Link
                                href={href}
                                className="text-xs font-semibold text-emerald-700 hover:underline truncate"
                                title={h}
                              >
                                {h}
                              </Link>
                            ) : (
                              <div className="font-mono text-[11px] truncate" title={c.creatorId}>
                                {c.creatorId.slice(0, 12)}…
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              {name ? (
                                <span className="text-[11px] text-slate-500 truncate" title={name}>
                                  {name}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500 font-mono truncate" title={c.creatorId}>
                                  {c.creatorId.slice(0, 12)}…
                                </span>
                              )}

                              {(suspended || deactivated) && (
                                <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                  {suspended ? "Suspended" : "Deactivated"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-2 font-extrabold text-[11px]">
                        {c.totalReceivedMinorUsd > 0 ? moneyMinorUsd(c.totalReceivedMinorUsd) : "—"}
                      </td>

                      <td className="px-2 py-2 text-[11px] text-gray-500">
                        {c.totalPlatformMinorUsd > 0 ? moneyMinorUsd(c.totalPlatformMinorUsd) : "—"}
                      </td>

                      <td className="px-2 py-2 text-[11px] text-gray-500">
                        {c.donationsCount.toLocaleString("en-US")}
                      </td>

                      <td className="px-2 py-2 text-[11px] text-gray-500">
                        {fmtDate(c.lastDonationAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}