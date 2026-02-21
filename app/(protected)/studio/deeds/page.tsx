// app/studio/posts/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    DocumentData,
    doc,
    updateDoc,
    serverTimestamp,
    deleteDoc,
} from "firebase/firestore";
import { getStorage, ref as storageRef, deleteObject } from "firebase/storage";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import StudioShell from "../components/StudioShell";
import AppShell from "@/app/components/AppShell";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import TikBallsLoader from "@/components/ui/TikBallsLoader";

import {
    IoSearchOutline,
    IoTimeOutline,
    IoPencilOutline,
    IoChatbubbleEllipsesOutline,
    IoTrashOutline,
    IoChevronDown,
    IoCheckmark,
    IoTrendingUpOutline,
    IoSparklesOutline,
    IoEyeOutline,
    IoHeartOutline,
} from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";

/* ---------- Types ---------- */
export type Deed = {
    id: string;
    authorUsername: string;
    caption?: string;
    createdAt?: any; // Firestore Timestamp
    createdAtMs?: number;
    visibility?: "public" | "followers" | "private";
    status?: "ready" | "processing" | "uploading" | "failed" | "deleted";
    stats?: { views?: number; likes?: number; comments?: number };
    type?: "video" | "photo" | "text";
    media?: Array<{
        url: string;
        width?: number;
        height?: number;
        durationSec?: number;
        thumbUrl?: string;
        storagePath?: string;
        kind?: "video" | "image";
        muxAssetId?: string;
    }>;
    mediaThumbUrl?: string;
};

const PAGE_SIZE = 20;

/* ---------- brand ---------- */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
    sub: "#5C6B66",
};

/* ---------- responsive helpers ---------- */
function useMediaQuery(queryStr: string) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia(queryStr);
        const onChange = () => setMatches(mq.matches);
        onChange();
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, [queryStr]);
    return matches;
}
function useIsDesktop() {
    return useMediaQuery("(min-width: 1024px)");
}
function useIsMobile() {
    return useMediaQuery("(max-width: 1023px)");
}

/* ---------- API helpers ---------- */
async function deleteMuxAsset(assetId: string) {
    const res = await fetch(
        `https://us-central1-ekarihub-aed5a.cloudfunctions.net/muxDeleteAsset?assetId=${encodeURIComponent(
            assetId
        )}`,
        { method: "DELETE" }
    );
    if (!res.ok) throw new Error(`Mux delete failed: ${await res.text()}`);
}

function Toast({ text }: { text: string }) {
    return (
        <div className="fixed bottom-4 left-1/2 z-[110] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            {text}
        </div>
    );
}

function StatusBadge({ s }: { s: Deed["status"] }) {
    const map: Record<string, string> = {
        ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
        processing: "bg-sky-100 text-sky-700 border-sky-200",
        uploading: "bg-amber-100 text-amber-700 border-amber-200",
        failed: "bg-rose-100 text-rose-700 border-rose-200",
        deleted: "bg-slate-100 text-slate-600 border-slate-200",
    };
    const k = s || "ready";
    return (
        <span
            className={clsx(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold border",
                map[k] || map.ready
            )}
        >
            {k}
        </span>
    );
}

function cap(s?: string) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function hexToRgba(hex: string, alpha: number) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
    if (!m) return hex;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/* ---------- premium UI helpers ---------- */
function PremiumSurface({
    children,
    className,
    style,
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <div
            className={clsx(
                "rounded-3xl border bg-white/80 backdrop-blur-xl",
                "shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
                className
            )}
            style={style}
        >
            {children}
        </div>
    );
}

function Pill({
    children,
    className,
    style,
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <span
            className={clsx(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-extrabold border",
                className
            )}
            style={style}
        >
            {children}
        </span>
    );
}

function nfmt(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
}

