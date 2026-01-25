// app/admin/overview/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    getCountFromServer,
    doc,
    onSnapshot,
    where,
    Timestamp,
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
    // finance & verification
    pendingWithdrawals: number;
    pendingWithdrawalTotals: Record<string, number>; // currency -> minor units
    totalUsers: number;
    verifiedUsers: number;
    pendingVerifications: number;
    // donations last 30 days (USD minor)
    donationGrossUsdLast30: number;
    platformShareUsdLast30: number;
    creatorShareUsdLast30: number;

    // ✅ subscriptions
    activeSubscriptions: number;
    trialingSubscriptions: number;
    expiredSubscriptions: number;
    canceledSubscriptions: number;
};

type DeedRow = {
    id: string;
    caption?: string;
    authorId?: string;
    authorUsername?: string;
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
    const label = currency === "KES" ? "KSh" : currency || "";
    return `${label} ${unit.toLocaleString("en-KE", {
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

/* ------------------------ Deed quick-view modal ------------------------ */

function DeedPreviewModal({
    deedId,
    onClose,
}: {
    deedId: string;
    onClose: () => void;
}) {
    const [deed, setDeed] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    // load deed doc
    useEffect(() => {
        const ref = doc(db, "deeds", deedId);
        const unsub = onSnapshot(
            ref,
            (snap) => {
                setDeed(snap.exists() ? (snap.data() as any) : null);
                setLoading(false);
            },
            () => setLoading(false)
        );
        return () => unsub();
    }, [deedId]);

    // close on Esc
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const stop = (e: React.MouseEvent) => e.stopPropagation();

    const handle = deed?.authorUsername;
    const publicUrl = handle ? `/${handle}/deed/${deedId}` : null;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 backdrop-blur-sm px-3"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-5xl h-[90vh] rounded-3xl bg-white shadow-xl flex flex-col overflow-hidden"
                onClick={stop}
                style={{ borderColor: EKARI.hair, borderWidth: 1 }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 border-b"
                    style={{ borderColor: EKARI.hair }}
                >
                    <div className="min-w-0">
                        <div
                            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                            style={{ color: EKARI.dim }}
                        >
                            Deed preview
                        </div>
                        <div
                            className="mt-0.5 text-sm md:text-base font-bold truncate"
                            style={{ color: EKARI.text }}
                        >
                            {deed?.caption || "Untitled deed"}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {publicUrl && (
                            <Link
                                href={publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="hidden sm:inline-flex items-center gap-1 rounded-full border px-3 h-8 text-xs font-semibold hover:bg-gray-50"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                Open full page
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full border text-xs font-bold hover:bg-gray-50"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 bg-gray-50/60 flex flex-col">
                    {loading ? (
                        <div
                            className="flex-1 grid place-items-center text-sm"
                            style={{ color: EKARI.dim }}
                        >
                            Loading deed…
                        </div>
                    ) : !deed ? (
                        <div
                            className="flex-1 grid place-items-center text-sm text-center px-4"
                            style={{ color: EKARI.dim }}
                        >
                            Could not load this deed. It may have been removed or you
                            don&apos;t have access.
                        </div>
                    ) : publicUrl ? (
                        <div className="flex-1">
                            {/* Public page inside an iframe so you don’t leave admin dashboard */}
                            <iframe
                                src={publicUrl}
                                title="Deed preview"
                                className="w-full h-full rounded-b-3xl"
                            />
                        </div>
                    ) : (
                        <div
                            className="flex-1 p-4 text-sm"
                            style={{ color: EKARI.text }}
                        >
                            <p className="mb-2 font-semibold">
                                This deed does not have an author handle yet, so the public
                                page path can&apos;t be built.
                            </p>
                            <p className="text-xs" style={{ color: EKARI.dim }}>
                                You can still open it from other admin tools that load the
                                deed document directly.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ------------------------------ Main page ------------------------------ */

export default function AdminOverviewPage() {
    const [stats, setStats] = useState<OverviewStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [recentDeeds, setRecentDeeds] = useState<DeedRow[]>([]);
    const [recentDonations, setRecentDonations] = useState<DonationRow[]>([]);
    const [loadingTables, setLoadingTables] = useState(true);

    const [previewDeedId, setPreviewDeedId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function loadStats() {
            try {
                const [
                    deedsSnap,
                    listingsSnap,
                    eventsSnap,
                    discussionsSnap,
                    donationsSnap,
                    withdrawalsPendingSnap,
                    usersSnap,
                    verifiedUsersSnap,
                    pendingVerifSnap,
                    // ✅ subscriptions
                    activeSubSnap,
                    trialingSubSnap,
                    expiredSubSnap,
                    canceledSubSnap,
                ] = await Promise.all([
                    getCountFromServer(collection(db, "deeds")),
                    getCountFromServer(collection(db, "marketListings")),
                    getCountFromServer(collection(db, "events")),
                    getCountFromServer(collection(db, "discussions")),
                    getCountFromServer(collection(db, "donations")),
                    getCountFromServer(
                        query(
                            collection(db, "withdrawalRequests"),
                            where("status", "==", "pending")
                        )
                    ),
                    getCountFromServer(collection(db, "users")),
                    getCountFromServer(
                        query(
                            collection(db, "users"),
                            where("verification.status", "==", "approved")
                        )
                    ),
                    getCountFromServer(
                        query(
                            collection(db, "users"),
                            where("verification.status", "==", "pending")
                        )
                    ),
                    // ✅ sellerSubscriptions counts
                    getCountFromServer(query(collection(db, "sellerSubscriptions"), where("status", "==", "active"))),
                    getCountFromServer(query(collection(db, "sellerSubscriptions"), where("status", "==", "trialing"))),
                    getCountFromServer(query(collection(db, "sellerSubscriptions"), where("status", "==", "expired"))),
                    getCountFromServer(query(collection(db, "sellerSubscriptions"), where("status", "==", "canceled"))),
                ]);

                // Compute pending withdrawal totals (first 200 requests)
                const pendingTotals: Record<string, number> = {};
                try {
                    const pendingDocsSnap = await getDocs(
                        query(
                            collection(db, "withdrawalRequests"),
                            where("status", "==", "pending"),
                            limit(200)
                        )
                    );
                    pendingDocsSnap.forEach((d) => {
                        const data = d.data() as any;
                        const currency = (data.currency || "KES") as string;
                        const amountMinor =
                            typeof data.amount === "number" ? data.amount : 0;
                        if (!pendingTotals[currency]) pendingTotals[currency] = 0;
                        pendingTotals[currency] += amountMinor;
                    });
                } catch (err) {
                    console.error("Error computing pending withdrawal totals", err);
                }

                // Donations last 30 days (succeeded only)
                const now = new Date();
                const cutoff30 = new Date(now);
                cutoff30.setDate(cutoff30.getDate() - 30);
                const cutoffTs30 = Timestamp.fromDate(cutoff30);

                let donationGrossUsdLast30 = 0;
                let platformShareUsdLast30 = 0;
                let creatorShareUsdLast30 = 0;

                try {
                    const last30Snap = await getDocs(
                        query(
                            collection(db, "donations"),
                            where("status", "==", "succeeded"),
                            where("paidAt", ">=", cutoffTs30),
                            limit(500)
                        )
                    );

                    last30Snap.forEach((d) => {
                        const data = d.data() as any;
                        donationGrossUsdLast30 += data.grossAmountUsdMinor || 0;
                        platformShareUsdLast30 += data.platformShareUsdMinor || 0;
                        creatorShareUsdLast30 += data.creatorShareNetUsdMinor || 0;
                    });
                } catch (err) {
                    console.error("Error computing last 30-day uplift totals", err);
                }

                if (cancelled) return;

                setStats({
                    deeds: deedsSnap.data().count,
                    listings: listingsSnap.data().count,
                    events: eventsSnap.data().count,
                    discussions: discussionsSnap.data().count,
                    donations: donationsSnap.data().count,
                    pendingWithdrawals: withdrawalsPendingSnap.data().count,
                    pendingWithdrawalTotals: pendingTotals,
                    totalUsers: usersSnap.data().count,
                    verifiedUsers: verifiedUsersSnap.data().count,
                    pendingVerifications: pendingVerifSnap.data().count,
                    donationGrossUsdLast30,
                    platformShareUsdLast30,
                    creatorShareUsdLast30,
                    // ✅ subscriptions
                    activeSubscriptions: activeSubSnap.data().count,
                    trialingSubscriptions: trialingSubSnap.data().count,
                    expiredSubscriptions: expiredSubSnap.data().count,
                    canceledSubscriptions: canceledSubSnap.data().count,
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

    const openPreview = useCallback((id: string) => {
        setPreviewDeedId(id);
    }, []);

    const closePreview = useCallback(() => {
        setPreviewDeedId(null);
    }, []);

    const pendingTotalsDisplay = stats?.pendingWithdrawalTotals || {};

    const last30GrossUsdMajor = (stats?.donationGrossUsdLast30 ?? 0) / 100;
    const last30PlatformUsdMajor = (stats?.platformShareUsdLast30 ?? 0) / 100;
    const last30CreatorUsdMajor = (stats?.creatorShareUsdLast30 ?? 0) / 100;

    return (
        <>
            <div className="p-4 md:p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    {/* Small badge */}
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm border border-slate-200 w-fit mb-1">
                        <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            ⓔ
                        </span>
                        <span
                            className="text-[11px] font-semibold tracking-[0.16em] uppercase"
                            style={{ color: EKARI.dim }}
                        >
                            EkariHub admin overview
                        </span>
                    </div>

                    <h1
                        className="text-2xl md:text-3xl font-extrabold"
                        style={{ color: EKARI.text }}
                    >
                        Overview
                    </h1>
                    <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                        High-level view of ekarihub activity across deeds, marketplace,
                        events, discussions, uplifts, wallets and verification.
                    </p>
                </div>

                {/* Stat cards (content stats) */}
                <div className="grid gap-4 md:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                        { label: "Deeds", key: "deeds", href: "/admin/deeds", emoji: "🎥" },
                        {
                            label: "Marketplace",
                            key: "listings",
                            href: "/admin/market",
                            emoji: "🛒",
                        },
                        {
                            label: "Events",
                            key: "events",
                            href: "/admin/events",
                            emoji: "📅",
                        },
                        {
                            label: "Discussions",
                            key: "discussions",
                            href: "/admin/discussions",
                            emoji: "💬",
                        },
                        {
                            label: "Uplifts",
                            key: "donations",
                            href: "/admin/earnings",
                            emoji: "❤️",
                        },
                    ].map((card) => {
                        const value = stats ? (stats as any)[card.key] : null;

                        return (
                            <Link
                                key={card.key}
                                href={card.href}
                                className="group rounded-2xl border shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition bg-white"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 group-hover:text-gray-700">
                                        {card.label}
                                    </div>
                                    <div className="text-sm">{card.emoji}</div>
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
                                    All time • View all {card.label.toLowerCase()}
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* Finance & verification snapshot */}
                <div className="grid gap-4 md:grid-cols-3">
                    {/* Finance snapshot */}
                    <Link
                        href="/admin/wallets"
                        className="rounded-2xl border shadow-sm bg-white p-4 md:p-5 hover:shadow-md transition flex flex-col justify-between"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <div
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: EKARI.dim }}
                                >
                                    Wallets & withdrawals
                                </div>
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                                    ₵
                                </span>
                            </div>
                            <p
                                className="mt-1 text-sm md:text-base font-extrabold"
                                style={{ color: EKARI.text }}
                            >
                                {stats?.pendingWithdrawals ?? 0} pending withdrawals
                            </p>
                            <p
                                className="mt-1 text-[11px]"
                                style={{ color: EKARI.dim }}
                            >
                                Pending payout amount (approx. first 200 requests):
                            </p>
                            <ul
                                className="mt-1 space-y-0.5 text-[11px]"
                                style={{ color: EKARI.dim }}
                            >
                                {Object.keys(pendingTotalsDisplay).length === 0 && <li>—</li>}
                                {Object.entries(pendingTotalsDisplay).map(
                                    ([currency, minor]) => {
                                        const major = minor / 100;
                                        return (
                                            <li key={currency}>
                                                <span className="font-semibold">
                                                    {currency === "KES" ? "KSh" : currency}{" "}
                                                    {major.toLocaleString("en-KE", {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    })}
                                                </span>{" "}
                                                pending
                                            </li>
                                        );
                                    }
                                )}
                            </ul>

                            <p
                                className="mt-3 text-[11px]"
                                style={{ color: EKARI.dim }}
                            >
                                Uplifts volume (last 30 days, USD):
                            </p>
                            <ul
                                className="mt-1 space-y-0.5 text-[11px]"
                                style={{ color: EKARI.dim }}
                            >
                                <li>
                                    Gross:{" "}
                                    <span className="font-semibold">
                                        USD{" "}
                                        {last30GrossUsdMajor.toLocaleString("en-KE", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                </li>
                                <li>
                                    Creator share:{" "}
                                    <span className="font-semibold">
                                        USD{" "}
                                        {last30CreatorUsdMajor.toLocaleString("en-KE", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                </li>
                                <li>
                                    Platform share:{" "}
                                    <span className="font-semibold text-emerald-700">
                                        USD{" "}
                                        {last30PlatformUsdMajor.toLocaleString("en-KE", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </span>
                                </li>
                            </ul>
                        </div>
                        <div className="mt-3 text-[11px] text-emerald-700 font-semibold">
                            Go to withdrawals →
                        </div>
                    </Link>

                    {/* Verification snapshot */}
                    <Link
                        href="/admin/verification"
                        className="rounded-2xl border shadow-sm bg-white p-4 md:p-5 hover:shadow-md transition flex flex-col justify-between"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <div
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: EKARI.dim }}
                                >
                                    Members & verification
                                </div>
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-700 text-xs font-bold">
                                    ✔
                                </span>
                            </div>
                            <p
                                className="mt-1 text-sm md:text-base font-extrabold"
                                style={{ color: EKARI.text }}
                            >
                                {stats?.pendingVerifications ?? 0} pending verifications
                            </p>
                            <p
                                className="mt-1 text-[11px]"
                                style={{ color: EKARI.dim }}
                            >
                                Total members:{" "}
                                <span className="font-semibold">
                                    {formatNumber(stats?.totalUsers ?? 0)}
                                </span>
                            </p>
                            <p className="text-[11px]" style={{ color: EKARI.dim }}>
                                Verified:{" "}
                                <span className="font-semibold text-emerald-700">
                                    {formatNumber(stats?.verifiedUsers ?? 0)}
                                </span>
                            </p>
                        </div>
                        <div className="mt-3 text-[11px] text-emerald-700 font-semibold">
                            Review verification requests →
                        </div>
                    </Link>
                    <Link
                        href="/admin/subscriptions"
                        className="rounded-2xl border shadow-sm bg-white p-4 md:p-5 hover:shadow-md transition flex flex-col justify-between"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <div
                                    className="text-xs font-semibold uppercase tracking-wide"
                                    style={{ color: EKARI.dim }}
                                >
                                    Subscriptions
                                </div>
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
                                    ★
                                </span>
                            </div>

                            <p className="mt-1 text-sm md:text-base font-extrabold" style={{ color: EKARI.text }}>
                                {formatNumber(stats?.activeSubscriptions ?? 0)} active
                            </p>

                            <ul className="mt-2 space-y-0.5 text-[11px]" style={{ color: EKARI.dim }}>
                                <li>
                                    Trialing: <span className="font-semibold">{formatNumber(stats?.trialingSubscriptions ?? 0)}</span>
                                </li>
                                <li>
                                    Expired: <span className="font-semibold">{formatNumber(stats?.expiredSubscriptions ?? 0)}</span>
                                </li>
                                <li>
                                    Canceled: <span className="font-semibold">{formatNumber(stats?.canceledSubscriptions ?? 0)}</span>
                                </li>
                            </ul>
                        </div>

                        <div className="mt-3 text-[11px] text-emerald-700 font-semibold">
                            View subscriptions →
                        </div>
                    </Link>

                </div>

                {/* Two-column: recent donations + recent deeds */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent donations */}
                    <div
                        className="rounded-2xl border shadow-sm bg-white overflow-hidden"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <div
                            className="px-4 py-3 border-b"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <h2
                                        className="text-sm font-extrabold"
                                        style={{ color: EKARI.text }}
                                    >
                                        Recent uplifts
                                    </h2>
                                    <p
                                        className="text-xs"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Last 6 completed or pending uplifts.
                                    </p>
                                </div>
                                <Link
                                    href="/admin/uplifts"
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
                                        <th className="text-left px-4 py-2 font-semibold">
                                            Uplift
                                        </th>
                                        <th className="text-left px-2 py-2 font-semibold">
                                            Amount
                                        </th>
                                        <th className="text-left px-2 py-2 font-semibold">
                                            Status
                                        </th>
                                        <th className="text-left px-2 py-2 font-semibold">
                                            Date
                                        </th>
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
                                                No uplifts yet.
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
                                                    <div className="font-mono text-[11px]">
                                                        {d.id.slice(0, 8)}…
                                                    </div>
                                                    <div className="text-[11px] text-gray-500">
                                                        Deed: {d.deedId?.slice(0, 8) ?? "—"} • Creator:{" "}
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
                        <div
                            className="px-4 py-3 border-b"
                            style={{ borderColor: EKARI.hair }}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <h2
                                        className="text-sm font-extrabold"
                                        style={{ color: EKARI.text }}
                                    >
                                        Recent deeds
                                    </h2>
                                    <p
                                        className="text-xs"
                                        style={{ color: EKARI.dim }}
                                    >
                                        Latest uploads across EkariHub. Click a row to preview the
                                        public page.
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
                                        <th className="text-left px-4 py-2 font-semibold">
                                            Deed
                                        </th>
                                        <th className="text-left px-2 py-2 font-semibold">
                                            Status
                                        </th>
                                        <th className="text-left px-2 py-2 font-semibold">
                                            Visibility
                                        </th>
                                        <th className="text-left px-2 py-2 font-semibold">
                                            Created
                                        </th>
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
                                                onClick={() => openPreview(d.id)}
                                                className="border-t text-gray-700 hover:bg-emerald-50/40 cursor-pointer"
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

            {previewDeedId && (
                <DeedPreviewModal deedId={previewDeedId} onClose={closePreview} />
            )}
        </>
    );
}
