"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    doc, getDoc, collection, query, where, orderBy, limit, getDocs, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    IoClose, IoChevronUp, IoChevronDown, IoVolumeMute, IoVolumeHigh,
    IoBarChartOutline, IoHeartOutline, IoChatbubbleOutline, IoShareOutline
} from "react-icons/io5";

/* ---------------- Types / helpers ---------------- */
type Visibility = "public" | "followers" | "private";
type Item = {
    id: string;
    authorId: string;
    authorUsername?: string;
    authorPhotoURL?: string;
    mediaUrl?: string | null;
    posterUrl?: string;
    mediaType?: "video" | "photo" | "none";
    text?: string;
    createdAt?: number;
    visibility?: Visibility;
    stats?: { views?: number; likes?: number; comments?: number; shares?: number };
};

const toItem = (d: any, id: string): Item => {
    const createdAtMs =
        typeof d.createdAtMs === "number"
            ? d.createdAtMs
            : d.createdAt instanceof Timestamp
                ? d.createdAt.toMillis()
                : Date.now();

    // Figure out media
    const m0 = Array.isArray(d.media) ? d.media[0] : undefined;
    const kind = (d.type ?? m0?.kind ?? d.mediaType)?.toString().toLowerCase();
    const mediaType: Item["mediaType"] =
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

    const visibility: Visibility =
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
};

function nfmt(n?: number) {
    const v = n ?? 0;
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(v);
}

