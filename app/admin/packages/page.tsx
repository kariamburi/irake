// app/admin/packages/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
    collection,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    deleteDoc,
} from "firebase/firestore";
import { getAuth, onIdTokenChanged, User as FirebaseUser } from "firebase/auth";

import { db } from "@/lib/firebase";
import { ConfirmModal } from "@/app/components/ConfirmModal";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

type BannerState =
    | { type: "success"; message: string }
    | { type: "error"; message: string }
    | { type: "info"; message: string }
    | null;

type PackageDoc = {
    id: string;
    name: string;
    target: string;
    priceMonthlyUsd: number; // ✅ required number
    yearlyDiscountPct?: number;
    priceYearlyUsd: number; // ✅ required number
    activeListingsLimit: number | null; // null = unlimited
    priorityRanking: boolean;
    topOfSearch: boolean;
    verifiedBadge: boolean;
    storefront: boolean;
    analyticsLevel: "none" | "basic" | "advanced";
    monthlyBoostCredits: number; // ✅ required number
    weeklyFeaturedCredits: number; // ✅ required number
    status: "active" | "disabled";
    features: string[];
    sortOrder: number; // ✅ required number
    createdAt?: any;
    updatedAt?: any;
};

type FormState = {
    name: string;
    target: string;
    priceMonthlyUsd: string;
    yearlyDiscountPct: DiscountPct;
    priceYearlyUsd: string;
    activeListingsLimit: string; // number or "unlimited"
    priorityRanking: boolean;
    topOfSearch: boolean;
    verifiedBadge: boolean;
    storefront: boolean;
    analyticsLevel: PackageDoc["analyticsLevel"];
    monthlyBoostCredits: string;
    weeklyFeaturedCredits: string;
    status: PackageDoc["status"];
    featuresText: string;
    sortOrder: string;
};

const DEFAULTS: FormState = {
    name: "",
    target: "",
    priceMonthlyUsd: "20",
    yearlyDiscountPct: 10, // ✅ NEW
    priceYearlyUsd: "240",
    activeListingsLimit: "10",
    priorityRanking: false,
    topOfSearch: false,
    verifiedBadge: false,
    storefront: false,
    analyticsLevel: "basic",
    monthlyBoostCredits: "0",
    weeklyFeaturedCredits: "0",
    status: "active",
    featuresText:
        "Up to 10 active listings\nStandard visibility\nBuyer chat & inquiries\nBasic performance stats (views)",
    sortOrder: "10",
};

function usd(n: number | null | undefined) {
    if (typeof n !== "number") return "—";
    return `$${n.toLocaleString("en-US")}`;
}

function parseNumberOrNull(v: string, opts: { allowNull: true }): number | null | typeof NaN;
function parseNumberOrNull(v: string, opts: { allowNull: false }): number | typeof NaN;
function parseNumberOrNull(v: string, { allowNull }: { allowNull: boolean }) {
    const t = v.trim();
    if (allowNull && (t === "" || t.toLowerCase() === "unlimited")) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n);
}

function splitFeatures(text: string) {
    return text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
}

function badgeClasses(kind: "active" | "disabled") {
    return kind === "active"
        ? "bg-emerald-50 text-emerald-800"
        : "bg-gray-100 text-gray-700";
}

function tierPill(name: string) {
    const n = (name || "").toLowerCase();
    if (n.includes("silver")) return { bg: "#F3F4F6", fg: "#111827", ring: "#E5E7EB" };
    if (n.includes("gold")) return { bg: "#FFF7ED", fg: "#9A3412", ring: "#FED7AA" };
    if (n.includes("platinum")) return { bg: "#EEF2FF", fg: "#3730A3", ring: "#C7D2FE" };
    return { bg: "#F8FAFC", fg: "#0F172A", ring: "#E2E8F0" };
}
const DISCOUNT_OPTIONS = [0, 10, 15] as const;
type DiscountPct = (typeof DISCOUNT_OPTIONS)[number];

function calcYearlyFromMonthly(monthly: number, discountPct: DiscountPct) {
    const factor = 1 - discountPct / 100;
    return Math.round(monthly * 12 * factor);
}

