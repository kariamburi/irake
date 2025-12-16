"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    startAfter,
    getDocs,
    addDoc,
    serverTimestamp,
    doc,
    deleteDoc,
    updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    IoChatbubbleOutline,
    IoClose,
    IoPencil,
    IoSwapVertical,
    IoTrashOutline,
    IoHeartOutline,
    IoEyeOutline,
    IoShareOutline,
} from "react-icons/io5";
import SmartAvatar from "./SmartAvatar";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/* Embedded user snapshot (new format)                                 */
/* ------------------------------------------------------------------ */
type UserEmbed = {
    name?: string | null;
    handle?: string | null;
    photoURL?: string | null;
};

type ActivityDoc = {
    id: string;
    deedId?: string;
    userId?: string;
    deviceId?: string;
    user?: UserEmbed | null;

    // legacy fallbacks (older docs)
    userHandle?: string | null;
    userPhotoURL?: string | null;

    createdAt?: any;
};

function pickHandle(a: any) {
    return ((a?.user?.handle ?? a?.userHandle ?? "") as string).trim() || null;
}
function pickPhoto(a: any) {
    return (a?.user?.photoURL ?? a?.userPhotoURL ?? null) || null;
}
function pickName(a: any) {
    return (a?.user?.name ?? null) || null;
}

/* ------------------------------------------------------------------ */
/* Tiny activity indicator                                             */
/* ------------------------------------------------------------------ */
function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
    const px = `${size}px`;
    return (
        <span
            className={[
                "inline-block align-middle rounded-full animate-spin",
                "border-2 border-white/50 border-t-white",
                className,
            ].join(" ")}
            style={{ width: px, height: px }}
            aria-label="Loading"
            role="status"
        />
    );
}

/* ------------------------------------------------------------------ */
/* Emoji list                                                          */
/* ------------------------------------------------------------------ */
const DEFAULT_EMOJIS = [
    "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤗", "🤔", "😴", "😅", "😇", "😉", "🙃", "🙂",
    "😭", "😤", "😡", "🤯", "🤝", "👍", "👎", "👏", "🙏", "💪", "👌", "🤌", "🙌", "🫶", "🤙", "💖", "💗", "💜",
    "🔥", "✨", "🎉", "🥳", "💯", "✅", "❌", "⚠️", "☑️", "🩷", "🧡", "💛", "💚", "💙", "🖤", "🤍", "🤎",
    "🍀", "🌟", "⭐️", "🌈", "☀️", "🌙", "🌸", "🌼", "🐶", "🐱", "🦄", "🐣", "🍕", "🍔", "🍟", "🍩", "☕️",
];

/* ------------------------------------------------------------------ */
/* Grapheme-safe helpers                                               */
/* ------------------------------------------------------------------ */
function clipGraphemes(input: string, max: number) {
    try {
        // @ts-ignore
        if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
            // @ts-ignore
            const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            const it = seg.segment(input)[Symbol.iterator]();
            let out = "";
            let n = 0;
            while (n < max) {
                const { value, done } = it.next();
                if (done || !value) break;
                out += value.segment;
                n++;
            }
            return out;
        }
    } catch { }
    return Array.from(input).slice(0, max).join("");
}

function insertAtCursor(
    el: HTMLTextAreaElement,
    insert: string,
    limit = 400
): { nextValue: string; nextCursor: number } {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const combined = before + insert + after;
    const clipped = clipGraphemes(combined, limit);
    const delta = clipped.length - (before + after).length;
    const nextCursor = start + Math.max(0, Math.min(insert.length, delta));
    return { nextValue: clipped, nextCursor };
}

/* ------------------------------------------------------------------ */
/* Minimal floating popup (portal) like TikTok                         */
/* ------------------------------------------------------------------ */
type Pos = { top: number; left: number; placement: "top" | "bottom" };

function computePosition(anchorRect: DOMRect, popupW = 288, popupH = 240, gap = 8): Pos {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const left = Math.min(Math.max(8, anchorRect.right - popupW), vw - popupW - 8);

    const tryBottomTop = anchorRect.bottom + gap;
    const tryTopTop = anchorRect.top - gap - popupH;

    if (tryBottomTop + popupH <= vh) {
        return { top: tryBottomTop, left, placement: "bottom" };
    }
    const top = Math.max(8, tryTopTop);
    return { top, left, placement: "top" };
}

function useGlobalClickAway(refs: Array<React.RefObject<HTMLElement | null>>, onAway: () => void) {
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            const inside = refs.some((r) => r.current && r.current.contains(t));
            if (!inside) onAway();
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [refs, onAway]);
}

