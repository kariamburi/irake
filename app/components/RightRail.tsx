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

function pickPhoto(a: any) {
    return (a?.user?.photoURL ?? a?.userPhotoURL ?? null) || null;
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

function useGlobalClickAway(
    refs: Array<React.RefObject<HTMLElement | null>>,
    onAway: () => void
) {
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

    useGlobalClickAway(
        [popRef as React.RefObject<HTMLElement | null>, anchorRef],
        () => open && onClose()
    );

    if (!open || !pos) return null;

    return ReactDOM.createPortal(
        <div
            ref={popRef}
            role="dialog"
            aria-label="Emoji picker"
            className="fixed z-[10050] pointer-events-auto"
            style={{ top: pos.top, left: pos.left, width: 288 }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className={[
                    "absolute h-3 w-3 rotate-45 bg-[#15231B] border border-white/10",
                    pos.placement === "top" ? "bottom-[-6px] right-4" : "top-[-6px] right-4",
                    "shadow-[0_1px_6px_rgba(0,0,0,.08)]",
                ].join(" ")}
            />
            <div className="rounded-2xl border border-white/10 bg-[#15231B] p-2 shadow-[0_18px_45px_rgba(0,0,0,0.42)] backdrop-blur-xl">
                <div className="grid grid-cols-8 gap-1 text-xl max-h-56 overflow-auto">
                    {DEFAULT_EMOJIS.map((e) => (
                        <button
                            key={e}
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-lg transition hover:scale-110 hover:bg-white/[0.08] focus:outline-none"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => onSelect(e)}
                            aria-label={`Insert ${e}`}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
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
    forest: "#0D1510",
    leaf: "#15231B",
    gold: "#F3A526",
    green: "#22C55E",
    cyan: "#22D3EE",
    coral: "#FB7185",
    hair: "rgba(255,255,255,0.10)",
    text: "#F8FAFC",
    subtext: "rgba(255,255,255,0.50)",
};

type RightRailProps = {
    open: boolean;
    deedId?: string;
    onClose: () => void;
    onsuccesfulcomment?: (deedId: string) => void;
    currentUser: { uid?: string; photoURL?: string | null; handle?: string | null; name?: string | null };
    mode?: "sidebar" | "sheet";
    className?: string;
};
/* ------------------------------------------------------------------ */
/* Grapheme-safe helpers                                               */
/* ------------------------------------------------------------------ */
function getGraphemeLength(input: string) {
    try {
        // @ts-ignore
        if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
            // @ts-ignore
            const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            let count = 0;
            for (const _ of seg.segment(input)) count++;
            return count;
        }
    } catch { }
    return Array.from(input).length;
}

function sliceGraphemes(input: string, max: number) {
    try {
        // @ts-ignore
        if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
            // @ts-ignore
            const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            let out = "";
            let n = 0;
            for (const part of seg.segment(input)) {
                if (n >= max) break;
                out += part.segment;
                n++;
            }
            return out;
        }
    } catch { }
    return Array.from(input).slice(0, max).join("");
}

function insertTextAtSelection(
    currentValue: string,
    selectionStart: number,
    selectionEnd: number,
    insert: string,
    limit = 400
) {
    const before = currentValue.slice(0, selectionStart);
    const after = currentValue.slice(selectionEnd);
    const nextValue = sliceGraphemes(before + insert + after, limit);

    const wantedCursor = before.length + insert.length;
    const nextCursor = Math.min(wantedCursor, nextValue.length);

    return { nextValue, nextCursor };
}
export default function RightRail({
    open,
    deedId,
    onClose,
    onsuccesfulcomment,
    currentUser,
    mode = "sidebar",
    className,
}: RightRailProps) {
    const outer = [
        mode === "sidebar"
            ? "hidden lg:flex h-screen w-[360px] border-l border-white/10"
            : "flex lg:hidden",
        "h-full flex-col bg-[#0D1510] text-white",
        className || "",
    ].join(" ");

    const isReady = !!open && !!deedId;

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
    const MAX_TEXTAREA_HEIGHT = 120;

    const resizeComposerTextarea = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;

        el.style.height = "auto";

        const nextHeight = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT);
        el.style.height = `${nextHeight}px`;
        el.style.overflowY =
            el.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
    }, []);
    const isGuest = !currentUser?.uid;
    const normalizedText = text.replace(/\r\n/g, "\n");
    const canSend =
        tab === "comments" &&
        !!currentUser?.uid &&
        enabled &&
        getGraphemeLength(normalizedText.trim()) > 0 &&
        !sending;
    const [showEmoji, setShowEmoji] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);
    const selectionStartRef = useRef(0);
    const selectionEndRef = useRef(0);
    useEffect(() => {
        setTab("comments");
        setText("");
        setReplyTo(null);
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;

            el.style.height = "auto";
            el.style.overflowY = "hidden";
        });
        setSending(false);
        setShowEmoji(false);
    }, [deedId, open]);
    const syncComposerSelection = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        selectionStartRef.current = el.selectionStart ?? text.length;
        selectionEndRef.current = el.selectionEnd ?? text.length;
    }, [text]);
    const send = useCallback(async () => {
        if (!canSend || !deedId || !currentUser?.uid) return;
        setSending(true);
        try {

            const trimmed = sliceGraphemes(text.trim(), 400);
            if (!trimmed) return;
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
            onsuccesfulcomment?.(deedId);
            setText("");
            setReplyTo(null);
            requestAnimationFrame(() => {
                const el = textareaRef.current;
                if (!el) return;

                el.style.height = "auto";
                el.style.overflowY = "hidden";
            });
        } finally {
            setSending(false);
        }
    }, [canSend, deedId, currentUser, text, replyTo]);

    const onEmojiPick = useCallback((emoji: string) => {
        const start = selectionStartRef.current ?? text.length;
        const end = selectionEndRef.current ?? text.length;

        const { nextValue, nextCursor } = insertTextAtSelection(
            text,
            start,
            end,
            emoji,
            400
        );

        setText(nextValue);

        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(nextCursor, nextCursor);
            selectionStartRef.current = nextCursor;
            selectionEndRef.current = nextCursor;
        });

        setShowEmoji(false);
    }, [text]);

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
                    "flex min-w-0 items-center justify-center gap-1",
                    "w-full px-1 py-2.5 text-[11px] font-bold border-b-2 transition-all duration-200",
                    active
                        ? "border-[#F3A526] text-white"
                        : "border-transparent text-white/45 hover:text-white/80",
                ].join(" ")}
            >
                <span className="shrink-0 text-[15px]">{icon}</span>
                <span className="truncate">{label}</span>
                <span className="shrink-0 font-semibold text-white/30">
                    {nfmt(count)}
                </span>
            </button>
        );
    };
    if (!isReady) {
        return (
            <aside
                className={`${outer} ${mode === "sidebar" ? "w-0 overflow-hidden" : "hidden"}`}
                aria-hidden
            />
        );
    }
    const activeActivity =
        tab === "likes" ? likesQ : tab === "views" ? viewsQ : tab === "shares" ? sharesQ : null;

    return (
        <aside
            className={`${outer} relative z-[9999] pointer-events-auto`}
            style={{ borderColor: EKARI.hair }}
            aria-live="polite"
        >
            <div className="flex h-full w-full flex-col bg-[#0D1510]">
                {/* Meta + Tabs header */}
                <div
                    className="shrink-0 border-b bg-[#0D1510]/95 backdrop-blur-xl"
                    style={{ borderColor: EKARI.hair }}
                >
                    <div className="px-4 pb-0 pt-3.5">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                type="button"
                                aria-label="Close"
                                className={[
                                    "relative z-40 grid h-9 w-9 shrink-0 place-items-center",
                                    "rounded-full border border-white/10 bg-white/[0.04]",
                                    "text-white/85",
                                    "transition-all duration-200 ease-out",
                                    "hover:scale-105 hover:bg-white/[0.09] hover:text-white",
                                    "active:scale-95",
                                ].join(" ")}
                            >
                                <IoClose size={21} />
                            </button>

                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/25">
                                    Deed activity
                                </div>

                                <div className="mt-0.5 truncate text-[11px] font-medium text-white/45">
                                    Posted {posted ? posted.toLocaleString() : "—"}
                                </div>
                            </div>

                            {tab === "comments" ? (
                                <button
                                    onClick={() =>
                                        setSort((s) =>
                                            s === "newest" ? "oldest" : "newest"
                                        )
                                    }
                                    className={[
                                        "grid h-9 w-9 shrink-0 place-items-center",
                                        "rounded-full border border-white/10 bg-white/[0.035]",
                                        "text-white/55",
                                        "transition-all duration-200 ease-out",
                                        "hover:scale-105 hover:bg-white/[0.08] hover:text-white",
                                        "active:scale-95",
                                    ].join(" ")}
                                    title={
                                        sort === "newest"
                                            ? "Newest comments first"
                                            : "Oldest comments first"
                                    }
                                    aria-label="Toggle comment sort"
                                    type="button"
                                >
                                    <IoSwapVertical size={18} />
                                </button>
                            ) : (
                                <div className="h-9 w-9 shrink-0" />
                            )}
                        </div>

                        <div className="mt-3 flex w-full border-b border-white/10">
                            <TabButton
                                k="comments"
                                label="Comments"
                                count={stats?.comments}
                                icon={<IoChatbubbleOutline />}
                            />
                            <TabButton
                                k="likes"
                                label="Likes"
                                count={stats?.likes}
                                icon={<IoHeartOutline />}
                            />
                            <TabButton
                                k="views"
                                label="Views"
                                count={stats?.views}
                                icon={<IoEyeOutline />}
                            />
                            <TabButton
                                k="shares"
                                label="Shares"
                                count={stats?.shares}
                                icon={<IoShareOutline />}
                            />
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-[#0D1510] no-scrollbar">
                    {tab === "comments" ? (
                        !enabled ? (
                            <div className="flex h-full items-center justify-center px-6 py-8">
                                <div
                                    className={[
                                        "w-full max-w-[280px] rounded-3xl",
                                        "border border-white/[0.08] bg-white/[0.035]",
                                        "px-6 py-8 text-center",
                                        "shadow-[0_18px_45px_rgba(0,0,0,0.18)]",
                                    ].join(" ")}
                                >
                                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-2xl">
                                        🔒
                                    </div>

                                    <div className="mt-4 text-base font-black text-white">
                                        Comments are turned off
                                    </div>

                                    <div className="mt-1.5 text-sm leading-5 text-white/35">
                                        This creator is not accepting comments on this deed.
                                    </div>
                                </div>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex h-full items-center justify-center px-6 py-8">
                                <div
                                    className={[
                                        "w-full max-w-[280px] rounded-3xl",
                                        "border border-white/[0.08] bg-white/[0.035]",
                                        "px-6 py-8 text-center",
                                        "shadow-[0_18px_45px_rgba(0,0,0,0.18)]",
                                    ].join(" ")}
                                >
                                    <div
                                        className={[
                                            "mx-auto grid h-14 w-14 place-items-center",
                                            "rounded-full border border-white/10 bg-white/[0.04]",
                                            "text-2xl text-white/40",
                                        ].join(" ")}
                                    >
                                        <IoChatbubbleOutline />
                                    </div>

                                    <div className="mt-4 text-base font-black text-white">
                                        Start the conversation
                                    </div>

                                    <div className="mt-1.5 text-sm leading-5 text-white/35">
                                        Be the first to leave a comment.
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <ul className="space-y-3 px-3 py-3">
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
                                        <div className="flex items-center justify-center gap-2 text-center text-sm text-white/40">
                                            <Spinner size={14} className="border-white/20 border-t-[#F3A526]" /> Loading…
                                        </div>
                                    ) : (
                                        <button
                                            onClick={loadMore}
                                            className="w-full text-sm font-semibold text-white/45 transition hover:text-[#F3A526]"
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
                        <div
                            className={[
                                "rounded-2xl border border-white/10",
                                "bg-white/[0.045] px-3 py-2.5 text-center",
                                "text-xs font-bold text-white/50",
                            ].join(" ")}
                        >
                            Sign in to join the conversation
                        </div>
                    </div>
                )}

                {/* Composer (only comments tab) */}
                {tab === "comments" && (
                    <div
                        className="shrink-0 border-t bg-[#101A13]/95 px-3 py-2.5 backdrop-blur-xl"
                        style={{ borderColor: EKARI.hair }}
                    >
                        {replyTo && (
                            <div className="mb-2 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/50">
                                <span>Replying to {replyTo.handle ? `${replyTo.handle}` : "comment"}</span>
                                <button
                                    onClick={() => setReplyTo(null)}
                                    className="rounded p-1 transition hover:bg-white/10 hover:text-white"
                                    aria-label="Cancel reply"
                                    type="button"
                                >
                                    <IoClose size={14} />
                                </button>
                            </div>
                        )}

                        <div className="relative flex items-end gap-2">
                            <div className="mb-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">

                                <SmartAvatar src={currentUser?.photoURL || "/avatar-placeholder.png"} alt={"user"} size={30} />
                            </div>

                            <div
                                className={[
                                    "flex min-w-0 flex-1 items-end gap-2 rounded-[22px]",
                                    "border border-white/10 bg-[#15231B] px-3 py-2",
                                    "transition-all duration-200",
                                    "focus-within:border-[#F3A526]/45",
                                    "focus-within:shadow-[0_0_0_3px_rgba(243,165,38,0.07)]",
                                    sending ? "opacity-80" : "",
                                ].join(" ")}
                            >
                                <textarea
                                    ref={textareaRef}
                                    value={text}
                                    onChange={(e) => {
                                        const next = clipGraphemes(e.target.value, 400);
                                        setText(next);

                                        selectionStartRef.current = e.target.selectionStart ?? e.target.value.length;
                                        selectionEndRef.current = e.target.selectionEnd ?? e.target.value.length;

                                        requestAnimationFrame(resizeComposerTextarea);
                                    }}
                                    onClick={syncComposerSelection}
                                    onKeyUp={() => {
                                        syncComposerSelection();
                                        resizeComposerTextarea();
                                    }}
                                    onSelect={syncComposerSelection}
                                    onFocus={() => {
                                        syncComposerSelection();
                                        resizeComposerTextarea();
                                    }}
                                    className="min-h-[20px] flex-1 resize-none overflow-hidden bg-transparent text-sm leading-5 text-white outline-none placeholder:text-white/30"
                                    placeholder={!enabled ? "Comments are off" : isGuest ? "Sign in to comment…" : "Add a comment…"}
                                    disabled={!enabled || isGuest || sending}
                                    rows={1}
                                    aria-busy={sending}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            if (!sending) send();
                                            return;
                                        }

                                        requestAnimationFrame(() => {
                                            syncComposerSelection();
                                            resizeComposerTextarea();
                                        });
                                    }}
                                />

                                <button
                                    ref={emojiBtnRef}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        syncComposerSelection();
                                    }}
                                    onClick={() => setShowEmoji((v) => !v)}
                                    disabled={!enabled || isGuest || sending}
                                    aria-haspopup="dialog"
                                    aria-expanded={showEmoji}
                                    title="Add emoji"
                                    className={[
                                        "grid h-8 w-8 place-items-center rounded-full",
                                        "border border-white/10 bg-white/[0.06] text-lg shadow-sm",
                                        "transition-all duration-200 hover:scale-105 hover:bg-white/[0.10]",
                                        "disabled:opacity-40",
                                    ].join(" ")}
                                >
                                    😊
                                </button>
                            </div>

                            <button
                                onClick={send}
                                disabled={!canSend}
                                aria-busy={sending}
                                className={[
                                    "ml-0.5 inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-black",
                                    "transition-all duration-200",
                                    canSend
                                        ? "bg-[#F3A526] text-[#102219] hover:scale-[1.03] hover:bg-[#FFB536] active:scale-95"
                                        : "cursor-not-allowed bg-white/10 text-white/30",
                                ].join(" ")}
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
            <div className="mb-3 text-[11px] font-black uppercase tracking-[0.12em] text-white/35">
                {title}
            </div>

            {queryData.items.length === 0 ? (
                <div className="flex min-h-[220px] items-center justify-center">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-6 py-5 text-center text-sm text-white/40">
                        No {tab} yet.
                    </div>
                </div>
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
                                <div className="flex items-center justify-center gap-2 text-center text-sm text-white/40">
                                    <Spinner size={14} className="border-white/20 border-t-[#F3A526]" /> Loading…
                                </div>
                            ) : (
                                <button onClick={queryData.loadMore} className="w-full text-sm font-semibold text-white/45 transition hover:text-[#F3A526]" type="button">
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
        <li
            className={[
                "flex items-center gap-3 rounded-2xl",
                "border border-white/[0.08] bg-white/[0.04]",
                "px-3 py-2.5",
                "transition-all duration-200",
                "hover:translate-x-0.5 hover:border-white/15 hover:bg-white/[0.065]",
            ].join(" ")}
        >
            <button
                type="button"
                onClick={go}
                className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
                aria-label="Open profile"
                disabled={!canOpen}
            >
                <SmartAvatar src={photoURL} alt={handle ?? "user"} size={34} />

            </button>

            <div className="min-w-0 flex-1">
                <button
                    type="button"
                    onClick={go}
                    disabled={!canOpen}
                    className="truncate text-left text-sm font-bold text-white/80 transition hover:text-white hover:underline disabled:opacity-70"
                >

                    <div className="truncate text-sm font-extrabold text-white">{name || "Someone"}</div>
                    <div className="truncate text-[12px] font-semibold text-white/40">
                        {handle || (fallbackDeviceId ? "Guest viewer" : "Someone")}
                    </div>
                </button>

                {!userId && !handle && fallbackDeviceId && (
                    <div className="text-[11px] text-white/35">Anonymous device activity</div>
                )}
                {!userId && !handle && !fallbackDeviceId && (
                    <div className="text-[11px] text-white/35">No user data stored on this event doc</div>
                )}
            </div>

            {rightText && <div className="whitespace-nowrap text-xs font-bold text-white/40">{rightText}</div>}
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
    const { list: replies } = useReplies(deedId, comment.id, open);
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

    const onPickEditEmoji = useCallback((emoji: string) => {
        const el = editTextareaRef.current;
        if (!el) return;

        const { nextValue, nextCursor } = insertTextAtSelection(
            editText,
            el.selectionStart ?? editText.length,
            el.selectionEnd ?? editText.length,
            emoji,
            400
        );

        setEditText(nextValue);

        requestAnimationFrame(() => {
            editTextareaRef.current?.focus();
            editTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
        });

        setShowEditEmoji(false);
    }, [editText]);

    const router = useRouter();

    const goToProfile = useCallback(
        (handle?: string | null) => {
            const h = (handle || "").trim();
            if (!h) return;
            const clean = h.startsWith("@") ? h : `@${h}`;
            router.push(`/${clean}/`);
        },
        [router]
    );

    const embeddedHandle = (
        (comment?.user?.handle ?? comment?.userHandle ?? "") as string
    ).trim() || null;

    const embeddedName = (
        (comment?.user?.name ?? "") as string
    ).trim() || embeddedHandle || "Someone";

    const embeddedPhoto =
        (comment?.user?.photoURL ?? comment?.userPhotoURL ?? null) || null;

    const created = timeAgo(comment?.createdAt);
    const replyCount =
        typeof comment?.replies === "number"
            ? comment.replies
            : Array.isArray(replies)
                ? replies.length
                : 0;

    return (
        <li className="rounded-2xl">
            <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                    <button
                        type="button"
                        onClick={() => goToProfile(embeddedHandle)}
                        disabled={!embeddedHandle}
                        className="mt-0.5 shrink-0 rounded-full disabled:opacity-100"
                        aria-label="Open profile"
                    >
                        <SmartAvatar src={embeddedPhoto} alt={embeddedHandle ?? "user"} size={34} />

                    </button>
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => goToProfile(embeddedHandle)}
                            disabled={!embeddedHandle}
                            className="truncate text-left text-[12px] font-bold text-white/90 transition hover:text-white hover:underline disabled:no-underline"
                        >
                            {embeddedName}
                        </button>

                        {embeddedHandle ? (
                            <button
                                type="button"
                                onClick={() => goToProfile(embeddedHandle)}
                                disabled={!embeddedHandle}
                                className="truncate text-[11px] font-medium text-white/35 transition hover:text-white/65 disabled:hover:text-white/35"
                            >
                                {embeddedHandle.startsWith("@") ? embeddedHandle : `@${embeddedHandle}`}
                            </button>
                        ) : null}

                        {created ? (
                            <span className="shrink-0 text-[11px] text-white/25">{created}</span>
                        ) : null}

                        {comment?.edited ? (
                            <span className="shrink-0 text-[10px] font-medium text-white/25">
                                edited
                            </span>
                        ) : null}
                    </div>

                    {!isEditing ? (
                        <div
                            className={[
                                "mt-1.5 inline-block max-w-full rounded-2xl",
                                "border border-white/[0.07] bg-white/[0.05]",
                                "px-3 py-2",
                            ].join(" ")}
                        >
                            <p className="whitespace-pre-wrap break-words text-[13px] leading-[1.4] text-white/85">
                                {comment?.text || ""}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-2 rounded-2xl border border-white/10 bg-[#15231B] p-2 shadow-sm">
                            <textarea
                                ref={editTextareaRef}
                                value={editText}
                                onChange={(e) => setEditText(clipGraphemes(e.target.value, 400))}
                                className="min-h-[72px] w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] leading-[1.4] text-white outline-none focus:border-[#F3A526]/45"
                                disabled={saving}
                            />

                            <div className="mt-2 flex items-center justify-between gap-2">
                                <button
                                    ref={editEmojiBtnRef}
                                    type="button"
                                    onClick={() => setShowEditEmoji((v) => !v)}
                                    className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[16px] transition hover:bg-white/[0.10]"
                                    title="Add emoji"
                                >
                                    😊
                                </button>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (saving) return;
                                            setIsEditing(false);
                                            setEditText(comment?.text ?? "");
                                        }}
                                        className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-white/60 transition hover:bg-white/[0.10] hover:text-white"
                                        type="button"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        onClick={saveEdit}
                                        disabled={saving || !editText.trim()}
                                        className="rounded-full bg-[#F3A526] px-3 py-1.5 text-[12px] font-bold text-[#102219] transition hover:bg-[#FFB536] disabled:opacity-40"
                                        type="button"
                                    >
                                        {saving ? "Saving" : "Save"}
                                    </button>
                                </div>
                            </div>

                            <EmojiPopup
                                anchorRef={editEmojiBtnRef as React.RefObject<HTMLElement | null>}
                                open={showEditEmoji}
                                onClose={() => setShowEditEmoji(false)}
                                onSelect={onPickEditEmoji}
                            />
                        </div>
                    )}

                    <div className="mt-2 flex items-center gap-4 text-[11px] text-white/35">
                        <button
                            onClick={() => onReply(comment.id, embeddedHandle)}
                            className="font-semibold transition hover:text-[#F3A526]"
                            type="button"
                        >
                            Reply
                        </button>

                        <button
                            onClick={() => setOpen((v) => !v)}
                            className="transition hover:text-white"
                            type="button"
                        >
                            {open
                                ? "Hide replies"
                                : `View replies${replyCount > 0 ? ` (${replyCount})` : ""}`}
                        </button>

                        {canModify && !isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-white/35 transition hover:text-[#F3A526]"
                                title="Edit"
                                type="button"
                            >
                                <IoPencil size={12} />
                                Edit
                            </button>
                        ) : null}

                        {canModify ? (
                            <button
                                onClick={deleteMine}
                                disabled={deleting}
                                aria-busy={deleting}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-white/25 transition hover:text-rose-400 disabled:opacity-60"
                                title="Delete"
                                type="button"
                            >
                                <IoTrashOutline size={12} />
                                {deleting ? "Deleting" : "Delete"}
                            </button>
                        ) : null}
                    </div>

                    {open && replies.length > 0 ? (
                        <div className="mt-3 space-y-3 border-l border-white/10 pl-3">
                            {replies.map((reply) => (
                                <CommentRow
                                    key={reply.id}
                                    deedId={deedId}
                                    comment={reply}
                                    currentUser={currentUser}
                                    onReply={onReply}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
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
                    <button onClick={loadMore} className="py-1.5 text-xs font-semibold text-white/40 transition hover:text-[#F3A526]" type="button">
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
            <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
                <button
                    type="button"
                    onClick={() => (handle ? goToProfile(handle) : null)}
                    className="h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10"
                    aria-label="Open profile"
                    disabled={!handle}
                >
                    <SmartAvatar src={avatar} alt={handle ?? "user"} size={34} />
                </button>
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    {!!handle && (
                        <button type="button" onClick={() => goToProfile(handle)} className="text-xs font-bold text-white/55 transition hover:text-white hover:underline">
                            {handle}
                        </button>
                    )}

                    <span className="text-[11px] text-white/25">{timeAgo(reply.createdAt)}</span>
                </div>

                {!isEditing ? (
                    <>
                        {!!reply.text && (
                            <div className="whitespace-pre-wrap text-sm text-white/85">
                                {reply.text}
                                {reply.edited && <span className="ml-2 text-[10px] text-white/30">(edited)</span>}
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
                                className="w-full rounded-xl border border-white/10 bg-white/[0.04] p-2 text-sm text-white outline-none focus:border-[#F3A526]/45 focus:ring-2 focus:ring-[#F3A526]/10 disabled:opacity-70"
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
                                    "grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-lg",
                                    "border border-white/10 shadow transition hover:bg-white/[0.10] disabled:opacity-50",
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
                                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-semibold text-white/55 transition hover:bg-white/[0.10] hover:text-white"
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
                            className="inline-flex items-center gap-1 text-white/40 transition hover:text-[#F3A526]"
                            title="Edit reply"
                            type="button"
                        >
                            <IoPencil /> Edit
                        </button>
                        <button
                            onClick={deleteMine}
                            disabled={deleting}
                            aria-busy={deleting}
                            className="inline-flex items-center gap-2 text-white/30 transition hover:text-rose-400 disabled:opacity-60"
                            title="Delete reply"
                            type="button"
                        >
                            {deleting ? <Spinner size={12} className="border-white/20 border-t-rose-400" /> : <IoTrashOutline size={14} />}
                            {deleting ? "Deleting" : "Delete"}
                        </button>
                    </div>
                )}
            </div>
        </li>
    );
}