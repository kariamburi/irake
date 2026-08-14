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
import { motion, AnimatePresence } from "framer-motion";

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
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#F39A22",
    sand: "#F8F7F2",
    paper: "#FBFAF6",
    text: "#0F172A",
    dim: "#64748B",
    hair: "#DDD8CC",
    sub: "#64748B",
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
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={clsx(
                "rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]",
                "shadow-[0_10px_28px_rgba(15,23,42,0.025)]",
                className
            )}
        >
            {children}
        </motion.div>
    );
}

function Pill({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <span
            className={clsx(
                "inline-flex items-center gap-1 rounded-full border border-[#D9D3C7] bg-[#F3F1EB] px-2.5 py-1 text-[9px] font-black text-slate-600",
                className
            )}
        >
            {children}
        </span>
    );
}

function nfmt(
    input: number | string | null | undefined
) {
    const n = Number(input ?? 0);

    if (!Number.isFinite(n)) {
        return "0";
    }

    if (n >= 1_000_000) {
        return (
            (n / 1_000_000)
                .toFixed(1)
                .replace(/\.0$/, "") + "M"
        );
    }

    if (n >= 1_000) {
        return (
            (n / 1_000)
                .toFixed(1)
                .replace(/\.0$/, "") + "K"
        );
    }

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
            background: "#F8F7F2",
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

    /* ---------- Header ---------- */
    const Header = (
        <motion.header
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative overflow-hidden bg-[#173C2E] text-white"
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
                }}
            />

            <div className={clsx(isDesktop ? "mx-auto max-w-[1180px] px-4 sm:px-5 md:px-6" : "px-3")}>
                <div className="relative flex min-h-[92px] items-center gap-3 py-4">
                    <button
                        type="button"
                        onClick={goBack}
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                            Deed studio
                        </div>

                        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="text-[22px] font-black tracking-[-0.03em] sm:text-[25px]">
                                    Your deeds
                                </h1>

                                <p className="mt-1 text-[10px] font-medium text-white/50 sm:text-[11px]">
                                    Manage, edit and review the performance of your published content.
                                </p>
                            </div>

                            <Link
                                href="/studio/upload"
                                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-[#F39A22] px-4 text-[10px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#E98C12]"
                            >
                                <IoSparklesOutline size={14} />
                                New deed
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </motion.header>
    );

    /* ---------- Body ---------- */
    const Body = (
        <div className={clsx(isDesktop ? "mx-auto max-w-[1180px] px-4 pb-10 pt-4 sm:px-5 md:px-6" : "px-3 pb-10 pt-3")}>
            {/* Overview + filters */}
            <PremiumSurface className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.09em] text-[#F39A22]">
                            Content library
                        </div>

                        <h2 className="mt-1 text-[17px] font-black tracking-[-0.02em] text-slate-900">
                            Manage deeds
                        </h2>

                        <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
                            Change visibility, open analytics, edit content or remove deeds you no longer need.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[#DDD8CC] bg-[#F8F7F2] p-1 no-scrollbar">
                            {(["all", "public", "followers", "private"] as const).map((p) => {
                                const active = privacyFilter === p;

                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPrivacyFilter(p)}
                                        className={[
                                            "shrink-0 rounded-lg px-3 py-2 text-[9px] font-black transition",
                                            active
                                                ? "bg-[#173C2E] text-white shadow-sm"
                                                : "text-slate-500 hover:bg-white hover:text-[#173C2E]",
                                        ].join(" ")}
                                    >
                                        {p === "all" ? "All" : p === "followers" ? "Followers" : cap(p)}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-3 transition focus-within:border-[#173C2E]/45 md:w-[260px]">
                            <IoSearchOutline size={15} className="shrink-0 text-slate-400" />

                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search deed caption…"
                                className="min-w-0 flex-1 bg-transparent text-[10px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MiniMetric
                        label="Visible"
                        value={filtered.length}
                        icon={<IoEyeOutline size={14} />}
                    />
                    <MiniMetric
                        label="Selected"
                        value={selectedIds.length}
                        icon={<IoCheckmark size={14} />}
                    />
                    <MiniMetric
                        label="Views"
                        value={rows.reduce(
                            (sum, r) =>
                                sum +
                                Number(
                                    r.stats?.views ?? 0
                                ),
                            0
                        )}
                        icon={<IoTrendingUpOutline size={14} />}
                    />
                    <MiniMetric
                        label="Likes"
                        value={rows.reduce(
                            (sum, r) =>
                                sum +
                                Number(
                                    r.stats?.likes ?? 0
                                ),
                            0
                        )}
                        icon={<IoHeartOutline size={14} />}
                    />
                </div>

                <AnimatePresence>
                    {selectedIds.length > 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: -3 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -3 }}
                            className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F3D7B2] bg-[#FFF7EB] px-3 py-2.5"
                        >
                            <div className="text-[10px] font-black text-[#9A5A08]">
                                {selectedIds.length} selected
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelected({})}
                                    className="h-8 rounded-lg border border-[#E8D7BF] bg-white px-3 text-[9px] font-black text-slate-500"
                                >
                                    Clear
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setConfirmBulk(true)}
                                    className="h-8 rounded-lg bg-rose-600 px-3 text-[9px] font-black text-white transition hover:bg-rose-700"
                                >
                                    Delete selected
                                </button>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </PremiumSurface>

            {/* List */}
            <div className="mt-4">
                <PremiumSurface className="overflow-hidden">
                    <div className="hidden border-b border-[#E4DED2] bg-[#F8F7F2] px-3 py-2.5 md:block">
                        <div className="grid w-full grid-cols-[24px_minmax(180px,1fr)_110px_70px_120px] items-center gap-2 text-[9px] font-black uppercase tracking-[0.06em] text-slate-400 xl:grid-cols-[24px_minmax(220px,1fr)_110px_70px_70px_80px_90px_120px]">
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    aria-label="Select all"
                                    checked={allOnPageSelected}
                                    onChange={toggleSelectAll}
                                    className="accent-[#173C2E]"
                                />
                            </div>

                            <div>Deed</div>
                            <div className="text-center">Privacy</div>
                            <div className="text-center">Views</div>
                            <div className="hidden text-center lg:block">Likes</div>
                            <div className="hidden text-center lg:block">Comments</div>
                            <div className="text-center">Status</div>
                            <div className="text-center">Actions</div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex min-h-[320px] items-center justify-center">
                            <TikBallsLoader />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="grid min-h-[340px] place-items-center px-6 text-center">
                            <div>
                                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
                                    <IoSparklesOutline size={23} />
                                </div>

                                <div className="mt-4 text-[15px] font-black text-slate-900">
                                    No deeds found
                                </div>

                                <p className="mx-auto mt-1 max-w-sm text-[10px] font-medium leading-4 text-slate-400">
                                    {q || privacyFilter !== "all"
                                        ? "Try changing your search or visibility filter."
                                        : "Create your first deed and start building your profile."}
                                </p>

                                {!q && privacyFilter === "all" ? (
                                    <Link
                                        href="/studio/upload"
                                        className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#F39A22] px-4 text-[10px] font-black text-white"
                                    >
                                        <IoSparklesOutline size={13} />
                                        Create a deed
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <div className="p-2">
                            {filtered.map((r) => (
                                <PostRowPremium
                                    key={r.id}
                                    row={r}
                                    selected={!!selected[r.id]}
                                    onToggleSelect={() =>
                                        setSelected((prev) => ({
                                            ...prev,
                                            [r.id]: !prev[r.id],
                                        }))
                                    }
                                    onChangePrivacy={updateVisibility}
                                    onDelete={() => requestDelete(r.id)}
                                />
                            ))}
                        </div>
                    )}

                    {cursor ? (
                        <div className="border-t border-[#EAE6DD] px-3 py-3 text-center">
                            <button
                                type="button"
                                onClick={loadMore}
                                disabled={moreLoading}
                                className="h-9 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[9px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE] disabled:opacity-50"
                            >
                                {moreLoading ? "Loading…" : "Load more"}
                            </button>
                        </div>
                    ) : null}
                </PremiumSurface>
            </div>

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

            {toast ? <Toast text={toast} /> : null}
        </div>
    );

    // MOBILE
    if (isMobile) {
        return (
            <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">
                {Header}

                <div
                    className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
                    style={{
                        WebkitOverflowScrolling: "touch",
                        touchAction: "pan-y",
                    }}
                >
                    {Body}
                </div>
            </div>
        );
    }

    // DESKTOP
    return (
        <AppShell>
            <div
                className="h-full overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#F8F7F2]"
                style={{
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-y",
                }}
            >
                <StudioShell
                    title="Deeds"
                    ctaHref="/studio/upload"
                    ctaLabel="Upload"
                >
                    {Header}
                    {Body}
                </StudioShell>
            </div>
        </AppShell>
    );
}

/* ---------- Deed Row ---------- */
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
    onChangePrivacy: (
        id: string,
        v: "public" | "followers" | "private"
    ) => void;
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

    const dateStr = created
        ? created.toLocaleString()
        : "—";

    const views = nfmt(
        Number(
            row.stats?.views ?? 0
        )
    );
    const likes = nfmt(
        Number(
            row.stats?.likes ?? 0
        )
    );
    const comments = nfmt(
        Number(
            row.stats?.comments ?? 0
        )
    );

    const poster =
        row.media?.find((m) => m.thumbUrl)?.thumbUrl ||
        row.mediaThumbUrl ||
        row.media?.[0]?.url ||
        "/video-placeholder.jpg";

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
            className={[
                "mb-2 w-full min-w-0 overflow-visible rounded-[16px] border bg-white transition",
                selected
                    ? "border-[#F39A22] ring-2 ring-[#F39A22]/10"
                    : "border-[#E4DED2] hover:border-[#CFC8BB]",
            ].join(" ")}
        >
            {/* Desktop */}
            <div className="hidden px-1 md:block">
                <div className="grid w-full grid-cols-[24px_minmax(180px,1fr)_110px_70px_120px] items-center gap-2 px-3 py-3 xl:grid-cols-[24px_minmax(220px,1fr)_110px_70px_70px_80px_90px_120px]">
                    <div className="flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={onToggleSelect}
                            aria-label="Select row"
                            className="accent-[#173C2E]"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                `/${row.authorUsername}/deed/${row.id}`
                            )
                        }
                        className="flex min-w-0 items-center gap-3 overflow-hidden text-left"
                    >
                        <UniformThumbPremium
                            src={poster}
                            dateStr={dateStr}
                        />

                        <div className="min-w-0 overflow-hidden">
                            <div className="truncate text-[11px] font-black text-slate-800">
                                {row.caption?.trim()
                                    ? row.caption
                                    : "Untitled deed"}
                            </div>

                            <div className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">
                                {dateStr}
                            </div>
                        </div>
                    </button>

                    <div className="relative flex items-center justify-center">
                        <button
                            type="button"
                            onClick={() => setOpenMenu((value) => !value)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#D9D3C7] bg-white px-2.5 text-[9px] font-black text-slate-600 transition hover:bg-[#F3F1EB]"
                        >
                            {cap(row.visibility || "public")}
                            <IoChevronDown size={12} />
                        </button>

                        <AnimatePresence>
                            {openMenu ? (
                                <motion.div
                                    initial={{ opacity: 0, y: -3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-xl border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_14px_34px_rgba(15,23,42,0.12)]"
                                >
                                    {(["public", "followers", "private"] as const).map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => {
                                                onChangePrivacy(row.id, v);
                                                setOpenMenu(false);
                                            }}
                                            className="flex w-full items-center justify-between border-b border-[#EEEAE2] px-3 py-2.5 text-left text-[9px] font-black text-slate-600 transition last:border-b-0 hover:bg-[#F3F1EB]"
                                        >
                                            <span className="capitalize">
                                                {v}
                                            </span>
                                            {row.visibility === v ? (
                                                <IoCheckmark className="text-[#173C2E]" />
                                            ) : null}
                                        </button>
                                    ))}
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </div>

                    <div className="text-center text-[10px] font-black text-slate-700">
                        {views}
                    </div>

                    <div className="hidden text-center text-[10px] font-black text-slate-700 xl:block">
                        {likes}
                    </div>

                    <div className="hidden text-center text-[10px] font-black text-slate-700 xl:block">
                        {comments}
                    </div>

                    <div className="text-center">
                        <StatusBadge s={row.status} />
                    </div>

                    <div className="flex min-w-0 flex-wrap items-center justify-center gap-1">
                        <IconBtn
                            title="Edit"
                            href={`/studio/upload?editDeedId=${row.id}`}
                        />
                        <IconBtn
                            title="Analytics"
                            href={`/studio/analytics/${row.id}`}
                            variant="ghost"
                        />
                        <IconBtn
                            title="Comments"
                            href={`/${row.authorUsername}/deed/${row.id}`}
                            variant="ghost"
                        />

                        <button
                            type="button"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Delete"
                            onClick={onDelete}
                        >
                            <IoTrashOutline size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile */}
            <div className="px-3 py-3 md:hidden">
                <div className="flex items-start gap-3">
                    <div className="pt-1">
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={onToggleSelect}
                            aria-label="Select row"
                            className="accent-[#173C2E]"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() =>
                            router.push(
                                `/${row.authorUsername}/deed/${row.id}`
                            )
                        }
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                        <UniformThumbPremium
                            src={poster}
                            dateStr={dateStr}
                        />

                        <div className="min-w-0">
                            <div className="truncate text-[12px] font-black text-slate-800">
                                {row.caption?.trim()
                                    ? row.caption
                                    : "Untitled deed"}
                            </div>

                            <div className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">
                                {dateStr}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                <Pill>
                                    {cap(row.visibility || "public")}
                                </Pill>

                                <Pill>
                                    <IoEyeOutline size={11} />
                                    {views}
                                </Pill>

                                <Pill>
                                    <IoHeartOutline size={11} />
                                    {likes}
                                </Pill>

                                <Pill>
                                    💬 {comments}
                                </Pill>

                                <StatusBadge s={row.status} />
                            </div>
                        </div>
                    </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#EEEAE2] pt-3">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpenMenu((value) => !value)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D9D3C7] bg-white px-2.5 text-[9px] font-black text-slate-600"
                        >
                            Privacy
                            <IoChevronDown size={12} />
                        </button>

                        <AnimatePresence>
                            {openMenu ? (
                                <motion.div
                                    initial={{ opacity: 0, y: -3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    className="absolute bottom-10 left-0 z-30 w-40 overflow-hidden rounded-xl border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_14px_34px_rgba(15,23,42,0.12)]"
                                >
                                    {(["public", "followers", "private"] as const).map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => {
                                                onChangePrivacy(row.id, v);
                                                setOpenMenu(false);
                                            }}
                                            className="flex w-full items-center justify-between border-b border-[#EEEAE2] px-3 py-2.5 text-left text-[9px] font-black text-slate-600 last:border-b-0"
                                        >
                                            <span className="capitalize">
                                                {v}
                                            </span>
                                            {row.visibility === v ? (
                                                <IoCheckmark className="text-[#173C2E]" />
                                            ) : null}
                                        </button>
                                    ))}
                                </motion.div>
                            ) : null}
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-1">
                        <IconBtn
                            title="Edit"
                            href={`/studio/upload?editDeedId=${row.id}`}
                        />
                        <IconBtn
                            title="Analytics"
                            href={`/studio/analytics/${row.id}`}
                            variant="ghost"
                        />
                        <IconBtn
                            title="Comments"
                            href={`/${row.authorUsername}/deed/${row.id}`}
                            variant="ghost"
                        />

                        <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Delete"
                            onClick={onDelete}
                        >
                            <IoTrashOutline size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/* ---------- Thumbnail ---------- */
