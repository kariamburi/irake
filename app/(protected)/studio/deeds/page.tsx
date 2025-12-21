// app/studio/posts/page.tsx (or your current location)
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
    IoSearchOutline,
    IoTimeOutline,
    IoPencilOutline,
    IoChatbubbleEllipsesOutline,
    IoTrashOutline,
    IoChevronDown,
    IoCheckmark,
    IoTrendingUpOutline,
} from "react-icons/io5";
import TikBallsLoader from "@/components/ui/TikBallsLoader";
import AppShell from "@/app/components/AppShell";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { ArrowLeft } from "lucide-react";

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

/* ---------- theme + responsive helpers (same approach as discussion) ---------- */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
    sand: "#FFFFFF",
};

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
        `https://us-central1-ekarihub-aed5a.cloudfunctions.net/muxDeleteAsset?assetId=${encodeURIComponent(assetId)}`,
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
        ready: "bg-emerald-100 text-emerald-700",
        processing: "bg-sky-100 text-sky-700",
        uploading: "bg-amber-100 text-amber-700",
        failed: "bg-rose-100 text-rose-700",
        deleted: "bg-slate-100 text-slate-600",
    };
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[s || "ready"] || map.ready}`}>
            {s || "ready"}
        </span>
    );
}
function cap(s?: string) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
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

    // selection state (multi-select + bulk delete)
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

    async function hardDeleteSingle(id: string) {
        const target = rows.find((r) => r.id === id);
        const st = getStorage();
        const deletions: Promise<any>[] = [];

        if (target?.media?.length) {
            for (const m of target.media) {
                if (m.kind === "image" && m.storagePath) {
                    deletions.push(deleteObject(storageRef(st, m.storagePath)));
                }
                // if you store thumbs as gs://... you likely want bucket/path parsing;
                // keeping your original behavior:
                if (m.thumbUrl && m.thumbUrl.startsWith("gs://")) {
                    deletions.push(deleteObject(storageRef(st, m.thumbUrl.replace(/^gs:\/\//, ""))));
                }
                if (m.kind === "video" && m.muxAssetId) {
                    deletions.push(deleteMuxAsset(m.muxAssetId));
                }
            }
        }

        await Promise.allSettled(deletions);
        await deleteDoc(doc(db, "deeds", id));
        setRows((prev) => prev.filter((p) => p.id !== id));
    }

    async function hardDelete(id: string) {
        try {
            setBusyDelete(true);
            await hardDeleteSingle(id);
            setToast("Post deleted");
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

    const Header = (
        <div
            className="border-b sticky top-0 z-50 backdrop-blur"
            style={{ backgroundColor: "rgba(255,255,255,0.92)", borderColor: EKARI.hair }}
        >
            <div className={isDesktop ? "h-14 px-4 max-w-[1180px] mx-auto" : "h-14 px-3"}>
                <div className="h-full flex items-center justify-between gap-2">
                    <button
                        onClick={goBack}
                        className="p-2 rounded-xl border transition hover:bg-black/5 focus:outline-none focus:ring-2"
                        style={{ borderColor: EKARI.hair, ...ringStyle }}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={18} style={{ color: EKARI.text }} />
                    </button>

                    <div className="flex-1 min-w-0">
                        <div className="font-black text-[18px] leading-none truncate" style={{ color: EKARI.text }}>
                            Studio
                        </div>
                        <div className="text-[11px] mt-0.5 truncate" style={{ color: EKARI.dim }}>
                            Posts
                        </div>
                    </div>

                    <Link
                        href="/studio/upload"
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-extrabold text-white"
                        style={{ backgroundColor: EKARI.gold }}
                    >
                        + Upload
                    </Link>
                </div>
            </div>
        </div>
    );

    const Body = (
        <div className={isDesktop ? "max-w-[1180px] mx-auto px-4 pb-10" : "px-3 pb-10"}>
            {/* Toolbar */}
            <div className="w-full mt-4 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xl font-extrabold" style={{ color: EKARI.text }}>
                    Deeds
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {/* Privacy filter */}
                    <div className="flex flex-wrap items-center gap-1">
                        {(["all", "public", "followers", "private"] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPrivacyFilter(p)}
                                className={[
                                    "rounded-full border px-3 py-1 text-sm font-semibold",
                                    privacyFilter === p ? "bg-black/5" : "hover:bg-black/5",
                                ].join(" ")}
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            >
                                {p === "all" ? "All" : p === "followers" ? "Followers" : cap(p)}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-2 rounded-xl border px-2.5 py-2">
                        <IoSearchOutline className="opacity-70" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search for post description"
                            className="w-full sm:w-64 bg-transparent text-sm outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Bulk actions bar */}
            {selectedIds.length > 0 && (
                <div className="mb-2 flex items-center justify-between rounded-xl border bg-amber-50 px-3 py-2 text-sm">
                    <div className="text-amber-900">
                        <strong>{selectedIds.length}</strong> selected
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="rounded-xl border px-3 py-1.5 font-semibold hover:bg-black/5"
                            onClick={() => setConfirmBulk(true)}
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            Delete Selected
                        </button>
                    </div>
                </div>
            )}

            {/* List container */}
            <div className="rounded-2xl border bg-white" style={{ borderColor: EKARI.hair }}>
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-[24px,160px,110px,90px,90px,90px,120px,220px] items-center gap-3 border-b px-3 py-2 text-xs font-semibold text-slate-600">
                    <div className="flex items-center justify-center">
                        <input
                            type="checkbox"
                            aria-label="Select all"
                            checked={allOnPageSelected}
                            onChange={toggleSelectAll}
                        />
                    </div>
                    <div>Deeds (Created on)</div>
                    <div className="text-center">Privacy</div>
                    <div className="text-center">Views</div>
                    <div className="text-center">Likes</div>
                    <div className="text-center">Comments</div>
                    <div className="text-center">Status</div>
                    <div className="text-center">Actions</div>
                </div>

                {/* Rows */}
                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <TikBallsLoader />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">No deeds yet.</div>
                ) : (
                    filtered.map((r) => (
                        <PostRow
                            key={r.id}
                            row={r}
                            selected={!!selected[r.id]}
                            onToggleSelect={() => setSelected((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                            onChangePrivacy={updateVisibility}
                            onDelete={() => requestDelete(r.id)}
                        />
                    ))
                )}

                {/* Load more */}
                {cursor && (
                    <div className="border-t p-3 text-center">
                        <button
                            className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-black/5"
                            onClick={loadMore}
                            disabled={moreLoading}
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            {moreLoading ? "Loading…" : "Load more"}
                        </button>
                    </div>
                )}
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
                title="Delete selected posts?"
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

            {/* Toast */}
            {toast && <Toast text={toast} />}
        </div>
    );

    // MOBILE: fixed inset like your discussion page (no AppShell/StudioShell chrome)
    if (isMobile) {
        return (
            <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: EKARI.sand }}>
                {Header}
                <div className="flex-1 overflow-y-auto overscroll-contain">{Body}</div>
            </div>
        );
    }

    // DESKTOP: AppShell + StudioShell
    return (
        <AppShell>
            <StudioShell title="Posts" ctaHref="/studio/upload" ctaLabel="+ Upload">
                <div className="min-h-screen w-full" style={{ backgroundColor: EKARI.sand }}>
                    {Header}
                    {Body}
                </div>
            </StudioShell>
        </AppShell>
    );
}

/* ---------- Row ---------- */
function PostRow({
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
        <div className="grid grid-cols-1 md:grid-cols-[24px,160px,120px,90px,90px,90px,120px,220px] items-start md:items-center gap-3 border-t px-3 py-3 text-sm">
            {/* Select */}
            <div className="flex items-center justify-center">
                <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label="Select row" />
            </div>

            {/* Post cell */}
            <div
                onClick={() => router.push(`/${row.authorUsername}/deed/${row.id}`)}
                className="flex min-w-0 items-center cursor-pointer gap-3"
            >
                <UniformThumb src={poster} dateStr={dateStr} />
                <div className="min-w-0">
                    <div className="text-xs text-slate-500">{dateStr}</div>
                </div>
            </div>

            {/* Privacy dropdown (desktop only) */}
            <div className="relative hidden md:flex items-center justify-center">
                <button
                    onClick={() => setOpenMenu((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold hover:bg-black/5"
                >
                    {cap(row.visibility || "public")}
                    <IoChevronDown />
                </button>
                {openMenu && (
                    <div className="absolute z-20 mt-8 w-36 overflow-hidden rounded-md border bg-white shadow-md">
                        {(["public", "followers", "private"] as const).map((v) => (
                            <button
                                key={v}
                                onClick={() => {
                                    onChangePrivacy(row.id, v as any);
                                    setOpenMenu(false);
                                }}
                                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-black/5"
                            >
                                <span className="capitalize">{v}</span>
                                {row.visibility === v && <IoCheckmark />}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Stats (desktop only) */}
            <div className="hidden md:block text-center">{views}</div>
            <div className="hidden md:block text-center">{likes}</div>
            <div className="hidden md:block text-center">{comments}</div>

            {/* Status (desktop only) */}
            <div className="hidden md:block text-center">
                <StatusBadge s={row.status} />
            </div>

            {/* Actions (desktop only) */}
            <div className="hidden md:flex items-center justify-center gap-2">
                <IconBtn title="Edit" href={`/studio/upload?editDeedId=${row.id}`} />
                <IconBtn title="Analytics" href={`/studio/analytics/${row.id}`} variant="ghost" />
                <IconBtn title="Comments" href={`/${row.authorUsername}/deed/${row.id}`} variant="ghost" />
                <button className="rounded-full p-2 hover:bg-black/5" title="Delete" onClick={onDelete}>
                    <IoTrashOutline />
                </button>
            </div>

            {/* Mobile chips + actions */}
            <div className="md:hidden -mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border px-2 py-0.5">{cap(row.visibility || "public")}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">👁 {views}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">❤️ {likes}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">💬 {comments}</span>
                <StatusBadge s={row.status} />
                <span className="flex-1" />
                <div className="flex items-center gap-1">
                    <IconBtn title="Edit" href={`/studio/upload?editDeedId=${row.id}`} />
                    <IconBtn title="Analytics" href={`/studio/analytics/${row.id}`} variant="ghost" />
                    <IconBtn title="Comments" href={`/${row.authorUsername}/deed/${row.id}`} variant="ghost" />
                    <button className="rounded-full p-2 hover:bg-black/5" title="Delete" onClick={onDelete}>
                        <IoTrashOutline />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* Uniform, fixed-size thumbnail */
function UniformThumb({ src, dateStr }: { src: string; dateStr: string }) {
    return (
        <div className="relative flex-none basis-[100px] w-[100px] h-32 overflow-hidden rounded-lg bg-slate-900 ring-1 ring-black/5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute left-0 top-0 rounded-br bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
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

function nfmt(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
}
