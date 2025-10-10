// app/(lib)/fire-queries.ts
"use client";

import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------- Types ---------------- */
export type DeedStats = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  completions?: number;
  watchMs?: number; // tolerate stats.watchMs or root watchMs
};

export type DeedMedia = {
  muxPlaybackId?: string;
  muxUploadId?: string;
  thumbUrl?: string;
  durationSec?: number;
  coverMs?: number;
  width?: number;
  height?: number;
};

export type DeedDoc = {
  id: string;
  authorId: string;
  caption?: string;
  text?: string;
  allowComments?: boolean;
  tags?: string[];
  status?: "processing" | "ready" | string;
  visibility?: "public" | "followers" | "private";
  mediaType?: "video" | "photo" | "none";

  media?: DeedMedia[];
  mediaThumbUrl?: string;
  type?: string;
  muxUploadId?: string;
  muxPlaybackId?: string;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdAtMs?: number;

  geo?: { lat?: number; lng?: number };

  stats?: DeedStats;
};

/* --------------- Resolve UID by handle ---------------- */
export async function resolveUidByHandle(handle: string): Promise<{ uid: string; data: any } | null> {
  // normalize: remove leading "@"
  const clean = handle.startsWith("@") ? handle : "@"+handle;

  const q = query(collection(db, "users"), where("handle", "==", clean), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, data: d.data() as any };
}

/* ---------------- Normalizer ---------------- */
export const toDeed = (d: DocumentData, id: string): DeedDoc => {
  const createdAtMs =
    typeof d.createdAtMs === "number"
      ? d.createdAtMs
      : d.createdAt instanceof Timestamp
      ? d.createdAt.toMillis()
      : undefined;

  const m0: DeedMedia | undefined = Array.isArray(d.media) ? d.media[0] : undefined;

  const rawType = String(d.mediaType ?? d.type ?? "").toLowerCase();
  const mediaType: DeedDoc["mediaType"] =
    rawType === "video" ? "video" : rawType === "photo" ? "photo" : "none";

  const muxPlaybackId = d.muxPlaybackId ?? m0?.muxPlaybackId;
  const mediaThumbUrl = d.mediaThumbUrl ?? m0?.thumbUrl;

  return {
    id,
    authorId: d.authorId,
    caption: d.caption ?? d.text ?? "",
    text: d.text ?? d.caption ?? "",
    allowComments: !!d.allowComments,
    tags: Array.isArray(d.tags) ? d.tags : [],
    status: d.status,
    visibility: (["public", "followers", "private"].includes(d.visibility)
      ? d.visibility
      : "public") as DeedDoc["visibility"],
    mediaType,
    media: Array.isArray(d.media) ? d.media : [],
    mediaThumbUrl,
    muxUploadId: d.muxUploadId ?? undefined,
    muxPlaybackId: muxPlaybackId ?? undefined,
    createdAt: d.createdAt instanceof Timestamp ? d.createdAt : undefined,
    updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt : undefined,
    createdAtMs,
    geo: d.geo && typeof d.geo === "object" ? { lat: d.geo.lat, lng: d.geo.lng } : undefined,
    stats: {
      views: Number(d?.stats?.views ?? 0),
      likes: Number(d?.stats?.likes ?? 0),
      comments: Number(d?.stats?.comments ?? 0),
      shares: Number(d?.stats?.shares ?? 0),
      saves: Number(d?.stats?.saves ?? 0),
      completions: Number(d?.stats?.completions ?? 0),
      watchMs: Number(d?.stats?.watchMs ?? d?.watchMs ?? 0),
    },
  };
};

/* --------- Helpers used by feed/profile/video player ---------- */
export function deedPoster(deed: DeedDoc): string {
  return deed.mediaThumbUrl || "/video-placeholder.jpg";
}

export function deedMuxPlaybackId(deed: DeedDoc): string | undefined {
  return deed.muxPlaybackId ?? deed.media?.[0]?.muxPlaybackId ?? undefined;
}

export function deedMediaUrl(deed: DeedDoc): string | null {
  const pb = deedMuxPlaybackId(deed);
  if (deed.mediaType === "video" && pb) return `https://stream.mux.com/${pb}.m3u8`;
  return null;
}

/* ---------------- Player-friendly mapper ---------------- */
export type PlayerItem = {
  id: string;
  authorId: string;
  authorUsername?: string;
  authorPhotoURL?: string;
  mediaUrl: string | null;
  posterUrl?: string;
  mediaType: "video" | "photo" | "none";
  text: string;
  createdAt: number;
  visibility: "public" | "followers" | "private";
  stats?: DeedStats;
};

export function toPlayerItem(d: any, id: string): PlayerItem {
  const createdAtMs =
    typeof d.createdAtMs === "number"
      ? d.createdAtMs
      : d.createdAt instanceof Timestamp
      ? d.createdAt.toMillis()
      : Date.now();

  const m0 = Array.isArray(d.media) ? d.media[0] : undefined;
  const kind = (d.type ?? m0?.kind ?? d.mediaType)?.toString().toLowerCase();
  const mediaType: PlayerItem["mediaType"] =
    kind === "video" ? "video" : kind === "image" || kind === "photo" ? "photo" : "none";

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

  const visibility: PlayerItem["visibility"] =
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

/* ---------------- Convenience fetch ---------------- */
export async function fetchUserSiblings(authorId: string, max = 100): Promise<PlayerItem[]> {
  const q = query(
    collection(db, "deeds"),
    where("authorId", "==", authorId),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const s = await getDocs(q);
  return s.docs.map((d) => toPlayerItem(d.data(), d.id));
}
