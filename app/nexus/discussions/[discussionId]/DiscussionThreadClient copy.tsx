"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    startAfter,
    updateDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, type User } from "firebase/auth";

import { db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import OpenInAppBanner from "@/app/components/OpenInAppBanner";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

import DiscussionHeader from "./DiscussionHeader";
import DiscussionComposer from "./DiscussionComposer";
import DiscussionTopicCard from "./DiscussionTopicCard";
import DiscussionReplyItem from "./DiscussionReplyItem";

import type {
    DiscussionItem,
    Reply,
    ReplyTarget,
    UserCacheMap,
} from "./discussion-thread.types";
import { EKARI, PAGE_SIZE, THREAD_MAX_WIDTH, cn } from "./discussion-thread.utils";

type Props = {
    discussionId: string;
    initialDiscussion: DiscussionItem;
};

type DocCursor = any | null;

export default function DiscussionThreadClient({
    discussionId,
    initialDiscussion,
}: Props) {
    const router = useRouter();

    const [discussion] = useState<DiscussionItem | null>(initialDiscussion ?? null);

    const [uid, setUid] = useState<string | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [replies, setReplies] = useState<Reply[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [cursor, setCursor] = useState<DocCursor>(null);

    const [text, setText] = useState("");
    const [posting, setPosting] = useState(false);

    const [replyTarget, setReplyTarget] = useState<ReplyTarget>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const [savingId, setSavingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const [userCache, setUserCache] = useState<UserCacheMap>({});

    const [isDesktop, setIsDesktop] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onResize = () => {
            if (typeof window === "undefined") return;
            setIsDesktop(window.innerWidth >= 1024);
            setIsMobile(window.innerWidth < 1024);
        };

        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        const auth = getAuth();
        const unsub = onAuthStateChanged(auth, (user: User | null) => {
            setUid(user?.uid ?? null);
            setAuthReady(true);
        });

        return () => unsub();
    }, []);

    const hydrateUsers = useCallback(async (items: Reply[]) => {
        const missingAuthorIds = Array.from(
            new Set(
                items
                    .map((x) => x.authorId)
                    .filter(Boolean)
                    .filter((authorId) => !userCache[authorId])
            )
        );

        if (!missingAuthorIds.length) return;

        const entries = await Promise.all(
            missingAuthorIds.map(async (authorId) => {
                try {
                    const snap = await getDoc(doc(db, "users", authorId));
                    if (!snap.exists()) {
                        return [
                            authorId,
                            { name: "User", handle: null, photoURL: null },
                        ] as const;
                    }

                    const data = snap.data() as any;

                    return [
                        authorId,
                        {
                            name:
                                String(
                                    data?.name ||
                                    data?.username ||
                                    `${data?.firstName || ""} ${data?.lastName || ""}`
                                )
                                    .replace(/\s+/g, " ")
                                    .trim() || "User",
                            handle: String(
                                data?.handle || data?.username || data?.userName || ""
                            ).trim() || null,
                            photoURL:
                                String(data?.photoURL || data?.photo || data?.imageUrl || "").trim() ||
                                null,
                        },
                    ] as const;
                } catch {
                    return [
                        authorId,
                        { name: "User", handle: null, photoURL: null },
                    ] as const;
                }
            })
        );

        setUserCache((prev) => {
            const next = { ...prev };
            for (const [authorId, value] of entries) next[authorId] = value;
            return next;
        });
    }, [userCache]);

    const normalizeReply = useCallback((id: string, data: any): Reply => {
        return {
            id,
            body: String(data?.body || "").trim(),
            authorId: String(data?.authorId || "").trim(),
            createdAt: data?.createdAt ?? null,
            updatedAt: data?.updatedAt ?? null,
            parentId: data?.parentId ?? null,
            replyToId: data?.replyToId ?? null,
            replyToHandle: data?.replyToHandle ?? null,
            userName: data?.userName ?? null,
            userHandle: data?.userHandle ?? null,
            userPhotoURL: data?.userPhotoURL ?? null,
        };
    }, []);

    const fetchInitialReplies = useCallback(async () => {
        setLoading(true);
        try {
            const qy = query(
                collection(db, "discussions", discussionId, "replies"),
                orderBy("createdAt", "asc"),
                limit(PAGE_SIZE)
            );

            const snap = await getDocs(qy);
            const items = snap.docs.map((d) => normalizeReply(d.id, d.data()));

            setReplies(items);
            setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
            setHasMore(snap.docs.length >= PAGE_SIZE);

            await hydrateUsers(items);
        } catch (error) {
            console.error("Failed to load replies:", error);
            setReplies([]);
            setHasMore(false);
            setCursor(null);
        } finally {
            setLoading(false);
        }
    }, [discussionId, hydrateUsers, normalizeReply]);

    const fetchMoreReplies = useCallback(async () => {
        if (!hasMore || loadingMore || !cursor) return;

        setLoadingMore(true);
        try {
            const qy = query(
                collection(db, "discussions", discussionId, "replies"),
                orderBy("createdAt", "asc"),
                startAfter(cursor),
                limit(PAGE_SIZE)
            );

            const snap = await getDocs(qy);
            const items = snap.docs.map((d) => normalizeReply(d.id, d.data()));

            setReplies((prev) => {
                const seen = new Set(prev.map((x) => x.id));
                const merged = [...prev];
                for (const item of items) {
                    if (!seen.has(item.id)) merged.push(item);
                }
                return merged;
            });

            setCursor(snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor);
            setHasMore(snap.docs.length >= PAGE_SIZE);

            await hydrateUsers(items);
        } catch (error) {
            console.error("Failed to fetch more replies:", error);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, discussionId, hasMore, hydrateUsers, loadingMore, normalizeReply]);

    useEffect(() => {
        fetchInitialReplies();
    }, [fetchInitialReplies]);

    useEffect(() => {
        const qy = query(
            collection(db, "discussions", discussionId, "replies"),
            orderBy("createdAt", "asc"),
            limit(PAGE_SIZE)
        );

        const unsub = onSnapshot(
            qy,
            async (snap) => {
                const liveItems = snap.docs.map((d) => normalizeReply(d.id, d.data()));
                setReplies((prev) => {
                    const prevMap = new Map(prev.map((x) => [x.id, x]));
                    for (const item of liveItems) prevMap.set(item.id, item);

                    return Array.from(prevMap.values()).sort((a, b) => {
                        const aMs =
                            typeof a?.createdAt?.toDate === "function"
                                ? a.createdAt.toDate().getTime()
                                : 0;
                        const bMs =
                            typeof b?.createdAt?.toDate === "function"
                                ? b.createdAt.toDate().getTime()
                                : 0;
                        return aMs - bMs;
                    });
                });

                await hydrateUsers(liveItems);
            },
            (error) => {
                console.error("Realtime replies listener failed:", error);
            }
        );

        return () => unsub();
    }, [discussionId, hydrateUsers, normalizeReply]);

    useEffect(() => {
        if (!sentinelRef.current || !hasMore) return;

        const node = sentinelRef.current;
        const observer = new IntersectionObserver(
            (entries) => {
                const first = entries[0];
                if (first?.isIntersecting) fetchMoreReplies();
            },
            { rootMargin: "600px 0px 600px 0px" }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [fetchMoreReplies, hasMore]);

    const topReplies = useMemo(
        () => replies.filter((r) => !r.parentId),
        [replies]
    );

    const childMap = useMemo(() => {
        const map = new Map<string, Reply[]>();

        for (const reply of replies) {
            if (!reply.parentId) continue;
            const arr = map.get(reply.parentId) || [];
            arr.push(reply);
            map.set(reply.parentId, arr);
        }

        for (const [, arr] of map) {
            arr.sort((a, b) => {
                const aMs =
                    typeof a?.createdAt?.toDate === "function"
                        ? a.createdAt.toDate().getTime()
                        : 0;
                const bMs =
                    typeof b?.createdAt?.toDate === "function"
                        ? b.createdAt.toDate().getTime()
                        : 0;
                return aMs - bMs;
            });
        }

        return map;
    }, [replies]);

    const startReplyToTop = useCallback((parent: Reply) => {
        setReplyTarget({
            parentId: parent.id,
            replyToId: parent.id,
            replyToHandle:
                parent.userHandle ||
                userCache[parent.authorId]?.handle ||
                parent.userName ||
                null,
        });
        setEditingId(null);
        setEditingText("");
    }, [userCache]);

    const startReplyToChild = useCallback((parent: Reply, child: Reply) => {
        setReplyTarget({
            parentId: parent.id,
            replyToId: child.id,
            replyToHandle:
                child.userHandle ||
                userCache[child.authorId]?.handle ||
                child.userName ||
                null,
        });
        setEditingId(null);
        setEditingText("");
    }, [userCache]);

    const startEdit = useCallback((reply: Reply) => {
        setReplyTarget(null);
        setEditingId(reply.id);
        setEditingText(reply.body || "");
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditingText("");
    }, []);

    const handleSubmit = useCallback(async () => {
        const body = text.trim();
        if (!body || posting || !uid) return;

        setPosting(true);
        try {
            const profile = userCache[uid] || {};

            await addDoc(collection(db, "discussions", discussionId, "replies"), {
                body,
                authorId: uid,
                parentId: replyTarget?.parentId ?? null,
                replyToId: replyTarget?.replyToId ?? null,
                replyToHandle: replyTarget?.replyToHandle ?? null,
                userName: profile.name ?? null,
                userHandle: profile.handle ?? null,
                userPhotoURL: profile.photoURL ?? null,
                createdAt: serverTimestamp(),
                updatedAt: null,
            });

            setText("");
            setReplyTarget(null);
        } catch (error) {
            console.error("Failed to post reply:", error);
        } finally {
            setPosting(false);
        }
    }, [discussionId, posting, replyTarget, text, uid, userCache]);

    const saveEdit = useCallback(async () => {
        const body = editingText.trim();
        if (!editingId || !body) return;

        setSavingId(editingId);
        try {
            await updateDoc(doc(db, "discussions", discussionId, "replies", editingId), {
                body,
                updatedAt: serverTimestamp(),
            });
            setEditingId(null);
            setEditingText("");
        } catch (error) {
            console.error("Failed to save edit:", error);
        } finally {
            setSavingId(null);
        }
    }, [discussionId, editingId, editingText]);

    const requestDelete = useCallback(async (reply: Reply) => {
        if (!reply?.id) return;

        const ok = window.confirm("Delete this answer?");
        if (!ok) return;

        setDeletingId(reply.id);
        try {
            const nested = replies.filter((x) => x.parentId === reply.id);
            for (const item of nested) {
                await deleteDoc(doc(db, "discussions", discussionId, "replies", item.id));
            }

            await deleteDoc(doc(db, "discussions", discussionId, "replies", reply.id));

            if (editingId === reply.id) {
                setEditingId(null);
                setEditingText("");
            }

            if (replyTarget?.replyToId === reply.id || replyTarget?.parentId === reply.id) {
                setReplyTarget(null);
            }
        } catch (error) {
            console.error("Failed to delete reply:", error);
        } finally {
            setDeletingId(null);
        }
    }, [discussionId, editingId, replies, replyTarget]);

    const handleBack = useCallback(() => {
        if (window.history.length > 1) {
            router.back();
            return;
        }
        router.push("/nexus");
    }, [router]);

    const handleShare = useCallback(async () => {
        try {
            const url =
                typeof window !== "undefined" ? window.location.href : "";
            if (!url) return;

            if (navigator.share) {
                await navigator.share({
                    title: discussion?.title || "Discussion",
                    text: discussion?.title || "Join this discussion",
                    url,
                });
                return;
            }

            await navigator.clipboard.writeText(url);
        } catch (error) {
            console.error("Share failed:", error);
        }
    }, [discussion]);

    const composerBottomSpace = isDesktop ? "pb-[124px]" : "pb-[118px]";

    const threadCountLabel = useMemo(() => {
        const count = replies.length;
        if (!count) return "No answers yet";
        if (count === 1) return "1 answer";
        return `${count} answers`;
    }, [replies.length]);

    const content = (
        <div className="min-h-screen bg-[#F8FAFC]">
            <DiscussionHeader
                title={discussion?.title}
                onBack={handleBack}
                onShare={handleShare}
                isMobile={isMobile}
            />

            <OpenInAppBanner />

            <main className={cn("mx-auto w-full", THREAD_MAX_WIDTH, composerBottomSpace)}>
                <DiscussionTopicCard discussion={discussion} />

                <div className="px-3 pt-4 sm:px-4">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-[13px] font-semibold tracking-[-0.01em] text-gray-500">
                            {threadCountLabel}
                        </div>

                        {!authReady ? (
                            <div className="text-[12px] font-medium text-gray-400">Checking account…</div>
                        ) : uid ? (
                            <div
                                className="rounded-full px-3 py-1 text-[12px] font-semibold"
                                style={{
                                    color: EKARI.forest,
                                    backgroundColor: "rgba(35, 63, 57, 0.08)",
                                }}
                            >
                                Joined discussion
                            </div>
                        ) : (
                            <div className="text-[12px] font-medium text-gray-400">
                                Sign in to answer
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex min-h-[260px] items-center justify-center">
                            <BouncingBallLoader />
                        </div>
                    ) : topReplies.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-black/10 bg-white px-5 py-12 text-center shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
                            <div className="mx-auto max-w-[420px]">
                                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-[#111827]">
                                    Be the first to answer
                                </h3>
                                <p className="mt-2 text-[14px] leading-6 text-gray-500">
                                    Keep it helpful, clear, and practical so the discussion flows well.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {topReplies.map((parent) => (
                                <DiscussionReplyItem
                                    key={parent.id}
                                    parent={parent}
                                    childrenReplies={childMap.get(parent.id) || []}
                                    uid={uid}
                                    userCache={userCache}
                                    editingId={editingId}
                                    editingText={editingText}
                                    savingId={savingId}
                                    deletingId={deletingId}
                                    setEditingText={setEditingText}
                                    startReplyToTop={startReplyToTop}
                                    startReplyToChild={startReplyToChild}
                                    startEdit={startEdit}
                                    cancelEdit={cancelEdit}
                                    saveEdit={saveEdit}
                                    requestDelete={requestDelete}
                                />
                            ))}

                            <div ref={sentinelRef} className="h-10 w-full" />

                            {loadingMore ? (
                                <div className="py-3 text-center text-[13px] font-medium text-gray-400">
                                    Loading more…
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
            </main>

            <DiscussionComposer
                isDesktop={isDesktop}
                text={text}
                setText={setText}
                posting={posting}
                replyTarget={replyTarget}
                setReplyTarget={setReplyTarget}
                onSubmit={handleSubmit}
            />
        </div>
    );

    return isDesktop ? <AppShell>{content}</AppShell> : content;
}