function EmojiPopup({
    anchorRef,
    open,
    onSelect,
    onClose,
}: {
    anchorRef: React.RefObject<HTMLElement | null>;
    open: boolean;
    onSelect: (emoji: string) => void;
    onClose: () => void;
}) {
    const popRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<Pos | null>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const anchor = anchorRef.current;
        if (!anchor) return;
        const update = () => setPos(computePosition(anchor.getBoundingClientRect()));
        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, [open, anchorRef]);

    useGlobalClickAway([popRef as React.RefObject<HTMLElement | null>, anchorRef], () => open && onClose());

    if (!open || !pos) return null;

    const popup = (
        <div
            ref={popRef}
            role="dialog"
            aria-label="Emoji picker"
            className="fixed z-[1000]"
            style={{ top: pos.top, left: pos.left, width: 288 }}
        >
            <div
                className={[
                    "absolute h-3 w-3 rotate-45 bg-white border border-gray-200",
                    pos.placement === "top" ? "bottom-[-6px] right-4" : "top-[-6px] right-4",
                    "shadow-[0_1px_6px_rgba(0,0,0,.08)]",
                ].join(" ")}
            />
            <div className="rounded-xl border border-gray-200 bg-white shadow-xl p-2">
                <div className="grid grid-cols-8 gap-1 text-xl max-h-56 overflow-auto">
                    {DEFAULT_EMOJIS.map((e) => (
                        <button
                            key={e}
                            type="button"
                            className="h-8 w-8 grid place-items-center rounded hover:bg-gray-100 focus:outline-none"
                            onClick={() => onSelect(e)}
                            aria-label={`Insert ${e}`}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(popup, document.body);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function nfmt(n?: number) {
    const v = Number(n ?? 0);
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(v);
}

function timeAgo(ts?: any) {
    if (!ts) return "";
    const d =
        ts instanceof Date
            ? ts
            : typeof ts?.toMillis === "function"
                ? new Date(ts.toMillis())
                : typeof ts === "number"
                    ? new Date(ts)
                    : null;
    if (!d) return "";
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return "now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;
    const wk = Math.floor(day / 7);
    if (wk < 4) return `${wk}w`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo`;
    const yr = Math.floor(day / 365);
    return `${yr}y`;
}

/* ------------------------------------------------------------------ */
/* Types & hooks                                                       */
/* ------------------------------------------------------------------ */
type SortMode = "newest" | "oldest";
type UserLite = { uid?: string; photoURL?: string | null; handle?: string | null };

// ✅ matches your backend collections
type Tab = "comments" | "likes" | "views" | "shares";
type ActivityCollection = "likes" | "views" | "shares";

function useDeedMeta(deedId?: string, open?: boolean) {
    const [meta, setMeta] = useState<{
        createdAt?: any;
        stats?: { views?: number; likes?: number; comments?: number; shares?: number };
        allowComments?: boolean;
        commentsEnabled?: boolean;
    } | null>(null);

    useEffect(() => {
        if (!deedId || !open) return;
        return onSnapshot(doc(db, "deeds", deedId), (s) => {
            const d = s.data() as any;
            setMeta({
                createdAt: d?.createdAt,
                stats: d?.stats || {},
                allowComments: d?.allowComments,
                commentsEnabled: d?.commentsEnabled,
            });
        });
    }, [deedId, open]);

    const posted =
        meta?.createdAt instanceof Date
            ? meta.createdAt
            : typeof meta?.createdAt?.toMillis === "function"
                ? new Date(meta.createdAt.toMillis())
                : typeof meta?.createdAt === "number"
                    ? new Date(meta.createdAt)
                    : undefined;

    const enabled = meta?.allowComments !== false && meta?.commentsEnabled !== false;

    return { posted, stats: meta?.stats || {}, enabled };
}

function useTopLevelComments(deedId?: string, open?: boolean, sort: SortMode = "newest") {
    const [items, setItems] = useState<any[]>([]);
    const [cursor, setCursor] = useState<any>(null);
    const [paging, setPaging] = useState(false);

    useEffect(() => {
        if (!deedId || !open) return;
        const q0 = query(
            collection(db, "comments"),
            where("deedId", "==", deedId),
            where("parentId", "==", null),
            orderBy("createdAt", sort === "newest" ? "desc" : "asc"),
            limit(30)
        );
        const unsub = onSnapshot(q0, (snap) => {
            setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
            setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
        });
        return () => unsub();
    }, [deedId, open, sort]);

    const loadMore = useCallback(async () => {
        if (!deedId || !cursor || paging) return;
        setPaging(true);
        try {
            const qMore = query(
                collection(db, "comments"),
                where("deedId", "==", deedId),
                where("parentId", "==", null),
                orderBy("createdAt", sort === "newest" ? "desc" : "asc"),
                startAfter(cursor),
                limit(30)
            );
            const snap = await getDocs(qMore);
            setItems((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))]);
            setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
        } finally {
            setPaging(false);
        }
    }, [deedId, cursor, paging, sort]);

    return { items, loadMore, paging };
}

function useReplies(deedId?: string, parentId?: string, open?: boolean) {
    const [list, setList] = useState<any[]>([]);
    const [cursor, setCursor] = useState<any>(null);

    useEffect(() => {
        if (!deedId || !parentId || !open) return;
        const qR = query(
            collection(db, "comments"),
            where("deedId", "==", deedId),
            where("parentId", "==", parentId),
            orderBy("createdAt", "asc"),
            limit(20)
        );
        const unsub = onSnapshot(qR, (snap) => {
            setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
            setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
        });
        return () => unsub();
    }, [deedId, parentId, open]);

    const loadMore = useCallback(async () => {
        if (!deedId || !parentId || !cursor) return;
        const qMore = query(
            collection(db, "comments"),
            where("deedId", "==", deedId),
            where("parentId", "==", parentId),
            orderBy("createdAt", "asc"),
            startAfter(cursor),
            limit(20)
        );
        const snap = await getDocs(qMore);
        setList((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))]);
        setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
    }, [deedId, parentId, cursor]);

    return { list, loadMore, hasMore: !!cursor };
}

function useDeedActivity(collectionName: ActivityCollection, deedId?: string, open?: boolean) {
    const [items, setItems] = useState<ActivityDoc[]>([]);
    const [cursor, setCursor] = useState<any>(null);
    const [paging, setPaging] = useState(false);

    useEffect(() => {
        if (!open || !deedId) return;

        const q0 = query(
            collection(db, collectionName),
            where("deedId", "==", deedId),
            orderBy("createdAt", "desc"),
            limit(30)
        );

        const unsub = onSnapshot(
            q0,
            (snap) => {
                setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
                setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
            },
            () => {
                setItems([]);
                setCursor(null);
            }
        );

        return () => unsub();
    }, [collectionName, deedId, open]);

    const loadMore = useCallback(async () => {
        if (!deedId || !cursor || paging) return;
        setPaging(true);
        try {
            const qMore = query(
                collection(db, collectionName),
                where("deedId", "==", deedId),
                orderBy("createdAt", "desc"),
                startAfter(cursor),
                limit(30)
            );
            const snap = await getDocs(qMore);
            setItems((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))]);
            setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
        } finally {
            setPaging(false);
        }
    }, [collectionName, deedId, cursor, paging]);

    return { items, loadMore, paging };
}

/* ------------------------------------------------------------------ */
/* ✅ Views: unique users list (dedup by userId OR deviceId)            */
/* ------------------------------------------------------------------ */
type ViewItem = ActivityDoc & {
    viewsByUser?: number;
    lastViewedAt?: any;
};

function useDeedViewsUnique(deedId?: string, open?: boolean) {
    const [items, setItems] = useState<ViewItem[]>([]);
    const [paging] = useState(false);

    useEffect(() => {
        if (!open || !deedId) return;

        const q0 = query(
            collection(db, "views"),
            where("deedId", "==", deedId),
            orderBy("createdAt", "desc"),
            limit(400)
        );

        const unsub = onSnapshot(
            q0,
            (snap) => {
                const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ViewItem[];

                const map = new Map<string, ViewItem>(); // key -> newest doc + count

                for (const v of raw) {
                    const uid = (v.userId || "").trim();
                    const did = (v.deviceId || "").trim();
                    const key = uid || (did ? `device:${did}` : "");
                    if (!key) continue;

                    const existing = map.get(key);
                    if (!existing) {
                        map.set(key, { ...v, viewsByUser: 1, lastViewedAt: v.createdAt });
                    } else {
                        map.set(key, {
                            ...existing,
                            viewsByUser: (existing.viewsByUser ?? 1) + 1,
                        });
                    }
                }

                setItems(Array.from(map.values()));
            },
            () => setItems([])
        );

        return () => unsub();
    }, [deedId, open]);

    const loadMore = useCallback(async () => { }, []);
    return { items, loadMore, paging };
}
/* ------------------------------------------------------------------ */
/* ✅ Shares: unique users list (dedup by userId OR deviceId)           */
/* ------------------------------------------------------------------ */
type ShareItem = ActivityDoc & {
    sharesByUser?: number;
    lastSharedAt?: any;
};

function useDeedSharesUnique(deedId?: string, open?: boolean) {
    const [items, setItems] = useState<ShareItem[]>([]);
    const [paging] = useState(false);

    useEffect(() => {
        if (!open || !deedId) return;

        const q0 = query(
            collection(db, "shares"),
            where("deedId", "==", deedId),
            orderBy("createdAt", "desc"),
            limit(400)
        );

        const unsub = onSnapshot(
            q0,
            (snap) => {
                const raw = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ShareItem[];

                const map = new Map<string, ShareItem>(); // key -> newest doc + count

                for (const s of raw) {
                    const uid = (s.userId || "").trim();
                    const did = (s.deviceId || "").trim();
                    const key = uid || (did ? `device:${did}` : "");
                    if (!key) continue;

                    const existing = map.get(key);
                    if (!existing) {
                        map.set(key, { ...s, sharesByUser: 1, lastSharedAt: s.createdAt });
                    } else {
                        map.set(key, {
                            ...existing,
                            sharesByUser: (existing.sharesByUser ?? 1) + 1,
                        });
                    }
                }

                setItems(Array.from(map.values()));
            },
            () => setItems([])
        );

        return () => unsub();
    }, [deedId, open]);

    const loadMore = useCallback(async () => { }, []);
    return { items, loadMore, paging };
}

function useUserLiteById(userId?: string) {
    const [u, setU] = useState<{ handle?: string; photoURL?: string } | null>(null);

    useEffect(() => {
        if (!userId) {
            setU(null);
            return;
        }
        return onSnapshot(doc(db, "users", userId), (s) => {
            const d = s.data() as any;
            setU(d ? { handle: d?.handle, photoURL: d?.photoURL } : null);
        });
    }, [userId]);

    return u;
}

/* ------------------------------------------------------------------ */
/* RightRail                                                           */
/* ------------------------------------------------------------------ */
const EKARI = {
    forest: "#233F39",
    leaf: "#1F3A34",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#111827",
    subtext: "#6B7280",
};

type RightRailProps = {
    open: boolean;
    deedId?: string;
    onClose: () => void;
    currentUser: { uid?: string; photoURL?: string | null; handle?: string | null; name?: string | null };
    mode?: "sidebar" | "sheet";
    className?: string;
};

export default function RightRail({
    open,
    deedId,
    onClose,
    currentUser,
    mode = "sidebar",
    className,
}: RightRailProps) {
    if (!open || !deedId) {
        return <aside className="hidden lg:flex w-0 shrink-0" aria-hidden />;
    }

    const outer = [
        mode === "sidebar" ? "hidden lg:flex h-screen w-[400px] border-l" : "flex lg:hidden",
        "h-full flex-col",
        className || "",
    ].join(" ");

    const [tab, setTab] = useState<Tab>("comments");

    const { posted, stats, enabled } = useDeedMeta(deedId, open);

    // comments
    const [sort, setSort] = useState<SortMode>("newest");
    const { items, loadMore, paging } = useTopLevelComments(deedId, open, sort);

    // activity
    const likesQ = useDeedActivity("likes", deedId, open);
    const viewsQ = useDeedViewsUnique(deedId, open);
    const sharesQ = useDeedSharesUnique(deedId, open);

    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string; handle?: string | null } | null>(null);
    const [sending, setSending] = useState(false);

    const isGuest = !currentUser?.uid;
    const canSend = tab === "comments" && !!currentUser?.uid && enabled && text.trim().length > 0 && !sending;

    const [showEmoji, setShowEmoji] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setTab("comments");
        setText("");
        setReplyTo(null);
        setSending(false);
        setShowEmoji(false);
    }, [deedId, open]);

    const send = useCallback(async () => {
        if (!canSend || !deedId || !currentUser?.uid) return;
        setSending(true);
        try {
            const trimmed = clipGraphemes(text.trim(), 400);

            await addDoc(collection(db, "comments"), {
                deedId,
                userId: currentUser.uid,

                // ✅ unified snapshot (new)
                user: {
                    name: currentUser.name ?? null,
                    handle: currentUser.handle ?? null,
                    photoURL: currentUser.photoURL ?? null,
                },

                // (optional legacy fields, leave off if you want)
                // userHandle: currentUser.handle ?? null,
                // userPhotoURL: currentUser.photoURL ?? null,

                text: trimmed,
                imageUrl: null,
                parentId: replyTo?.id ?? null,
                createdAt: serverTimestamp(),
            });

            setText("");
            setReplyTo(null);
        } finally {
            setSending(false);
        }
    }, [canSend, deedId, currentUser, text, replyTo]);

    const onEmojiPick = (emoji: string) => {
        if (!textareaRef.current) return;
        const { nextValue, nextCursor } = insertAtCursor(textareaRef.current, emoji, 400);
        setText(nextValue);
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        });
        setShowEmoji(false);
    };

    const TabButton = ({
        k,
        label,
        count,
        icon,
    }: {
        k: Tab;
        label: string;
        count?: number;
        icon: React.ReactNode;
    }) => {
        const active = tab === k;

        return (
            <button
                type="button"
                onClick={() => setTab(k)}
                className={[
                    "flex items-center justify-center gap-1.5",
                    "w-full py-2 text-xs font-bold border-b-2 transition",
                    active ? "text-gray-900 border-gray-900" : "text-gray-500 border-transparent hover:text-gray-800",
                ].join(" ")}
            >
                <span className="text-base">{icon}</span>
                <span>{label}</span>
                <span className="text-gray-400 font-semibold">{nfmt(count)}</span>
            </button>
        );
    };

    const activeActivity =
        tab === "likes" ? likesQ : tab === "views" ? viewsQ : tab === "shares" ? sharesQ : null;

    return (
        <aside className={outer} style={{ borderColor: EKARI.hair }} aria-live="polite">
            <div className="flex flex-col w-full h-full">
                {/* Meta + Tabs header */}
                <div className="border-b" style={{ borderColor: EKARI.hair }}>
                    <div className="px-4 pt-4 pb-3">
                        <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">Posted {posted ? posted.toLocaleString() : "—"}</div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-gray-100"
                                aria-label="Close"
                                type="button"
                            >
                                <IoClose size={22} />
                            </button>
                        </div>

                        <div className="mt-3 flex w-full border-b border-gray-200">
                            <TabButton k="comments" label="Comments" count={stats?.comments} icon={<IoChatbubbleOutline />} />
                            <TabButton k="likes" label="Likes" count={stats?.likes} icon={<IoHeartOutline />} />
                            <TabButton k="views" label="Views" count={stats?.views} icon={<IoEyeOutline />} />
                            <TabButton k="shares" label="Shares" count={stats?.shares} icon={<IoShareOutline />} />
                        </div>

                        {tab === "comments" && (
                            <div className="mt-3 flex items-center justify-between">
                                <button
                                    onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
                                    className="p-2 rounded-full hover:bg-gray-100"
                                    title="Toggle sort"
                                    aria-label="Toggle sort"
                                    type="button"
                                >
                                    <IoSwapVertical size={20} />
                                </button>

                                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                                    {stats?.comments ? `Comments · ${stats.comments}` : "Comments"}
                                </div>

                                <div className="w-10" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {tab === "comments" ? (
                        !enabled ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
                                <span className="text-4xl">🔒</span>
                                <div className="font-semibold">Comments are turned off</div>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
                                <span className="text-4xl">
                                    <IoChatbubbleOutline />
                                </span>
                                <div className="font-extrabold text-gray-900">Start the conversation</div>
                                <div>Be the first to leave a comment.</div>
                            </div>
                        ) : (
                            <ul className="px-3 py-2 space-y-3">
                                {items.map((c) => (
                                    <CommentRow
                                        key={c.id}
                                        deedId={deedId}
                                        comment={c}
                                        currentUser={currentUser}
                                        onReply={(id, handle) => setReplyTo({ id, handle })}
                                    />
                                ))}
                                <li className="py-2">
                                    {paging ? (
                                        <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                                            <Spinner size={14} className="border-gray-400 border-t-gray-600" /> Loading…
                                        </div>
                                    ) : (
                                        <button
                                            onClick={loadMore}
                                            className="w-full text-sm text-gray-600 hover:text-gray-900"
                                            type="button"
                                        >
                                            Load more
                                        </button>
                                    )}
                                </li>
                            </ul>
                        )
                    ) : (
                        <ActivityPanel tab={tab} queryData={activeActivity!} />
                    )}
                </div>

                {/* Guest chip (only comments tab) */}
                {tab === "comments" && enabled && isGuest && (
                    <div className="px-3 py-2">
                        <div className="text-center text-xs font-bold text-gray-600 bg-gray-100 rounded-full py-2">
                            Sign in to join the conversation
                        </div>
                    </div>
                )}

                {/* Composer (only comments tab) */}
                {tab === "comments" && (
                    <div className="border-t p-3" style={{ borderColor: EKARI.hair }}>
                        {replyTo && (
                            <div className="mb-2 flex items-center justify-between rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
                                <span>Replying to {replyTo.handle ? `${replyTo.handle}` : "comment"}</span>
                                <button
                                    onClick={() => setReplyTo(null)}
                                    className="p-1 rounded hover:bg-gray-200"
                                    aria-label="Cancel reply"
                                    type="button"
                                >
                                    <IoClose size={14} />
                                </button>
                            </div>
                        )}

                        <div className="flex items-center items-end gap-2 relative">
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                <img
                                    src={currentUser?.photoURL || "/avatar-placeholder.png"}
                                    alt="me"
                                    className="h-8 w-8 object-cover"
                                />
                            </div>

                            <div
                                className={["flex-1 bg-gray-100 items-center rounded-full px-3 py-2 flex items-end gap-2", sending ? "opacity-80" : ""].join(
                                    " "
                                )}
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={text}
                                    onChange={(e) => setText(clipGraphemes(e.target.value, 400))}
                                    className="flex-1 bg-transparent outline-none text-sm resize-none max-h-28"
                                    placeholder={!enabled ? "Comments are off" : isGuest ? "Sign in to comment…" : "Add a comment…"}
                                    disabled={!enabled || isGuest || sending}
                                    rows={1}
                                    aria-busy={sending}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            if (!sending) send();
                                        }
                                    }}
                                />

                                <button
                                    ref={emojiBtnRef}
                                    type="button"
                                    onClick={() => setShowEmoji((v) => !v)}
                                    disabled={!enabled || isGuest || sending}
                                    aria-haspopup="dialog"
                                    aria-expanded={showEmoji}
                                    title="Add emoji"
                                    className={["h-8 w-8 rounded-full bg-white text-lg grid place-items-center", "shadow border hover:bg-gray-50 disabled:opacity-50"].join(
                                        " "
                                    )}
                                >
                                    😊
                                </button>
                            </div>

                            <button
                                onClick={send}
                                disabled={!canSend}
                                aria-busy={sending}
                                className={`ml-1 h-9 px-3 rounded-full text-white text-sm font-bold inline-flex items-center gap-2 ${canSend ? "bg-gray-900 hover:opacity-90" : "bg-gray-400 cursor-not-allowed"
                                    }`}
                                type="button"
                            >
                                {sending ? <Spinner size={14} /> : null}
                                {sending ? "Sending" : "Send"}
                            </button>
                        </div>

                        <EmojiPopup
                            anchorRef={emojiBtnRef as React.RefObject<HTMLElement | null>}
                            open={showEmoji}
                            onClose={() => setShowEmoji(false)}
                            onSelect={(e) => {
                                onEmojiPick(e);
                                setShowEmoji(false);
                            }}
                        />
                    </div>
                )}
            </div>
        </aside>
    );
}

/* ------------------------------------------------------------------ */
/* Activity panel (Likes / Views / Shares)                             */
/* ------------------------------------------------------------------ */
function ActivityPanel({
    tab,
    queryData,
}: {
    tab: Exclude<Tab, "comments">;
    queryData: { items: any[]; loadMore: () => void; paging: boolean };
}) {
    const title = tab === "likes" ? "Liked by" : tab === "views" ? "Viewed by" : tab === "shares" ? "Shared by" : "Activity";

    const showLoadMore = tab !== "views"; // views are unique-deduped; load more is a no-op

    return (
        <div className="p-3">
            <div className="text-sm font-extrabold text-gray-900 mb-2">{title}</div>

            {queryData.items.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">No {tab} yet.</div>
            ) : (
                <>
                    <ul className="space-y-2">
                        {queryData.items.map((a: any) => (
                            <ActivityRow
                                key={a.id}
                                userId={a.userId}
                                embeddedUser={a.user}
                                fallbackHandle={a.userHandle}
                                fallbackPhotoURL={a.userPhotoURL}
                                fallbackDeviceId={a.deviceId}
                                rightText={
                                    tab === "views"
                                        ? `${a.viewsByUser ?? 1} view${(a.viewsByUser ?? 1) > 1 ? "s" : ""}`
                                        : tab === "shares"
                                            ? `${a.sharesByUser ?? 1} share${(a.sharesByUser ?? 1) > 1 ? "s" : ""}`
                                            : undefined
                                }

                            />
                        ))}
                    </ul>

                    {showLoadMore && (
                        <div className="pt-3">
                            {queryData.paging ? (
                                <div className="text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                                    <Spinner size={14} className="border-gray-400 border-t-gray-600" /> Loading…
                                </div>
                            ) : (
                                <button onClick={queryData.loadMore} className="w-full text-sm text-gray-600 hover:text-gray-900" type="button">
                                    Load more
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function ActivityRow({
    userId,
    embeddedUser,
    fallbackHandle,
    fallbackPhotoURL,
    fallbackDeviceId,
    rightText,
}: {
    userId?: string;
    embeddedUser?: UserEmbed | null;
    fallbackHandle?: string | null;
    fallbackPhotoURL?: string | null;
    fallbackDeviceId?: string | null;
    rightText?: string;
}) {
    // Only fetch if embedded data is missing
    const hasHandle = !!((embeddedUser?.handle ?? fallbackHandle ?? "").trim());
    const hasPhoto = !!((embeddedUser?.photoURL ?? fallbackPhotoURL ?? "").trim());
    const needsFetch = !!userId && (!hasHandle || !hasPhoto);

    const u = useUserLiteById(needsFetch ? userId : undefined);
    const embeddedName = (embeddedUser?.name ?? null) as string | null;
    const handle = ((embeddedUser?.handle ?? fallbackHandle ?? u?.handle ?? "") as string).trim();
    const photoURL =
        (embeddedUser?.photoURL ?? fallbackPhotoURL ?? u?.photoURL ?? "/avatar-placeholder.png") || "/avatar-placeholder.png";
    const name = (embeddedName ?? u?.handle ?? null) as string | null;
    const router = useRouter();
    const canOpen = !!handle;

    const go = () => {
        if (!canOpen) return;
        const clean = handle.startsWith("@") ? handle : `@${handle}`;
        router.push(`/${clean}/`);
    };

    return (
        <li className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
            <button
                type="button"
                onClick={go}
                className="h-9 w-9 rounded-full overflow-hidden bg-gray-200 shrink-0"
                aria-label="Open profile"
                disabled={!canOpen}
            >
                <img src={photoURL} alt={handle || "user"} className="h-full w-full object-cover" />
            </button>

            <div className="min-w-0 flex-1">
                <button
                    type="button"
                    onClick={go}
                    disabled={!canOpen}
                    className="text-sm font-bold text-gray-800 hover:underline text-left truncate disabled:opacity-70"
                >

                    <div className="text-sm font-extrabold text-gray-900 truncate">{name || "Someone"}</div>
                    <div className="text-[12px] font-semibold text-gray-500 truncate">
                        {handle || (fallbackDeviceId ? "Guest viewer" : "Someone")}
                    </div>
                </button>

                {!userId && !handle && fallbackDeviceId && (
                    <div className="text-[11px] text-gray-500">Anonymous device activity</div>
                )}
                {!userId && !handle && !fallbackDeviceId && (
                    <div className="text-[11px] text-gray-500">No user data stored on this event doc</div>
                )}
            </div>

            {rightText && <div className="text-xs font-bold text-gray-500 whitespace-nowrap">{rightText}</div>}
        </li>
    );
}

/* ------------------------------------------------------------------ */
/* Comment rows + replies                                               */
/* ------------------------------------------------------------------ */
function CommentRow({
    deedId,
    comment,
    currentUser,
    onReply,
}: {
    deedId: string;
    comment: any;
    currentUser: UserLite & { name?: string | null };
    onReply: (id: string, handle?: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    useReplies(deedId, comment.id, open); // keep snapshot subscription behavior
    const canModify = currentUser?.uid === comment?.userId;

    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment?.text ?? "");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const editTextareaRef = useRef<HTMLTextAreaElement>(null);
    const editEmojiBtnRef = useRef<HTMLButtonElement>(null);
    const [showEditEmoji, setShowEditEmoji] = useState(false);

    useEffect(() => {
        setEditText(comment?.text ?? "");
    }, [comment?.text]);

    const saveEdit = async () => {
        if (!canModify) return;
        const text = clipGraphemes(editText.trim(), 400);
        if (!text) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "comments", comment.id), {
                text,
                edited: true,
                editedAt: serverTimestamp(),
            });
            setIsEditing(false);
        } catch (e) {
            console.warn("update comment error", e);
        } finally {
            setSaving(false);
        }
    };

    const deleteMine = async () => {
        if (!canModify) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "comments", comment.id));
        } catch (e) {
            console.warn("delete comment error", e);
            setDeleting(false);
        }
    };

    const onPickEditEmoji = (emoji: string) => {
        if (!editTextareaRef.current) return;
        const { nextValue, nextCursor } = insertAtCursor(editTextareaRef.current, emoji, 400);
        setEditText(nextValue);
        requestAnimationFrame(() => {
            editTextareaRef.current?.focus();
            editTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        });
        setShowEditEmoji(false);
    };

    const router = useRouter();
    const goToProfile = useCallback(
        (handle?: string | null) => {
            const h = (handle || "").trim();
            if (!h) return;
            const clean = h.startsWith("@") ? h : "@" + h;
            router.push(`/${clean}/`);
        },
        [router]
    );

    const embeddedHandle = ((comment?.user?.handle ?? comment?.userHandle ?? "") as string).trim() || null;
    const embeddedPhoto = pickPhoto(comment);

    const authorProfile = useAuthorProfile(comment.userId);
    const avatar = embeddedPhoto || authorProfile?.photoURL || "/avatar-placeholder.png";

    return (
        <li className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                <button
                    type="button"
                    onClick={() => goToProfile(embeddedHandle)}
                    className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0 cursor-pointer"
                    aria-label="Open profile"
                    disabled={!embeddedHandle}
                >
                    <SmartAvatar src={avatar} alt={embeddedHandle ?? "user"} size={34} />
                </button>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {!!embeddedHandle && (
                        <button
                            type="button"
                            onClick={() => goToProfile(embeddedHandle)}
                            className="text-sm font-bold text-gray-700 hover:underline"
                        >
                            {embeddedHandle}
                        </button>
                    )}

                    <span className="text-xs text-gray-400">{timeAgo(comment.createdAt)}</span>
                </div>

                {!isEditing ? (
                    <>
                        {!!comment.text && (
                            <div className="text-sm text-gray-900 whitespace-pre-wrap">
                                {comment.text}
                                {comment.edited && <span className="ml-2 text-[11px] text-gray-500">(edited)</span>}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-1">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={editTextareaRef}
                                value={editText}
                                onChange={(e) => setEditText(clipGraphemes(e.target.value, 400))}
                                rows={2}
                                disabled={saving}
                                aria-busy={saving}
                                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-70"
                                maxLength={800}
                            />
                            <button
                                ref={editEmojiBtnRef}
                                type="button"
                                onClick={() => setShowEditEmoji((v) => !v)}
                                disabled={saving}
                                aria-haspopup="dialog"
                                aria-expanded={showEditEmoji}
                                title="Add emoji"
                                className={[
                                    "h-8 w-8 rounded-full bg-white text-lg grid place-items-center",
                                    "shadow border hover:bg-gray-50 disabled:opacity-50",
                                ].join(" ")}
                            >
                                😊
                            </button>
                        </div>

                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={saveEdit}
                                disabled={!editText.trim() || saving}
                                aria-busy={saving}
                                className={`px-3 py-1.5 rounded-full text-white text-sm font-bold inline-flex items-center gap-2 ${editText.trim() && !saving ? "bg-gray-900 hover:opacity-90" : "bg-gray-400 cursor-not-allowed"
                                    }`}
                                type="button"
                            >
                                {saving ? <Spinner size={14} /> : null}
                                {saving ? "Saving" : "Save"}
                            </button>
                            <button
                                onClick={() => {
                                    if (saving) return;
                                    setIsEditing(false);
                                    setEditText(comment?.text ?? "");
                                }}
                                className="px-3 py-1.5 rounded-full text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                                type="button"
                            >
                                Cancel
                            </button>
                        </div>

                        <EmojiPopup
                            anchorRef={editEmojiBtnRef as React.RefObject<HTMLElement | null>}
                            open={showEditEmoji}
                            onClose={() => setShowEditEmoji(false)}
                            onSelect={onPickEditEmoji}
                        />
                    </div>
                )}

                <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                    <button onClick={() => onReply(comment.id, embeddedHandle)} className="font-semibold hover:text-gray-900" type="button">
                        Reply
                    </button>
                    <button onClick={() => setOpen((v) => !v)} className="hover:text-gray-900" type="button">
                        {open ? "Hide replies" : `View replies${typeof comment.replies === "number" ? ` (${comment.replies})` : ""}`}
                    </button>

                    {canModify && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="ml-auto inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                            title="Edit"
                            type="button"
                        >
                            <IoPencil /> Edit
                        </button>
                    )}

                    {canModify && (
                        <button
                            onClick={deleteMine}
                            disabled={deleting}
                            aria-busy={deleting}
                            className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 disabled:opacity-60"
                            title="Delete"
                            type="button"
                        >
                            {deleting ? <Spinner size={12} className="border-gray-500 border-t-red-600" /> : <IoTrashOutline size={16} />}
                            {deleting ? "Deleting" : "Delete"}
                        </button>
                    )}
                </div>

                {open && (
                    <div className="pl-3 mt-2 border-l border-gray-200">
                        <RepliesList goToProfile={goToProfile} deedId={deedId} parentId={comment.id} currentUser={currentUser} />
                    </div>
                )}
            </div>
        </li>
    );
}

function useAuthorProfile(authorId?: string) {
    const [profile, setProfile] = useState<{ handle?: string; photoURL?: string } | null>(null);

    useEffect(() => {
        if (!authorId) {
            setProfile(null);
            return;
        }
        const ref = doc(db, "users", authorId);
        const unsub = onSnapshot(ref, (snap) => {
            const data = snap.data() as any | undefined;
            if (!data) {
                setProfile(null);
                return;
            }
            setProfile({ handle: data?.handle, photoURL: data?.photoURL });
        });
        return () => unsub();
    }, [authorId]);

    return profile;
}

function RepliesList({
    goToProfile,
    deedId,
    parentId,
    currentUser,
}: {
    goToProfile: (handle: string) => void;
    deedId: string;
    parentId: string;
    currentUser: UserLite;
}) {
    const { list, loadMore, hasMore } = useReplies(deedId, parentId, true);

    return (
        <ul className="space-y-3">
            {list.map((r) => (
                <ReplyRow key={r.id} goToProfile={goToProfile} reply={r} currentUser={currentUser} />
            ))}
            {hasMore && (
                <li>
                    <button onClick={loadMore} className="py-1.5 text-xs text-gray-600 hover:text-gray-900" type="button">
                        Load more
                    </button>
                </li>
            )}
        </ul>
    );
}

function ReplyRow({
    reply,
    currentUser,
    goToProfile,
}: {
    reply: any;
    currentUser: UserLite;
    goToProfile: (handle: string) => void;
}) {
    const canModify = currentUser?.uid === reply?.userId;
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(reply?.text ?? "");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const editTextareaRef = useRef<HTMLTextAreaElement>(null);
    const editEmojiBtnRef = useRef<HTMLButtonElement>(null);
    const [showEditEmoji, setShowEditEmoji] = useState(false);

    useEffect(() => {
        setEditText(reply?.text ?? "");
    }, [reply?.text]);

    const saveEdit = async () => {
        if (!canModify) return;
        const text = clipGraphemes(editText.trim(), 400);
        if (!text) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "comments", reply.id), {
                text,
                edited: true,
                editedAt: serverTimestamp(),
            });
            setIsEditing(false);
        } catch (e) {
            console.warn("update reply error", e);
        } finally {
            setSaving(false);
        }
    };

    const deleteMine = async () => {
        if (!canModify) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, "comments", reply.id));
        } catch (e) {
            console.warn("delete reply error", e);
            setDeleting(false);
        }
    };

    const onPickEditEmoji = (emoji: string) => {
        if (!editTextareaRef.current) return;
        const { nextValue, nextCursor } = insertAtCursor(editTextareaRef.current, emoji, 400);
        setEditText(nextValue);
        requestAnimationFrame(() => {
            editTextareaRef.current?.focus();
            editTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        });
        setShowEditEmoji(false);
    };

    const handle = ((reply?.user?.handle ?? reply?.userHandle ?? "") as string).trim() || null;
    const embeddedPhoto = pickPhoto(reply);

    const authorProfile = useAuthorProfile(reply.userId);
    const avatar = embeddedPhoto || authorProfile?.photoURL || "/avatar-placeholder.png";

    return (
        <li className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full overflow-hidden bg-gray-200 shrink-0">
                <button
                    type="button"
                    onClick={() => (handle ? goToProfile(handle) : null)}
                    className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0 cursor-pointer"
                    aria-label="Open profile"
                    disabled={!handle}
                >
                    <SmartAvatar src={avatar} alt={handle ?? "user"} size={34} />
                </button>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {!!handle && (
                        <button type="button" onClick={() => goToProfile(handle)} className="text-xs font-bold text-gray-600 hover:underline">
                            {handle}
                        </button>
                    )}

                    <span className="text-[11px] text-gray-400">{timeAgo(reply.createdAt)}</span>
                </div>

                {!isEditing ? (
                    <>
                        {!!reply.text && (
                            <div className="text-sm text-gray-900 whitespace-pre-wrap">
                                {reply.text}
                                {reply.edited && <span className="ml-2 text-[10px] text-gray-500">(edited)</span>}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-1">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={editTextareaRef}
                                value={editText}
                                onChange={(e) => setEditText(clipGraphemes(e.target.value, 400))}
                                rows={2}
                                disabled={saving}
                                aria-busy={saving}
                                className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-70"
                                maxLength={800}
                            />
                            <button
                                ref={editEmojiBtnRef}
                                type="button"
                                onClick={() => setShowEditEmoji((v) => !v)}
                                disabled={saving}
                                aria-haspopup="dialog"
                                aria-expanded={showEditEmoji}
                                title="Add emoji"
                                className={[
                                    "h-8 w-8 rounded-full bg-white text-lg grid place-items-center",
                                    "shadow border hover:bg-gray-50 disabled:opacity-50",
                                ].join(" ")}
                            >
                                😊
                            </button>
                        </div>

                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={saveEdit}
                                disabled={!editText.trim() || saving}
                                aria-busy={saving}
                                className={`px-3 py-1.5 rounded-full text-white text-sm font-bold inline-flex items-center gap-2 ${editText.trim() && !saving ? "bg-gray-900 hover:opacity-90" : "bg-gray-400 cursor-not-allowed"
                                    }`}
                                type="button"
                            >
                                {saving ? <Spinner size={14} /> : null}
                                {saving ? "Saving" : "Save"}
                            </button>
                            <button
                                onClick={() => {
                                    if (saving) return;
                                    setIsEditing(false);
                                    setEditText(reply?.text ?? "");
                                }}
                                className="px-3 py-1.5 rounded-full text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                                type="button"
                            >
                                Cancel
                            </button>
                        </div>

                        <EmojiPopup
                            anchorRef={editEmojiBtnRef as React.RefObject<HTMLElement | null>}
                            open={showEditEmoji}
                            onClose={() => setShowEditEmoji(false)}
                            onSelect={onPickEditEmoji}
                        />
                    </div>
                )}

                {canModify && !isEditing && (
                    <div className="mt-2 flex items-center gap-3 text-xs">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                            title="Edit reply"
                            type="button"
                        >
                            <IoPencil /> Edit
                        </button>
                        <button
                            onClick={deleteMine}
                            disabled={deleting}
                            aria-busy={deleting}
                            className="inline-flex items-center gap-2 text-gray-500 hover:text-red-600 disabled:opacity-60"
                            title="Delete reply"
                            type="button"
                        >
                            {deleting ? <Spinner size={12} className="border-gray-500 border-t-red-600" /> : <IoTrashOutline size={14} />}
                            {deleting ? "Deleting" : "Delete"}
                        </button>
                    </div>
                )}
            </div>
        </li>
    );
}
