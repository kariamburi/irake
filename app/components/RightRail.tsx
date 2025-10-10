"use client";

import React, { useCallback, useEffect, useState } from "react";
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
import { IoChatbubbleOutline, IoClose, IoPencil, IoSwapVertical, IoTrashOutline } from "react-icons/io5";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type SortMode = "newest" | "oldest";
type UserLite = { uid?: string; photoURL?: string | null; handle?: string | null };

/* ------------------------------------------------------------------ */
/* Small hooks                                                         */
/* ------------------------------------------------------------------ */
function useDeedCommentsMeta(deedId?: string, open?: boolean) {
    const [count, setCount] = useState(0);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        if (!deedId || !open) return;
        const unsub = onSnapshot(doc(db, "deeds", deedId), (s) => {
            const d = s.data() as any;
            setCount(Number(d?.stats?.comments ?? 0));
            setEnabled((d?.allowComments !== false) && (d?.commentsEnabled !== false));
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
/* RightRail = Comments panel                                         */
/* ------------------------------------------------------------------ */
const EKARI = { hair: "#E5E7EB", text: "#111827", subtext: "#6B7280" };
type RightRailProps = {
    open: boolean;
    deedId?: string;
    onClose: () => void;
    currentUser: { uid?: string; photoURL?: string | null; handle?: string };
    mode?: "sidebar" | "sheet"; // NEW
    className?: string;         // optional
};
export default function RightRail({
    open,
    deedId,
    onClose,
    currentUser,
    mode = "sidebar",
    className,
}: RightRailProps) {
    // hide entirely when closed (frees width)
    if (!open || !deedId) {
        return <aside className="hidden lg:flex w-0 shrink-0" aria-hidden />;
    }

    const [sort, setSort] = useState<SortMode>("newest");
    const { count, enabled } = useDeedCommentsMeta(deedId, open);
    const { items, loadMore, paging } = useTopLevelComments(deedId, open, sort);
    // Outer visibility container
    const outer = [
        // In sidebar mode: only show on lg+
        mode === "sidebar" ? "hidden lg:flex h-screen w-[400px] border-l" : "flex lg:hidden",
        "h-full flex-col", // ensure full height for internal scroll areas
        className || "",
    ].join(" ");
    // composer
    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string; handle?: string | null } | null>(null);
    const isGuest = !currentUser?.uid;
    const canSend = !!currentUser?.uid && enabled && text.trim().length > 0;

    // reset when deed changes or panel closes
    useEffect(() => {
        setText("");
        setReplyTo(null);
    }, [deedId, open]);

    const send = useCallback(async () => {
        if (!canSend) return;
        await addDoc(collection(db, "comments"), {
            deedId,
            userId: currentUser.uid,
            userPhotoURL: currentUser.photoURL ?? null,
            userHandle: currentUser.handle ?? null,
            text: text.trim().slice(0, 400),
            imageUrl: null, // wire later if needed
            parentId: replyTo?.id ?? null,
            createdAt: serverTimestamp(),
        });
        setText("");
        setReplyTo(null);
    }, [canSend, deedId, currentUser, text, replyTo]);

    return (
        <aside
            className={outer}
            style={{ borderColor: EKARI.hair }}
            aria-live="polite"
        >
            <div className="flex flex-col w-full h-full">
                {/* Header */}
                <div className="h-12 flex items-center justify-between px-3 border-b" style={{ borderColor: EKARI.hair }}>
                    <button
                        onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
                        className="p-2 rounded-full hover:bg-gray-100"
                        title="Toggle sort"
                        aria-label="Toggle sort"
                    >
                        <IoSwapVertical size={20} />
                    </button>
                    <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                        {count > 0 ? `Comments · ${count}` : "Comments"}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
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
                            <span className="text-4xl"><IoChatbubbleOutline /></span>
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
                                    <div className="text-center text-sm text-gray-500">Loading…</div>
                                ) : (
                                    <button onClick={loadMore} className="w-full text-sm text-gray-600 hover:text-gray-900">
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
                            <button onClick={() => setReplyTo(null)} className="p-1 rounded hover:bg-gray-200" aria-label="Cancel reply">
                                <IoClose size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-end gap-2">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={currentUser?.photoURL || "/avatar-placeholder.png"}
                                alt="me"
                                className="h-8 w-8 object-cover"
                            />
                        </div>

                        <div className="flex-1 bg-gray-100 rounded-full px-3 py-2 flex items-end gap-2">
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="flex-1 bg-transparent outline-none text-sm resize-none max-h-28"
                                placeholder={!enabled ? "Comments are off" : isGuest ? "Sign in to comment…" : "Add a comment…"}
                                disabled={!enabled || isGuest}
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                            />
                        </div>

                        <button
                            onClick={send}
                            disabled={!canSend}
                            className={`ml-1 h-9 px-3 rounded-full text-white text-sm font-bold ${canSend ? "bg-gray-900 hover:opacity-90" : "bg-gray-400 cursor-not-allowed"
                                }`}
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}

/* ------------------------------------------------------------------ */
/* Row + Replies                                                       */
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

    // EDIT state for TOP-LEVEL comment
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(comment?.text ?? "");

    useEffect(() => {
        // when incoming data changes, reset edit buffer
        setEditText(comment?.text ?? "");
    }, [comment?.text]);

    const saveEdit = async () => {
        if (!canModify) return;
        const text = editText.trim().slice(0, 400);
        if (!text) return;
        try {
            await updateDoc(doc(db, "comments", comment.id), {
                text,
                edited: true,
                editedAt: serverTimestamp(),
            });
            setIsEditing(false);
        } catch (e) {
            console.warn("update comment error", e);
        }
    };

    const deleteMine = async () => {
        if (!canModify) return;
        try {
            await deleteDoc(doc(db, "comments", comment.id));
        } catch (e) {
            console.warn("delete comment error", e);
        }
    };

    return (
        <li className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={comment.userPhotoURL || "/avatar-placeholder.png"}
                    alt="avatar"
                    className="h-8 w-8 object-cover"
                />
            </div>

            <div className="min-w-0 flex-1">
                {!!comment.userHandle && (
                    <div className="text-xs font-bold text-gray-600">{comment.userHandle}</div>
                )}

                {/* Top-level comment text / editor */}
                {!isEditing ? (
                    <>
                        {!!comment.text && (
                            <div className="text-sm text-gray-900 whitespace-pre-wrap">
                                {comment.text}
                                {comment.edited && (
                                    <span className="ml-2 text-[11px] text-gray-500">(edited)</span>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-1">
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                            maxLength={400}
                        />
                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={saveEdit}
                                disabled={!editText.trim()}
                                className={`px-3 py-1.5 rounded-full text-white text-sm font-bold ${editText.trim()
                                    ? "bg-gray-900 hover:opacity-90"
                                    : "bg-gray-400 cursor-not-allowed"
                                    }`}
                            >
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditText(comment?.text ?? "");
                                }}
                                className="px-3 py-1.5 rounded-full text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                    <button
                        onClick={() => onReply(comment.id, comment.userHandle ?? null)}
                        className="font-semibold hover:text-gray-900"
                    >
                        Reply
                    </button>
                    <button onClick={() => setOpen((v) => !v)} className="hover:text-gray-900">
                        {open
                            ? "Hide replies"
                            : `View replies${typeof comment.replies === "number" ? ` (${comment.replies})` : ""}`}
                    </button>

                    {canModify && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="ml-auto inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                            title="Edit"
                        >
                            <IoPencil /> Edit
                        </button>
                    )}
                    {canModify && (
                        <button
                            onClick={deleteMine}
                            className="inline-flex items-center gap-1 text-gray-500 hover:text-red-600"
                            title="Delete"
                        >
                            <IoTrashOutline size={16} /> Delete
                        </button>
                    )}
                </div>

                {/* Replies */}
                {open && (
                    <div className="pl-3 mt-2 border-l border-gray-200">
                        <ul className="space-y-3">
                            {list.map((r) => (
                                <ReplyRow
                                    key={r.id}
                                    reply={r}
                                    currentUser={currentUser}
                                />
                            ))}
                            {hasMore && (
                                <li>
                                    <button
                                        onClick={loadMore}
                                        className="py-1.5 text-xs text-gray-600 hover:text-gray-900"
                                    >
                                        Load more
                                    </button>
                                </li>
                            )}
                        </ul>
                    </div>
                )}
            </div>
        </li>
    );
}
function ReplyRow({
    reply,
    currentUser,
}: {
    reply: any;
    currentUser: UserLite;
}) {
    const canModify = currentUser?.uid === reply?.userId;
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(reply?.text ?? "");

    useEffect(() => {
        setEditText(reply?.text ?? "");
    }, [reply?.text]);

    const saveEdit = async () => {
        if (!canModify) return;
        const text = editText.trim().slice(0, 400);
        if (!text) return;
        try {
            await updateDoc(doc(db, "comments", reply.id), {
                text,
                edited: true,
                editedAt: serverTimestamp(),
            });
            setIsEditing(false);
        } catch (e) {
            console.warn("update reply error", e);
        }
    };

    const deleteMine = async () => {
        if (!canModify) return;
        try {
            await deleteDoc(doc(db, "comments", reply.id));
        } catch (e) {
            console.warn("delete reply error", e);
        }
    };

    return (
        <li className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full overflow-hidden bg-gray-200 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={reply.userPhotoURL || "/avatar-placeholder.png"}
                    alt="avatar"
                    className="h-7 w-7 object-cover"
                />
            </div>

            <div className="min-w-0 flex-1">
                {!!reply.userHandle && (
                    <div className="text-[11px] font-bold text-gray-600">{reply.userHandle}</div>
                )}

                {!isEditing ? (
                    <>
                        {!!reply.text && (
                            <div className="text-sm text-gray-900 whitespace-pre-wrap">
                                {reply.text}
                                {reply.edited && (
                                    <span className="ml-2 text-[10px] text-gray-500">(edited)</span>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="mt-1">
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:ring-2 focus:ring-gray-900"
                            maxLength={400}
                        />
                        <div className="mt-2 flex gap-2">
                            <button
                                onClick={saveEdit}
                                disabled={!editText.trim()}
                                className={`px-3 py-1.5 rounded-full text-white text-sm font-bold ${editText.trim()
                                    ? "bg-gray-900 hover:opacity-90"
                                    : "bg-gray-400 cursor-not-allowed"
                                    }`}
                            >
                                Save
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditText(reply?.text ?? "");
                                }}
                                className="px-3 py-1.5 rounded-full text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {canModify && !isEditing && (
                    <div className="mt-2 flex items-center gap-3 text-xs">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Edit reply"
                        >
                            <IoPencil /> Edit
                        </button>
                        <button
                            onClick={deleteMine}
                            className="inline-flex items-center gap-1 text-gray-500 hover:text-red-600"
                            title="Delete reply"
                        >
                            <IoTrashOutline size={14} /> Delete
                        </button>
                    </div>
                )}
            </div>
        </li>
    );
}