/* ---------- Page ---------- */
export default function PostsPage() {
    const { user } = useAuth();
    const uid = user?.uid;
    const router = useRouter();

    const isDesktop = useIsDesktop();
    const isMobile = useIsMobile();

    const ringStyle: React.CSSProperties = {
        ["--tw-ring-color" as any]: EKARI.forest,
    };

    const premiumBg = useMemo<React.CSSProperties>(
        () => ({
            background:
                "radial-gradient(900px circle at 10% 0%, rgba(199,146,87,0.22), rgba(255,255,255,0) 55%), radial-gradient(900px circle at 90% 20%, rgba(35,63,57,0.16), rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,1))",
        }),
        []
    );

    const goBack = useCallback(() => {
        if (window.history.length > 1) router.back();
        else router.push("/studio/overview");
    }, [router]);

    const [rows, setRows] = useState<Deed[]>([]);
    const [loading, setLoading] = useState(true);
    const [moreLoading, setMoreLoading] = useState(false);
    const [cursor, setCursor] = useState<DocumentData | null>(null);
    const [q, setQ] = useState("");
    const [privacyFilter, setPrivacyFilter] =
        useState<"all" | "public" | "followers" | "private">("all");

    // selection state
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const selectedIds = useMemo(
        () => Object.keys(selected).filter((id) => selected[id]),
        [selected]
    );
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [confirmBulk, setConfirmBulk] = useState(false);
    const [busyDelete, setBusyDelete] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // initial load
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!uid) {
                setRows([]);
                setLoading(false);
                return;
            }
            setLoading(true);
            const base = query(
                collection(db, "deeds"),
                where("authorId", "==", uid),
                orderBy("createdAt", "desc"),
                limit(PAGE_SIZE)
            );
            const snap = await getDocs(base);
            if (cancelled) return;
            const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Deed[];
            setRows(docs);
            setCursor(snap.docs[snap.docs.length - 1] ?? null);
            setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [uid]);

    async function loadMore() {
        if (!uid || !cursor) return;
        setMoreLoading(true);
        const qy = query(
            collection(db, "deeds"),
            where("authorId", "==", uid),
            orderBy("createdAt", "desc"),
            startAfter(cursor),
            limit(PAGE_SIZE)
        );
        const snap = await getDocs(qy);
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Deed[];
        setRows((prev) => [...prev, ...docs]);
        setCursor(snap.docs[snap.docs.length - 1] ?? null);
        setMoreLoading(false);
    }

    const filtered = useMemo(() => {
        const ql = q.trim().toLowerCase();
        return rows.filter((r) => {
            const okQ = ql ? (r.caption || "").toLowerCase().includes(ql) : true;
            const okP = privacyFilter === "all" ? true : (r.visibility || "public") === privacyFilter;
            return okQ && okP && r.status !== "deleted";
        });
    }, [rows, q, privacyFilter]);

    const allOnPageSelected = useMemo(() => {
        if (!filtered.length) return false;
        return filtered.every((r) => selected[r.id]);
    }, [filtered, selected]);

    function toggleSelectAll() {
        const next: Record<string, boolean> = { ...selected };
        const makeTrue = !allOnPageSelected;
        for (const r of filtered) next[r.id] = makeTrue;
        setSelected(next);
    }

    async function updateVisibility(id: string, v: "public" | "followers" | "private") {
        await updateDoc(doc(db, "deeds", id), { visibility: v, updatedAt: serverTimestamp() });
        setRows((prev) => prev.map((p) => (p.id === id ? { ...p, visibility: v } : p)));
    }

    function requestDelete(id: string) {
        setConfirmId(id);
    }
    async function deleteDeedViaCloudFunction(deedId: string) {
        const fn = httpsCallable(getFunctions(), "deleteDeedCascade");
        const res = await fn({ deedId });
        return res.data as { ok: boolean; deedId: string; muxAssetId?: string | null; muxDeleted?: boolean };
    }
    async function hardDeleteSingle(id: string) {
        // ✅ call the same cascade used by mobile
        await deleteDeedViaCloudFunction(id);

        // ✅ update UI
        setRows((prev) => prev.filter((p) => p.id !== id));
    }
    async function hardDelete(id: string) {
        try {
            setBusyDelete(true);
            await hardDeleteSingle(id);
            setToast("Deed deleted");
        } catch (err: any) {
            console.error(err);
            setToast(err?.message || "Failed to delete");
        } finally {
            setBusyDelete(false);
            setConfirmId(null);
            setTimeout(() => setToast(null), 2200);
        }
    }

    async function hardDeleteBulk() {
        try {
            setBusyDelete(true);
            for (const id of selectedIds) {
                // eslint-disable-next-line no-await-in-loop
                await hardDeleteSingle(id);
            }
            setToast(`${selectedIds.length} post(s) deleted`);
            setSelected({});
        } catch (err: any) {
            console.error(err);
            setToast(err?.message || "Bulk delete failed");
        } finally {
            setBusyDelete(false);
            setConfirmBulk(false);
            setTimeout(() => setToast(null), 2400);
        }
    }

    /* ---------- Header (premium) ---------- */
    const Header = (
        <div
            className={clsx("sticky top-0 z-50")}
            style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))",
                backdropFilter: "blur(14px)",
                borderBottom: "1px solid rgba(199,146,87,0.18)",
            }}
        >
            <div className={clsx(isDesktop ? "px-4 max-w-[1180px] mx-auto" : "px-3")}>
                <div className="h-[72px] flex items-center justify-between gap-3">
                    <button
                        onClick={goBack}
                        className="h-11 w-11 rounded-2xl border bg-white/80 backdrop-blur-xl shadow-sm grid place-items-center transition hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
                        style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={18} style={{ color: EKARI.text }} />
                    </button>

                    <div className="flex-1 min-w-0">
                        <div className="font-black text-[18px] leading-none truncate" style={{ color: EKARI.text }}>
                            Studio
                        </div>
                        <div className="text-[12px] mt-1 font-semibold truncate" style={{ color: EKARI.dim }}>
                            Deeds • {filtered.length} visible
                        </div>
                    </div>

                    <Link
                        href="/studio/upload"
                        className="h-11 px-4 rounded-full border bg-white/80 backdrop-blur-xl shadow-sm flex items-center gap-2 font-extrabold text-[13px] transition hover:bg-white active:scale-[0.98]"
                        style={{ borderColor: "rgba(199,146,87,0.22)", color: EKARI.text }}
                    >
                        <span
                            className="h-8 w-8 rounded-2xl grid place-items-center border"
                            style={{
                                borderColor: "rgba(199,146,87,0.18)",
                                background: "linear-gradient(135deg, rgba(199,146,87,0.22), rgba(35,63,57,0.06))",
                            }}
                        >
                            <IoSparklesOutline size={16} style={{ color: EKARI.forest }} />
                        </span>
                        Upload
                    </Link>
                </div>
            </div>
        </div>
    );

    /* ---------- Body ---------- */
    const Body = (
        <div className={clsx(isDesktop ? "max-w-[1180px] mx-auto px-4 pb-10" : "px-3 pb-10")}>
            {/* Toolbar */}
            <div className={clsx(isDesktop ? "pt-4" : "pt-3")}>
                <PremiumSurface
                    className="px-4 py-4"
                    style={{
                        borderColor: "rgba(199,146,87,0.20)",
                        background: "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
                    }}
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="text-[18px] font-black" style={{ color: EKARI.text }}>
                                Deeds
                            </div>
                            <div className="text-[12px] font-semibold mt-0.5" style={{ color: EKARI.sub }}>
                                Manage visibility, analytics and cleanup
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            {/* Privacy filter pills */}
                            <div className="flex flex-wrap items-center gap-2">
                                {(["all", "public", "followers", "private"] as const).map((p) => {
                                    const active = privacyFilter === p;
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPrivacyFilter(p)}
                                            className={clsx(
                                                "rounded-full px-3 py-1 text-[12px] font-extrabold border transition active:scale-[0.99]",
                                                active ? "bg-white" : "bg-white/50 hover:bg-white"
                                            )}
                                            style={{
                                                borderColor: active ? "rgba(199,146,87,0.35)" : "rgba(199,146,87,0.18)",
                                                color: EKARI.text,
                                                boxShadow: active ? "0 10px 30px rgba(15,23,42,0.08)" : undefined,
                                            }}
                                        >
                                            {p === "all" ? "All" : p === "followers" ? "Followers" : cap(p)}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Search */}
                            <div
                                className="flex items-center gap-2 rounded-2xl border px-3 py-2 bg-white/70 backdrop-blur-xl shadow-sm"
                                style={{ borderColor: "rgba(199,146,87,0.18)" }}
                            >
                                <IoSearchOutline className="opacity-70" />
                                <input
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Search post description…"
                                    className="w-full sm:w-64 bg-transparent text-sm outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Bulk bar */}
                    {selectedIds.length > 0 && (
                        <div className="mt-3 rounded-2xl border px-3 py-2 flex items-center justify-between gap-2 bg-white/70">
                            <div className="text-[12px] font-extrabold" style={{ color: EKARI.text }}>
                                {selectedIds.length} selected
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    className="rounded-full px-3 py-1.5 text-[12px] font-extrabold border bg-white hover:bg-white/90 transition"
                                    onClick={() => setConfirmBulk(true)}
                                    style={{ borderColor: "rgba(199,146,87,0.22)", color: EKARI.text }}
                                >
                                    Delete selected
                                </button>
                                <button
                                    className="rounded-full px-3 py-1.5 text-[12px] font-extrabold border bg-white/50 hover:bg-white transition"
                                    onClick={() => setSelected({})}
                                    style={{ borderColor: "rgba(199,146,87,0.18)", color: EKARI.dim }}
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    )}
                </PremiumSurface>
            </div>

            {/* List container */}
            <div className={clsx(isDesktop ? "mt-4" : "mt-3")}>
                <PremiumSurface
                    className="p-2 overflow-x-hidden"
                    style={{
                        borderColor: "rgba(199,146,87,0.20)",
                        background: "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
                    }}
                >
                    {/* Desktop header (✅ responsive grid, no horizontal scroll) */}
                    <div
                        className="hidden md:block px-2 py-1"
                        style={{ color: EKARI.dim }}
                    >
                        <div
                            className={clsx(
                                "grid w-full items-center gap-3 px-3 py-2 text-[11px] font-extrabold"
                            )}
                            style={{ borderBottom: "1px solid rgba(199,146,87,0.14)" }}
                        >
                            {/* md: hide Likes/Comments to save width; lg: show them */}
                            <div className="grid w-full grid-cols-[24px_minmax(240px,1fr)_120px_80px_100px_140px] lg:grid-cols-[24px_minmax(260px,1fr)_120px_80px_80px_90px_100px_140px] items-center gap-1">
                                <div className="flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        aria-label="Select all"
                                        checked={allOnPageSelected}
                                        onChange={toggleSelectAll}
                                    />
                                </div>
                                <div>Deed (created)</div>
                                <div className="text-center">Privacy</div>
                                <div className="text-center">Views</div>
                                <div className="hidden lg:block text-center">Likes</div>
                                <div className="hidden lg:block text-center">Comments</div>
                                <div className="text-center">Status</div>
                                <div className="text-center">Actions</div>
                            </div>
                        </div>
                    </div>

                    {/* Rows */}
                    {loading ? (
                        <div className="flex items-center justify-center p-10">
                            <TikBallsLoader />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <div
                                className="mx-auto h-14 w-14 rounded-3xl grid place-items-center mb-3 border"
                                style={{
                                    borderColor: "rgba(199,146,87,0.20)",
                                    background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
                                }}
                            >
                                <IoSparklesOutline size={24} style={{ color: EKARI.forest }} />
                            </div>
                            <div className="text-[16px] font-black" style={{ color: EKARI.text }}>
                                No deeds yet
                            </div>
                            <div className="mt-1 text-sm font-semibold" style={{ color: EKARI.dim }}>
                                Upload your first deed to start building your profile.
                            </div>
                            <div className="mt-5">
                                <Link
                                    href="/studio/upload"
                                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-extrabold border bg-white hover:bg-white/90 transition"
                                    style={{ borderColor: "rgba(199,146,87,0.22)", color: EKARI.text }}
                                >
                                    <IoSparklesOutline />
                                    Upload a deed
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2 p-2">
                            {filtered.map((r) => (
                                <PostRowPremium
                                    key={r.id}
                                    row={r}
                                    selected={!!selected[r.id]}
                                    onToggleSelect={() => setSelected((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                                    onChangePrivacy={updateVisibility}
                                    onDelete={() => requestDelete(r.id)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Load more */}
                    {cursor && (
                        <div className="pt-2 pb-1 text-center">
                            <button
                                className="rounded-full border px-5 py-2 text-[13px] font-extrabold bg-white/70 hover:bg-white transition disabled:opacity-60"
                                onClick={loadMore}
                                disabled={moreLoading}
                                style={{ borderColor: "rgba(199,146,87,0.22)", color: EKARI.text }}
                            >
                                {moreLoading ? "Loading…" : "Load more"}
                            </button>
                        </div>
                    )}
                </PremiumSurface>
            </div>

            {/* Delete confirm modal (single) */}
            <ConfirmModal
                open={!!confirmId}
                title="Delete deed?"
                message="This will remove the deed and its media. This action cannot be undone."
                confirmText={busyDelete ? "Deleting…" : "Delete"}
                cancelText="Cancel"
                onCancel={() => {
                    if (busyDelete) return;
                    setConfirmId(null);
                }}
                onConfirm={() => {
                    if (!confirmId || busyDelete) return;
                    void hardDelete(confirmId);
                }}
            />

            {/* Bulk delete modal */}
            <ConfirmModal
                open={confirmBulk}
                title="Delete selected deeds?"
                message={`You are about to delete ${selectedIds.length} deed(s), including their media and any linked assets. This action cannot be undone.`}
                confirmText={busyDelete ? "Deleting…" : "Delete all"}
                cancelText="Cancel"
                onCancel={() => {
                    if (busyDelete) return;
                    setConfirmBulk(false);
                }}
                onConfirm={() => {
                    if (busyDelete || selectedIds.length === 0) return;
                    void hardDeleteBulk();
                }}
            />

            {toast && <Toast text={toast} />}
        </div>
    );

    // MOBILE: fixed inset, NO bottom tabs
    if (isMobile) {
        return (
            <div className="fixed inset-0 flex flex-col" style={premiumBg}>
                {Header}
                <div className="flex-1 overflow-y-auto overscroll-contain">{Body}</div>
            </div>
        );
    }

    // DESKTOP: AppShell + StudioShell
    return (
        <AppShell>
            <StudioShell title="Deeds" ctaHref="/studio/upload" ctaLabel="Upload">
                <div className="min-h-screen w-full" style={premiumBg}>
                    {Header}
                    {Body}
                </div>
            </StudioShell>
        </AppShell>
    );
}

/* ---------- Premium Row ---------- */
function PostRowPremium({
    row,
    selected,
    onToggleSelect,
    onChangePrivacy,
    onDelete,
}: {
    row: Deed;
    selected: boolean;
    onToggleSelect: () => void;
    onChangePrivacy: (id: string, v: "public" | "followers" | "private") => void;
    onDelete: () => void;
}) {
    const [openMenu, setOpenMenu] = useState(false);
    const router = useRouter();

    const created =
        row.createdAt?.toDate?.() instanceof Date
            ? row.createdAt.toDate()
            : row.createdAtMs
                ? new Date(row.createdAtMs)
                : null;

    const dateStr = created ? created.toLocaleString() : "—";
    const views = nfmt(row.stats?.views ?? 0);
    const likes = nfmt(row.stats?.likes ?? 0);
    const comments = nfmt(row.stats?.comments ?? 0);

    const poster =
        row.media?.find((m) => m.thumbUrl)?.thumbUrl ||
        row.mediaThumbUrl ||
        row.media?.[0]?.url ||
        "/video-placeholder.jpg";

    return (
        <div
            className={clsx(
                "w-full min-w-0 rounded-3xl border bg-white/70 backdrop-blur-xl shadow-sm",
                "transition hover:shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
                selected ? "ring-2" : ""
            )}
            style={{
                borderColor: "rgba(199,146,87,0.20)",
                ["--tw-ring-color" as any]: hexToRgba(EKARI.gold, 0.55),
            }}
        >
            {/* DESKTOP layout (✅ responsive grid, no horizontal scroll) */}
            <div className="hidden md:block px-1">
                <div className="grid w-full grid-cols-[24px_minmax(240px,1fr)_120px_80px_100px_140px] lg:grid-cols-[24px_minmax(260px,1fr)_120px_80px_80px_90px_100px_140px] items-center gap-1 px-3 py-3">
                    <div className="flex items-center justify-center">
                        <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label="Select row" />
                    </div>

                    <button
                        onClick={() => router.push(`/${row.authorUsername}/deed/${row.id}`)}
                        className="flex min-w-0 items-center gap-3 text-left"
                    >
                        <UniformThumbPremium src={poster} dateStr={dateStr} />
                        <div className="min-w-0">
                            <div className="text-[12px] font-extrabold text-slate-700 truncate">
                                {row.caption?.trim() ? row.caption : "—"}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 truncate">{dateStr}</div>
                        </div>
                    </button>

                    <div className="relative flex items-center justify-center">
                        <button
                            onClick={() => setOpenMenu((v) => !v)}
                            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-extrabold bg-white/70 hover:bg-white transition"
                            style={{ borderColor: "rgba(199,146,87,0.22)", color: EKARI.text }}
                        >
                            {cap(row.visibility || "public")}
                            <IoChevronDown />
                        </button>

                        {openMenu && (
                            <div
                                className="absolute z-20 mt-14 w-40 overflow-hidden rounded-2xl border bg-white/90 backdrop-blur-xl shadow-lg"
                                style={{ borderColor: "rgba(199,146,87,0.22)" }}
                            >
                                {(["public", "followers", "private"] as const).map((v) => (
                                    <button
                                        key={v}
                                        onClick={() => {
                                            onChangePrivacy(row.id, v as any);
                                            setOpenMenu(false);
                                        }}
                                        className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-extrabold hover:bg-black/5"
                                        style={{ color: EKARI.text }}
                                    >
                                        <span className="capitalize">{v}</span>
                                        {row.visibility === v && <IoCheckmark />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="text-center text-[12px] font-extrabold text-slate-700">{views}</div>

                    {/* Likes + Comments only on lg */}
                    <div className="hidden lg:block text-center text-[12px] font-extrabold text-slate-700">{likes}</div>
                    <div className="hidden lg:block text-center text-[12px] font-extrabold text-slate-700">{comments}</div>

                    <div className="text-center">
                        <StatusBadge s={row.status} />
                    </div>

                    <div className="flex items-center justify-center gap-1">
                        {/*<IconBtn title="Edit" href={`/studio/upload?editDeedId=${row.id}`} /> */}
                        <IconBtn title="Analytics" href={`/studio/analytics/${row.id}`} variant="ghost" />
                        <IconBtn title="Comments" href={`/${row.authorUsername}/deed/${row.id}`} variant="ghost" />
                        <button className="rounded-full p-2 hover:bg-black/5" title="Delete" onClick={onDelete}>
                            <IoTrashOutline />
                        </button>
                    </div>
                </div>
            </div>

            {/* MOBILE layout (card) */}
            <div className="md:hidden px-3 py-3">
                <div className="flex items-start gap-3">
                    <div className="pt-1">
                        <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label="Select row" />
                    </div>

                    <button
                        onClick={() => router.push(`/${row.authorUsername}/deed/${row.id}`)}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left"
                    >
                        <UniformThumbPremium src={poster} dateStr={dateStr} />
                        <div className="min-w-0">
                            <div className="text-[13px] font-black text-slate-800 truncate">
                                {row.caption?.trim() ? row.caption : "Untitled deed"}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 truncate mt-0.5">{dateStr}</div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Pill
                                    className="bg-white/70"
                                    style={{ borderColor: "rgba(199,146,87,0.18)", color: EKARI.text }}
                                >
                                    {cap(row.visibility || "public")}
                                </Pill>

                                <Pill className="bg-slate-50" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                                    <IoEyeOutline className="opacity-70" /> {views}
                                </Pill>
                                <Pill className="bg-slate-50" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                                    <IoHeartOutline className="opacity-70" /> {likes}
                                </Pill>
                                <Pill className="bg-slate-50" style={{ borderColor: "rgba(15,23,42,0.06)" }}>
                                    💬 {comments}
                                </Pill>

                                <StatusBadge s={row.status} />
                            </div>
                        </div>
                    </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                    <button
                        onClick={() => setOpenMenu((v) => !v)}
                        className="flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-extrabold bg-white/70 hover:bg-white transition"
                        style={{ borderColor: "rgba(199,146,87,0.22)", color: EKARI.text }}
                    >
                        <span
                            className="h-8 w-8 rounded-2xl grid place-items-center border"
                            style={{
                                borderColor: "rgba(199,146,87,0.18)",
                                background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
                            }}
                        >
                            <IoChevronDown style={{ color: EKARI.forest }} />
                        </span>
                        Privacy
                    </button>

                    <div className="flex items-center gap-1">
                        <IconBtn title="Edit" href={`/studio/upload?editDeedId=${row.id}`} />
                        <IconBtn title="Analytics" href={`/studio/analytics/${row.id}`} variant="ghost" />
                        <IconBtn title="Comments" href={`/${row.authorUsername}/deed/${row.id}`} variant="ghost" />
                        <button className="rounded-full p-2 hover:bg-black/5" title="Delete" onClick={onDelete}>
                            <IoTrashOutline />
                        </button>
                    </div>
                </div>

                {openMenu && (
                    <div
                        className="mt-2 overflow-hidden rounded-2xl border bg-white/90 backdrop-blur-xl shadow-lg"
                        style={{ borderColor: "rgba(199,146,87,0.22)" }}
                    >
                        {(["public", "followers", "private"] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => {
                                    onChangePrivacy(row.id, v as any);
                                    setOpenMenu(false);
                                }}
                                className="flex w-full items-center justify-between px-3 py-3 text-left text-[12px] font-extrabold hover:bg-black/5"
                                style={{ color: EKARI.text }}
                            >
                                <span className="capitalize">{v}</span>
                                {row.visibility === v && <IoCheckmark />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ---------- Premium thumbnail ---------- */
function UniformThumbPremium({ src, dateStr }: { src: string; dateStr: string }) {
    return (
        <div className="relative flex-none w-[96px] h-[112px] overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-black/5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-extrabold text-white backdrop-blur">
                <IoTimeOutline className="-mt-0.5 inline" /> {dateStr.split(",")[0] ?? ""}
            </span>
        </div>
    );
}

function IconBtn({
    title,
    href,
    variant = "solid",
}: {
    title: "Edit" | "Analytics" | "Comments";
    href: string;
    variant?: "solid" | "ghost";
}) {
    return (
        <Link
            href={href}
            title={title}
            className={variant === "ghost" ? "rounded-full p-2 hover:bg-black/5" : "rounded-full p-2 hover:bg-black/5"}
        >
            {title === "Edit" ? <IoPencilOutline /> : title === "Analytics" ? <IoTrendingUpOutline /> : <IoChatbubbleEllipsesOutline />}
        </Link>
    );
}