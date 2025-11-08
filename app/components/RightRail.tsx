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
} from "react-icons/io5";
import SmartAvatar from "./SmartAvatar";

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
        // @ts-ignore - Safari/older browsers may lack Segmenter
        if (typeof Intl !== "undefined" && Intl.Segmenter) {
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

    let left = Math.min(Math.max(8, anchorRect.right - popupW), vw - popupW - 8);

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

    // Esc to close
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Position calculations
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

    // Outside click (consider both popup & anchor)
    useGlobalClickAway(
        [popRef as React.RefObject<HTMLElement | null>, anchorRef],
        () => open && onClose()
    );

    if (!open || !pos) return null;

    const popup = (
        <div
            ref={popRef}
            role="dialog"
            aria-label="Emoji picker"
            className="fixed z-[1000]"
            style={{ top: pos.top, left: pos.left, width: 288 }}
        >
            {/* caret */}
            <div
                className={[
                    "absolute h-3 w-3 rotate-45 bg-white border border-gray-200",
                    pos.placement === "top" ? "bottom-[-6px] right-4" : "top-[-6px] right-4",
                    "shadow-[0_1px_6px_rgba(0,0,0,.08)]",
                ].join(" ")}
            />
            {/* panel */}
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
/* Types & small data hooks                                            */
/* ------------------------------------------------------------------ */
type SortMode = "newest" | "oldest";
type UserLite = { uid?: string; photoURL?: string | null; handle?: string | null };

function useDeedCommentsMeta(deedId?: string, open?: boolean) {
    const [count, setCount] = useState(0);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        if (!deedId || !open) return;
        const unsub = onSnapshot(doc(db, "deeds", deedId), (s) => {
            const d = s.data() as any;
            setCount(Number(d?.stats?.comments ?? 0));
            setEnabled(d?.allowComments !== false && d?.commentsEnabled !== false);
        });
        return () => unsub();
    }, [deedId, open]);

    return { count, enabled };
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

/* ------------------------------------------------------------------ */
/* RightRail (comments panel with TikTok-like emoji popup)            */
/* ------------------------------------------------------------------ */

const EKARI = {
    forest: "#233F39",
    leaf: "#1F3A34",
    gold: "#C79257", hair: "#E5E7EB", text: "#111827", subtext: "#6B7280"
};
type RightRailProps = {
    open: boolean;
    deedId?: string;
    onClose: () => void;
    currentUser: { uid?: string; photoURL?: string | null; handle?: string };
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

    const [sort, setSort] = useState<SortMode>("newest");
    const { count, enabled } = useDeedCommentsMeta(deedId, open);
    const { items, loadMore, paging } = useTopLevelComments(deedId, open, sort);

    const outer = [
        mode === "sidebar" ? "hidden lg:flex h-screen w-[400px] border-l" : "flex lg:hidden",
        "h-full flex-col",
        className || "",
    ].join(" ");

    // composer
    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string; handle?: string | null } | null>(null);
    const [sending, setSending] = useState(false);
    const isGuest = !currentUser?.uid;
    const canSend = !!currentUser?.uid && enabled && text.trim().length > 0 && !sending;

    // emoji popup state
    const [showEmoji, setShowEmoji] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);

    // reset when deed changes or panel closes
    useEffect(() => {
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
                userPhotoURL: currentUser.photoURL ?? null,
                userHandle: currentUser.handle ?? null,
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

    return (
        <aside className={outer} style={{ borderColor: EKARI.hair }} aria-live="polite">
            <div className="flex flex-col w-full h-full">
                {/* Header */}
                <div className="h-12 flex items-center justify-between px-3 border-b" style={{ borderColor: EKARI.hair }}>
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
                        {count > 0 ? `Comments · ${count}` : "Comments"}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close" type="button">
                        <IoClose size={22} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                    {!enabled ? (
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
                                    <button onClick={loadMore} className="w-full text-sm text-gray-600 hover:text-gray-900" type="button">
                                        Load more
                                    </button>
                                )}
                            </li>
                        </ul>
                    )}
                </div>

                {/* Guest chip */}
                {enabled && isGuest && (
                    <div className="px-3 py-2">
                        <div className="text-center text-xs font-bold text-gray-600 bg-gray-100 rounded-full py-2">
                            Sign in to join the conversation
                        </div>
                    </div>
                )}

                {/* Composer */}
                <div className="border-t p-3" style={{ borderColor: EKARI.hair }}>
                    {replyTo && (
                        <div className="mb-2 flex items-center justify-between rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
                            <span>Replying to {replyTo.handle ? `${replyTo.handle}` : "comment"}</span>
                            <button onClick={() => setReplyTo(null)} className="p-1 rounded hover:bg-gray-200" aria-label="Cancel reply" type="button">
                                <IoClose size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center items-end gap-2 relative">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={currentUser?.photoURL || "/avatar-placeholder.png"} alt="me" className="h-8 w-8 object-cover" />
                        </div>

                        <div className={["flex-1 bg-gray-100 items-center rounded-full px-3 py-2 flex items-end gap-2", sending ? "opacity-80" : ""].join(" ")}>
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

                            {/* Emoji button (anchor) */}
                            <button
                                ref={emojiBtnRef}
                                type="button"
                                onClick={() => setShowEmoji((v) => !v)}
                                disabled={!enabled || isGuest || sending}
                                aria-haspopup="dialog"
                                aria-expanded={showEmoji}
                                title="Add emoji"
                                className={[
                                    "h-8 w-8 rounded-full bg-white text-lg grid place-items-center",
                                    "shadow border hover:bg-gray-50 disabled:opacity-50",
                                ].join(" ")}
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
                </div>
            </div>

            {/* Portal-based floating picker (like TikTok) */}
            <EmojiPopup
                anchorRef={emojiBtnRef as React.RefObject<HTMLElement | null>}
                open={showEmoji}
                onClose={() => setShowEmoji(false)}
                onSelect={(e) => {
                    onEmojiPick(e);
                    setShowEmoji(false);
                }}
            />
        </aside>
    );
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */
function CommentRow({
    deedId,
    comment,
    currentUser,
    onReply,
}: {
    deedId: string;
    comment: any;
    currentUser: UserLite;
    onReply: (id: string, handle?: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const { list, loadMore, hasMore } = useReplies(deedId, comment.id, open);
    const canModify = currentUser?.uid === comment?.userId;

    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment?.text ?? "");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // NEW: emoji while editing
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

    // NEW: insert emoji into edit textarea at caret
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

    return (
        <li className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <SmartAvatar src={comment.userPhotoURL} alt={comment.userHandle} size={34} />

            </div>

            <div className="min-w-0 flex-1">
                {!!comment.userHandle && <div className="text-xs font-bold text-gray-600">{comment.userHandle}</div>}

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
                            {/* NEW: emoji anchor while editing */}
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

                        {/* NEW: editing emoji popup */}
                        <EmojiPopup
                            anchorRef={editEmojiBtnRef as React.RefObject<HTMLElement | null>}
                            open={showEditEmoji}
                            onClose={() => setShowEditEmoji(false)}
                            onSelect={onPickEditEmoji}
                        />
                    </div>
                )}

                <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                    <button onClick={() => onReply(comment.id, comment.userHandle ?? null)} className="font-semibold hover:text-gray-900" type="button">
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
                        <RepliesList deedId={deedId} parentId={comment.id} currentUser={currentUser} />
                    </div>
                )}
            </div>
        </li>
    );
}


function RepliesList({ deedId, parentId, currentUser }: { deedId: string; parentId: string; currentUser: UserLite }) {
    const { list, loadMore, hasMore } = useReplies(deedId, parentId, true);
    return (
        <ul className="space-y-3">
            {list.map((r) => (
                <ReplyRow key={r.id} reply={r} currentUser={currentUser} />
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

function ReplyRow({ reply, currentUser }: { reply: any; currentUser: UserLite }) {
    const canModify = currentUser?.uid === reply?.userId;
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(reply?.text ?? "");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // NEW: emoji while editing a reply
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

    // NEW: insert emoji into reply edit textarea
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

    return (
        <li className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reply.userPhotoURL || "/avatar-placeholder.png"} alt="avatar" className="h-7 w-7 object-cover" />
            </div>

            <div className="min-w-0 flex-1">
                {!!reply.userHandle && <div className="text-[11px] font-bold text-gray-600">{reply.userHandle}</div>}

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
                            {/* NEW: emoji anchor while editing a reply */}
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

                        {/* NEW: emoji popup for reply editing */}
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