export default function AdminPackagesPage() {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    const [banner, setBanner] = useState<BannerState>(null);
    const showError = (message: string) => setBanner({ type: "error", message });
    const showSuccess = (message: string) => setBanner({ type: "success", message });
    const showInfo = (message: string) => setBanner({ type: "info", message });
    const clearBanner = () => setBanner(null);

    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rows, setRows] = useState<PackageDoc[]>([]);

    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState<FormState>(DEFAULTS);

    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<FormState>(DEFAULTS);

    const [confirmConfig, setConfirmConfig] = useState<{
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm: () => void;
    } | null>(null);

    // --- Admin guard from custom claims ---
    useEffect(() => {
        const auth = getAuth();
        const unsub = onIdTokenChanged(auth, async (u) => {
            setUser(u || null);
            if (!u) {
                setIsAdmin(false);
                setCheckingAuth(false);
                return;
            }
            try {
                const token = await u.getIdTokenResult();
                setIsAdmin(!!token.claims.admin);
            } catch {
                setIsAdmin(false);
            } finally {
                setCheckingAuth(false);
            }
        });
        return () => unsub();
    }, []);

    // --- Load packages ---
    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const base = query(collection(db, "packages"), orderBy("sortOrder", "asc"));
                const snap = await getDocs(base);
                if (cancelled) return;

                const items: PackageDoc[] = snap.docs.map((d) => {
                    const x = d.data() as any;

                    // Backwards-compatible: old docs might have priceMonthly/priceYearly
                    const monthlyUsd =
                        typeof x.priceMonthlyUsd === "number"
                            ? x.priceMonthlyUsd
                            : typeof x.priceMonthly === "number"
                                ? x.priceMonthly
                                : 0;

                    const yearlyUsd =
                        typeof x.priceYearlyUsd === "number"
                            ? x.priceYearlyUsd
                            : typeof x.priceYearly === "number"
                                ? x.priceYearly
                                : 0;

                    return {
                        id: d.id,
                        name: String(x.name || "Untitled"),
                        target: String(x.target || ""),
                        priceMonthlyUsd: monthlyUsd,
                        yearlyDiscountPct:
                            (DISCOUNT_OPTIONS.includes(x.yearlyDiscountPct) ? x.yearlyDiscountPct : 10),
                        priceYearlyUsd: yearlyUsd,
                        activeListingsLimit: typeof x.activeListingsLimit === "number" ? x.activeListingsLimit : null,
                        priorityRanking: !!x.priorityRanking,
                        topOfSearch: !!x.topOfSearch,
                        verifiedBadge: !!x.verifiedBadge,
                        storefront: !!x.storefront,
                        analyticsLevel: (x.analyticsLevel || "none") as PackageDoc["analyticsLevel"],
                        monthlyBoostCredits: typeof x.monthlyBoostCredits === "number" ? x.monthlyBoostCredits : 0,
                        weeklyFeaturedCredits: typeof x.weeklyFeaturedCredits === "number" ? x.weeklyFeaturedCredits : 0,
                        status: (x.status || "active") as PackageDoc["status"],
                        features: Array.isArray(x.features) ? x.features.map(String) : [],
                        sortOrder: typeof x.sortOrder === "number" ? x.sortOrder : 10,
                        createdAt: x.createdAt,
                        updatedAt: x.updatedAt,
                    };
                });

                setRows(items);
            } catch (err) {
                console.error("AdminPackages: load error", err);
                setRows([]);
                showError("Failed to load packages. Please try again.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isAdmin]);

    const bannerBg =
        banner?.type === "error" ? "#FEE2E2" : banner?.type === "success" ? "#ECFDF3" : "#DBEAFE";
    const bannerText =
        banner?.type === "error" ? "#991B1B" : banner?.type === "success" ? "#166534" : "#1D4ED8";

    const stats = useMemo(() => {
        const active = rows.filter((r) => r.status === "active").length;
        const disabled = rows.filter((r) => r.status === "disabled").length;
        return { total: rows.length, active, disabled };
    }, [rows]);

    const resetCreateForm = () => setForm(DEFAULTS);

    // ✅ IMPORTANT: payload contains ONLY writeable fields, no createdAt/updatedAt keys.
    function validateAndBuild(input: FormState) {
        const name = input.name.trim();
        const target = input.target.trim();

        if (!name) return { ok: false as const, message: "Package name is required." };
        if (!target) return { ok: false as const, message: "Target sellers is required." };

        const priceMonthlyUsd = parseNumberOrNull(input.priceMonthlyUsd, { allowNull: false });
        const priceYearlyUsd = parseNumberOrNull(input.priceYearlyUsd, { allowNull: false });

        if (!Number.isFinite(priceMonthlyUsd) || priceMonthlyUsd <= 0)
            return { ok: false as const, message: "Monthly price (USD) must be a positive number." };
        if (!Number.isFinite(priceYearlyUsd) || priceYearlyUsd <= 0)
            return { ok: false as const, message: "Yearly price (USD) must be a positive number." };

        const activeListingsLimit = parseNumberOrNull(input.activeListingsLimit, { allowNull: true });
        if (Number.isNaN(activeListingsLimit))
            return { ok: false as const, message: 'Listings limit must be a number or "unlimited".' };
        if (typeof activeListingsLimit === "number" && activeListingsLimit <= 0)
            return { ok: false as const, message: "Listings limit must be > 0 (or unlimited)." };

        const monthlyBoostCredits = parseNumberOrNull(input.monthlyBoostCredits, { allowNull: false });
        const weeklyFeaturedCredits = parseNumberOrNull(input.weeklyFeaturedCredits, { allowNull: false });
        if (!Number.isFinite(monthlyBoostCredits) || monthlyBoostCredits < 0)
            return { ok: false as const, message: "Monthly boost credits must be 0 or more." };
        if (!Number.isFinite(weeklyFeaturedCredits) || weeklyFeaturedCredits < 0)
            return { ok: false as const, message: "Weekly featured credits must be 0 or more." };

        const sortOrder = parseNumberOrNull(input.sortOrder, { allowNull: false });
        if (!Number.isFinite(sortOrder)) return { ok: false as const, message: "Sort order must be a number." };

        const features = splitFeatures(input.featuresText);

        const payload = {
            name,
            target,
            priceMonthlyUsd,
            yearlyDiscountPct: input.yearlyDiscountPct,
            priceYearlyUsd,
            activeListingsLimit,
            priorityRanking: input.priorityRanking,
            topOfSearch: input.topOfSearch,
            verifiedBadge: input.verifiedBadge,
            storefront: input.storefront,
            analyticsLevel: input.analyticsLevel as PackageDoc["analyticsLevel"],
            monthlyBoostCredits,
            weeklyFeaturedCredits,
            status: input.status,
            features,
            sortOrder,
        };

        return { ok: true as const, payload };
    }

    const createPackage = async () => {
        clearBanner();
        if (!user) return showError("Not signed in. Please log in again.");

        const built = validateAndBuild(form);
        if (!built.ok) return showError(built.message);

        try {
            setCreating(true);

            const colRef = collection(db, "packages");
            const ref = doc(colRef);

            await setDoc(ref, {
                ...built.payload,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: user.uid,
            });

            setRows((prev) =>
                [{ id: ref.id, ...(built.payload as any), createdAt: null, updatedAt: null }, ...prev].sort(
                    (a, b) => (a.sortOrder ?? 10) - (b.sortOrder ?? 10)
                )
            );

            resetCreateForm();
            showSuccess("Package created.");
        } catch (err: any) {
            console.error("Create package failed", err);
            showError(err?.message || "Failed to create package. Please try again.");
        } finally {
            setCreating(false);
        }
    };

    const openEdit = (row: PackageDoc) => {
        clearBanner();
        setEditId(row.id);
        setEditForm({
            name: row.name,
            target: row.target,
            priceMonthlyUsd: String(row.priceMonthlyUsd ?? ""),
            yearlyDiscountPct: (row.yearlyDiscountPct ?? 10) as DiscountPct,
            priceYearlyUsd: String(row.priceYearlyUsd ?? ""),
            activeListingsLimit: row.activeListingsLimit === null ? "unlimited" : String(row.activeListingsLimit),
            priorityRanking: row.priorityRanking,
            topOfSearch: row.topOfSearch,
            verifiedBadge: row.verifiedBadge,
            storefront: row.storefront,
            analyticsLevel: row.analyticsLevel,
            monthlyBoostCredits: String(row.monthlyBoostCredits ?? 0),
            weeklyFeaturedCredits: String(row.weeklyFeaturedCredits ?? 0),
            status: row.status,
            featuresText: (row.features || []).join("\n"),
            sortOrder: String(row.sortOrder ?? 10),
        });
        setEditOpen(true);
    };

    const saveEdit = async () => {
        clearBanner();
        if (!editId) return;

        const built = validateAndBuild(editForm);
        if (!built.ok) return showError(built.message);

        try {
            setBusyId(editId);

            // ✅ only write allowed fields + updatedAt
            await updateDoc(doc(db, "packages", editId), {
                ...built.payload,
                updatedAt: serverTimestamp(),
            });

            setRows((prev) =>
                prev
                    .map((r) => (r.id === editId ? ({ ...r, ...(built.payload as any) } as PackageDoc) : r))
                    .sort((a, b) => (a.sortOrder ?? 10) - (b.sortOrder ?? 10))
            );

            setEditOpen(false);
            setEditId(null);
            showSuccess("Package updated.");
        } catch (err: any) {
            console.error("Update package failed", err);
            showError(err?.message || "Failed to update package. Please try again.");
        } finally {
            setBusyId(null);
        }
    };

    const toggleStatus = async (row: PackageDoc) => {
        clearBanner();
        const next = row.status === "active" ? "disabled" : "active";
        try {
            setBusyId(row.id);
            await updateDoc(doc(db, "packages", row.id), {
                status: next,
                updatedAt: serverTimestamp(),
            });
            setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
            showSuccess(next === "active" ? "Package enabled." : "Package disabled.");
        } catch (err: any) {
            console.error("Toggle status failed", err);
            showError(err?.message || "Failed to update status.");
        } finally {
            setBusyId(null);
        }
    };

    const actuallyDelete = async (row: PackageDoc) => {
        clearBanner();
        try {
            setBusyId(row.id);
            await deleteDoc(doc(db, "packages", row.id));
            setRows((prev) => prev.filter((r) => r.id !== row.id));
            showSuccess(`Deleted "${row.name}".`);
        } catch (err: any) {
            console.error("Delete package failed", err);
            showError(err?.message || "Failed to delete package.");
        } finally {
            setBusyId(null);
        }
    };

    const deletePackage = (row: PackageDoc) => {
        setConfirmConfig({
            title: "Delete package",
            message: `Delete "${row.name}"? This will not remove existing subscriptions automatically (they’ll reference the old package id).`,
            confirmText: "Delete package",
            cancelText: "Cancel",
            onConfirm: async () => {
                setConfirmConfig(null);
                await actuallyDelete(row);
            },
        });
    };

    if (checkingAuth) {
        return (
            <div className="p-6 text-sm" style={{ color: EKARI.dim }}>
                Checking admin permissions…
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="p-6">
                <div className="max-w-md rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: EKARI.hair }}>
                    <h1 className="text-lg font-extrabold" style={{ color: EKARI.text }}>
                        You&apos;re not an admin
                    </h1>
                    <p className="mt-2 text-sm" style={{ color: EKARI.dim }}>
                        This area is restricted. If you believe this is a mistake, contact the ekarihub team.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="p-4 md:p-6 space-y-6">
                {/* Banner */}
                {banner && (
                    <div
                        className="flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm"
                        style={{ backgroundColor: bannerBg, color: bannerText }}
                    >
                        <div>{banner.message}</div>
                        <button type="button" onClick={clearBanner} className="ml-2 text-xs font-bold">
                            ×
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-extrabold" style={{ color: EKARI.text }}>
                            Packages
                        </h1>
                        <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                            Manage seller subscription tiers. These control listing limits, visibility perks, storefront access and included boost credits.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="rounded-2xl border bg-white px-3 py-2 text-xs" style={{ borderColor: EKARI.hair }}>
                            <span className="font-bold" style={{ color: EKARI.text }}>
                                {stats.total}
                            </span>{" "}
                            <span style={{ color: EKARI.dim }}>total</span>
                            <span className="mx-2" style={{ color: EKARI.hair }}>
                                |
                            </span>
                            <span className="font-bold text-emerald-700">{stats.active}</span>{" "}
                            <span style={{ color: EKARI.dim }}>active</span>
                            <span className="mx-2" style={{ color: EKARI.hair }}>
                                |
                            </span>
                            <span className="font-bold text-gray-700">{stats.disabled}</span>{" "}
                            <span style={{ color: EKARI.dim }}>disabled</span>
                        </div>
                    </div>
                </div>

                {/* Create */}
                <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3" style={{ borderColor: EKARI.hair }}>
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                            Create package
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                resetCreateForm();
                                showInfo("Form reset.");
                            }}
                            className="rounded-xl px-3 py-2 text-xs font-bold border"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            Reset
                        </button>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-3">
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">Package name</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder="Silver"
                            />
                        </div>

                        <div className="space-y-2 lg:col-span-2">
                            <label className="block text-xs font-semibold text-gray-500">Target sellers</label>
                            <input
                                value={form.target}
                                onChange={(e) => setForm((p) => ({ ...p, target: e.target.value }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder="Smallholder farmers, individual traders, new sellers"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">Monthly price (USD)</label>
                            <input
                                inputMode="decimal"
                                value={form.priceMonthlyUsd}
                                onChange={(e) => {
                                    const nextMonthly = e.target.value;
                                    setForm((p) => {
                                        const m = Number(nextMonthly);
                                        if (Number.isFinite(m) && m > 0) {
                                            return {
                                                ...p,
                                                priceMonthlyUsd: nextMonthly,
                                                priceYearlyUsd: String(calcYearlyFromMonthly(m, p.yearlyDiscountPct)),
                                            };
                                        }
                                        return { ...p, priceMonthlyUsd: nextMonthly };
                                    });
                                }}


                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder="20"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">
                                Yearly discount
                            </label>
                            <select
                                value={form.yearlyDiscountPct}
                                onChange={(e) => {
                                    const pct = Number(e.target.value) as DiscountPct;
                                    setForm((p) => {
                                        const m = Number(p.priceMonthlyUsd);
                                        if (Number.isFinite(m) && m > 0) {
                                            return {
                                                ...p,
                                                yearlyDiscountPct: pct,
                                                priceYearlyUsd: String(calcYearlyFromMonthly(m, pct)),
                                            };
                                        }
                                        return { ...p, yearlyDiscountPct: pct };
                                    });
                                }}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            >
                                {DISCOUNT_OPTIONS.map((pct) => (
                                    <option key={pct} value={pct}>
                                        {pct}%
                                    </option>
                                ))}
                            </select>

                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">
                                Yearly price (USD)
                                <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                                    Auto from monthly ×12 minus discount (editable)
                                </span>
                            </label>
                            <input
                                inputMode="decimal"
                                value={form.priceYearlyUsd}
                                onChange={(e) => setForm((p) => ({ ...p, priceYearlyUsd: e.target.value }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder="240"
                            />
                        </div>


                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">Active listings limit</label>
                            <input
                                value={form.activeListingsLimit}
                                onChange={(e) => setForm((p) => ({ ...p, activeListingsLimit: e.target.value }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder='10 (or "unlimited")'
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">Analytics</label>
                            <select
                                value={form.analyticsLevel}
                                onChange={(e) => setForm((p) => ({ ...p, analyticsLevel: e.target.value as any }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            >
                                <option value="none">None</option>
                                <option value="basic">Basic</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">Included boosts / month</label>
                            <input
                                inputMode="numeric"
                                value={form.monthlyBoostCredits}
                                onChange={(e) => setForm((p) => ({ ...p, monthlyBoostCredits: e.target.value }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">Featured credits / week</label>
                            <input
                                inputMode="numeric"
                                value={form.weeklyFeaturedCredits}
                                onChange={(e) => setForm((p) => ({ ...p, weeklyFeaturedCredits: e.target.value }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as any }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            >
                                <option value="active">Active</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-500">Sort order</label>
                            <input
                                inputMode="numeric"
                                value={form.sortOrder}
                                onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder="10"
                            />
                        </div>

                        <div className="space-y-2 lg:col-span-3">
                            <label className="block text-xs font-semibold text-gray-500">Feature bullets (one per line)</label>
                            <textarea
                                value={form.featuresText}
                                onChange={(e) => setForm((p) => ({ ...p, featuresText: e.target.value }))}
                                className="w-full min-h-[120px] rounded-xl border px-3 py-2 text-sm outline-none"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                placeholder={"Up to 10 active listings\nStandard visibility\nBuyer chat & inquiries"}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                            onClick={createPackage}
                            disabled={creating}
                            className="rounded-xl px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
                            style={{ backgroundColor: EKARI.forest }}
                        >
                            {creating ? "Saving…" : "Save package"}
                        </button>
                        <div className="text-[11px]" style={{ color: EKARI.dim }}>
                            Tip: For “unlimited listings”, set listings limit to <span className="font-mono">unlimited</span>.
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-2xl border bg-white shadow-sm overflow-hidden" style={{ borderColor: EKARI.hair }}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: EKARI.hair }}>
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                                    Package list
                                </h2>
                                <p className="text-xs" style={{ color: EKARI.dim }}>
                                    These packages power subscriptions and limit seller capabilities. Disable a package to hide it from checkout.
                                </p>
                            </div>
                            <div className="text-xs" style={{ color: EKARI.dim }}>
                                {loading ? "Loading…" : `${rows.length.toLocaleString("en-KE")} package${rows.length === 1 ? "" : "s"}`}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500">
                                    <th className="text-left px-4 py-2 font-semibold">Package</th>
                                    <th className="text-left px-2 py-2 font-semibold">Pricing</th>
                                    <th className="text-left px-2 py-2 font-semibold">Limits</th>
                                    <th className="text-left px-2 py-2 font-semibold">Perks</th>
                                    <th className="text-left px-2 py-2 font-semibold">Status</th>
                                    <th className="text-right px-4 py-2 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                                            Loading…
                                        </td>
                                    </tr>
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                                            No packages yet.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r) => {
                                        const pill = tierPill(r.name);

                                        const perks: string[] = [];
                                        if (r.priorityRanking) perks.push("Priority ranking");
                                        if (r.topOfSearch) perks.push("Top-of-search bias");
                                        if (r.verifiedBadge) perks.push("Verified badge");
                                        if (r.storefront) perks.push("Storefront");
                                        if (r.analyticsLevel === "basic") perks.push("Basic analytics");
                                        if (r.analyticsLevel === "advanced") perks.push("Advanced analytics");
                                        if ((r.monthlyBoostCredits ?? 0) > 0) perks.push(`${r.monthlyBoostCredits}/mo boosts`);
                                        if ((r.weeklyFeaturedCredits ?? 0) > 0) perks.push(`${r.weeklyFeaturedCredits}/wk featured`);

                                        return (
                                            <tr key={r.id} className="border-t text-gray-700" style={{ borderColor: EKARI.hair }}>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-start gap-2">
                                                        <span
                                                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold border"
                                                            style={{ background: pill.bg, color: pill.fg, borderColor: pill.ring }}
                                                        >
                                                            {r.name}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] text-gray-500 line-clamp-2">{r.target}</div>
                                                            <div className="font-mono text-[10px] text-gray-300 truncate">{r.id}</div>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-2 py-2 text-[11px] text-gray-600">
                                                    <div className="font-semibold">{usd(r.priceMonthlyUsd)} / month</div>
                                                    <div className="text-[10px]" style={{ color: EKARI.dim }}>
                                                        {usd(r.priceYearlyUsd)} / year
                                                    </div>
                                                </td>

                                                <td className="px-2 py-2 text-[11px] text-gray-600">
                                                    <div>
                                                        Listings:{" "}
                                                        <span className="font-semibold">{r.activeListingsLimit === null ? "Unlimited" : r.activeListingsLimit}</span>
                                                    </div>
                                                </td>

                                                <td className="px-2 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(perks.length ? perks : ["Standard visibility"]).map((p, i) => (
                                                            <span
                                                                key={i}
                                                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border"
                                                                style={{ borderColor: EKARI.hair, color: EKARI.text, background: "#fff" }}
                                                            >
                                                                {p}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {r.features?.length ? (
                                                        <div className="mt-1 text-[10px]" style={{ color: EKARI.dim }}>
                                                            {r.features.slice(0, 2).join(" • ")}
                                                            {r.features.length > 2 ? " • …" : ""}
                                                        </div>
                                                    ) : null}
                                                </td>

                                                <td className="px-2 py-2">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClasses(r.status)}`}>
                                                        {r.status === "active" ? "Active" : "Disabled"}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-2 text-right">
                                                    <div className="inline-flex flex-wrap gap-1 justify-end">
                                                        <button
                                                            type="button"
                                                            disabled={busyId === r.id}
                                                            onClick={() => openEdit(r)}
                                                            className="rounded-full px-2 py-1 text-[10px] font-bold border disabled:opacity-40"
                                                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                                        >
                                                            Edit
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={busyId === r.id}
                                                            onClick={() => toggleStatus(r)}
                                                            className="rounded-full px-2 py-1 text-[10px] font-bold border disabled:opacity-40"
                                                            style={{ borderColor: EKARI.hair, color: r.status === "active" ? "#6B7280" : EKARI.forest }}
                                                        >
                                                            {r.status === "active" ? "Disable" : "Enable"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={busyId === r.id}
                                                            onClick={() => deletePackage(r)}
                                                            className="rounded-full px-2 py-1 text-[10px] font-bold border disabled:opacity-40"
                                                            style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Edit modal */}
                {editOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
                        <div
                            className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border max-h-[90vh] flex flex-col overflow-hidden"
                            style={{ borderColor: EKARI.hair }}
                            role="dialog"
                            aria-modal="true"
                        >
                            {/* Header */}
                            <div className="px-4 py-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: EKARI.hair }}>
                                <div>
                                    <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                                        Edit package
                                    </div>
                                    <div className="text-[11px]" style={{ color: EKARI.dim }}>
                                        Changes apply to new checkouts and package visibility. Existing subscriptions can keep their packageId.
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setEditOpen(false)}
                                    aria-label="Close"
                                    className="h-9 w-9 rounded-xl border flex items-center justify-center text-lg font-bold hover:bg-gray-50"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-4 grid gap-3 md:grid-cols-2 overflow-y-auto">
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Package name</label>
                                    <input
                                        value={editForm.name}
                                        onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-500">Target sellers</label>
                                    <input
                                        value={editForm.target}
                                        onChange={(e) => setEditForm((p) => ({ ...p, target: e.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Monthly price (USD)</label>
                                    <input
                                        inputMode="decimal"
                                        value={editForm.priceMonthlyUsd}
                                        onChange={(e) => {
                                            const nextMonthly = e.target.value;
                                            setEditForm((p) => {
                                                const m = Number(nextMonthly);
                                                if (Number.isFinite(m) && m > 0) {
                                                    return {
                                                        ...p,
                                                        priceMonthlyUsd: nextMonthly,
                                                        priceYearlyUsd: String(calcYearlyFromMonthly(m, p.yearlyDiscountPct)),
                                                    };
                                                }
                                                return { ...p, priceMonthlyUsd: nextMonthly };
                                            });
                                        }}

                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Yearly discount</label>
                                    <select
                                        value={editForm.yearlyDiscountPct}
                                        onChange={(e) => {
                                            const pct = Number(e.target.value) as DiscountPct;
                                            setEditForm((p) => {
                                                const m = Number(p.priceMonthlyUsd);
                                                if (Number.isFinite(m) && m > 0) {
                                                    return {
                                                        ...p,
                                                        yearlyDiscountPct: pct,
                                                        priceYearlyUsd: String(calcYearlyFromMonthly(m, pct)),
                                                    };
                                                }
                                                return { ...p, yearlyDiscountPct: pct };
                                            });
                                        }}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    >
                                        {DISCOUNT_OPTIONS.map((pct) => (
                                            <option key={pct} value={pct}>
                                                {pct}%
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">
                                        Yearly price (USD)
                                        <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                                            Auto from monthly ×12 minus discount (editable)
                                        </span>
                                    </label>
                                    <input
                                        inputMode="decimal"
                                        value={editForm.priceYearlyUsd}
                                        onChange={(e) => setEditForm((p) => ({ ...p, priceYearlyUsd: e.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    />
                                </div>


                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Listings limit</label>
                                    <input
                                        value={editForm.activeListingsLimit}
                                        onChange={(e) => setEditForm((p) => ({ ...p, activeListingsLimit: e.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Analytics</label>
                                    <select
                                        value={editForm.analyticsLevel}
                                        onChange={(e) => setEditForm((p) => ({ ...p, analyticsLevel: e.target.value as any }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    >
                                        <option value="none">None</option>
                                        <option value="basic">Basic</option>
                                        <option value="advanced">Advanced</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2 grid gap-2 sm:grid-cols-2">
                                    {[
                                        { key: "priorityRanking", label: "Priority ranking" },
                                        { key: "topOfSearch", label: "Top-of-search bias" },
                                        { key: "verifiedBadge", label: "Verified seller badge" },
                                        { key: "storefront", label: "Dedicated storefront" },
                                    ].map((t) => (
                                        <label
                                            key={t.key}
                                            className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                                            style={{ borderColor: EKARI.hair }}
                                        >
                                            <span className="text-sm font-semibold" style={{ color: EKARI.text }}>
                                                {t.label}
                                            </span>
                                            <input
                                                type="checkbox"
                                                checked={(editForm as any)[t.key]}
                                                onChange={(e) => setEditForm((p) => ({ ...p, [t.key]: e.target.checked } as any))}
                                                className="h-4 w-4"
                                            />
                                        </label>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Boost credits / month</label>
                                    <input
                                        inputMode="numeric"
                                        value={editForm.monthlyBoostCredits}
                                        onChange={(e) => setEditForm((p) => ({ ...p, monthlyBoostCredits: e.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Featured credits / week</label>
                                    <input
                                        inputMode="numeric"
                                        value={editForm.weeklyFeaturedCredits}
                                        onChange={(e) => setEditForm((p) => ({ ...p, weeklyFeaturedCredits: e.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Status</label>
                                    <select
                                        value={editForm.status}
                                        onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as any }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none bg-white"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    >
                                        <option value="active">Active</option>
                                        <option value="disabled">Disabled</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-gray-500">Sort order</label>
                                    <input
                                        inputMode="numeric"
                                        value={editForm.sortOrder}
                                        onChange={(e) => setEditForm((p) => ({ ...p, sortOrder: e.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-xs font-semibold text-gray-500">Feature bullets (one per line)</label>
                                    <textarea
                                        value={editForm.featuresText}
                                        onChange={(e) => setEditForm((p) => ({ ...p, featuresText: e.target.value }))}
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
                                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                        rows={5}
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-4 py-3 border-t flex flex-wrap items-center gap-2 justify-end shrink-0 bg-white" style={{ borderColor: EKARI.hair }}>
                                <button
                                    type="button"
                                    onClick={() => setEditOpen(false)}
                                    className="rounded-xl px-4 py-2 text-sm font-bold border"
                                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={saveEdit}
                                    disabled={!editId || busyId === editId}
                                    className="rounded-xl px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
                                    style={{ backgroundColor: EKARI.forest }}
                                >
                                    {busyId === editId ? "Saving…" : "Save changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ConfirmModal
                open={!!confirmConfig}
                title={confirmConfig?.title || ""}
                message={confirmConfig?.message || ""}
                confirmText={confirmConfig?.confirmText || "Confirm"}
                cancelText={confirmConfig?.cancelText || "Cancel"}
                onConfirm={() => {
                    if (confirmConfig?.onConfirm) confirmConfig.onConfirm();
                    else setConfirmConfig(null);
                }}
                onCancel={() => setConfirmConfig(null)}
            />
        </>
    );
}
