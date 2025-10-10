// app/(lib)/fire-queries.ts
"use client";

import {
    collection, doc, getDoc, getDocs, limit, orderBy, query,
    Timestamp, where, onSnapshot, deleteDoc, setDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Resolve a user's UID from their @handle. Returns { uid, profileDoc? } or null. */
export async function resolveUidByHandle(handle: string) {
    const q = query(collection(db, "users"), where("handle", "==", handle), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { uid: d.id, data: d.data() as any };
}

/** Map a raw deed to your Item/Deed shape */
export function toDeed(d: any, id: string) {
    const createdAtMs =
        typeof d?.createdAtMs === "number"
            ? d.createdAtMs
            : d?.createdAt instanceof Timestamp
                ? d.createdAt.toMillis()
                : undefined;

    return {
        id,
        authorId: d?.authorId,
        caption: d?.caption ?? d?.text ?? "",
        createdAt: d?.createdAt,
        createdAtMs,
        type: (d?.type ?? d?.mediaType) || "video",
        visibility: d?.visibility ?? "public",
        media: Array.isArray(d?.media) ? d.media : undefined,
        mediaThumbUrl: d?.mediaThumbUrl,
        stats: d?.stats,
    };
}

/** Map deed -> player item */
export function toPlayerItem(d: any, id: string) {
    const createdAtMs =
        typeof d.createdAtMs === "number"
            ? d.createdAtMs
            : d.createdAt instanceof Timestamp
                ? d.createdAt.toMillis()
                : Date.now();

    const m0 = Array.isArray(d.media) ? d.media[0] : undefined;
    const kind = (d.type ?? m0?.kind ?? d.mediaType)?.toString().toLowerCase();
    const mediaType = kind === "video" ? "video" : kind === "image" || kind === "photo" ? "photo" : "none";

    let mediaUrl: string | null = null;
    let posterUrl: string | undefined;
    if (mediaType === "video") {
        const muxPlaybackId = d.muxPlaybackId ?? m0?.muxPlaybackId;
        if (muxPlaybackId) {
            mediaUrl = `https://stream.mux.com/${muxPlaybackId}.m3u8`;
            posterUrl = d.posterUrl ?? m0?.thumbUrl ?? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg`;
        } else {
            mediaUrl = d.mediaUrl ?? m0?.url ?? null;
            posterUrl = d.posterUrl ?? m0?.thumbUrl;
        }
    } else if (mediaType === "photo") {
        mediaUrl = d.mediaUrl ?? m0?.url ?? null;
        posterUrl = d.mediaThumbUrl ?? m0?.thumbUrl ?? mediaUrl ?? undefined;
    }

    const visibility =
        d.visibility === "followers" || d.visibility === "private" ? d.visibility : "public";

    return {
        id,
        authorId: d.authorId,
        authorUsername: d.authorUsername,
        authorPhotoURL: d.authorPhotoURL,
        mediaUrl,
        posterUrl,
        mediaType,
        text: d.text ?? d.caption ?? "",
        createdAt: createdAtMs,
        visibility,
        stats: d.stats ?? {},
    };
}

export async function fetchUserSiblings(authorId: string, max = 100) {
    const q = query(
        collection(db, "deeds"),
        where("authorId", "==", authorId),
        orderBy("createdAt", "desc"),
        limit(max)
    );
    const s = await getDocs(q);
    return s.docs.map(d => toPlayerItem(d.data(), d.id));
}
