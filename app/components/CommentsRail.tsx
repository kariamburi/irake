"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    addDoc,
    startAfter,
    getDocs,
    serverTimestamp,
    doc,
    deleteDoc,
    getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { IoClose, IoSwapVertical, IoTrashOutline, IoHappyOutline, IoImageOutline } from "react-icons/io5";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

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
            const allowA = d?.allowComments !== false;
            const allowB = d?.commentsEnabled !== false;
            setEnabled(allowA && allowB);
        });
        return () => unsub();
    }, [deedId, open]);
    return { count, enabled };
}

function useComments(deedId?: string, open?: boolean, sort: SortMode = "newest") {
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

export default function CommentsRail({
    deedId,
    open,
    onClose,
    currentUser,
}: {
    deedId?: string;
    open: boolean;
    onClose: () => void;
    currentUser: UserLite;
}) {
    const { count, enabled } = useDeedCommentsMeta(deedId, open);
    const [sort, setSort] = useState<SortMode>("newest");
    const { items, loadMore, paging } = useComments(deedId, open, sort);

    const [text, setText] = useState("");
    const [replyTo, setReplyTo] = useState<{ id: string; handle?: string | null } | null>(null);
    const isGuest = !currentUser?.uid;
    const canSend = !!deedId && !!currentUser?.uid && enabled && text.trim().length > 0;

    useEffect(() => {
        // reset state when closing or switching deed
        if (!open) {
            setText("");
            setReplyTo(null);
            setSort("newest");
        }
    }, [open, deedId]);

    const send = useCallback(async () => {
        if (!canSend || !deedId || !currentUser?.uid) return;
        const body = text.trim().slice(0, 400);
        await addDoc(collection(db, "comments"), {
            deedId,
            userId: currentUser.uid,
            userPhotoURL: currentUser.photoURL ?? null,
            userHandle: currentUser.handle ?? null,
            text: body,
            imageUrl: null, // 🔧 add upload later if you want
            parentId: replyTo?.id ?? null,
            createdAt: serverTimestamp(),
        });
        setText("");
        setReplyTo(null);
    }, [canSend, deedId, currentUser?.uid, currentUser?.photoURL, currentUser?.handle, text, replyTo]);

    const requestDelete = useCallback(async (comment: any) => {
        if (!currentUser?.uid || comment?.userId !== currentUser.uid) return;
        try {
            await deleteDoc(doc(db, "comments", comment.id));
        } catch (e) {
            console.warn("delete comment error", e);
        }
    }, [currentUser?.uid]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* dim background */}
                    <motion.div
                        className="fixed  inset-0 bg-black/30 z-[60]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    {/* right rail */}
                    <motion.aside
                        className="fixed right-0 top-0 bottom-0 z-[70] w-[380px] md:w-[420px] bg-white border-l border-gray-200 flex flex-col"
                        initial={{ x: 460 }}
                        animate={{ x: 0 }}
                        exit={{ x: 460 }}
                        transition={{ type: "tween", duration: 0.2 }}
                    >
                        {/* header */}
                        <div className="h-12 flex items-center justify-between px-3 border-b border-gray-200">
                            <button
                                onClick={() => setSort((s) => (s === "newest" ? "oldest" : "newest"))}
                                className="p-2 rounded-full hover:bg-gray-100"
                                aria-label="Toggle sort"
                                title="Toggle sort"
                            >
                                <IoSwapVertical size={20} />
                            </button>
                            <div className="text-sm font-extrabold text-gray-900">
                                {count > 0 ? `Comments · ${count}` : "Comments"}
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
                                <IoClose size={22} />
                            </button>
                        </div>

                        {/* body */}
                        <div className="flex-1 overflow-y-auto">
                            {!enabled ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
                                    <span className="text-4xl">🔒</span>
                                    <div className="font-semibold">Comments are turned off</div>
                                </div>
                            ) : items.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
                                    <span className="text-4xl">💬</span>
                                    <div className="font-extrabold text-gray-900">Start the conversation</div>
                                    <div>Be the first to leave a comment.</div>
                                </div>
                            ) : (
                                <ul className="px-3 py-2 space-y-3">
                                    {items.map((c) => (
                                        <li key={c.id} className="flex items-start gap-3">
                                            <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                                <Image
                                                    src={c.userPhotoURL || "/avatar-placeholder.png"}
                                                    alt="avatar"
                                                    width={32}
                                                    height={32}
                                                    className="h-8 w-8 object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                {!!c.userHandle && (
                                                    <div className="text-xs font-bold text-gray-600">@{c.userHandle}</div>
                                                )}
                                                {!!c.text && <div className="text-sm text-gray-900 whitespace-pre-wrap">{c.text}</div>}

                                                {/* meta: reply / view replies */}
                                                <CommentMetaRow
                                                    deedId={deedId!}
                                                    comment={c}
                                                    onReply={() => setReplyTo({ id: c.id, handle: c.userHandle ?? null })}
                                                    onDelete={() => requestDelete(c)}
                                                    canDelete={c.userId === currentUser?.uid}
                                                />
                                            </div>
                                        </li>
                                    ))}

                                    {/* load more */}
                                    <li>
                                        {paging ? (
                                            <div className="py-3 text-center text-sm text-gray-500">Loading…</div>
                                        ) : (
                                            <button
                                                onClick={loadMore}
                                                className="w-full py-2 text-sm text-gray-600 hover:text-gray-900"
                                            >
                                                Load more
                                            </button>
                                        )}
                                    </li>
                                </ul>
                            )}
                        </div>

                        {/* guest chip */}
                        {enabled && isGuest && (
                            <div className="px-3 py-2">
                                <div className="text-center text-xs font-bold text-gray-600 bg-gray-100 rounded-full py-2">
                                    Sign in to join the conversation
                                </div>
                            </div>
                        )}

                        {/* composer */}
                        <div className="border-t border-gray-200 p-3">
                            {replyTo && (
                                <div className="mb-2 flex items-center justify-between rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-600">
                                    <span>
                                        Replying to {replyTo.handle ? `${replyTo.handle}` : "comment"}
                                    </span>
                                    <button
                                        onClick={() => setReplyTo(null)}
                                        className="p-1 rounded hover:bg-gray-200"
                                        aria-label="Cancel reply"
                                    >
                                        <IoClose size={14} />
                                    </button>
                                </div>
                            )}

                            <div className="flex items-end gap-2">
                                <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                    <Image
                                        src={currentUser?.photoURL || "/avatar-placeholder.png"}
                                        alt="me"
                                        width={32}
                                        height={32}
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
                                    {/* Optional emoji / image icons (wired later) */}
                                    <button className="p-1 rounded hover:bg-gray-200" aria-label="Emoji">
                                        <IoHappyOutline size={18} className="text-gray-500" />
                                    </button>
                                    <button className="p-1 rounded hover:bg-gray-200" aria-label="Add image">
                                        <IoImageOutline size={18} className="text-gray-500" />
                                    </button>
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
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}

