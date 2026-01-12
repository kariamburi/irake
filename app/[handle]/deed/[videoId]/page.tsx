// app/[handle]/deed/[deedid]/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    IoChevronUp,
    IoChevronDown,
    IoVolumeMute,
    IoVolumeHigh,
    IoBarChartOutline,
    IoHeartOutline,
    IoShareOutline,
    IoHeart,
    IoBookmark,
    IoBookmarkOutline,
    IoArrowBack,
    IoMusicalNotesOutline,
    IoChatbubbleOutline,
    IoClose,
} from "react-icons/io5";
import {
    fetchUserSiblings,
    resolveUidByHandle,
    toPlayerItem,
} from "@/lib/fire-queries";
import RightRail from "@/app/components/RightRail";
import { useAuth } from "@/app/hooks/useAuth";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { cn } from "@/lib/utils";
import OpenInAppBanner from "@/app/components/OpenInAppBanner";
import { AuthorBadgePill } from "@/app/components/AuthorBadgePill";

type Item = any;

function nfmt(n?: number) {
    const v = n ?? 0;
    if (v >= 1_000_000)
        return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(v);
}

/* -------------------- responsive helpers -------------------- */

function useMediaQuery(queryStr: string) {
    const [matches, setMatches] = React.useState(false);
    React.useEffect(() => {
        const mq = window.matchMedia(queryStr);
        const onChange = () => setMatches(mq.matches);
        onChange();
        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, [queryStr]);
    return matches;
}
function useIsMobile() {
    return useMediaQuery("(max-width: 1023px)");
}

/* -------------------- HLS + preload helpers -------------------- */

function useHls(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    src?: string | null
) {
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        const isHls = src.endsWith(".m3u8");
        let hls: any;

        if (isHls && !video.canPlayType("application/vnd.apple.mpegURL")) {
            (async () => {
                try {
                    const mod = await import("hls.js");
                    const Hls = mod.default;
                    if (Hls?.isSupported()) {
                        hls = new Hls({ enableWorker: true });
                        hls.loadSource(src);
                        hls.attachMedia(video);
                    } else {
                        (video as any).src = src;
                        video.load?.();
                    }
                } catch {
                    (video as any).src = src;
                    video.load?.();
                }
            })();
        } else {
            (video as any).src = src;
            video.load?.();
        }

        return () => {
            hls?.destroy?.();
        };
    }, [videoRef, src]);
}

function VideoPreload({ src, poster }: { src: string; poster?: string | null }) {
    const ref = useRef<HTMLVideoElement | null>(null);
    useHls(ref, src);

    return (
        <video
            ref={ref}
            muted
            playsInline
            preload="metadata"
            poster={poster || undefined}
            style={{
                position: "absolute",
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
                top: -9999,
                left: -9999,
            }}
        />
    );
}

function AdjacentPreloadWeb({
    siblings,
    activeIndex,
    neighborRange,
}: {
    siblings: Item[];
    activeIndex: number;
    neighborRange: number;
}) {
    if (neighborRange <= 0) return null;

    const candidates: Item[] = [];
    for (let offset = 1; offset <= neighborRange; offset++) {
        const prev = siblings[activeIndex - offset];
        const next = siblings[activeIndex + offset];
        if (prev && prev.mediaType === "video" && prev.mediaUrl) candidates.push(prev);
        if (next && next.mediaType === "video" && next.mediaUrl) candidates.push(next);
    }
    if (!candidates.length) return null;

    return (
        <div
            aria-hidden
            style={{
                position: "fixed",
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
                top: -9999,
                left: -9999,
                zIndex: -1,
            }}
        >
            {candidates.map((it) => (
                <VideoPreload key={it.id} src={it.mediaUrl!} poster={it.posterUrl} />
            ))}
        </div>
    );
}
function useFollowingCount(userId?: string) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!userId) {
            setCount(0);
            return;
        }

        // follow docs: { followerId, followingId }
        // "following count" = how many people this user follows
        const qy = query(collection(db, "follows"), where("followerId", "==", userId));

        const unsub = onSnapshot(
            qy,
            (snap) => setCount(snap.size),
            () => setCount(0)
        );

        return () => unsub();
    }, [userId]);

    return count;
}

