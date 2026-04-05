"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    increment,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type UserSnap = {
    userId: string;
    name?: string | null;
    handle?: string | null;
    photoURL?: string | null;
};

function cleanId(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function isValidFirestoreId(value: unknown): value is string {
    const id = cleanId(value);
    if (!id) return false;

    // placeholders / temp ids you never want to hit Firestore with
    const blocked = new Set(["__none__", "__pending__", "__loading__"]);
    if (blocked.has(id)) return false;

    return true;
}

async function getUserSnap(uid: string): Promise<UserSnap> {
    const cleanUid = cleanId(uid);
    if (!cleanUid) {
        return {
            userId: "",
            name: null,
            handle: null,
            photoURL: null,
        };
    }

    const us = await getDoc(doc(db, "users", cleanUid));
    const u = (us.data() as any) || {};

    return {
        userId: cleanUid,
        name: [u.firstName, u.surname].filter(Boolean).join(" ") || null,
        handle: u?.handle ?? null,
        photoURL: u?.photoURL ?? null,
    };
}

function getOrMakeDeviceId(): string {
    const k = "__ekari_device_id__";
    try {
        let v = localStorage.getItem(k);
        if (!v || v.length < 16) {
            v =
                crypto?.randomUUID?.() ??
                Math.random().toString(36).slice(2) + Date.now().toString(36);

            if (v.length < 16) v = v.padEnd(16, "x");
            localStorage.setItem(k, v);
        }
        return v;
    } catch {
        return "anon_device_" + Math.random().toString(36).slice(2).padEnd(16, "x");
    }
}

export function useLikesWeb(itemId: string, uid?: string | null) {
    const cleanItemId = cleanId(itemId);
    const cleanUid = cleanId(uid);
    const validItemId = isValidFirestoreId(cleanItemId);

    const likeId =
        validItemId && cleanUid ? `${cleanItemId}_${cleanUid}` : undefined;

    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!validItemId) {
            setLiked(false);
            setCount(0);
            return;
        }

        let unsubSelf = () => { };
        if (likeId) {
            unsubSelf = onSnapshot(
                doc(db, "likes", likeId),
                (s) => setLiked(s.exists()),
                () => setLiked(false)
            );
        } else {
            setLiked(false);
        }

        const unsubCount = onSnapshot(
            query(collection(db, "likes"), where("deedId", "==", cleanItemId)),
            (s) => setCount(s.size),
            () => setCount(0)
        );

        return () => {
            unsubSelf();
            unsubCount();
        };
    }, [cleanItemId, likeId, validItemId]);

    const toggle = useCallback(async () => {
        if (!cleanUid || !likeId || !validItemId) return;

        try {
            const ref = doc(db, "likes", likeId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                await deleteDoc(ref);
                return;
            }

            const userSnap = await getUserSnap(cleanUid);

            await setDoc(ref, {
                deedId: cleanItemId,
                userId: cleanUid,
                user: {
                    name: userSnap?.name ?? null,
                    handle: userSnap?.handle ?? null,
                    photoURL: userSnap?.photoURL ?? null,
                },
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            if (err instanceof FirebaseError) {
                console.error("Like toggle error:", err.code, err.message);
            } else {
                console.error("Like toggle unknown error:", err);
            }
        }
    }, [cleanItemId, cleanUid, likeId, validItemId]);

    return { liked, count, toggle };
}

export function useCommentsCountWeb(itemId: string) {
    const cleanItemId = cleanId(itemId);
    const validItemId = isValidFirestoreId(cleanItemId);
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!validItemId) {
            setCount(0);
            return;
        }

        const qC = query(
            collection(db, "comments"),
            where("deedId", "==", cleanItemId)
        );

        const unsub = onSnapshot(
            qC,
            (s) => setCount(s.size),
            () => setCount(0)
        );

        return () => unsub();
    }, [cleanItemId, validItemId]);

    return count;
}