function CommentMetaRow({
    deedId,
    comment,
    onReply,
    onDelete,
    canDelete,
}: {
    deedId: string;
    comment: any;
    onReply: () => void;
    onDelete: () => void;
    canDelete: boolean;
}) {
    const [open, setOpen] = useState(false);
    const { list, loadMore, hasMore } = useReplies(deedId, comment.id, open);

    return (
        <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center gap-4 text-xs text-gray-600">
                <button onClick={onReply} className="font-semibold hover:text-gray-900">Reply</button>
                <button onClick={() => setOpen((v) => !v)} className="hover:text-gray-900">
                    {open ? "Hide replies" : `View replies${typeof comment.replies === "number" ? ` (${comment.replies})` : ""}`}
                </button>
                {canDelete ? (
                    <button onClick={onDelete} className="ml-auto inline-flex items-center gap-1 text-gray-500 hover:text-red-600">
                        <IoTrashOutline size={16} />
                        Delete
                    </button>
                ) : null}
            </div>

            {open && (
                <div className="pl-3 border-l border-gray-200">
                    <ul className="space-y-3">
                        {list.map((r) => (
                            <li key={r.id} className="flex items-start gap-3">
                                <div className="h-7 w-7 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={r.userPhotoURL || "/avatar-placeholder.png"}
                                        alt="avatar"
                                        className="h-7 w-7 object-cover"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    {!!r.userHandle && (
                                        <div className="text-[11px] font-bold text-gray-600">@{r.userHandle}</div>
                                    )}
                                    {!!r.text && <div className="text-sm text-gray-900 whitespace-pre-wrap">{r.text}</div>}
                                </div>
                            </li>
                        ))}
                        {hasMore ? (
                            <li>
                                <button onClick={loadMore} className="py-1.5 text-xs text-gray-600 hover:text-gray-900">
                                    Load more
                                </button>
                            </li>
                        ) : null}
                    </ul>
                </div>
            )}
        </div>
    );
}
