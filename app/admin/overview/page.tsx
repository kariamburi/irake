// app/admin/overview/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

type OverviewStats = {
    deeds: number;
    listings: number;
    events: number;
    discussions: number;
    donations: number;
};

type DeedRow = {
    id: string;
    caption?: string;
    authorId?: string;
    status?: string;
    createdAt?: any;
    visibility?: string;
};

type DonationRow = {
    id: string;
    deedId?: string;
    creatorId?: string;
    donorId?: string;
    amount?: number;
    currency?: string;
    status?: string;
    createdAt?: any;
};

function formatNumber(n: number) {
    return n.toLocaleString("en-KE");
}

function formatMoneyMinor(n?: number, currency?: string) {
    if (!n || n <= 0) return "—";
    const unit = n / 100;
    return `${currency || ""} ${unit.toLocaleString("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`.trim();
}

function formatDate(ts: any) {
    if (!ts) return "";
    if (ts.toDate) {
        const d = ts.toDate();
        return d.toLocaleString();
    }
    return String(ts);
}

export default function AdminOverviewPage() {
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [recentDeeds, setRecentDeeds] = useState<DeedRow[]>([]);
    const [recentDonations, setRecentDonations] = useState<DonationRow[]>([]);
    const [loadingTables, setLoadingTables] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadStats() {
            try {
                const [deedsSnap, listingsSnap, eventsSnap, discussionsSnap, donationsSnap] =
                    await Promise.all([
                        getCountFromServer(collection(db, "deeds")),
                        getCountFromServer(collection(db, "marketListings")),
                        getCountFromServer(collection(db, "events")),
                        getCountFromServer(collection(db, "discussions")),
                        getCountFromServer(collection(db, "donations")),
                    ]);

                if (cancelled) return;

                setStats({
                    deeds: deedsSnap.data().count,
                    listings: listingsSnap.data().count,
                    events: eventsSnap.data().count,
                    discussions: discussionsSnap.data().count,
                    donations: donationsSnap.data().count,
                });
            } catch (err) {
                console.error("Admin overview stats error", err);
            } finally {
                if (!cancelled) setLoadingStats(false);
            }
        }

        async function loadRecent() {
            try {
                const [deedsSnap, donationsSnap] = await Promise.all([
                    getDocs(
                        query(
                            collection(db, "deeds"),
                            orderBy("createdAt", "desc"),
                            limit(6)
                        )
                    ),
                    getDocs(
                        query(
                            collection(db, "donations"),
                            orderBy("createdAt", "desc"),
                            limit(6)
                        )
                    ),
                ]);

                if (cancelled) return;

                setRecentDeeds(
                    deedsSnap.docs.map((d) => ({
                        id: d.id,
                        ...(d.data() as any),
                    }))
                );

                setRecentDonations(
                    donationsSnap.docs.map((d) => ({
                        id: d.id,
                        ...(d.data() as any),
                    }))
                );
            } catch (err) {
                console.error("Admin overview tables error", err);
            } finally {
                if (!cancelled) setLoadingTables(false);
            }
        }

        loadStats();
        loadRecent();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1
                    className="text-2xl md:text-3xl font-extrabold"
                    style={{ color: EKARI.text }}
                >
                    Overview
                </h1>
                <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                    High-level view of ekarihub activity across deeds, marketplace, events,
                    discussions, and donations.
                </p>
            </div>

            {/* Stat cards */}
            <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                {[
                    { label: "Deeds", key: "deeds", href: "/admin/deeds" },
                    { label: "Marketplace", key: "listings", href: "/admin/market" },
                    { label: "Events", key: "events", href: "/admin/events" },
                    { label: "Discussions", key: "discussions", href: "/admin/discussions" },
                    { label: "Donations", key: "donations", href: "/admin/wallets" },
                ].map((card) => {
                    const value =
                        stats && (stats as any)[card.key as keyof OverviewStats as any];

                    return (
                        <Link
                            key={card.key}
                            href={card.href}
                            className="group rounded-2xl border shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition"
                            style={{ borderColor: EKARI.hair, backgroundColor: EKARI.sand }}
                        >
                            <div className="text-xs font-semibold uppercase tracking-wide mb-2 text-gray-500 group-hover:text-gray-700">
                                {card.label}
                            </div>
                            <div className="text-2xl md:text-3xl font-extrabold flex items-baseline gap-1">
                                {loadingStats ? (
                                    <span className="h-7 w-14 bg-gray-100 rounded animate-pulse" />
                                ) : (
                                    <span style={{ color: EKARI.text }}>
                                        {value != null ? formatNumber(value) : "—"}
                                    </span>
                                )}
                            </div>
                            <div className="mt-2 text-[11px] text-gray-500 group-hover:text-gray-700">
                                View all {card.label.toLowerCase()}
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Two-column: recent donations + recent deeds */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent donations */}
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
                                    Recent donations
                                </h2>
                                <p className="text-xs" style={{ color: EKARI.dim }}>
                                    Last 6 completed or pending donations.
                                </p>
                            </div>
                            <Link
                                href="/admin/donations"
                                className="text-xs font-bold underline-offset-2 hover:underline"
                                style={{ color: EKARI.forest }}
                            >
                                View all
                            </Link>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500">
                                    <th className="text-left px-4 py-2 font-semibold">Donation</th>
                                    <th className="text-left px-2 py-2 font-semibold">Amount</th>
                                    <th className="text-left px-2 py-2 font-semibold">Status</th>
                                    <th className="text-left px-2 py-2 font-semibold">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingTables ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-6 text-center text-gray-400"
                                        >
                                            Loading…
                                        </td>
                                    </tr>
                                ) : recentDonations.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-6 text-center text-gray-400"
                                        >
                                            No donations yet.
                                        </td>
                                    </tr>
                                ) : (
                                    recentDonations.map((d) => (
                                        <tr
                                            key={d.id}
                                            className="border-t text-gray-700 hover:bg-gray-50"
                                            style={{ borderColor: EKARI.hair }}
                                        >
                                            <td className="px-4 py-2">
                                                <div className="font-semibold text-[11px]">
                                                    {d.id.slice(0, 8)}…
                                                </div>
                                                <div className="text-[11px] text-gray-500">
                                                    Deed: {d.deedId?.slice(0, 8) ?? "—"} • Creator:
                                                    {" "}
                                                    {d.creatorId?.slice(0, 8) ?? "—"}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2">
                                                <div className="font-extrabold text-[11px]">
                                                    {formatMoneyMinor(d.amount, d.currency)}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2">
                                                <span
                                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                                                    style={{
                                                        backgroundColor:
                                                            d.status === "succeeded"
                                                                ? "#DCFCE7"
                                                                : d.status === "pending"
                                                                    ? "#FEF9C3"
                                                                    : "#FEE2E2",
                                                        color:
                                                            d.status === "succeeded"
                                                                ? "#15803D"
                                                                : d.status === "pending"
                                                                    ? "#92400E"
                                                                    : "#B91C1C",
                                                    }}
                                                >
                                                    {d.status || "unknown"}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-gray-500">
                                                {formatDate(d.createdAt)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent deeds */}
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
                                    Recent deeds
                                </h2>
                                <p className="text-xs" style={{ color: EKARI.dim }}>
                                    Latest uploads across ekarihub.
                                </p>
                            </div>
                            <Link
                                href="/admin/deeds"
                                className="text-xs font-bold underline-offset-2 hover:underline"
                                style={{ color: EKARI.forest }}
                            >
                                View all
                            </Link>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500">
                                    <th className="text-left px-4 py-2 font-semibold">Deed</th>
                                    <th className="text-left px-2 py-2 font-semibold">Status</th>
                                    <th className="text-left px-2 py-2 font-semibold">
                                        Visibility
                                    </th>
                                    <th className="text-left px-2 py-2 font-semibold">Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingTables ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-6 text-center text-gray-400"
                                        >
                                            Loading…
                                        </td>
                                    </tr>
                                ) : recentDeeds.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-6 text-center text-gray-400"
                                        >
                                            No deeds yet.
                                        </td>
                                    </tr>
                                ) : (
                                    recentDeeds.map((d) => (
                                        <tr
                                            key={d.id}
                                            className="border-t text-gray-700 hover:bg-gray-50"
                                            style={{ borderColor: EKARI.hair }}
                                        >
                                            <td className="px-4 py-2">
                                                <div className="font-semibold text-[11px] truncate max-w-[160px]">
                                                    {d.caption || "Untitled deed"}
                                                </div>
                                                <div className="text-[11px] text-gray-500">
                                                    Author: {d.authorId?.slice(0, 8) ?? "—"}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2">
                                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-700">
                                                    {d.status || "unknown"}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-gray-500">
                                                {d.visibility || "public"}
                                            </td>
                                            <td className="px-2 py-2 text-[11px] text-gray-500">
                                                {formatDate(d.createdAt)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