export function useBookmarksWeb(itemId: string, uid?: string | null) {
    const cleanItemId = cleanId(itemId);
    const cleanUid = cleanId(uid);
    const validItemId = isValidFirestoreId(cleanItemId);

    const bookmarkId =
        validItemId && cleanUid ? `${cleanItemId}_${cleanUid}` : undefined;

    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!validItemId || !bookmarkId) {
            setSaved(false);
            return;
        }

        const unsub = onSnapshot(
            doc(db, "bookmarks", bookmarkId),
            (s) => setSaved(s.exists()),
            () => setSaved(false)
        );

        return () => unsub();
    }, [bookmarkId, validItemId]);

    const toggle = useCallback(async () => {
        if (!cleanUid || !bookmarkId || !validItemId) return;

        try {
            const ref = doc(db, "bookmarks", bookmarkId);
            const snap = await getDoc(ref);

            if (snap.exists()) {
                await deleteDoc(ref);
                return;
            }

            const userSnap = await getUserSnap(cleanUid);

            await setDoc(ref, {
                deedId: cleanItemId,
                userId: cleanUid,
                user: {
                    name: userSnap?.name ?? null,
                    handle: userSnap?.handle ?? null,
                    photoURL: userSnap?.photoURL ?? null,
                },
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            if (err instanceof FirebaseError) {
                console.error("Bookmark toggle error:", err.code, err.message);
            } else {
                console.error("Bookmark toggle unknown error:", err);
            }
        }
    }, [bookmarkId, cleanItemId, cleanUid, validItemId]);

    return { saved, toggle };
}

export function useBookmarkTotalFromDeedWeb(itemId: string) {
    const cleanItemId = cleanId(itemId);
    const validItemId = isValidFirestoreId(cleanItemId);
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!validItemId) {
            setCount(0);
            return;
        }

        const unsub = onSnapshot(
            doc(db, "deeds", cleanItemId),
            (s) => {
                const data = s.data() as any;
                const saves = Number(data?.stats?.saves ?? 0);
                setCount(Number.isFinite(saves) ? saves : 0);
            },
            () => setCount(0)
        );

        return () => unsub();
    }, [cleanItemId, validItemId]);

    return count;
}

export function useShareTotalFromDeedWeb(itemId: string) {
    const cleanItemId = cleanId(itemId);
    const validItemId = isValidFirestoreId(cleanItemId);
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!validItemId) {
            setCount(0);
            return;
        }

        const unsub = onSnapshot(
            doc(db, "deeds", cleanItemId),
            (s) => {
                const data = s.data() as any;
                const shares = Number(data?.stats?.shares ?? 0);
                setCount(Number.isFinite(shares) ? shares : 0);
            },
            () => setCount(0)
        );

        return () => unsub();
    }, [cleanItemId, validItemId]);

    return count;
}

export function useDeedEngagementWeb(itemId: string, uid?: string | null) {
    const cleanItemId = cleanId(itemId);
    const cleanUid = cleanId(uid);
    const validItemId = isValidFirestoreId(cleanItemId);

    const likes = useLikesWeb(cleanItemId, cleanUid);
    const commentsCount = useCommentsCountWeb(cleanItemId);
    const bookmarks = useBookmarksWeb(cleanItemId, cleanUid);
    const totalBookmarks = useBookmarkTotalFromDeedWeb(cleanItemId);
    const totalShares = useShareTotalFromDeedWeb(cleanItemId);

    const share = useCallback(
        async (opts?: { authorHandle?: string | null; caption?: string | null }) => {
            if (!validItemId) {
                return { ok: false, url: "" };
            }

            const handle = opts?.authorHandle?.trim();
            const url =
                typeof window !== "undefined"
                    ? handle
                        ? `${window.location.origin}/${handle.startsWith("@") ? handle : `@${handle}`}/deed/${cleanItemId}`
                        : `${window.location.origin}/deeds/${cleanItemId}`
                    : `/deeds/${cleanItemId}`;

            try {
                if (typeof navigator !== "undefined" && navigator.share) {
                    await navigator.share({
                        title: opts?.caption || "ekarihub",
                        text: opts?.caption || "",
                        url,
                    });
                } else if (typeof navigator !== "undefined" && navigator.clipboard) {
                    await navigator.clipboard.writeText(url);
                }

                const baseId = cleanUid || getOrMakeDeviceId();
                const shareId = `${cleanItemId}_${baseId}`;

                const shareRef = doc(db, "shares", shareId);
                const deedRef = doc(db, "deeds", cleanItemId);
                const existing = await getDoc(shareRef);

                if (!existing.exists()) {
                    const payload: Record<string, any> = {
                        deedId: cleanItemId,
                        createdAt: serverTimestamp(),
                        url,
                    };

                    if (cleanUid) {
                        const userSnap = await getUserSnap(cleanUid);
                        payload.userId = cleanUid;
                        payload.user = {
                            name: userSnap?.name ?? null,
                            handle: userSnap?.handle ?? null,
                            photoURL: userSnap?.photoURL ?? null,
                        };
                    } else {
                        payload.deviceId = baseId;
                    }

                    await setDoc(shareRef, payload);
                    await updateDoc(deedRef, {
                        "stats.shares": increment(1),
                    });
                }

                return { ok: true, url };
            } catch (error) {
                console.error("Share error:", error);
                return { ok: false, url };
            }
        },
        [cleanItemId, cleanUid, validItemId]
    );

    return useMemo(
        () => ({
            liked: likes.liked,
            likeCount: likes.count,
            toggleLike: likes.toggle,

            commentedCount: commentsCount,

            saved: bookmarks.saved,
            toggleSave: bookmarks.toggle,

            totalBookmarks,
            totalShares,
            share,

            isReady: validItemId,
        }),
        [
            likes.liked,
            likes.count,
            likes.toggle,
            commentsCount,
            bookmarks.saved,
            bookmarks.toggle,
            totalBookmarks,
            totalShares,
            share,
            validItemId,
        ]
    );
}