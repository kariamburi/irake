"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    IoClose, IoChevronUp, IoChevronDown, IoVolumeMute, IoVolumeHigh,
    IoBarChartOutline, IoHeartOutline, IoChatbubbleOutline, IoShareOutline,
    IoHeart,
    IoBookmark,
    IoBookmarkOutline,
    IoArrowBack,
    IoArrowForward,
    IoArrowUp
} from "react-icons/io5";
import { fetchUserSiblings, resolveUidByHandle, toPlayerItem } from "@/lib/fire-queries";
import RightRail from "@/app/components/RightRail";
import { useAuth } from "@/app/hooks/useAuth";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

type Item = ReturnType<typeof toPlayerItem>;

function nfmt(n?: number) {
    const v = n ?? 0;
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(v);
}

export default function PlayerByHandlePage() {
    const router = useRouter();
    const params = useParams<{ handle: string; videoId: string }>();
    const raw = params?.handle ?? "";
    const decoded = (() => { try { return decodeURIComponent(raw); } catch { return raw; } })();
    const handleWithAt = decoded.startsWith("@") ? decoded : `@${decoded}`;
    const deedId = params.videoId;

    const [item, setItem] = useState<Item | null>(null);
    const [siblings, setSiblings] = useState<Item[]>([]);
    const [idx, setIdx] = useState<number>(-1);
    const [muted, setMuted] = useState(true);
    const [ready, setReady] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const { user } = useAuth();
    const isOwner = !!user?.uid && !!item && item.authorId === user.uid;
    const uid = user?.uid;
    const { liked, toggle: toggleLike } = useLiked(item?.id, uid);
    const { saved, toggle: toggleSave } = useSaved(item?.id, uid);
    const { following, toggle: toggleFollow } = useFollowAuthor(item?.authorId, uid);
    const EKARI = { primary: "#C79257" };
    const requireAuth = (fn: () => void) => {
        if (!uid) { router.push(`/getstarted?next=${encodeURIComponent(location.pathname)}`); return; }
        fn();
    };

    const onShare = async () => {
        if (!item) return;
        const url = `${location.origin}/${encodeURIComponent(item.authorUsername || "")}/video/${item.id}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: item.text || "EkariHub", text: item.text || "", url });
            } else {
                await navigator.clipboard.writeText(url);
                alert("Link copied!");
            }
            const baseId = uid ?? getOrMakeDeviceId();
            const sid = `${item.id}_${baseId}_${Date.now()}`;
            const payload: any = { deedId: item.id, createdAt: serverTimestamp() };
            if (uid) payload.userId = uid; else payload.deviceId = baseId;
            await setDoc(doc(db, "shares", sid), payload);
        } catch { /* no-op */ }
    };


    // Load current deed + siblings for THIS handle only
    useEffect(() => {
        let active = true;
        (async () => {
            if (!handleWithAt || !deedId) return;

            const snap = await getDoc(doc(db, "deeds", deedId));
            if (!active) return;
            if (!snap.exists()) { setItem(null); setSiblings([]); setIdx(-1); return; }
            const current = toPlayerItem(snap.data(), snap.id);
            setItem(current);

            // verify deed belongs to route handle; else redirect to author’s canonical handle
            const routeRes = await resolveUidByHandle(handleWithAt);
            const routeUid = routeRes?.uid;
            if (routeUid && current.authorId !== routeUid) {
                let authorHandle = handleWithAt;
                try {
                    const u = await getDoc(doc(db, "users", current.authorId));
                    const h = (u.data() as any)?.handle as string | undefined;
                    if (h && h.length) authorHandle = h.startsWith("@") ? h : `@${h}`;
                } catch { }
                router.replace(`/${authorHandle}/video/${deedId}`);
                return;
            }

            try {
                const arr = await fetchUserSiblings(current.authorId, 100);
                setSiblings(arr);
                setIdx(arr.findIndex((x: any) => x.id === deedId));
            } catch {
                setSiblings([current]);
                setIdx(0);
            }
        })();
        return () => { active = false; };
    }, [handleWithAt, deedId, router]);

    // HLS attach
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
    const prevId = useMemo(() => (idx > 0 ? siblings[idx - 1]?.id : undefined), [idx, siblings]);
    const nextId = useMemo(() => (idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1]?.id : undefined), [idx, siblings]);

    const goPrev = () => { if (prevId) router.push(`/${encodeURIComponent(handleWithAt)}/video/${prevId}`); };
    const goNext = () => { if (nextId) router.push(`/${encodeURIComponent(handleWithAt)}/video/${nextId}`); };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); goNext(); }
            else if (e.key === "Escape") router.back();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [prevId, nextId]); // depend on computed ids

    if (!item) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black text-white/80">
                <BouncingBallLoader />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black text-white">
            {/* Close (kept fixed) */}
            {/* Top-left controls: Close + Back to EkariHub */}
            <div className="absolute mb-2 left-3 top-3 z-40 flex items-center gap-2">
                <Link
                    href="/"
                    className="rounded-full flex justify-center items-center px-3 py-1.5 text-sm text-gray-400 shadow hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    //  style={{ backgroundColor: EKARI.primary }} // uses your EkariHub gold
                    title="Back to EkariHub"
                >
                    <IoArrowBack /> Back to EkariHub
                </Link>
                <button
                    onClick={() => router.back()}
                    aria-label="Close"
                    className="rounded-full bg-white/10 p-2 hover:bg-white/20"
                    title="Close"
                >
                    <IoArrowUp size={22} />
                </button>


            </div>

            <div className="h-full w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px]">
                {/* MEDIA COLUMN */}
                <div className="relative flex items-center justify-center">
                    <div className="relative max-h-[100svh] max-w-[min(92vw,800px)] w-[min(92vw,800px)] h-[min(100svh,92vh)] flex items-center justify-center">
                        {/* Video / Photo */}
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

                        {/* Mute toggle */}
                        <button
                            onClick={() => setMuted((m) => !m)}
                            className="absolute left-3 top-3 rounded-full bg-black/60 p-2 hover:bg-black/80"
                            aria-label={muted ? "Unmute" : "Mute"}
                        >
                            {muted ? <IoVolumeMute /> : <IoVolumeHigh />}
                        </button>


                        {ready && item && !isOwner && (
                            <div
                                className="
      absolute right-3 top-1/2 -translate-y-1/2
      flex flex-col items-center gap-3
      pb-[env(safe-area-inset-bottom)]
      z-20
    "
                            >
                                {/* Follow */}

                                <button
                                    onClick={() => requireAuth(toggleFollow)}
                                    title={following ? "Following" : "Follow"}
                                    className={[
                                        "rounded-full px-3 py-1 text-xs font-bold transition",
                                        following
                                            ? "bg-white border hover:bg-[rgba(199,146,87,0.08)]"
                                            : "text-white hover:opacity-90"
                                    ].join(" ")}
                                    style={
                                        following
                                            ? { borderColor: EKARI.primary, color: EKARI.primary }
                                            : { backgroundColor: EKARI.primary }
                                    }
                                >
                                    {following ? "Following" : "Follow"}
                                </button>

                                {/* Like */}
                                <button
                                    onClick={() => requireAuth(toggleLike)}
                                    className="grid place-items-center rounded-full bg-white/10 p-3 hover:bg-white/20"
                                    title={liked ? 'Unlike' : 'Like'}
                                    aria-pressed={liked}
                                >
                                    {liked ? <IoHeart className="text-red-500" /> : <IoHeartOutline />}
                                </button>



                                {/* Save */}
                                <button
                                    onClick={() => requireAuth(toggleSave)}
                                    className="grid place-items-center rounded-full bg-white/10 p-3 hover:bg-white/20"
                                    title={saved ? 'Unsave' : 'Save'}
                                    aria-pressed={saved}
                                >
                                    {saved ? <IoBookmark /> : <IoBookmarkOutline />}
                                </button>

                                {/* Share */}
                                <button
                                    onClick={onShare}
                                    className="grid place-items-center rounded-full bg-white/10 p-3 hover:bg-white/20"
                                    title="Share"
                                >
                                    <IoShareOutline />
                                </button>
                            </div>
                        )}

                        {/* Up / Down inside media column */}
                        <div className="absolute right-3 top-10 -translate-y-1/2 flex flex-col gap-2">
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

                        {/* Analytics button inside media column */}
                        {/* Analytics button – owner only */}
                        {isOwner && (
                            <Link
                                href={`/studio/analytics/${item.id}`}
                                className="absolute right-3 bottom-2 inline-flex items-center gap-2 rounded-full bg-white text-black px-4 py-2 font-bold shadow-lg hover:bg-white/90"
                                title="View analytics"
                            >
                                <IoBarChartOutline size={18} />
                                Analytics
                            </Link>
                        )}

                        {/* Caption overlay */}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                            <div className="max-w-[90%]">
                                {item.authorUsername && (
                                    <div className="mb-1 font-extrabold">{item.authorUsername}</div>
                                )}
                                {!!item.text && (
                                    <p className="text-sm leading-5 text-white/95 line-clamp-3">{item.text}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* COMMENTS / META ASIDE (white) */}
                <aside className="hidden lg:flex flex-col bg-white text-gray-900 border-l border-gray-200 overflow-y-hidden">
                    {/* Meta header (light) */}
                    <div className="p-4 border-b border-gray-200">
                        <div className="mb-2 text-xs text-gray-500">
                            Posted {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <span>Views: <b>{nfmt(item.stats?.views)}</b></span>
                            <span>Likes: <b>{nfmt(item.stats?.likes)}</b></span>
                            <span>Comments: <b>{nfmt(item.stats?.comments)}</b></span>
                            <span>Shares: <b>{nfmt(item.stats?.shares)}</b></span>
                        </div>
                    </div>

                    {/* Real comments rail — fills the rest */}
                    <RightRail
                        open={true}
                        mode="sidebar"
                        deedId={item.id}
                        onClose={() => { /* keep open on desktop; no-op */ }}
                        currentUser={{
                            uid: user?.uid,
                            photoURL: user?.photoURL,
                            handle: (user as any)?.handle,
                        }}
                        className="!border-0 bg-white text-gray-900 !h-[calc(100vh-72px)]"
                    />
                </aside>
            </div>
        </div>
    );
}
function getOrMakeDeviceId(): string {
    const k = "__ekari_device_id__";
    try {
        let v = localStorage.getItem(k);
        if (!v || v.length < 16) {
            v = (crypto?.randomUUID?.() ?? (Math.random().toString(36).slice(2) + Date.now().toString(36)));
            if (v.length < 16) v = v.padEnd(16, "x");
            localStorage.setItem(k, v);
        }
        return v;
    } catch {
        return "anon_device_" + Math.random().toString(36).slice(2).padEnd(16, "x");
    }
}
function useLiked(deedId?: string, uid?: string) {
    const likeId = uid && deedId ? `${deedId}_${uid}` : undefined;
    const [liked, setLiked] = React.useState(false);

    React.useEffect(() => {
        if (!likeId) { setLiked(false); return; }
        return onSnapshot(doc(db, "likes", likeId), (s) => setLiked(s.exists()));
    }, [likeId]);

    const toggle = async () => {
        if (!uid || !deedId || !likeId) return;
        const ref = doc(db, "likes", likeId);
        const s = await getDoc(ref);
        if (s.exists()) await deleteDoc(ref);
        else await setDoc(ref, { deedId, userId: uid, createdAt: Date.now() });
    };

    return { liked, toggle };
}

function useSaved(deedId?: string, uid?: string) {
    const bookmarkId = uid && deedId ? `${deedId}_${uid}` : undefined;
    const [saved, setSaved] = React.useState(false);

    React.useEffect(() => {
        if (!bookmarkId) { setSaved(false); return; }
        return onSnapshot(doc(db, "bookmarks", bookmarkId), (s) => setSaved(s.exists()));
    }, [bookmarkId]);

    const toggle = async () => {
        if (!uid || !deedId || !bookmarkId) return;
        const ref = doc(db, "bookmarks", bookmarkId);
        const s = await getDoc(ref);
        if (s.exists()) await deleteDoc(ref);
        else await setDoc(ref, { deedId, userId: uid, createdAt: serverTimestamp() });
    };

    return { saved, toggle };
}

/** follows/{viewer_following} */
function useFollowAuthor(authorId?: string, uid?: string) {
    const docId = uid && authorId ? `${uid}_${authorId}` : undefined;
    const [following, setFollowing] = React.useState(false);

    React.useEffect(() => {
        if (!docId) { setFollowing(false); return; }
        return onSnapshot(doc(db, "follows", docId), (s) => setFollowing(s.exists()));
    }, [docId]);

    const toggle = async () => {
        if (!uid || !authorId || !docId || uid === authorId) return;
        const ref = doc(db, "follows", docId);
        const s = await getDoc(ref);
        if (s.exists()) await deleteDoc(ref);
        else await setDoc(ref, { followerId: uid, followingId: authorId, createdAt: Date.now() });
    };

    return { following, toggle };
}
