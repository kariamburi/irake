"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { getStorage, ref as storageRef, deleteObject, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import StudioShell from "../components/StudioShell";
import {
    IoSearchOutline,
    IoTimeOutline,
    IoPencilOutline,
    IoChatbubbleEllipsesOutline,
    IoOpenOutline,
    IoTrashOutline,
    IoChevronDown,
    IoCheckmark,
    IoGitBranchSharp,
    IoTrendingDownOutline,
    IoTrendingUpOutline,
} from "react-icons/io5";
import TikBallsLoader from "@/components/ui/TikBallsLoader";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

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
        storagePath?: string; // firebase storage path for images
        kind?: "video" | "image";
        muxAssetId?: string; // if uploaded to Mux
    }>;
    mediaThumbUrl?: string; // legacy
};

const PAGE_SIZE = 20;

/* ---------- API helpers ---------- */
async function deleteMuxAsset(assetId: string) {
    const res = await fetch(`/api/mux/delete?assetId=${encodeURIComponent(assetId)}`, {
        method: "DELETE",
    });
    if (!res.ok) throw new Error(`Mux delete failed: ${await res.text()}`);
}

/* ---------- Modals / UI bits ---------- */
function Backdrop({ children }: { children: React.ReactNode }) {
    // FIX: removed extra overlay div that blocked clicks
    return (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4">
            {children}
        </div>
    );
}