/* ---------------- Page ---------------- */
export default function DeedPreviewPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const deedId = params?.id;

    const [item, setItem] = useState<Item | null>(null);
    const [siblings, setSiblings] = useState<Item[]>([]);
    const [idx, setIdx] = useState<number>(-1);
    const [muted, setMuted] = useState(true);
    const [ready, setReady] = useState(false); // when media is ready to show rails

    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Load current deed
    useEffect(() => {
        let active = true;
        (async () => {
            if (!deedId) return;
            setReady(false);
            const snap = await getDoc(doc(db, "deeds", deedId));
            if (!active) return;

            if (snap.exists()) {
                const current = toItem(snap.data(), snap.id);
                setItem(current);

                // Load siblings by same author (newest first)
                try {
                    const q = query(
                        collection(db, "deeds"),
                        where("authorId", "==", current.authorId),
                        orderBy("createdAt", "desc"),
                        limit(100)
                    );
                    const sibSnap = await getDocs(q);
                    const arr = sibSnap.docs.map((d) => toItem(d.data(), d.id));
                    setSiblings(arr);
                    setIdx(arr.findIndex((x) => x.id === deedId));
                } catch {
                    setSiblings([current]);
                    setIdx(0);
                }
            } else {
                setItem(null);
            }
        })();

        return () => {
            active = false;
        };
    }, [deedId]);

    // HLS attach (only when we actually have a .m3u8)
    useEffect(() => {
        const el = videoRef.current;
        const src = item?.mediaUrl;
        if (!el || !src) return;

        const isHls = src.endsWith(".m3u8");
        let hls: any;

        const onReady = () => setReady(true);

        if (isHls && !el.canPlayType("application/vnd.apple.mpegURL")) {
            (async () => {
                try {
                    const mod = await import("hls.js");
                    const Hls = mod.default;
                    if (Hls?.isSupported()) {
                        hls = new Hls({ enableWorker: true });
                        hls.loadSource(src);
                        hls.attachMedia(el);
                        el.addEventListener("canplay", onReady, { once: true });
                    } else {
                        el.src = src;
                        el.addEventListener("canplay", onReady, { once: true });
                    }
                } catch {
                    el.src = src;
                    el.addEventListener("canplay", onReady, { once: true });
                }
            })();
        } else {
            el.src = src;
            el.addEventListener("canplay", onReady, { once: true });
        }

        return () => {
            el?.removeEventListener("canplay", onReady);
            hls?.destroy?.();
        };
    }, [item?.mediaUrl]);

    // keyboard nav
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); goNext(); }
            else if (e.key === "Escape") router.back();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [idx, siblings]);

    const prevId = useMemo(() => (idx > 0 ? siblings[idx - 1]?.id : undefined), [idx, siblings]);
    const nextId = useMemo(() => (idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1]?.id : undefined), [idx, siblings]);

    const goPrev = () => { if (prevId) router.push(`/deeds/${prevId}`); };
    const goNext = () => { if (nextId) router.push(`/deeds/${nextId}`); };

    if (!item) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black text-white/80">
                Deed not found
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black text-white">
            {/* Close */}
            <button
                onClick={() => router.back()}
                aria-label="Close"
                className="absolute left-3 top-3 z-40 rounded-full bg-white/10 p-2 hover:bg-white/20"
            >
                <IoClose size={22} />
            </button>

            {/* Analytics FAB */}
            <Link
                href={`/studio/analytics/${item.id}`}
                className="fixed right-4 bottom-4 z-40 inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 font-bold shadow-lg hover:bg-white/90"
                title="View analytics"
            >
                <IoBarChartOutline size={18} />
                Analytics
            </Link>

            {/* Up/Down nav */}
            <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
                <button
                    onClick={goPrev}
                    disabled={!prevId}
                    className="rounded-full bg-white/10 p-2 hover:bg-white/20 disabled:opacity-30"
                    aria-label="Previous"
                >
                    <IoChevronUp size={20} />
                </button>
                <button
                    onClick={goNext}
                    disabled={!nextId}
                    className="rounded-full bg-white/10 p-2 hover:bg-white/20 disabled:opacity-30"
                    aria-label="Next"
                >
                    <IoChevronDown size={20} />
                </button>
            </div>

            {/* Layout: video center, meta right (optional) */}
            <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
                {/* Media column */}
                <div className="relative flex items-center justify-center">
                    {/* Maintain fit: portrait or landscape */}
                    <div
                        className="
              relative
              max-h-[100svh]
              max-w-[min(92vw,800px)]
              w-[min(92vw,800px)]
              h-[min(100svh,92vh)]
              flex items-center justify-center
            "
                    >
                        {/* video or photo */}
                        {item.mediaType === "video" && item.mediaUrl ? (
                            <video
                                ref={videoRef}
                                poster={item.posterUrl}
                                playsInline
                                autoPlay
                                loop
                                muted={muted}
                                controlsList="nodownload noremoteplayback"
                                className="block h-full w-full object-contain bg-black"
                            />
                        ) : item.mediaType === "photo" && item.mediaUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={item.mediaUrl}
                                alt={item.text || "photo"}
                                className="block h-full w-full object-contain bg-black"
                                onLoad={() => setReady(true)}
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-white/70">No media</div>
                        )}

                        {/* mute toggle */}
                        <button
                            onClick={() => setMuted((m) => !m)}
                            className="absolute left-3 top-3 rounded-full bg-black/60 p-2 hover:bg-black/80"
                            aria-label={muted ? "Unmute" : "Mute"}
                        >
                            {muted ? <IoVolumeMute /> : <IoVolumeHigh />}
                        </button>

                        {/* Right action rail – hide until media ready to avoid flicker/shift */}
                        {ready && (
                            <div className="absolute right-3 bottom-3 flex flex-col items-center gap-4">
                                <button className="rounded-full bg-white/10 p-3 hover:bg-white/20" title="Like">
                                    <IoHeartOutline />
                                </button>
                                <button className="rounded-full bg-white/10 p-3 hover:bg-white/20" title="Comments">
                                    <IoChatbubbleOutline />
                                </button>
                                <button className="rounded-full bg-white/10 p-3 hover:bg-white/20" title="Share">
                                    <IoShareOutline />
                                </button>
                            </div>
                        )}

                        {/* Bottom gradient + author/caption */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                            <div className="max-w-[90%]">
                                {item.authorUsername && (
                                    <div className="mb-1 font-extrabold">@{item.authorUsername}</div>
                                )}
                                {!!item.text && (
                                    <p className="text-sm leading-5 text-white/95 line-clamp-3">{item.text}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* (optional) Right meta / comments placeholder */}
                <aside className="hidden lg:block border-l border-white/10 p-4 overflow-y-auto">
                    <div className="mb-4 text-xs text-white/60">
                        Posted {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span>Views: <b>{nfmt(item.stats?.views)}</b></span>
                        <span>Likes: <b>{nfmt(item.stats?.likes)}</b></span>
                        <span>Comments: <b>{nfmt(item.stats?.comments)}</b></span>
                        <span>Shares: <b>{nfmt(item.stats?.shares)}</b></span>
                    </div>

                    <div className="mt-6 text-white/80">
                        {/* You can pipe a real comments component here later */}
                        <div className="text-sm opacity-70">Comments coming soon…</div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