function UniformThumbPremium({
    src,
    dateStr,
}: {
    src: string;
    dateStr: string;
}) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    return (
        <div className="relative h-[78px] w-[66px] flex-none overflow-hidden rounded-xl bg-[#E8ECE8] ring-1 ring-black/5">
            {!failed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={src}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <div className="grid h-full w-full place-items-center text-[#173C2E]">
                    <IoSparklesOutline size={18} />
                </div>
            )}

            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[8px] font-black text-white backdrop-blur">
                <IoTimeOutline className="-mt-0.5 inline" />{" "}
                {dateStr.split(",")[0] ?? ""}
            </span>
        </div>
    );
}

function MiniMetric({
    label,
    value,
    icon,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-xl bg-[#F3F1EB] px-3 py-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[#F39A22]">
                    {icon}
                </span>

                <span className="text-[17px] font-black tracking-[-0.03em] text-[#173C2E]">
                    {nfmt(value)}
                </span>
            </div>

            <div className="mt-2 text-[8px] font-black uppercase tracking-[0.07em] text-slate-400">
                {label}
            </div>
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
    const isSolid =
        variant === "solid";

    return (
        <Link
            href={href}
            title={title}
            className={[
                "grid h-8 w-8 place-items-center rounded-lg transition",
                isSolid && title === "Edit"
                    ? "bg-[#EEF3EE] text-[#173C2E] hover:bg-[#E2ECE4]"
                    : "text-slate-400 hover:bg-[#F3F1EB] hover:text-slate-700",
            ].join(" ")}
        >
            {title === "Edit" ? (
                <IoPencilOutline size={14} />
            ) : title === "Analytics" ? (
                <IoTrendingUpOutline size={14} />
            ) : (
                <IoChatbubbleEllipsesOutline size={14} />
            )}
        </Link>
    );
}