function ConfirmModal({
    title,
    message,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
    busy,
}: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    busy?: boolean;
}) {
    return (
        <Backdrop>
            <div role="dialog" aria-modal className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{message}</p>
                <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="rounded-lg border px-3 py-1.5 text-sm font-semibold hover:bg-black/5"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={busy}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                        {busy ? "Deleting…" : confirmLabel}
                    </button>
                </div>
            </div>
        </Backdrop>
    );
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
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[s || "ready"] || map.ready
                }`}
        >
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

    // thumb regen busy states
    const [regenBusy, setRegenBusy] = useState<Record<string, boolean>>({});
    const [regenBulkBusy, setRegenBulkBusy] = useState(false);

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
        const storage = getStorage();
        const deletions: Promise<any>[] = [];
        if (target?.media?.length) {
            for (const m of target.media) {
                if (m.kind === "image" && m.storagePath) {
                    deletions.push(deleteObject(storageRef(storage, m.storagePath)));
                }
                if (m.thumbUrl && m.thumbUrl.startsWith("gs://")) {
                    deletions.push(
                        deleteObject(storageRef(storage, m.thumbUrl.replace(/^gs:\/\//, "")))
                    );
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
                // sequential to keep Mux/API gentle; switch to Promise.allSettled if desired
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

    /* ---------------- THUMBNAIL REGEN ---------------- */


    return (
        <AppShell>
            <StudioShell title="Posts" ctaHref="/studio/upload" ctaLabel="+ Upload">
                {/* Toolbar */}
                <div className="w-full mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xl font-extrabold text-slate-900">Deeds</div>

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
                                    style={{ borderColor: "#E5E7EB", color: "#0F172A" }}
                                >
                                    {p === "all" ? "All" : p === "followers" ? "Partners" : cap(p)}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
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
                    <div className="mb-2 flex items-center justify-between rounded-lg border bg-amber-50 px-3 py-2 text-sm">
                        <div className="text-amber-900">
                            <strong>{selectedIds.length}</strong> selected
                        </div>
                        <div className="flex items-center gap-2">

                            <button
                                className="rounded-lg border px-3 py-1.5 font-semibold hover:bg-black/5"
                                onClick={() => setConfirmBulk(true)}
                            >
                                Delete Selected
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="rounded-xl border bg-white">
                    {/* Header hidden on small screens */}
                    <div className="hidden md:grid grid-cols-[24px,1fr,110px,90px,90px,90px,120px,220px] items-center gap-3 border-b px-3 py-2 text-xs font-semibold text-slate-600">
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
                                busyRegen={!!regenBusy[r.id]}
                            />
                        ))
                    )}

                    {/* Load more */}
                    {cursor && (
                        <div className="border-t p-3 text-center">
                            <button
                                className="rounded-lg border px-3 py-1.5 text-sm font-bold hover:bg-black/5"
                                onClick={loadMore}
                                disabled={moreLoading}
                            >
                                {moreLoading ? <BouncingBallLoader /> : "Load more"}
                            </button>
                        </div>
                    )}
                </div>

                {/* Delete confirm modal (single) */}
                {confirmId && (
                    <ConfirmModal
                        title="Delete deed?"
                        message="This will remove the deed. This can't be undone."
                        confirmLabel="Delete"
                        onCancel={() => setConfirmId(null)}
                        onConfirm={() => hardDelete(confirmId)}
                        busy={busyDelete}
                    />
                )}

                {/* Bulk delete modal */}
                {confirmBulk && (
                    <ConfirmModal
                        title="Delete selected posts?"
                        message={`You are about to delete ${selectedIds.length} deed(s) including their media and any linked assets.`}
                        confirmLabel="Delete all"
                        onCancel={() => setConfirmBulk(false)}
                        onConfirm={hardDeleteBulk}
                        busy={busyDelete}
                    />
                )}

                {/* Toast */}
                {toast && <Toast text={toast} />}
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
    busyRegen,
}: {
    row: Deed;
    selected: boolean;
    onToggleSelect: () => void;
    onChangePrivacy: (id: string, v: "public" | "followers" | "private") => void;
    onDelete: () => void;
    busyRegen: boolean;
}) {
    const [openMenu, setOpenMenu] = useState(false);

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
    // const poster = `https://image.mux.com/${row.muxPlaybackId}/thumbnail.jpg?time=1&fit_mode=smartcrop`;
    return (
        <div className="grid grid-cols-1 md:grid-cols-[24px,1fr,110px,90px,90px,90px,120px,220px] items-start md:items-center gap-3 border-t px-3 py-3 text-sm">
            {/* Select */}
            <div className="flex items-center justify-center">
                <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label="Select row" />
            </div>

            {/* Post cell */}
            <div className="flex min-w-0 items-center gap-3">
                <UniformThumb src={poster} dateStr={dateStr} />
                <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-900">{row.caption || "—"}</div>
                    <div className="text-xs text-slate-500">{dateStr}</div>
                </div>
            </div>

            {/* Privacy quick toggle dropdown (desktop only) */}
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
                <IconBtn title="Comments" href={`/${row.authorUsername}/video/${row.id}`} variant="ghost" />

                <button className="rounded-full p-2 hover:bg-black/5" title="Delete" onClick={onDelete}>
                    <IoTrashOutline />
                </button>
            </div>

            {/* Mobile controls */}
            <div className="md:hidden -mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border px-2 py-0.5">{cap(row.visibility || "public")}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">👁 {views}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">❤️ {likes}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">💬 {comments}</span>
                <StatusBadge s={row.status} />
                <span className="flex-1" />
                <div className="flex items-center gap-1">
                    <IconBtn title="Edit" href={`/studio/upload?editDeedId=${row.id}`} />
                    <IconBtn title="Open" href={`/deeds/${row.id}`} variant="ghost" />
                    <IconBtn title="Comments" href={`/studio/comments?deedId=${row.id}`} variant="ghost" />

                    <button className="rounded-full p-2 hover:bg-black/5" title="Delete" onClick={onDelete}>
                        <IoTrashOutline />
                    </button>
                </div>
            </div>
        </div>
    );
}

/* Uniform, fixed-size thumbnail for consistency across the list */
function UniformThumb({ src, dateStr }: { src: string; dateStr: string }) {
    return (
        <div className="relative flex-none basis-[100px] w-[100px] h-32 overflow-hidden rounded-lg bg-slate-900 ring-1 ring-black/5 shadow-sm">
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
    title: string;
    href: string;
    variant?: "solid" | "ghost";
}) {
    return (
        <Link
            href={href}
            title={title}
            className={variant === "ghost" ? "rounded-full p-2 hover:bg-black/5" : "rounded-full p-2 hover:bg-black/5"}
        >
            {/* Keep icon only (minimal) */}
            {title === "Edit" ? (
                <IoPencilOutline />
            ) : title === "Analytics" ? (
                <IoTrendingUpOutline />
            ) : (
                <IoChatbubbleEllipsesOutline />
            )}
        </Link>
    );
}

/* ---------- helpers ---------- */
function nfmt(n: number) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
}
function uploadResumableToPath(blob: any, path: string) {
    throw new Error("Function not implemented.");
}