// ---------- time utils ----------
function toMillisSafe(v: any): number | null {
    if (!v) return null;

    if (typeof v?.toMillis === "function") return v.toMillis(); // Firestore Timestamp
    if (typeof v?.seconds === "number") return v.seconds * 1000; // {seconds,nanoseconds}
    if (typeof v === "number") return v > 10_000_000_000 ? v : v * 1000; // ms or seconds

    if (typeof v === "string") {
        const ms = Date.parse(v);
        return Number.isFinite(ms) ? ms : null;
    }

    if (v instanceof Date) return v.getTime();
    return null;
}

function formatTimeAgoShort(ms: number): string {
    const now = Date.now();
    const diff = Math.max(0, now - ms);

    const sec = Math.floor(diff / 1000);
    if (sec < 10) return "now";
    if (sec < 60) return `${sec}s`;

    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;

    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;

    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d`;

    const d = new Date(ms);
    const yNow = new Date().getFullYear();
    const sameYear = d.getFullYear() === yNow;

    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "2-digit",
        ...(sameYear ? {} : { year: "numeric" }),
    });
}

function formatAbsDateTime(ms: number): string {
    return new Date(ms).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}



/* -------------------- live author profile -------------------- */

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
            if (!data) return setProfile(null);
            setProfile({ handle: data?.handle, photoURL: data?.photoURL });
        });

        return () => unsub();
    }, [authorId]);

    return profile;
}

/* -------------------- slide component (one deed) -------------------- */

type DeedSlideProps = {
    item: Item;
    isActive: boolean;
    muted: boolean;
    setMuted: React.Dispatch<React.SetStateAction<boolean>>;
    uid?: string;
    requireAuth: (fn: () => void) => void;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    EKARI: { primary: string };
};

function DeedSlide({
    item,
    isActive,
    muted,
    setMuted,
    uid,
    requireAuth,
    hasPrev,
    hasNext,
    onPrev,
    onNext,
    EKARI,
}: DeedSlideProps) {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [ready, setReady] = useState(false);

    useHls(videoRef, item.mediaType === "video" ? item.mediaUrl : undefined);

    const authorProfile = useAuthorProfile(item.authorId);
    const { liked, toggle: toggleLike } = useLiked(item.id, uid);
    const { saved, toggle: toggleSave } = useSaved(item.id, uid);
    const { following, toggle: toggleFollow } = useFollowAuthor(item.authorId, uid);

    const isOwner = !!uid && item.authorId === uid;
    const followingCount = useFollowingCount(item.authorId);

    const avatar =
        authorProfile?.photoURL || item.authorPhotoURL || "/avatar-placeholder.png";

    const music = item.music;
    const isLibrarySound = music?.source === "library" && !!music?.coverUrl;

    const soundLabel = isLibrarySound
        ? music?.title || "Library sound"
        : "Original sound";
    const soundAvatar = isLibrarySound ? (music?.coverUrl as string) : avatar;
    const createdAtMs =
        toMillisSafe(item?.createdAt) ??
        toMillisSafe(item?.createdAtMs) ??
        toMillisSafe(item?.postedAt) ??
        null;

    const timeAgo = createdAtMs ? formatTimeAgoShort(createdAtMs) : "";
    const timeTitle = createdAtMs ? formatAbsDateTime(createdAtMs) : "";

    const handleToPath = (h?: string) =>
        h ? `/${encodeURIComponent(h.startsWith("@") ? h : `@${h}`)}` : null;

    const onViewProfileClick = (handle?: string) => {
        const path = handleToPath(handle);
        if (!path) return;
        router.push(path);
    };

    useEffect(() => {
        const v = videoRef.current;
        if (!v || item.mediaType !== "video") return;
        if (isActive) v.play().catch(() => { });
        else v.pause();
    }, [isActive, item.mediaType]);

    const onShare = async () => {
        const h =
            (item.authorUsername as string | undefined) ||
            (authorProfile?.handle as string | undefined) ||
            "";
        const handleWithAt = h ? (h.startsWith("@") ? h : `@${h}`) : "";
        const url = `${location.origin}/${handleWithAt}/deed/${item.id}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: item.text || "ekarihub",
                    text: item.text || "",
                    url,
                });
            } else {
                await navigator.clipboard.writeText(url);
                alert("Link copied!");
            }

            const baseId = uid ?? getOrMakeDeviceId();
            const sid = `${item.id}_${baseId}_${Date.now()}`;
            const payload: any = { deedId: item.id, createdAt: serverTimestamp() };
            if (uid) payload.userId = uid;
            else payload.deviceId = baseId;
            await setDoc(doc(db, "shares", sid), payload);
        } catch {
            /* no-op */
        }
    };

    return (
        <div className="snap-start h-[100svh] flex items-center justify-center">
            <div className="relative flex h-[100svh] w-[min(92vw,800px)] max-h-[100svh] max-w-[min(92vw,800px)] items-center justify-center">
                {item.mediaType === "video" && item.mediaUrl ? (
                    <video
                        ref={videoRef}
                        poster={item.posterUrl}
                        preload="metadata"
                        playsInline
                        autoPlay
                        muted={muted}
                        loop
                        controls={false}
                        disablePictureInPicture
                        controlsList="nodownload noremoteplayback"
                        className="block h-full w-full bg-black object-contain"
                        onLoadedMetadata={() => setReady(true)}
                        onCanPlay={() => setReady(true)}
                        onLoadedData={() => setReady(true)}
                    />
                ) : item.mediaType === "photo" && item.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.mediaUrl}
                        alt={item.text || "photo"}
                        className="block h-full w-full bg-black object-contain"
                        onLoad={() => setReady(true)}
                    />
                ) : (
                    <div className="grid h-full w-full place-items-center text-white/70">
                        No media
                    </div>
                )}

                {!ready && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-black/40 p-4">
                            <BouncingBallLoader />
                        </div>
                    </div>
                )}

                <button
                    onClick={() => setMuted((m) => !m)}
                    className="absolute left-3 top-10 rounded-full bg-white/10 p-2 hover:bg-black/80"
                    aria-label={muted ? "Unmute" : "Mute"}
                >
                    {muted ? <IoVolumeMute /> : <IoVolumeHigh />}
                </button>

                {ready && item && !isOwner && (
                    <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 pb-[env(safe-area-inset-bottom)] flex flex-col items-center gap-3">
                        <button
                            onClick={() => requireAuth(toggleLike)}
                            className="grid place-items-center rounded-full bg-white/10 p-3 hover:bg-white/20"
                            title={liked ? "Unlike" : "Like"}
                            aria-pressed={liked}
                        >
                            {liked ? <IoHeart className="text-red-500" /> : <IoHeartOutline />}
                            {!!item?.stats?.likes && (
                                <span className="mt-1 text-[11px] text-white/80">
                                    {nfmt(item.stats.likes)}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => requireAuth(toggleSave)}
                            className="grid place-items-center rounded-full bg-white/10 p-3 hover:bg-white/20"
                            title={saved ? "Unsave" : "Save"}
                            aria-pressed={saved}
                        >
                            {saved ? <IoBookmark /> : <IoBookmarkOutline />}
                        </button>

                        <button
                            onClick={onShare}
                            className="grid place-items-center rounded-full bg-white/10 p-3 hover:bg-white/20"
                            title="Share"
                        >
                            <IoShareOutline />
                        </button>
                    </div>
                )}

                <div className="absolute right-3 top-10 -translate-y-1/2 flex flex-col gap-2">
                    <button
                        onClick={onPrev}
                        disabled={!hasPrev}
                        className="rounded-full bg-white/10 p-2 hover:bg-white/20 disabled:opacity-30"
                        aria-label="Previous"
                    >
                        <IoChevronUp size={20} />
                    </button>
                    <button
                        onClick={onNext}
                        disabled={!hasNext}
                        className="rounded-full bg-white/10 p-2 hover:bg-white/20 disabled:opacity-30"
                        aria-label="Next"
                    >
                        <IoChevronDown size={20} />
                    </button>
                </div>

                {isOwner && (
                    <Link
                        href={`/studio/analytics/${item.id}`}
                        className="absolute right-3 bottom-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-black shadow-lg hover:bg-white/90"
                        title="View analytics"
                    >
                        <IoBarChartOutline size={18} />
                        Analytics
                    </Link>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <div className="max-w-[90%]">
                        <div className="flex items-center gap-2 mb-1">
                            <div
                                onClick={() => onViewProfileClick(item.authorUsername)}
                                className={cn(
                                    "h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0",
                                    item.authorUsername ? "cursor-pointer" : "cursor-default"
                                )}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={avatar}
                                    alt={item.authorUsername || item.authorId || "author"}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            <div
                                onClick={() => onViewProfileClick(item.authorUsername)}
                                className="cursor-pointer min-w-0 flex flex-col"
                            >
                                <div className="text-white/95 font-bold text-sm truncate">
                                    {item.authorUsername
                                        ? `${item.authorUsername}`
                                        : (item.authorId ?? "").slice(0, 6)}

                                </div>
                                <AuthorBadgePill badge={(item as any).authorBadge} />
                                {(followingCount > 0 || timeAgo) && (
                                    <div className="text-white/70 text-[11px] flex items-center gap-2">
                                        <span title={`${followingCount} following`}>
                                            {nfmt(followingCount)} Following
                                        </span>

                                        {timeAgo && (
                                            <>
                                                <span className="opacity-60">•</span>
                                                <span title={timeTitle} className="opacity-90">
                                                    {timeAgo}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )}

                            </div>


                            {ready && item && !isOwner && (
                                <button
                                    onClick={() => requireAuth(toggleFollow)}
                                    title={following ? "Following" : "Follow"}
                                    className={[
                                        "pointer-events-auto rounded-full px-3 py-1 text-xs font-bold transition",
                                        following
                                            ? "bg-white border hover:bg-[rgba(199,146,87,0.08)]"
                                            : "text-white hover:opacity-90",
                                    ].join(" ")}
                                    style={
                                        following
                                            ? { borderColor: EKARI.primary, color: EKARI.primary }
                                            : { backgroundColor: EKARI.primary }
                                    }
                                >
                                    {following ? "Following" : "Follow"}
                                </button>
                            )}
                        </div>

                        {!!item.text && (
                            <p className="text-sm leading-5 text-white/95 line-clamp-3">
                                {item.text}
                            </p>
                        )}

                        <div className="mt-1 flex items-center gap-2">
                            {isLibrarySound && (
                                <div className="h-5 w-5 rounded-full overflow-hidden bg-black/40 flex-shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={soundAvatar}
                                        alt={soundLabel}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            )}
                            <div className="flex items-center gap-1 text-[11px] text-white/85 min-w-0">
                                <IoMusicalNotesOutline className="flex-shrink-0" size={14} />
                                <span className="truncate max-w-[180px] sm:max-w-[220px]">
                                    {soundLabel}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* -------------------- main page -------------------- */

export default function PlayerByHandlePage() {
    const router = useRouter();
    const isMobile = useIsMobile();

    const params = useParams() as {
        handle?: string;
        deedid?: string;
        videoId?: string;
    };

    const rawHandle = params?.handle ?? "";
    const decoded = (() => {
        try {
            return decodeURIComponent(rawHandle);
        } catch {
            return rawHandle;
        }
    })();

    // IMPORTANT: your routes use "@handle" in the URL
    const handleWithAt = decoded.startsWith("@") ? decoded : `@${decoded}`;

    const deedId = params.deedid || params.videoId || "";

    const [siblings, setSiblings] = useState<Item[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [initialIndex, setInitialIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [muted, setMuted] = useState(true);

    // ✅ RightRail toggle:
    // - desktop: default open
    // - mobile: default closed (sheet opens on demand)
    const [showRail, setShowRail] = useState(false);
    useEffect(() => {
        setShowRail(isMobile ? false : true);
    }, [isMobile]);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const scrollRaf = useRef<number | null>(null);

    const { user } = useAuth();
    const uid = user?.uid;
    const profile = useUserProfile(uid);
    const prefs = useUserPrefs(uid);

    const EKARI = { primary: "#C79257" };
    const [neighborPreloadRange, setNeighborPreloadRange] = useState(1);

    useEffect(() => {
        let base = 1;
        try {
            const navAny = navigator as any;
            const conn =
                navAny?.connection || navAny?.mozConnection || navAny?.webkitConnection;
            const type: string | undefined = conn?.type;
            const effectiveType: string | undefined = conn?.effectiveType;
            if (type === "wifi" || effectiveType === "4g") base = 2;
            else base = 1;
        } catch {
            base = 1;
        }
        if (!uid) base = Math.min(base, 1);
        if (prefs?.dataSaverVideos) base = Math.max(0, base - 1);
        const clamped = Math.max(0, Math.min(3, base));
        setNeighborPreloadRange(clamped);
    }, [uid, prefs?.dataSaverVideos]);

    const requireAuth = (fn: () => void) => {
        if (!uid) {
            router.push(`/getstarted?next=${encodeURIComponent(location.pathname)}`);
            return;
        }
        fn();
    };

    useEffect(() => {
        let active = true;
        (async () => {
            if (!handleWithAt || !deedId) return;

            try {
                const snap = await getDoc(doc(db, "deeds", deedId));
                if (!active) return;

                if (!snap.exists()) {
                    setSiblings([]);
                    setLoading(false);
                    return;
                }

                const current = toPlayerItem(snap.data(), snap.id);

                // if URL handle doesn't match author, redirect to correct author handle
                const routeRes = await resolveUidByHandle(handleWithAt);
                const routeUid = routeRes?.uid;
                if (routeUid && current.authorId !== routeUid) {
                    try {
                        const u = await getDoc(doc(db, "users", current.authorId));
                        const h = (u.data() as any)?.handle as string | undefined;
                        if (h && h.length) {
                            const authorHandle = h.startsWith("@") ? h : `@${h}`;
                            router.replace(
                                `/${encodeURIComponent(authorHandle)}/deed/${encodeURIComponent(
                                    deedId
                                )}`
                            );
                            return;
                        }
                    } catch { }
                }

                const arr = await fetchUserSiblings(current.authorId, 100);
                let idx = arr.findIndex((x: any) => x.id === deedId);
                if (idx === -1) {
                    arr.unshift(current);
                    idx = 0;
                }

                if (!active) return;
                setSiblings(arr);
                setInitialIndex(idx);
                setActiveIndex(idx);
                setLoading(false);
            } catch (err) {
                console.error("Error loading deed siblings:", err);
                if (!active) return;
                setSiblings([]);
                setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [handleWithAt, deedId, router]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || !siblings.length) return;
        const h = el.clientHeight || window.innerHeight;
        el.scrollTo({ top: initialIndex * h, behavior: "auto" });
    }, [initialIndex, siblings.length]);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el || !siblings.length) return;
        const h = el.clientHeight || window.innerHeight;
        if (!h) return;

        const rawIndex = el.scrollTop / h;
        const nextIdx = Math.round(rawIndex);
        if (nextIdx !== activeIndex && nextIdx >= 0 && nextIdx < siblings.length) {
            setActiveIndex(nextIdx);
        }
    }, [activeIndex, siblings.length]);

    const onScroll = useCallback(() => {
        if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
        scrollRaf.current = window.requestAnimationFrame(handleScroll);
    }, [handleScroll]);

    useEffect(() => {
        return () => {
            if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
        };
    }, []);

    const scrollToIndex = useCallback((index: number) => {
        const el = scrollRef.current;
        if (!el) return;
        const h = el.clientHeight || window.innerHeight;
        el.scrollTo({ top: index * h, behavior: "smooth" });
    }, []);

    const goPrev = useCallback(() => {
        if (activeIndex > 0) scrollToIndex(activeIndex - 1);
    }, [activeIndex, scrollToIndex]);

    const goNext = useCallback(() => {
        if (activeIndex < siblings.length - 1) scrollToIndex(activeIndex + 1);
    }, [activeIndex, siblings.length, scrollToIndex]);

    // keyboard nav (↑/↓) + ESC closes rail if open (desktop)
    useEffect(() => {
        if (isMobile) return;

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                goPrev();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                goNext();
            } else if (e.key === "Escape") {
                setShowRail((v) => {
                    if (v) return false;
                    router.back();
                    return v;
                });
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [goPrev, goNext, router, isMobile]);

    const currentItem = siblings[activeIndex];

    if (loading && !currentItem) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black text-white/80">
                <BouncingBallLoader />
            </div>
        );
    }

    if (!currentItem) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-black text-white/80">
                Deed not found.
            </div>
        );
    }

    const h = String(handleWithAt ?? "").trim();
    const normalized = h.startsWith("@") ? h : `@${h}`;
    const webUrl =
        typeof window !== "undefined"
            ? window.location.href
            : `https://ekarihub.com/${encodeURIComponent(normalized)}/deed/${encodeURIComponent(deedId)}`;

    const appUrl = `ekarihub:///${encodeURIComponent(normalized)}/deed/${encodeURIComponent(deedId)}`;


    return (
        <div className="fixed inset-0 bg-black text-white">
            <OpenInAppBanner
                webUrl={webUrl}
                appUrl={appUrl}
                title="Open this deed in ekarihub"
                subtitle="Faster loading, messaging, and full features."
                playStoreUrl="https://play.google.com/store/apps/details?id=com.ekarihub.app"
                appStoreUrl="https://apps.apple.com" // replace later
            />

            {/* Top bar (safe) */}
            <div
                className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-3"
                style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}
            >
                <button
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="rounded-full p-2 hover:bg-white/20"
                    title="Back"
                >
                    <IoArrowBack size={22} />
                </button>

                <button
                    onClick={() => setShowRail((v) => !v)}
                    aria-label={showRail ? "Hide activity panel" : "Show activity panel"}
                    className="rounded-full p-2 hover:bg-white/20"
                    title={showRail ? "Hide" : "Comments"}
                >
                    {showRail ? <IoClose size={22} /> : <IoChatbubbleOutline size={22} />}
                </button>
            </div>

            <div
                className={cn(
                    "grid h-full w-full",
                    showRail ? "lg:grid-cols-[minmax(0,1fr)_420px]" : "lg:grid-cols-1"
                )}
            >
                {/* MEDIA COLUMN */}
                <div
                    ref={scrollRef}
                    className="relative flex h-full min-h-0 flex-col items-stretch justify-start overflow-y-scroll snap-y snap-mandatory scroll-smooth"
                    onScroll={onScroll}
                    style={{
                        paddingBottom: "env(safe-area-inset-bottom)",
                    }}
                >
                    {siblings.map((it, index) => (
                        <DeedSlide
                            key={it.id}
                            item={it}
                            isActive={index === activeIndex}
                            muted={muted}
                            setMuted={setMuted}
                            uid={uid}
                            requireAuth={requireAuth}
                            hasPrev={index > 0}
                            hasNext={index < siblings.length - 1}
                            onPrev={goPrev}
                            onNext={goNext}
                            EKARI={EKARI}
                        />
                    ))}
                </div>


                {!isMobile && showRail && (
                    <aside className="hidden lg:flex flex-col overflow-y-hidden border-l border-gray-200 bg-white text-gray-900">
                        <RightRail
                            open={true}
                            mode="sidebar"
                            deedId={currentItem.id}
                            onClose={() => setShowRail(false)}
                            currentUser={profile}
                            className="!h-[100vh] !border-0 bg-white text-gray-900"
                        />
                    </aside>
                )}


                {isMobile && (
                    <RightRail
                        open={showRail}
                        mode="sheet"
                        deedId={currentItem.id}
                        onClose={() => setShowRail(false)}
                        currentUser={profile}
                        className="bg-white text-gray-900"
                    />
                )}

            </div>

            {/* MOBILE RightRail (sheet overlay only) */}
            {isMobile && (
                <RightRail
                    open={showRail}
                    mode="sheet"
                    deedId={currentItem.id}
                    onClose={() => setShowRail(false)}
                    currentUser={profile}
                    className="bg-white text-gray-900"
                />
            )}

            {/* Adjacent preloading */}
            <AdjacentPreloadWeb
                siblings={siblings}
                activeIndex={activeIndex}
                neighborRange={neighborPreloadRange}
            />
        </div>
    );
}

/* -------------------- helpers: device id + hooks -------------------- */

function getOrMakeDeviceId(): string {
    const k = "__ekari_device_id__";
    try {
        let v: any = localStorage.getItem(k);
        if (!v || v.length < 16) {
            v =
                (typeof crypto !== "undefined" && (crypto as any)?.randomUUID?.()) ??
                (Math.random().toString(36).slice(2) + Date.now().toString(36));
            if (v.length < 16) v = v.padEnd(16, "x");
            localStorage.setItem(k, v);
        }
        return v;
    } catch {
        return (
            "anon_device_" +
            Math.random().toString(36).slice(2).padEnd(16, "x")
        );
    }
}

function useUserProfile(uid?: string) {
    const [profile, setProfile] = useState<any | null>(null);

    useEffect(() => {
        if (!uid) {
            setProfile(null);
            return;
        }
        const ref = doc(db, "users", uid);
        const unsub = onSnapshot(ref, (snap) => {
            const data = snap.data() as any | undefined;
            setProfile({
                uid,
                handle: data?.handle,
                photoURL: data?.photoURL ?? null,
            });
        });
        return () => unsub();
    }, [uid]);

    return profile;
}

function useUserPrefs(uid?: string) {
    const [prefs, setPrefs] = useState<{ dataSaverVideos?: boolean } | null>(null);

    useEffect(() => {
        if (!uid) {
            setPrefs(null);
            return;
        }
        const ref = doc(db, "users", uid);
        const unsub = onSnapshot(ref, (snap) => {
            const data = snap.data() as any | undefined;
            setPrefs({ dataSaverVideos: !!data?.dataSaverVideos });
        });
        return () => unsub();
    }, [uid]);

    return prefs;
}

function useLiked(deedId?: string, uid?: string) {
    const likeId = uid && deedId ? `${deedId}_${uid}` : undefined;
    const [liked, setLiked] = React.useState(false);

    React.useEffect(() => {
        if (!likeId) {
            setLiked(false);
            return;
        }
        return onSnapshot(doc(db, "likes", likeId), (s) => setLiked(s.exists()));
    }, [likeId]);

    const toggle = async () => {
        if (!uid || !deedId || !likeId) return;
        const ref = doc(db, "likes", likeId);
        const s = await getDoc(ref);
        if (s.exists()) await deleteDoc(ref);
        else await setDoc(ref, { deedId, userId: uid, createdAt: serverTimestamp() });
    };

    return { liked, toggle };
}

function useSaved(deedId?: string, uid?: string) {
    const bookmarkId = uid && deedId ? `${deedId}_${uid}` : undefined;
    const [saved, setSaved] = React.useState(false);

    React.useEffect(() => {
        if (!bookmarkId) {
            setSaved(false);
            return;
        }
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

function useFollowAuthor(authorId?: string, uid?: string) {
    const docId = uid && authorId ? `${uid}_${authorId}` : undefined;
    const [following, setFollowing] = React.useState(false);

    React.useEffect(() => {
        if (!docId) {
            setFollowing(false);
            return;
        }
        return onSnapshot(doc(db, "follows", docId), (s) => setFollowing(s.exists()));
    }, [docId]);

    const toggle = async () => {
        if (!uid || !authorId || !docId || uid === authorId) return;
        const ref = doc(db, "follows", docId);
        const s = await getDoc(ref);
        if (s.exists()) await deleteDoc(ref);
        else
            await setDoc(ref, {
                followerId: uid,
                followingId: authorId,
                createdAt: serverTimestamp(),
            });
    };

    return { following, toggle };
}
