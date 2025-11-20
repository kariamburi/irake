// app/admin/deeds/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    DocumentData,
    QuerySnapshot,
    updateDoc,
    doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DeedDoc, toDeed } from "@/lib/fire-queries";
import {
    IoAlertCircleOutline,
    IoChatbubbleEllipsesOutline,
    IoEyeOutline,
    IoHeartOutline,
    IoPlayCircleOutline,
    IoTimeOutline,
    IoEyeOffOutline,
    IoCheckmarkDone,
    IoTrashOutline,
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#F8FAFC",
    ink: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

type DeedStatus =
    | "ready"
    | "processing"
    | "mixing"
    | "uploading"
    | "failed"
    | "deleted"
    | string;

type Visibility =
    | "public"
    | "private"
    | "unlisted"
    | "contacts"
    | "hidden"
    | string;

type DeedAdminRow = DeedDoc & {
    id: string;
};

const STATUS_FILTERS = [
    { key: "all", label: "All" },
    { key: "ready", label: "Ready" },
    { key: "processing", label: "Processing" },
    { key: "failed", label: "Failed" },
];

function nfmt(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
}

/* ------------------------ Deed quick-view modal ------------------------ */

type DeedPreviewDoc = {
    caption?: string;
    authorUsername?: string | null;
    mediaThumbUrl?: string | null;
};

function DeedPreviewModal({
    deedId,
    onClose,
}: {
    deedId: string;
    onClose: () => void;
}) {
    const [deed, setDeed] = useState<DeedPreviewDoc | null>(null);
    const [loading, setLoading] = useState(true);

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

    const handle = deed?.authorUsername || undefined; // adjust if your field is named differently
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
                            style={{ color: EKARI.ink }}
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
                                style={{ borderColor: EKARI.hair, color: EKARI.ink }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                Open full page
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-full border text-xs font-bold hover:bg-gray-50"
                            style={{ borderColor: EKARI.hair, color: EKARI.ink }}
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
                            Could not load this deed. It may have been removed or you don&apos;t
                            have access.
                        </div>
                    ) : publicUrl ? (
                        <div className="flex-1">
                            <iframe
                                src={publicUrl}
                                title="Deed preview"
                                className="w-full h-full rounded-b-3xl"
                            />
                        </div>
                    ) : (
                        <div className="flex-1 p-4 text-sm" style={{ color: EKARI.ink }}>
                            <p className="mb-2 font-semibold">
                                This deed does not have an author handle yet, so the public page path
                                can&apos;t be built.
                            </p>
                            <p className="text-xs" style={{ color: EKARI.dim }}>
                                You can still open it from other admin tools that load the deed document
                                directly.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ------------------------------ Main page ------------------------------ */

export default function AdminDeedsPage() {
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<DeedAdminRow[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [previewDeedId, setPreviewDeedId] = useState<string | null>(null);

    // Listen to deeds with simple status filter
    useEffect(() => {
        setLoading(true);

        const baseRef = collection(db, "deeds");
        const constraints: any[] = [];

        if (statusFilter !== "all") {
            constraints.push(where("status", "==", statusFilter));
        }

        constraints.push(orderBy("createdAt", "desc"), limit(80));

        const q = query(baseRef, ...constraints);

        const unsub = onSnapshot(
            q,
            (qs: QuerySnapshot<DocumentData>) => {
                const items: DeedAdminRow[] = qs.docs.map(
                    (d) =>
                    ({
                        ...toDeed(d.data(), d.id),
                        id: d.id,
                    } as DeedAdminRow)
                );
                setRows(items);
                setLoading(false);
            },
            (err) => {
                console.error("Admin deeds listener error:", err);
                setRows([]);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [statusFilter]);

    const stats = useMemo(() => {
        const total = rows.length;
        const ready = rows.filter((d) => (d.status as DeedStatus) === "ready").length;
        const failed = rows.filter((d) => (d.status as DeedStatus) === "failed").length;
        const processing = rows.filter((d) =>
            ["uploading", "processing", "mixing"].includes(d.status as DeedStatus)
        ).length;

        return { total, ready, failed, processing };
    }, [rows]);

    const formatDate = (ts: any) => {
        if (!ts) return "";
        if (ts.toDate) return ts.toDate().toLocaleString();
        if (typeof ts === "string") return ts;
        return "";
    };

    const statusPillClass = (status: DeedStatus) => {
        switch (status) {
            case "ready":
                return "bg-emerald-50 text-emerald-700 border-emerald-100";
            case "failed":
                return "bg-rose-50 text-rose-700 border-rose-100";
            case "deleted":
                return "bg-slate-100 text-slate-600 border-slate-200";
            case "uploading":
            case "mixing":
            case "processing":
                return "bg-amber-50 text-amber-700 border-amber-100";
            default:
                return "bg-slate-50 text-slate-600 border-slate-200";
        }
    };

    const visibilityPillClass = (vis?: Visibility) => {
        if (!vis || vis === "public") {
            return "bg-emerald-50 text-emerald-700 border-emerald-100";
        }
        if (vis === "hidden") {
            return "bg-slate-200 text-slate-700 border-slate-300";
        }
        if (vis === "private" || vis === "contacts") {
            return "bg-indigo-50 text-indigo-700 border-indigo-100";
        }
        return "bg-slate-50 text-slate-600 border-slate-200";
    };

    const updateDeedStatus = async (row: DeedAdminRow, newStatus: DeedStatus) => {
        if (!row.id) return;
        const id = row.id;
        setBusyId(id);
        try {
            await updateDoc(doc(db, "deeds", id), {
                status: newStatus,
                updatedAt: new Date().toISOString(),
            });
        } catch (e: any) {
            alert(e?.message || "Failed to update status.");
        } finally {
            setBusyId(null);
        }
    };

    const updateVisibility = async (row: DeedAdminRow, vis: Visibility) => {
        if (!row.id) return;
        const id = row.id;
        setBusyId(id);
        try {
            await updateDoc(doc(db, "deeds", id), {
                visibility: vis,
                updatedAt: new Date().toISOString(),
            });
        } catch (e: any) {
            alert(e?.message || "Failed to update visibility.");
        } finally {
            setBusyId(null);
        }
    };

    const softDelete = async (row: DeedAdminRow) => {
        if (!row.id) return;
        const ok = window.confirm(
            "Soft-delete this deed? It will be removed from feeds but kept for audit."
        );
        if (!ok) return;
        setBusyId(row.id);
        try {
            await updateDoc(doc(db, "deeds", row.id), {
                status: "deleted",
                visibility: "hidden",
                updatedAt: new Date().toISOString(),
            });
        } catch (e: any) {
            alert(e?.message || "Failed to delete deed.");
        } finally {
            setBusyId(null);
        }
    };

    const closePreview = () => setPreviewDeedId(null);

    return (
        <>
            <div className="min-h-full bg-slate-50">
                <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <div>
                            <h1
                                className="text-xl md:text-2xl font-extrabold"
                                style={{ color: EKARI.ink }}
                            >
                                Deeds moderation
                            </h1>
                            <p className="text-xs md:text-sm" style={{ color: EKARI.dim }}>
                                Review, feature, or hide deeds across ekarihub. This view is only
                                visible to ekarihub staff.
                            </p>
                        </div>

                        {/* Status filter pills */}
                        <div className="flex items-center gap-2">
                            {STATUS_FILTERS.map((f) => {
                                const active = statusFilter === f.key;
                                return (
                                    <button
                                        key={f.key}
                                        onClick={() => setStatusFilter(f.key)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                            }`}
                                    >
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top stats strip */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                        <StatCard label="Total (filtered)" value={stats.total} tone="default" />
                        <StatCard label="Ready" value={stats.ready} tone="success" />
                        <StatCard label="Processing" value={stats.processing} tone="warn" />
                        <StatCard label="Failed" value={stats.failed} tone="danger" />
                    </div>

                    {/* Info strip */}
                    <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 flex items-start gap-2 text-xs text-amber-800">
                        <IoAlertCircleOutline className="mt-0.5" />
                        <p>
                            Focus on <span className="font-semibold">failed</span> and{" "}
                            <span className="font-semibold">processing</span> deeds first, then{" "}
                            <span className="font-semibold">abusive / hidden</span> content. Use
                            the status & visibility controls on each row to manage what appears
                            in feeds.
                        </p>
                    </div>

                    {/* Table */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="py-8 flex items-center justify-center text-sm text-slate-500">
                                <BouncingBallLoader />
                                <span className="ml-2">Loading deeds…</span>
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="py-8 flex items-center justify-center text-sm text-slate-500">
                                No deeds found for this filter.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-xs md:text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-[11px] uppercase text-slate-500">
                                            <th className="py-2 pl-4 pr-3">Deed</th>
                                            <th className="py-2 px-3 hidden md:table-cell">Creator</th>
                                            <th className="py-2 px-3">Engagement</th>
                                            <th className="py-2 px-3 hidden md:table-cell">Visibility</th>
                                            <th className="py-2 px-3">Status</th>
                                            <th className="py-2 px-3 pr-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((d) => {
                                            const status = (d.status as DeedStatus) || "ready";
                                            const vis = (d.visibility as Visibility) || "public";
                                            const likes = Number(d.stats?.likes ?? 0);
                                            const comments = Number(d.stats?.comments ?? 0);
                                            const views = Number(d.stats?.views ?? 0);
                                            const isVideo =
                                                !!d.media &&
                                                Array.isArray(d.media) &&
                                                (d.media[0] as any)?.type === "video";

                                            const isBusy = busyId === d.id;

                                            return (
                                                <tr
                                                    key={d.id}
                                                    className="border-b border-slate-50 last:border-none"
                                                >
                                                    {/* Deed summary */}
                                                    <td className="py-2 pl-4 pr-3 align-top">
                                                        <div className="flex items-start gap-2">
                                                            <div className="mt-0.5">
                                                                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                                                                    <IoPlayCircleOutline
                                                                        className="text-slate-500"
                                                                        size={18}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs md:text-sm font-semibold text-slate-900 line-clamp-2">
                                                                    {d.caption || "Untitled deed"}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-2">
                                                                    <span>
                                                                        ID:{" "}
                                                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                                            {d.id}
                                                                        </span>
                                                                    </span>
                                                                    {isVideo && (
                                                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                                                            Video
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                                                                    <IoTimeOutline size={12} />
                                                                    <span>{formatDate(d.createdAt)}</span>
                                                                    {status !== "ready" && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span className="capitalize">
                                                                                {status.toLowerCase()}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Creator */}
                                                    <td className="py-2 px-3 align-top hidden md:table-cell">
                                                        {d.authorId ? (
                                                            <span className="inline-flex items-center text-[11px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                                                {d.authorId}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400 italic">
                                                                Unknown
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Engagement */}
                                                    <td className="py-2 px-3 align-top">
                                                        <div className="flex flex-col gap-0.5 text-[11px] text-slate-600">
                                                            <div className="flex items-center gap-1.5">
                                                                <IoHeartOutline
                                                                    className="text-rose-400"
                                                                    size={12}
                                                                />
                                                                <span>{nfmt(likes)} likes</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <IoChatbubbleEllipsesOutline
                                                                    className="text-slate-400"
                                                                    size={12}
                                                                />
                                                                <span>{nfmt(comments)} comments</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <IoEyeOutline className="text-slate-400" size={12} />
                                                                <span>{nfmt(views)} views</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Visibility */}
                                                    <td className="py-2 px-3 align-top hidden md:table-cell">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${visibilityPillClass(
                                                                vis
                                                            )}`}
                                                        >
                                                            {vis || "public"}
                                                        </span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-2 px-3 align-top">
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusPillClass(
                                                                status
                                                            )}`}
                                                        >
                                                            {status}
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="py-2 px-3 pr-4 align-top">
                                                        <div className="flex flex-col gap-1 text-[11px]">
                                                            {/* Preview deed in modal */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewDeedId(d.id)}
                                                                className="text-emerald-700 font-semibold hover:underline text-left"
                                                            >
                                                                Preview deed
                                                            </button>

                                                            {/* Visibility controls */}
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {vis !== "public" && (
                                                                    <button
                                                                        disabled={isBusy}
                                                                        onClick={() => updateVisibility(d, "public")}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-semibold hover:opacity-90 disabled:opacity-60"
                                                                    >
                                                                        <IoCheckmarkDone size={12} />
                                                                        Public
                                                                    </button>
                                                                )}
                                                                {vis !== "hidden" && (
                                                                    <button
                                                                        disabled={isBusy}
                                                                        onClick={() => updateVisibility(d, "hidden")}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700 text-white font-semibold hover:opacity-90 disabled:opacity-60"
                                                                    >
                                                                        <IoEyeOffOutline size={12} />
                                                                        Hide
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {/* Status / delete */}
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {status !== "ready" && (
                                                                    <button
                                                                        disabled={isBusy}
                                                                        onClick={() => updateDeedStatus(d, "ready")}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 font-semibold hover:bg-emerald-100 disabled:opacity-60"
                                                                    >
                                                                        <IoCheckmarkDone size={12} />
                                                                        Mark ready
                                                                    </button>
                                                                )}
                                                                {status !== "failed" && (
                                                                    <button
                                                                        disabled={isBusy}
                                                                        onClick={() => updateDeedStatus(d, "failed")}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-200 text-amber-700 bg-amber-50 font-semibold hover:bg-amber-100 disabled:opacity-60"
                                                                    >
                                                                        <IoAlertCircleOutline size={12} />
                                                                        Mark failed
                                                                    </button>
                                                                )}
                                                                {status !== "deleted" && (
                                                                    <button
                                                                        disabled={isBusy}
                                                                        onClick={() => softDelete(d)}
                                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-60"
                                                                    >
                                                                        <IoTrashOutline size={12} />
                                                                        Delete
                                                                    </button>
                                                                )}
                                                            </div>

                                                            {isBusy && (
                                                                <span className="mt-0.5 text-[10px] text-slate-400">
                                                                    Working…
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {previewDeedId && (
                <DeedPreviewModal deedId={previewDeedId} onClose={closePreview} />
            )}
        </>
    );
}

function StatCard({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "default" | "success" | "warn" | "danger";
}) {
    let bg = "bg-slate-50 border-slate-200 text-slate-700";
    if (tone === "success")
        bg = "bg-emerald-50 border-emerald-100 text-emerald-800";
    if (tone === "warn") bg = "bg-amber-50 border-amber-100 text-amber-800";
    if (tone === "danger") bg = "bg-rose-50 border-rose-100 text-rose-800";

    return (
        <div
            className={`rounded-2xl border px-3 py-2 flex flex-col justify-center ${bg}`}
        >
            <span className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                {label}
            </span>
            <span className="text-lg font-extrabold leading-tight">{nfmt(value)}</span>
        </div>
    );
}
