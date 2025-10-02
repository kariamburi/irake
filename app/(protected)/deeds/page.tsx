"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
    IoHome, IoCompassOutline, IoPeopleOutline, IoChatbubbleOutline,
    IoCloudUploadOutline, IoNotificationsOutline, IoTvOutline,
    IoPersonCircleOutline, IoEllipsisHorizontal, IoHeart, IoChatbubble,
    IoBookmarkOutline, IoShareOutline, IoSearch, IoAdd, IoChevronUp, IoChevronDown,
    IoVolumeHigh, IoVolumeMute, IoPlay, IoPause
} from "react-icons/io5";

import {
    collection, query, orderBy, limit, onSnapshot, where,
    doc, setDoc, deleteDoc, getDoc, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

/* ---------- Theme ---------- */
const EKARI = {
    bg: "#ffffff",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
    primary: "#C79257",
};

/* ---------- Types & normalizer ---------- */
type Visibility = "public" | "followers" | "private";
type Item = {
    id: string;
    authorId: string;
    authorUsername?: string;
    authorPhotoURL?: string;
    muxPlaybackId?: string;
    posterUrl?: string;
    mediaUrl?: string | null;
    mediaType?: "video" | "photo" | "none";
    text?: string;
    createdAt?: number;
    visibility?: Visibility;
};

const toItem = (d: any, id: string): Item => {
    const createdAtMs =
        typeof d.createdAtMs === "number"
            ? d.createdAtMs
            : d.createdAt instanceof Timestamp
                ? d.createdAt.toMillis()
                : Date.now();

    const m0 = Array.isArray(d.media) ? d.media[0] : undefined;
    const rawType = (d.type ?? d.mediaType)?.toString().toLowerCase();
    const typeNorm: "video" | "photo" | "none" =
        rawType === "video" ? "video" : rawType === "photo" ? "photo" : "none";

    let muxPlaybackId: string | undefined;
    let posterUrl: string | undefined;
    let mediaUrl: string | null = null;
    let mediaType: Item["mediaType"] = "none";

    if (typeNorm === "video") {
        muxPlaybackId = d.muxPlaybackId ?? m0?.muxPlaybackId ?? undefined;
        if (muxPlaybackId) {
            mediaUrl = `https://stream.mux.com/${muxPlaybackId}.m3u8`;
            posterUrl = d.posterUrl ?? m0?.thumbUrl ?? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg`;
            mediaType = "video";
        }
    } else if (typeNorm === "photo") {
        mediaUrl = d.mediaUrl ?? m0?.url ?? null;
        mediaType = mediaUrl ? "photo" : "none";
    }

    const visibility: Visibility =
        d.visibility === "followers" || d.visibility === "private" ? d.visibility : "public";

    return {
        id,
        authorId: d.authorId,
        authorUsername: d.authorUsername,
        authorPhotoURL: d.authorPhotoURL,
        muxPlaybackId,
        posterUrl,
        mediaUrl,
        mediaType,
        text: d.text ?? d.caption ?? "",
        createdAt: createdAtMs,
        visibility,
    };
};

const canSee = (item: Item, uid?: string, following: Set<string> = new Set()): boolean => {
    const v = item.visibility ?? "public";
    if (v === "public") return true;
    if (!uid) return false;
    if (item.authorId === uid) return true;
    if (v === "followers") return following.has(item.authorId);
    return false;
};

/* ---------- Hooks ---------- */
function useFollowing(uid?: string) {
    const [following, setFollowing] = React.useState<Set<string>>(new Set());
    React.useEffect(() => {
        if (!uid) { setFollowing(new Set()); return; }
        const qF = query(collection(db, "follows"), where("followerId", "==", uid));
        const unsub = onSnapshot(qF, (snap) => {
            const s = new Set<string>();
            snap.forEach((d) => { const x = d.data() as any; if (x?.followingId) s.add(x.followingId as string); });
            setFollowing(s);
        }, () => setFollowing(new Set()));
        return () => unsub();
    }, [uid]);
    return following;
}

function useFeed(uid?: string) {
    const following = useFollowing(uid);
    const [items, setItems] = React.useState<Item[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        setLoading(true);
        const qd = query(collection(db, "deeds"), orderBy("createdAt", "desc"), limit(50));
        const unsub = onSnapshot(qd, (snap) => {
            setItems(snap.docs.map((d) => toItem(d.data(), d.id)));
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, []);

    const visible = React.useMemo(() => items.filter((it) => canSee(it, uid, following)), [items, uid, following]);
    return { items: visible, loading };
}

function useLikes(itemId: string, uid?: string) {
    const likeId = uid ? `${itemId}_${uid}` : undefined;
    const [liked, setLiked] = React.useState(false);
    const [count, setCount] = React.useState(0);

    React.useEffect(() => {
        let unsubSelf = () => { };
        if (likeId) unsubSelf = onSnapshot(doc(db, "likes", likeId), (s) => setLiked(s.exists()));
        const unsubCount = onSnapshot(query(collection(db, "likes"), where("deedId", "==", itemId)), (s) => setCount(s.size));
        return () => { unsubSelf(); unsubCount(); };
    }, [itemId, likeId]);

    const toggle = async () => {
        if (!uid || !likeId) return;
        const ref = doc(db, "likes", likeId);
        const s = await getDoc(ref);
        if (s.exists()) await deleteDoc(ref);
        else await setDoc(ref, { deedId: itemId, userId: uid, createdAt: Date.now() });
    };

    return { liked, count, toggle };
}

/* ---------- Video helpers (autoplay + HLS + exclusive) ---------- */
let CURRENT_PLAYING: HTMLVideoElement | null = null;
function playExclusive(el: HTMLVideoElement) {
    if (CURRENT_PLAYING && CURRENT_PLAYING !== el) CURRENT_PLAYING.pause();
    CURRENT_PLAYING = el;
    el.play().catch(() => { });
}
function pauseIfCurrent(el: HTMLVideoElement) {
    if (CURRENT_PLAYING === el) CURRENT_PLAYING = null;
    el.pause();
}

function useHls(videoRef: React.RefObject<HTMLVideoElement | null>, src?: string | null) {
    React.useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) return;

        const isHls = src.endsWith(".m3u8");
        if (!isHls) { video.src = src; return; }

        if (video.canPlayType("application/vnd.apple.mpegURL")) {
            video.src = src; // Safari native
            return;
        }

        let hls: any;
        (async () => {
            const mod = await import("hls.js");
            const Hls = mod.default;
            if (Hls?.isSupported()) {
                hls = new Hls({ enableWorker: true });
                hls.loadSource(src);
                hls.attachMedia(video);
            } else {
                video.src = src;
            }
        })();

        return () => { hls?.destroy?.(); };
    }, [videoRef, src]);
}

/** UPDATED: respects initialMuted (no forced true) */
function useAutoPlay(
    ref: React.RefObject<HTMLVideoElement | null>,
    opts: { root?: React.RefObject<Element | null>; threshold?: number; rootMargin?: string; initialMuted?: boolean } = {}
) {
    const { root, threshold = 0.35, rootMargin = "-30% 0px -30% 0px", initialMuted } = opts;

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;

        if (typeof initialMuted === "boolean") el.muted = initialMuted;
        el.playsInline = true;
        el.setAttribute("autoplay", "");
        el.setAttribute("webkit-playsinline", "true");

        const activate = () => playExclusive(el);
        const deactivate = () => pauseIfCurrent(el);

        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && entry.intersectionRatio >= threshold) activate();
                else deactivate();
            },
            { root: root?.current ?? null, threshold: [0, 0.15, threshold, 0.8, 1], rootMargin }
        );
        io.observe(el);

        const onLoaded = () => {
            const rootEl = (root?.current ?? null) as Element | null;
            const rect = el.getBoundingClientRect();
            const vr = rootEl
                ? rootEl.getBoundingClientRect()
                : ({ top: 0, bottom: window.innerHeight, height: window.innerHeight } as DOMRect);
            const overlap = Math.max(0, Math.min(rect.bottom, vr.bottom) - Math.max(rect.top, vr.top));
            const ratio = overlap / rect.height;
            if (ratio >= threshold) activate();
        };
        el.addEventListener("loadedmetadata", onLoaded);

        const onVis = () => { if (document.hidden) deactivate(); };
        document.addEventListener("visibilitychange", onVis);

        return () => {
            io.disconnect();
            el.removeEventListener("loadedmetadata", onLoaded);
            document.removeEventListener("visibilitychange", onVis);
            if (CURRENT_PLAYING === el) CURRENT_PLAYING = null;
        };
    }, [ref, root, threshold, rootMargin, initialMuted]);
}

/* ---------- GLOBAL MUTE PROVIDER ---------- */
type MuteContextType = {
    muted: boolean;
    toggleMute: () => void;
    setMuted: (m: boolean) => void;
    registerVideo: (el: HTMLVideoElement) => void;
    unregisterVideo: (el: HTMLVideoElement) => void;
};
const MuteContext = React.createContext<MuteContextType | null>(null);

function useGlobalMute() {
    const ctx = React.useContext(MuteContext);
    if (!ctx) throw new Error("useGlobalMute must be used inside MuteProvider");
    return ctx;
}

function MuteProvider({ children }: { children: React.ReactNode }) {
    const [muted, setMutedState] = React.useState(true);
    const videos = React.useRef(new Set<HTMLVideoElement>());

    const applyToAll = React.useCallback((m: boolean) => {
        videos.current.forEach(v => { v.muted = m; });
        CURRENT_PLAYING?.play().catch(() => { });
    }, []);

    const setMutedAndApply = React.useCallback((m: boolean) => {
        setMutedState(m);
        applyToAll(m);
    }, [applyToAll]);

    const toggleMute = React.useCallback(() => {
        setMutedState(prev => {
            const next = !prev;
            applyToAll(next);
            return next;
        });
    }, [applyToAll]);

    const registerVideo = React.useCallback((el: HTMLVideoElement) => {
        videos.current.add(el);
        el.muted = muted; // sync new mounts
    }, [muted]);

    const unregisterVideo = React.useCallback((el: HTMLVideoElement) => {
        videos.current.delete(el);
    }, []);

    const value = React.useMemo(() => ({
        muted, toggleMute, setMuted: setMutedAndApply, registerVideo, unregisterVideo
    }), [muted, toggleMute, setMutedAndApply, registerVideo, unregisterVideo]);

    return <MuteContext.Provider value={value}>{children}</MuteContext.Provider>;
}

/* ---------- One-item step scrolling (wheel + keyboard) ---------- */
function useStepScroll(
    rootRef: React.RefObject<HTMLElement | null>,
    getCount: () => number
): { goPrev: () => void; goNext: () => void; index: number } {
    const lockRef = React.useRef(false);
    const indexRef = React.useRef(0);
    const [index, setIndex] = React.useState(0);
    const targetTopRef = React.useRef<number | null>(null);

    const height = () => (rootRef.current ? rootRef.current.clientHeight : window.innerHeight);

    const goToIndex = React.useCallback((i: number) => {
        const root = rootRef.current;
        if (!root) return;
        const total = getCount();
        const clamped = Math.max(0, Math.min(total - 1, i));
        indexRef.current = clamped;
        setIndex(clamped);
        targetTopRef.current = clamped * height();
        root.scrollTo({ top: targetTopRef.current, behavior: "smooth" });
    }, [rootRef, getCount]);

    React.useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (lockRef.current) return;
            lockRef.current = true;
            const dir = e.deltaY > 0 ? 1 : -1;
            goToIndex(indexRef.current + dir);
        };

        const onKey = (e: KeyboardEvent) => {
            if (lockRef.current) return;
            const k = e.key;
            if (["ArrowDown", "PageDown", " "].includes(k)) {
                e.preventDefault();
                lockRef.current = true;
                goToIndex(indexRef.current + 1);
            } else if (["ArrowUp", "PageUp"].includes(k)) {
                e.preventDefault();
                lockRef.current = true;
                goToIndex(indexRef.current - 1);
            }
        };

        // monitor until we reach target
        let raf = 0;
        const monitor = () => {
            if (targetTopRef.current == null) {
                raf = requestAnimationFrame(monitor);
                return;
            }
            const diff = Math.abs(root.scrollTop - targetTopRef.current);
            if (diff < 2) {
                targetTopRef.current = null;
                lockRef.current = false;
            } else {
                raf = requestAnimationFrame(monitor);
            }
        };
        raf = requestAnimationFrame(monitor);

        indexRef.current = Math.round(root.scrollTop / height());
        setIndex(indexRef.current);

        root.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("keydown", onKey);

        return () => {
            root.removeEventListener("wheel", onWheel);
            window.removeEventListener("keydown", onKey);
            cancelAnimationFrame(raf);
        };
    }, [rootRef, goToIndex, getCount]);

    React.useEffect(() => {
        const onResize = () => {
            const root = rootRef.current;
            if (!root) return;
            const i = Math.round(root.scrollTop / height());
            root.scrollTo({ top: i * height() });
            setIndex(i);
            indexRef.current = i;
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [rootRef]);

    const goPrev = React.useCallback(() => goToIndex(indexRef.current - 1), [goToIndex]);
    const goNext = React.useCallback(() => goToIndex(indexRef.current + 1), [goToIndex]);

    return { goPrev, goNext, index };
}

/* ---------- UI helpers ---------- */
function cn(...xs: (string | false | null | undefined)[]) { return xs.filter(Boolean).join(" "); }

/* ---------- Rails ---------- */
function LeftNavDesktop() {
    return (
        <aside className="hidden lg:flex xl:w-[260px] lg:w-[220px] shrink-0 sticky top-0 h-screen flex-col border-r"
            style={{ borderColor: EKARI.hair }}>
            <div className="px-4 py-5">
                <Link href="/" className="inline-flex items-center gap-2">
                    <Image src="/ekarihub-logo.png" alt="Ekarihub" width={140} height={36} />
                </Link>
            </div>
            <nav className="px-2 space-y-1 text-[15px]">
                <NavItem icon={<IoHome />} label="Deeds" href="/deeds" />
                <NavItem icon={<IoCompassOutline />} label="Dive" href="/dive" />
                <NavItem icon={<IoPeopleOutline />} label="Following" href="/following" />
                <NavItem icon={<IoCloudUploadOutline />} label="Upload" href="/upload" />
                <NavItem icon={<IoNotificationsOutline />} label="Notifications" href="/notifications" />
                <NavItem icon={<IoChatbubbleOutline />} label="Bonga" href="/bonga" />
                <NavItem icon={<IoTvOutline />} label="LIVE" href="/live" />
                <div className="pt-2">
                    <NavItem icon={<IoPersonCircleOutline />} label="Profile" href="/profile" />
                    <NavItem icon={<IoEllipsisHorizontal />} label="More" href="/more" />
                </div>
            </nav>
            <div className="mt-auto p-4 text-xs" style={{ color: EKARI.subtext }}>
                © {new Date().getFullYear()} Ekarihub
            </div>
        </aside>
    );
}

function LeftRailCompact() {
    return (
        <aside className="lg:hidden sticky top-0 h-screen w-[54px] shrink-0 border-r flex flex-col items-center py-3 gap-4"
            style={{ borderColor: EKARI.hair }}>
            <Link href="/" className="mt-1">
                <Image src="/ekarihub-logo.png" alt="logo" width={22} height={22} />
            </Link>
            <RailIcon icon={<IoSearch />} label="Search" />
            <RailIcon icon={<IoHome />} label="Home" active />
            <RailIcon icon={<IoCompassOutline />} label="Explore" />
            <RailIcon icon={<IoPeopleOutline />} label="Following" />
            <RailIcon icon={<IoCloudUploadOutline />} label="Upload" />
            <RailIcon icon={<IoNotificationsOutline />} label="Inbox" badge="10" />
            <RailIcon icon={<IoTvOutline />} label="LIVE" />
            <div className="mt-auto mb-2" />
        </aside>
    );
}

function RailIcon(
    { icon, label, badge, active = false }:
        { icon: React.ReactNode; label: string; badge?: string; active?: boolean }
) {
    return (
        <button className="relative flex flex-col items-center gap-1 text-[22px] hover:opacity-80" aria-label={label}>
            {icon}
            {badge && <span className="absolute -right-1 -top-1 text-[10px] rounded-full bg-red-500 text-white px-1">{badge}</span>}
            <span className={cn("text-[10px] leading-3", active && "font-bold")} style={{ color: EKARI.subtext }}>
                {label}
            </span>
        </button>
    );
}

function NavItem({ icon, label, href, active = false }: { icon: React.ReactNode; label: string; href: string; active?: boolean }) {
    return (
        <Link href={href} className={cn("w-full flex items-center gap-3 rounded-lg px-3 py-2", active ? "font-bold bg-gray-50" : "font-medium", "hover:bg-gray-50")}
            style={{ color: EKARI.text }}>
            <span className="text-[20px]">{icon}</span><span>{label}</span>
        </Link>
    );
}

function RightRail() {
    return (
        <aside className="hidden xl:flex sticky top-0 h-screen w-[320px] shrink-0 border-l" style={{ borderColor: EKARI.hair }}>
            <div className="p-4 w-full">
                <h3 className="font-extrabold mb-3" style={{ color: EKARI.text }}>Suggested accounts</h3>
                <div className="space-y-2">
                    {["@dairy.coop", "@machinery.ke", "@horti.africa"].map((h) => (
                        <div key={h} className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-gray-200" />
                            <div>
                                <div className="text-sm font-bold" style={{ color: EKARI.text }}>{h}</div>
                                <div className="text-xs" style={{ color: EKARI.subtext }}>Follows you</div>
                            </div>
                            <button className="ml-auto rounded-full border px-3 py-1 text-xs font-bold hover:bg-gray-50" style={{ borderColor: EKARI.hair }}>
                                Follow
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}

/* ---------- Action rails ---------- */
function ActionRail({ liked, count, onLike }: {
    liked: boolean; count: number; onLike: () => void;
}) {
    const Btn = ({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) => (
        <button
            aria-label={label}
            onClick={onClick}
            className="rounded-full bg-white text-gray-900 shadow-md hover:shadow-lg hover:scale-105 transition p-3"
        >
            {children}
        </button>
    );

    return (
        <div className="absolute z-10 md:flex md:flex-col md:items-center md:gap-4 md:-right-[84px] md:top-1/2 md:-translate-y-1/2 hidden">
            <Btn label="Like" onClick={onLike}><IoHeart className={liked ? "fill-red-500 text-red-500" : ""} size={22} /></Btn>
            <div className="text-[11px] font-semibold text-gray-700 text-center">{count}</div>
            <Btn label="Comments"><IoChatbubble size={22} /></Btn>
            <div className="text-[11px] font-semibold text-gray-700 text-center">—</div>
            <Btn label="Save"><IoBookmarkOutline size={22} /></Btn>
            <div className="text-[11px] font-semibold text-gray-700 text-center">—</div>
            <Btn label="Share"><IoShareOutline size={22} /></Btn>
            <div className="mt-2 hidden md:flex flex-col items-center text-gray-600">
                <IoChevronUp /><IoChevronDown />
            </div>
        </div>
    );
}

function ActionRailMobile({ liked, onLike }: { liked: boolean; onLike: () => void }) {
    const Btn = ({ children, label, onClick }: { children: React.ReactNode; label: string; onClick?: () => void }) => (
        <button aria-label={label} onClick={onClick} className="rounded-full bg-white/95 text-gray-900 shadow p-2.5">
            {children}
        </button>
    );
    return (
        <div className="md:hidden absolute right-3 bottom-3 z-10 flex items-center gap-2">
            <Btn label="Like" onClick={onLike}><IoHeart className={liked ? "fill-red-500 text-red-500" : ""} size={20} /></Btn>
            <Btn label="Comments"><IoChatbubble size={20} /></Btn>
            <Btn label="Save"><IoBookmarkOutline size={20} /></Btn>
            <Btn label="Share"><IoShareOutline size={20} /></Btn>
        </div>
    );
}

/* ---------- Feed Card ---------- */
function VideoCard({
    item,
    uid,
    scrollRootRef,
}: {
    item: Item;
    uid?: string;
    scrollRootRef: React.RefObject<Element | null>;
}) {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const { muted, toggleMute, registerVideo, unregisterVideo } = useGlobalMute();

    useAutoPlay(videoRef, { root: scrollRootRef, threshold: 0.35, rootMargin: "-30% 0px -30% 0px", initialMuted: muted });
    useHls(videoRef, item.mediaUrl || undefined);

    React.useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        registerVideo(v);
        return () => { unregisterVideo(v); };
    }, [registerVideo, unregisterVideo]);

    React.useEffect(() => {
        if (videoRef.current) videoRef.current.muted = muted;
    }, [muted]);

    const avatar = item.authorPhotoURL || "/avatar-blank.png";
    const { liked, count, toggle } = useLikes(item.id, uid);

    const [playing, setPlaying] = React.useState(false);
    React.useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        v.addEventListener("play", onPlay);
        v.addEventListener("pause", onPause);
        return () => { v.removeEventListener("play", onPlay); v.removeEventListener("pause", onPause); };
    }, []);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (playing) pauseIfCurrent(v);
        else playExclusive(v);
    };

    return (
        <div className="relative">
            <article
                className="
          group relative overflow-hidden rounded-2xl border bg-black shadow-[0_8px_30px_rgba(0,0,0,.12)]
          aspect-[9/16] max-h-[98vh] sm:max-h-[92vh]
        "
            >
                {/* Top overlay controls (GLOBAL mute toggle here) */}
                {item.mediaType === "video" && (<>
                    <div className="absolute left-2 top-2 z-20 flex items-center gap-2">
                        <button
                            onClick={toggleMute}
                            aria-label={muted ? "Unmute video (global)" : "Mute video (global)"}
                            className="rounded-full bg-black/40 text-white p-2 hover:bg-black/70"
                        >
                            {muted ? <IoVolumeMute size={18} /> : <IoVolumeHigh size={18} />}
                        </button>
                    </div>
                    <button
                        onClick={togglePlay}
                        aria-label={playing ? "Pause video" : "Play video"}
                        className={[
                            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20",
                            "rounded-full bg-black/40 text-white p-4 md:p-5 shadow-lg hover:bg-black/75",
                            "backdrop-blur-sm transition-opacity",
                            playing ? "opacity-0 group-hover:opacity-100" : "opacity-100",
                        ].join(" ")}
                    >
                        {playing ? <IoPause size={28} /> : <IoPlay size={28} />}
                    </button>
                </>)}

                {item.mediaType === "video" && item.mediaUrl ? (
                    <video
                        ref={videoRef}
                        poster={item.posterUrl}
                        playsInline
                        loop
                        controlsList="nodownload noremoteplayback"
                        preload="metadata"
                        className="h-full w-full object-cover"
                        onClick={togglePlay}
                    />
                ) : item.mediaType === "photo" && item.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.mediaUrl} alt={item.text || "photo"} className="h-full w-full object-cover" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/90">No media</div>
                )}

                {/* Mobile rail */}
                <ActionRailMobile liked={liked} onLike={toggle} />

                {/* Bottom gradient + author/caption */}
                <div className="absolute left-0 right-0 bottom-0 p-3 sm:p-4 bg-gradient-to-t from-black/70 to-black/0">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={avatar} alt={item.authorUsername || item.authorId} className="h-full w-full object-cover" />
                        </div>
                        <div className="text-white/95 font-bold text-sm">
                            {item.authorUsername ? `@${item.authorUsername}` : item.authorId?.slice(0, 6)}
                        </div>
                        <button
                            className="ml-auto rounded-full border px-3 py-1 text-xs font-bold text-white/95 hover:bg-white/10"
                            style={{ borderColor: "rgba(255,255,255,.6)" }}
                        >
                            Follow
                        </button>
                    </div>
                    {!!item.text && <p className="text-white/95 text-sm leading-5 line-clamp-3">{item.text}</p>}
                </div>
            </article>

            {/* Desktop side rail */}
            <ActionRail liked={liked} count={count} onLike={toggle} />
        </div>
    );
}

/* ---------- Page ---------- */
export default function DeedsPage() {
    const { user } = useAuth();                 // ✅ SSR-safe auth
    const uid = user?.uid;
    const { items, loading } = useFeed(uid);
    const scrollerRef = React.useRef<HTMLDivElement>(null);

    // one-item step scrolling + API for buttons
    const { goPrev, goNext, index } =
        useStepScroll(scrollerRef as unknown as React.RefObject<HTMLElement>, () => items.length);

    const atTop = index <= 0;
    const atEnd = index >= Math.max(0, items.length - 1);

    return (
        <MuteProvider>
            <div className="min-h-screen" style={{ backgroundColor: EKARI.bg }}>
                <div className="mx-auto max-w-[1400px] flex">
                    <LeftRailCompact />
                    <LeftNavDesktop />

                    <main className="flex-1 mt-10 flex justify-center">
                        <section
                            ref={scrollerRef}
                            tabIndex={0}
                            className="w-full flex flex-col items-center gap-0 overflow-y-auto scroll-smooth outline-none"
                            style={{
                                height: "100svh",
                                scrollSnapType: "y mandatory",
                                overscrollBehaviorY: "contain",
                            }}
                        >
                            {loading && (
                                <div className="py-10 text-sm" style={{ color: EKARI.subtext }}>
                                    Loading deeds…
                                </div>
                            )}
                            {!loading && items.length === 0 && (
                                <div className="py-10 text-sm" style={{ color: EKARI.subtext }}>
                                    No posts yet.
                                </div>
                            )}

                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="h-[100svh] mb-10 w-full flex items-center justify-center"
                                    style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
                                >
                                    <VideoCard item={item} uid={uid} scrollRootRef={scrollerRef} />
                                </div>
                            ))}
                        </section>
                    </main>

                    <RightRail />
                </div>

                {/* Up/Down scroll buttons (TikTok-style) */}
                <div className="fixed right-3 md:right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 md:gap-3">
                    <button
                        onClick={goPrev}
                        disabled={atTop}
                        aria-label="Previous"
                        className="rounded-full border border-gray-200 bg-white/95 shadow p-2 md:p-3 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
                    >
                        <IoChevronUp size={18} />
                    </button>
                    <button
                        onClick={goNext}
                        disabled={atEnd}
                        aria-label="Next"
                        className="rounded-full border border-gray-200 bg-white/95 shadow p-2 md:p-3 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
                    >
                        <IoChevronDown size={18} />
                    </button>
                </div>

                {/* Mobile FAB */}
                <button
                    className="lg:hidden fixed right-4 bottom-4 rounded-full shadow-md p-3 text-white"
                    style={{ backgroundColor: EKARI.primary }}
                    aria-label="Upload"
                >
                    <IoAdd size={22} />
                </button>
            </div>
        </MuteProvider>
    );
}
