"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  IoHeart,
  IoChatbubble,
  IoAdd,
  IoChevronUp,
  IoChevronDown,
  IoVolumeHigh,
  IoVolumeMute,
  IoPlay,
  IoPause,
  IoArrowRedo,
  IoBookmark,
  IoSearchCircleOutline,
  IoSearch,
  IoCompass,
  IoCompassOutline,
  IoTelescopeOutline,
  IoLogoUsd,
  IoMusicalNotesOutline,
  IoExpandOutline,
  IoClose,
} from "react-icons/io5";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  documentId,
  serverTimestamp,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "@/lib/firebase";
import { useAuth } from "./hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import RightRail from "@/app/components/RightRail";
import UserAvatarMenu from "./components/UserAvatarMenu";
import LoginButton from "./components/LoginButton";

// 🔗 single source of truth for deed data
import { PlayerItem, toPlayerItem } from "@/lib/fire-queries";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { DonateDialogWeb } from "./components/DonateDialogWeb";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

/* ---------- Theme ---------- */
const THEME = { forest: "#233F39", gold: "#C79257", white: "#FFFFFF" };
const EKARI = {
  bg: "#ffffff",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
  primary: "#C79257",
};

/* ---------- Channels ---------- */
type TabKey = "forYou" | "following" | "nearby";
const TABS: TabKey[] = ["forYou", "following", "nearby"];
const LABEL: Record<TabKey, string> = { forYou: "For You", following: "Following", nearby: "Nearby" };

/* ---------- Visibility check (kept from your current file) ---------- */
type Visibility = "public" | "followers" | "private";

const canSee = (
  item: PlayerItem,
  uid?: string,
  following: Set<string> = new Set()
): boolean => {
  const v = (item.visibility ?? "public") as Visibility;
  if (v === "public") return true;
  if (!uid) return false;
  if (item.authorId === uid) return true;
  if (v === "followers") return following.has(item.authorId);
  return false;
};

function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0) + "K";
  return String(n);
}

/* ---------- Following (reused) ---------- */
function useFollowing(uid?: string) {
  const [following, setFollowing] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!uid) {
      setFollowing(new Set());
      return;
    }
    const qF = query(collection(db, "follows"), where("followerId", "==", uid));
    const unsub = onSnapshot(
      qF,
      (snap) => {
        const s = new Set<string>();
        snap.forEach((d) => {
          const x = d.data() as any;
          if (x?.followingId) s.add(x.followingId as string);
        });
        setFollowing(s);
      },
      () => setFollowing(new Set())
    );
    return () => unsub();
  }, [uid]);
  return following;
}

/* ---------- Public For You (logged-out fallback) ---------- */
async function fetchPublicForYou(limitCount = 30) {
  try {
    const qRef = query(
      collection(db, "deeds"),
      where("visibility", "==", "public"),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(qRef);
    const rows: PlayerItem[] = [];
    snap.forEach((d) => {
      const it = toPlayerItem(d.data(), d.id);
      if (it && it.visibility === "public") rows.push(it);
    });
    return rows;
  } catch {
    return [];
  }
}
function useProgressIndicator(isLoading: boolean, minMs = 300, delayMs = 120) {
  // shows after a short delay (avoid flicker) and stays visible for a minimum time
  const [show, setShow] = React.useState(false);
  const startRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (isLoading) {
      const t = setTimeout(() => {
        startRef.current = Date.now();
        setShow(true);
      }, delayMs);
      return () => clearTimeout(t);
    } else {
      if (!show) return;
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      const wait = Math.max(0, minMs - elapsed);
      const t = setTimeout(() => {
        setShow(false);
        startRef.current = null;
      }, wait);
      return () => clearTimeout(t);
    }
  }, [isLoading, delayMs, minMs, show]);

  return show;
}

function TopLoader({ active, color = "#233F39" }: { active: boolean; color?: string }) {
  if (!active) return null;
  return (
    <div className="absolute left-0 right-0 bottom-0 h-[3px] overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color, width: "33%" }}
        initial={{ x: "-100%" }}
        animate={{ x: ["-100%", "50%", "200%"] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ---------- Server feeds (same contract as mobile) ---------- */
async function fetchServerFeed(surface: TabKey, uid?: string) {
  if (!uid) return []; // extra guard

  try {
    const feedDocRef = doc(db, `feeds/${uid}/surfaces/${surface}`);
    const feedSnap = await getDoc(feedDocRef);

    const now = Date.now();
    let ids: string[] | null = null;

    // 1) Try cache with TTL
    if (feedSnap.exists()) {
      const d = feedSnap.data() as any;
      console.log("[feed] feedSnap data", { surface, uid, d });

      const ttlSec = Number(d?.ttlSec ?? 60);
      const updatedAtMs =
        typeof d?.updatedAt?.toMillis === "function"
          ? d.updatedAt.toMillis()
          : 0;
      const fresh = updatedAtMs && now - updatedAtMs < ttlSec * 1000;

      if (fresh && Array.isArray(d.ids) && d.ids.length > 0) {
        ids = d.ids as string[];
      }
    }

    // 2) If no fresh ids, call refreshFeed and WAIT for it
    if (!ids) {
      const functions = getFunctions(app, "us-central1"); // set region if needed
      const refreshFeed = httpsCallable<
        { surface: TabKey },
        { ids: string[] }
      >(functions, "refreshFeed");

      console.log("[feed] calling refreshFeed", { surface, uid });

      const res = await refreshFeed({ surface });
      ids = (res.data?.ids || []).filter(Boolean);

      console.log("[feed] refreshFeed result", { surface, uid, ids });
    }

    if (!ids || !ids.length) {
      console.log("[feed] no ids for surface", surface, "uid", uid);
      return [];
    }

    // 3) Fetch deeds for these ids
    const base = collection(db, "deeds");
    const docs: { id: string; data: any }[] = [];

    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const qs = await getDocs(query(base, where(documentId(), "in", batch)));
      qs.forEach((d) => docs.push({ id: d.id, data: d.data() }));
    }

    const map = new Map(docs.map((x) => [x.id, x.data]));

    // 4) Map to PlayerItem[]
    return ids
      .map((id) => toPlayerItem(map.get(id), id))
      .filter(Boolean) as PlayerItem[];
  } catch (err) {
    console.error("[feed] error", err);
    return [];
  }
}




/* ---------- Likes / Comments / Bookmarks / Shares (unchanged) ---------- */
function useLikes(itemId: string, uid?: string) {
  const likeId = uid ? `${itemId}_${uid}` : undefined;
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let unsubSelf = () => { };
    if (likeId) unsubSelf = onSnapshot(doc(db, "likes", likeId), (s) => setLiked(s.exists()));
    const unsubCount = onSnapshot(
      query(collection(db, "likes"), where("deedId", "==", itemId)),
      (s) => setCount(s.size)
    );
    return () => {
      unsubSelf();
      unsubCount();
    };
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

function useCommentsCount(itemId: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const qC = query(collection(db, "comments"), where("deedId", "==", itemId));
    const unsub = onSnapshot(qC, (s) => setCount(s.size));
    return () => unsub();
  }, [itemId]);
  return count;
}

function useBookmarks(itemId: string, uid?: string) {
  const bookmarkId = uid ? `${itemId}_${uid}` : undefined;
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!bookmarkId) {
      setSaved(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "bookmarks", bookmarkId), (s) => setSaved(s.exists()));
    return () => unsub();
  }, [bookmarkId]);

  const toggle = async () => {
    if (!uid || !bookmarkId) return;
    const ref = doc(db, "bookmarks", bookmarkId);
    const s = await getDoc(ref);
    if (s.exists()) await deleteDoc(ref);
    else
      await setDoc(ref, {
        deedId: itemId,
        userId: uid,
        createdAt: serverTimestamp(),
      });
  };

  return { saved, toggle };
}

function useBookmarkTotalFromDeed(itemId: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "deeds", itemId), (s) => {
      const data = s.data() as any;
      const saves = Number(data?.stats?.saves ?? 0);
      setCount(Number.isFinite(saves) ? saves : 0);
    });
    return () => unsub();
  }, [itemId]);
  return count;
}

function useShareTotalFromDeed(itemId: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "deeds", itemId), (s) => {
      const data = s.data() as any;
      const shares = Number(data?.stats?.shares ?? 0);
      setCount(Number.isFinite(shares) ? shares : 0);
    });
    return () => unsub();
  }, [itemId]);
  return count;
}

function useFollowAuthor(authorId?: string, uid?: string) {
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const followDocId = uid && authorId ? `${uid}_${authorId}` : undefined;

  useEffect(() => {
    let unsubSelf = () => { };
    if (followDocId) {
      unsubSelf = onSnapshot(doc(db, "follows", followDocId), (s) => setFollowing(s.exists()));
    }
    if (!authorId) return () => unsubSelf();
    const unsubCount = onSnapshot(
      query(collection(db, "follows"), where("followingId", "==", authorId)),
      (s) => setFollowersCount(s.size)
    );
    return () => {
      unsubSelf();
      unsubCount();
    };
  }, [followDocId, authorId]);

  const toggle = async () => {
    if (!uid || !authorId || !followDocId) return;
    if (uid === authorId) return;
    const ref = doc(db, "follows", followDocId);
    const s = await getDoc(ref);
    if (s.exists()) await deleteDoc(ref);
    else await setDoc(ref, { followerId: uid, followingId: authorId, createdAt: Date.now() });
  };

  return { following, followersCount, toggle };
}

/* ---------- Video helpers (unchanged) ---------- */
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

function useHls(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  src?: string | null,
  opts: { maxHeight?: number } = {}
) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isHls = src.endsWith(".m3u8");
    if (!isHls) {
      (video as any).src = src;
      return;
    }

    // Native HLS (Safari / some iOS)
    if (video.canPlayType("application/vnd.apple.mpegURL")) {
      (video as any).src = src;
      return;
    }

    let hls: any;
    let HlsMod: any;

    (async () => {
      const mod = await import("hls.js");
      const Hls = mod.default;
      HlsMod = Hls;
      if (Hls?.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          capLevelToPlayerSize: true, // don’t go above player size
        });

        hls.loadSource(src);
        hls.attachMedia(video);

        // 🔒 Clamp max resolution if requested
        // 🔒 Clamp max resolution if requested
        const maxHeight = opts.maxHeight; // 👈 capture once
        if (typeof maxHeight === "number") {
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const levels = hls.levels || [];
            let capIndex = -1;

            for (let i = 0; i < levels.length; i++) {
              const h = levels[i]?.height || 0;
              if (h <= maxHeight && i > capIndex) {
                capIndex = i;
              }
            }

            if (capIndex >= 0) {
              // Limit ABR to this level index (0..N)
              hls.autoLevelCapping = capIndex;
            }
          });
        }
      } else {
        (video as any).src = src;
      }
    })();

    return () => {
      try {
        hls?.destroy?.();
      } catch { }
    };
  }, [videoRef, src, opts.maxHeight]);
}

// ⬇️ Add this AFTER useHls definition

function VideoPreload({
  src,
  poster,
}: {
  src: string;
  poster?: string | null;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Re-use existing HLS wiring for .m3u8 sources
  useHls(videoRef, src);

  return (
    <video
      ref={videoRef}
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
  items,
  activeIndex,
  mode = "light",
}: {
  items: PlayerItem[];
  activeIndex: number;
  mode?: PreloadMode;
}) {
  if (mode === "none") return null;

  const candidates: PlayerItem[] = [];

  const pushIfVideo = (it?: PlayerItem) => {
    if (it && it.mediaType === "video" && it.mediaUrl) {
      candidates.push(it);
    }
  };

  if (mode === "light") {
    // 🔍 Only preload the *next* card
    pushIfVideo(items[activeIndex + 1]);
  } else {
    // 🚀 Aggressive: prev/next and +/-2
    pushIfVideo(items[activeIndex + 1]);
    pushIfVideo(items[activeIndex - 1]);
    pushIfVideo(items[activeIndex + 2]);
    pushIfVideo(items[activeIndex - 2]);
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
        <VideoPreload
          key={`preload_${it.id}`}
          src={it.mediaUrl!}
          poster={it.posterUrl}
        />
      ))}
    </div>
  );
}


function useAutoPlay(
  ref: React.RefObject<HTMLVideoElement | null>,
  opts: {
    root?: React.RefObject<Element | null>;
    threshold?: number;
    rootMargin?: string;
    initialMuted?: boolean;
  } = {}
) {
  const { root, threshold = 0.35, rootMargin = "-30% 0px -30% 0px", initialMuted } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof initialMuted === "boolean") (el as any).muted = initialMuted;
    (el as any).playsInline = true;
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

    const onVis = () => {
      if (document.hidden) deactivate();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      el.removeEventListener("loadedmetadata", onLoaded);
      document.removeEventListener("visibilitychange", onVis);
      if (CURRENT_PLAYING === el) CURRENT_PLAYING = null;
    };
  }, [ref, root, threshold, rootMargin, initialMuted]);
}

/* ---------- GLOBAL MUTE PROVIDER (unchanged) ---------- */
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
  const [muted, setMutedState] = useState(true);
  const videos = useRef(new Set<HTMLVideoElement>());
  const applyToAll = React.useCallback((m: boolean) => {
    videos.current.forEach((v) => {
      (v as any).muted = m;
    });
    CURRENT_PLAYING?.play().catch(() => { });
  }, []);
  const setMutedAndApply = React.useCallback(
    (m: boolean) => {
      setMutedState(m);
      applyToAll(m);
    },
    [applyToAll]
  );
  const toggleMute = React.useCallback(() => {
    setMutedState((prev) => {
      const next = !prev;
      applyToAll(next);
      return next;
    });
  }, [applyToAll]);
  const registerVideo = React.useCallback(
    (el: HTMLVideoElement) => {
      videos.current.add(el);
      (el as any).muted = muted;
    },
    [muted]
  );
  const unregisterVideo = React.useCallback((el: HTMLVideoElement) => {
    videos.current.delete(el);
  }, []);
  const value = React.useMemo(
    () => ({ muted, toggleMute, setMuted: setMutedAndApply, registerVideo, unregisterVideo }),
    [muted, toggleMute, setMutedAndApply, registerVideo, unregisterVideo]
  );
  return <MuteContext.Provider value={value}>{children}</MuteContext.Provider>;
}

/* ---------- UI helpers ---------- */
function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- Skeleton ---------- */
/* ---------- Skeleton (same size as VideoCard) ---------- */
function SkeletonCard({
  railOpen,
  tabOffsetPx = 0,
}: {
  railOpen: boolean;
  tabOffsetPx?: number;
}) {
  const { w: cardW, h: cardH } = useDeedBox(railOpen, tabOffsetPx);

  return (
    <div className="relative mt-1 mb-1">
      <article
        className="relative w-full lg:w-[400px] overflow-hidden rounded-[28px] bg-black shadow-[0_22px_60px_rgba(0,0,0,.12)]"
        style={{ height: cardH, top: tabOffsetPx - 5 }}
      >

      </article>
    </div>
  );
}


/* ---------- VideoCard (unchanged UI; only data source varies) ---------- */
function VideoCard({
  item,
  uid,
  scrollRootRef,
  onFirstFrame,
  onOpenComments,
  railOpen,
  tabOffsetPx = 0,
  dataSaverOn,
  hlsMaxHeight,
}: {
  item: PlayerItem;
  uid?: string;
  scrollRootRef: React.RefObject<Element | null>;
  onFirstFrame?: () => void;
  onOpenComments: (deedId: string) => void;
  railOpen: boolean;
  tabOffsetPx?: number;
  dataSaverOn?: boolean;
  hlsMaxHeight?: number;
}) {
  const { w: cardW, h: cardH } = useDeedBox(railOpen, tabOffsetPx);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const { muted, toggleMute, registerVideo, unregisterVideo } = useGlobalMute();
  const router = useRouter();
  const authorProfile = useAuthorProfile(item.authorId);
  const [mediaReady, setMediaReady] = useState(item.mediaType !== "video");
  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");
  const firstFrameFiredRef = useRef(false);
  // 🔥 NEW: fullscreen video ref + state
  // 🔥 NEW: fullscreen media
  const fsVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenKind, setFullscreenKind] = useState<"video" | "photo" | null>(null);
  const { liked, count: likeCount, toggle: toggleLike } = useLikes(item.id, uid);
  const commentsCount = useCommentsCount(item.id);
  const { saved, toggle: toggleSave } = useBookmarks(item.id, uid);
  const totalBookmarks = useBookmarkTotalFromDeed(item.id);
  const totalShares = useShareTotalFromDeed(item.id);
  const { following, followersCount, toggle: toggleFollow } = useFollowAuthor(
    item.authorId,
    uid
  );
  const [donateOpen, setDonateOpen] = useState(false);

  const canSupport = !!item.authorId && uid !== item.authorId;

  const onSupportClick = () => {
    if (!uid) {
      router.push("login/?next=/");
      return;
    }
    setDonateOpen(true);
  };

  const onShare = async () => {
    const url = `${location.origin}/deed/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.text || "EkariHub",
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
    } catch { }
  };

  const onLikeClick = () => {
    if (!uid) {
      router.push("/getstarted?next=/");
      return;
    }
    toggleLike();
  };
  const onSaveClick = () => {
    if (!uid) {
      router.push("/getstarted?next=/");
      return;
    }
    toggleSave();
  };
  const onCommentsClick = () => {
    if (!uid) {
      router.push("/getstarted?next=/");
      return;
    }
    onOpenComments(item.id);
  };

  const onFollowClick = async () => {
    if (!uid) {
      router.push("/getstarted?next=/");
      return;
    }
    await toggleFollow();
  };

  const handleToPath = (h?: string) =>
    h ? `/${encodeURIComponent(h.startsWith("@") ? h : `@${h}`)}` : null;

  const onViewProfileClick = () => {
    const handle = authorProfile?.handle || item.authorUsername;
    const path = handleToPath(handle);
    if (!path) return;
    router.push(path);
  };

  const fireFirstFrameOnce = React.useCallback(() => {
    if (firstFrameFiredRef.current) return;
    firstFrameFiredRef.current = true;
    onFirstFrame?.();
  }, [onFirstFrame]);

  const handleVideoReady = () => {
    const v = videoRef.current;
    if (v && (v as any).videoWidth && (v as any).videoHeight) {
      setFitMode(
        (v as any).videoWidth > (v as any).videoHeight ? "contain" : "cover"
      );
    }
    setMediaReady(true);
    fireFirstFrameOnce();
  };

  const handleImageReady: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setFitMode(
        img.naturalWidth > img.naturalHeight ? "contain" : "cover"
      );
    }
    setMediaReady(true);
    fireFirstFrameOnce();
  };

  useAutoPlay(videoRef, {
    root: scrollRootRef,
    threshold: 0.35,
    rootMargin: "-30% 0px -30% 0px",
    initialMuted: muted,
  });
  useHls(videoRef, item.mediaUrl || undefined, { maxHeight: hlsMaxHeight });
  // 🔥 NEW: HLS for fullscreen element (only does work when open)
  // 🔥 HLS for fullscreen video only
  useHls(
    fsVideoRef,
    fullscreenOpen && fullscreenKind === "video"
      ? item.mediaUrl || undefined
      : undefined,
    { maxHeight: hlsMaxHeight }
  );

  // 🔥 Register fullscreen video with global mute when open
  useEffect(() => {
    if (!fullscreenOpen || fullscreenKind !== "video") return;

    const v = fsVideoRef.current;
    if (!v) return;

    registerVideo(v);
    (v as any).muted = muted;
    playExclusive(v);

    return () => {
      pauseIfCurrent(v);
      unregisterVideo(v);
    };
  }, [fullscreenOpen, fullscreenKind, registerVideo, unregisterVideo, muted]);

  // 🔥 Keep fullscreen video in sync with global mute
  useEffect(() => {
    if (!fullscreenOpen || fullscreenKind !== "video") return;
    const v = fsVideoRef.current;
    if (!v) return;
    (v as any).muted = muted;
  }, [muted, fullscreenOpen, fullscreenKind]);



  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    registerVideo(v);
    return () => {
      unregisterVideo(v);
    };
  }, [registerVideo, unregisterVideo]);

  useEffect(() => {
    if (videoRef.current) (videoRef.current as any).muted = muted;
  }, [muted]);

  const avatar =
    authorProfile?.photoURL ||
    item.authorPhotoURL ||
    "/avatar-placeholder.png";

  const music = item.music;
  const isLibrarySound = music?.source === "library" && !!music?.coverUrl;
  const soundLabel = isLibrarySound
    ? music?.title || "Library sound"
    : "Original sound";
  const soundAvatar = isLibrarySound ? (music?.coverUrl as string) : avatar;

  const [playing, setPlaying] = useState(false);

  // 🔥 Caption + hashtag logic (TikTok-style)
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const tags = useMemo(
    () => (item.tags ?? []).filter(Boolean),
    [item.tags]
  );

  const MAX_COLLAPSED_TAGS = 3;

  const hasCaption = !!item.text;
  const hasTags = tags.length > 0;

  const captionTooLong = (item.text?.length ?? 0) > 80;
  const tagsHidden = tags.length > MAX_COLLAPSED_TAGS;

  // what we actually render
  const visibleTags = captionExpanded ? tags : tags.slice(0, MAX_COLLAPSED_TAGS);

  // should we show "… more"/"less" at all?
  const showMoreToggle = captionTooLong || tagsHidden;

  // Reset expanded state when the card changes to a new deed
  useEffect(() => {
    setCaptionExpanded(false);
  }, [item.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) pauseIfCurrent(v!);
    else playExclusive(v!);
  };

  const showFollow = (!uid || uid !== item.authorId) && !following;

  return (
    <div className="relative mt-1 mb-1">
      <article
        className={cn(
          "group relative overflow-hidden rounded-[28px]",
          "shadow-[0_22px_60px_rgba(0,0,0,.65)]",
          "bg-gradient-to-b from-[#0B1513] via-black to-black",
          "transition-transform duration-300 ease-out",
          "md:hover:-translate-y-1 md:hover:shadow-[0_28px_80px_rgba(0,0,0,.85)]",
          "w-full lg:w-[375px]"
        )}
        style={{ top: tabOffsetPx - 5, height: cardH }}
      >
        {/* Loader overlay until mediaReady */}
        {!mediaReady && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <BouncingBallLoader />
          </div>
        )}

        {/* Top overlay controls */}
        {item.mediaType === "video" && (
          <>
            <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
              <button
                onClick={toggleMute}
                aria-label={
                  muted ? "Unmute video (global)" : "Mute video (global)"
                }
                className="rounded-full bg-black/40 text-white p-2 hover:bg-black/70 backdrop-blur-sm border border-white/20"
              >
                {muted ? <IoVolumeMute size={18} /> : <IoVolumeHigh size={18} />}
              </button>
            </div>
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause video" : "Play video"}
              className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20",
                "rounded-full bg-black/40 text-white p-4 md:p-5 shadow-lg hover:bg-black/75",
                "backdrop-blur-sm transition-opacity duration-200",
                playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
              )}
            >
              {playing ? <IoPause size={28} /> : <IoPlay size={28} />}
            </button>
          </>
        )}
        {/* 🔥 Fullscreen toggle for any media */}
        {item.mediaUrl && (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
            <button
              onClick={() => {
                if (item.mediaType === "video") {
                  const v = videoRef.current;
                  if (v) {
                    // pause inline video while fullscreen is open
                    pauseIfCurrent(v);
                  }
                  setFullscreenKind("video");
                } else if (item.mediaType === "photo") {
                  setFullscreenKind("photo");
                }
                setFullscreenOpen(true);
              }}
              aria-label="Fullscreen preview"
              title="Fullscreen"
              className="rounded-full bg-black/40 text-white p-2 hover:bg-black/70 backdrop-blur-sm border border-white/20"
            >
              <IoExpandOutline size={18} />
            </button>
          </div>
        )}


        {/* Media */}
        <div className="w-full h-full flex items-center justify-center bg-black">
          {item.mediaType === "video" && item.mediaUrl ? (
            <video
              ref={videoRef}
              poster={item.posterUrl}
              playsInline
              loop
              controlsList="nodownload noremoteplayback"
              preload={dataSaverOn ? "metadata" : "auto"}
              className={cn(
                "max-h-full max-w-full",
                fitMode === "contain" ? "object-contain" : "object-cover"
              )}
              onClick={togglePlay}
              onLoadedMetadata={handleVideoReady}
              onLoadedData={handleVideoReady}
              onCanPlay={handleVideoReady}
            />
          ) : item.mediaType === "photo" && item.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.mediaUrl}
              alt={item.text || "photo"}
              className={cn(
                "max-h-full max-w-full",
                fitMode === "contain" ? "object-contain" : "object-cover"
              )}
              onLoad={handleImageReady}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-white/90">
              No media
            </div>
          )}
        </div>

        {/* Bottom gradient + author/caption */}
        <div
          className={cn(
            "absolute left-0 right-0 bottom-0 p-3 sm:p-4",
            "bg-gradient-to-t from-black/80 via-black/40 to-transparent",
            "transition-opacity duration-200",
            mediaReady ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              onClick={onViewProfileClick}
              className={cn(
                "relative h-9 w-9 rounded-full overflow-hidden bg-gray-200 shrink-0",
                (authorProfile?.handle || item.authorUsername)
                  ? "cursor-pointer"
                  : "cursor-default"
              )}
              aria-label={
                authorProfile?.handle || item.authorUsername
                  ? `Open ${authorProfile?.handle || item.authorUsername
                  } profile`
                  : undefined
              }
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#C79257] via-transparent to-[#233F39] opacity-70" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt={
                  authorProfile?.handle ||
                  item.authorUsername ||
                  item.authorId ||
                  "author"
                }
                className="relative h-full w-full object-cover border border-white/30 rounded-full"
              />
            </div>
            <div
              onClick={onViewProfileClick}
              className="cursor-pointer min-w-0 flex flex-col"
            >
              <div className="text-white/95 font-bold text-sm truncate">

                {authorProfile?.handle
                  ? authorProfile.handle
                  : item.authorUsername
                    ? item.authorUsername
                    : (item.authorId ?? "").slice(0, 6)}
              </div>
              <div
                className="items-center text-white/70 text-[11px]"
                title={`${followersCount} Follower${followersCount === 1 ? "" : "s"
                  }`}
              >
                {formatCount(followersCount)} Follower
                {followersCount === 1 ? "" : "s"}
              </div>
            </div>

            {showFollow && (
              <button
                onClick={onFollowClick}
                className="ml-auto rounded-full px-3 py-1 text-xs font-bold text-[#ffffff] bg-[#C79257] hover:bg-[#FCD34D] shadow-sm"
                aria-label="Follow"
                title="Follow"
              >
                Follow
              </button>
            )}
          </div>

          {/* Caption + hashtags (TikTok-style) */}

          {/* Caption + hashtags (TikTok-style) */}
          {(hasCaption || hasTags) && (
            <motion.div
              className="mt-1 w-full"
              layout
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
            >
              {/* Caption with inline toggle at end of last line */}
              {hasCaption && (
                <div className="relative pb-1 w-full">
                  <motion.p
                    layout
                    className={cn(
                      "text-white/95 w-full text-sm leading-5 cursor-pointer",
                      captionExpanded ? "" : "line-clamp-2"
                    )}
                    onClick={() => setCaptionExpanded((v) => !v)}
                  >
                    {item.text}
                  </motion.p>


                </div>
              )}

              {/* Hashtag pills */}
              {hasTags && (
                <motion.div
                  layout
                  className="mt-1 w-full flex flex-wrap items-center gap-1.5"
                >
                  {visibleTags.map((tag: any) => (
                    <button
                      key={tag}
                      type="button"
                      className="px-2 py-0.5 rounded-full border border-white/30 bg-black/30 text-[11px] text-white font-semibold hover:bg-black/60 transition-colors"
                      onClick={() =>
                        router.push(
                          `/search?tag=${encodeURIComponent(tag)}&tab=Tags`
                        )
                      }

                    >
                      #{tag}
                    </button>
                  ))}
                  {showMoreToggle && (
                    <button
                      type="button"
                      onClick={() => setCaptionExpanded((v) => !v)}
                      className={cn(

                        "bg-gradient-to-l from-black via-black/80 to-transparent",
                        "pl-2 text-[11px] text-white/90 font-semibold"
                      )}
                    >
                      {captionExpanded ? "less" : "… more"}
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}




          {/* Sound row */}
          <div className="mt-2 flex items-center gap-2">
            {isLibrarySound && (
              <div className="h-5 w-5 rounded-full overflow-hidden bg-black/40 flex-shrink-0 border border-white/30">
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
              {!isLibrarySound && (
                <span className="hidden sm:inline opacity-80">
                  • Original sound
                </span>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* Action rail */}
      <div
        className={cn(
          "absolute z-10 flex flex-col items-center gap-1.5",
          "right-3 top-1/2 -translate-y-1/2",
          "md:right-[-72px]",
          "transition-opacity duration-200",
          mediaReady ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* support */}
        {canSupport && (
          <>
            <button
              aria-label="Uplift this deed"
              title="Uplift this deed"
              onClick={onSupportClick}
              className={cn(
                "h-11 w-11 md:h-12 md:w-12",
                "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition",
                "bg-black/40 md:bg-white/95 backdrop-blur-sm border border-white/30 md:border-gray-200"
              )}
            >
              💰
            </button>
            <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-900">
              Uplift
            </div>
          </>
        )}

        {/* Like */}
        <button
          aria-label="Like"
          aria-pressed={liked}
          onClick={onLikeClick}
          className={cn(
            "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition",
            "h-11 w-11 md:h-12 md:w-12",
            "bg-black/40 md:bg-white/95 backdrop-blur-sm border border-white/30 md:border-gray-200"
          )}
        >
          <IoHeart
            size={22}
            className="transition-colors"
            style={{
              color: likeCount ? THEME.forest : THEME.gold,
            }}
          />
        </button>
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-900">
          {formatCount(likeCount)}
        </div>

        {/* Comments */}
        <button
          aria-label="Comments"
          onClick={onCommentsClick}
          className={cn(
            "h-11 w-11 md:h-12 md:w-12",
            "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition",
            "bg-black/40 md:bg-white/95 backdrop-blur-sm border border-white/30 md:border-gray-200"
          )}
        >
          <IoChatbubble
            size={22}
            className="transition-colors"
            style={{
              color: commentsCount ? THEME.forest : THEME.gold,
            }}
          />
        </button>
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-900">
          {formatCount(commentsCount)}
        </div>

        {/* Save */}
        <button
          aria-label="Save"
          onClick={onSaveClick}
          className={cn(
            "h-11 w-11 md:h-12 md:w-12",
            "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition",
            "bg-black/40 md:bg-white/95 backdrop-blur-sm border border-white/30 md:border-gray-200"
          )}
        >
          <IoBookmark
            size={22}
            className="transition-colors"
            style={{
              color: totalBookmarks ? THEME.forest : THEME.gold,
            }}
          />
        </button>
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-900">
          {formatCount(totalBookmarks)}
        </div>

        {/* Share */}
        <button
          aria-label="Share"
          onClick={onShare}
          className={cn(
            "h-11 w-11 md:h-12 md:w-12",
            "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition",
            "bg-black/40 md:bg-white/95 backdrop-blur-sm border border-white/30 md:border-gray-200"
          )}
        >
          <IoArrowRedo
            size={22}
            className="transition-colors"
            style={{
              color: totalShares ? THEME.forest : THEME.gold,
            }}
          />
        </button>
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-900">
          {formatCount(totalShares)}
        </div>
      </div>
      {/* 🔥 Fullscreen preview overlay */}
      {/* 🔥 Fullscreen preview overlay for video & photo */}
      {fullscreenOpen && item.mediaUrl && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={() => {
              setFullscreenOpen(false);
              setFullscreenKind(null);
              // pause fullscreen video if open
              const v = fsVideoRef.current;
              if (v) pauseIfCurrent(v);
            }}
            className="absolute top-4 right-4 rounded-full bg-black/70 border border-white/30 p-2 text-white hover:bg-black/90"
            aria-label="Close fullscreen"
            title="Close"
          >
            <IoClose size={20} />
          </button>


          {/* Fullscreen VIDEO */}
          {fullscreenKind === "video" &&
            item.mediaType === "video" &&
            item.mediaUrl && (
              <video
                ref={fsVideoRef}
                poster={item.posterUrl || undefined}
                playsInline
                loop
                controls
                className="max-h-[92vh] max-w-[92vw] object-contain"
                // For non-HLS sources, let the element own src directly
                src={item.mediaUrl.endsWith(".m3u8") ? undefined : item.mediaUrl}
                onClick={(e) => {
                  const v = e.currentTarget;
                  if (v.paused) playExclusive(v);
                  else pauseIfCurrent(v);
                }}
              />
            )}

          {/* Fullscreen PHOTO */}
          {fullscreenKind === "photo" &&
            item.mediaType === "photo" &&
            item.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.mediaUrl}
                alt={item.text || "photo"}
                className="max-h-[92vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl"
              />
            )}
        </div>
      )}

      <DonateDialogWeb
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        deedId={item.id}
        creatorId={item.authorId}
        creatorName={item.authorUsername}
      />
    </div>
  );
}


/* ---------- Card sizing ---------- */
const CARD_ASPECT = 9 / 16;
const CARD_ASPECT_INV = 16 / 9;

function useDeedBox(railOpen: boolean, topOffsetPx = 0) {
  const [box, setBox] = React.useState<{ w: number; h: number }>({ w: 360, h: 640 });

  const recalc = React.useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const targetH = Math.max(320, vh - topOffsetPx); // ⬅️ subtract sticky tabs
    const targetW = Math.round(targetH * CARD_ASPECT);

    const railW = railOpen && vw >= 1024 ? 380 : 0;
    const sideGutter = vw >= 1024 ? 64 : 24;
    const usableW = Math.max(320, vw - railW - sideGutter * 2);

    if (targetW <= usableW) {
      setBox({ w: targetW, h: targetH });
    } else {
      const w = Math.floor(usableW);
      const h = Math.floor(w / CARD_ASPECT_INV);
      setBox({ w, h });
    }
  }, [railOpen, topOffsetPx]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  return box;
}


function itemHeight(root: HTMLElement | null) {
  if (!root) return window.innerHeight;
  const first = root.querySelector('[data-snap-item="1"]') as HTMLElement | null;
  return first?.offsetHeight ?? root.clientHeight;
}

function useIsDesktop() {
  const [is, setIs] = React.useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = () => setIs(mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return is;
}

function useUserProfile(uid?: string) {
  const [profile, setProfile] = useState<{
    handle?: string;
    photoURL?: string;
    dataSaverVideos?: boolean;
    uid?: string;
  } | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any | undefined;
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile({
        uid,
        handle: data?.handle,
        photoURL: data?.photoURL,
        dataSaverVideos: !!data?.dataSaverVideos,
      });
    });
    return () => unsub();
  }, [uid]);

  return profile;
}


type PreloadMode = "none" | "light" | "aggressive";

function useNetworkProfile() {
  const [state, setState] = useState<{
    effectiveType?: string;
    saveData?: boolean;
  }>({});

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const nav: any = navigator as any;
    const conn =
      nav.connection || nav.mozConnection || nav.webkitConnection || null;
    if (!conn) return;

    const update = () => {
      setState({
        effectiveType: conn.effectiveType,
        saveData: !!conn.saveData,
      });
    };

    update();
    conn.addEventListener?.("change", update);
    return () => conn.removeEventListener?.("change", update);
  }, []);

  return state;
}

/** 🔥 NEW: live author profile for each deed */
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
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile({
        handle: data?.handle,
        photoURL: data?.photoURL,
      });
    });

    return () => unsub();
  }, [authorId]);

  return profile;
}

/* ---------- Channelled Feed Shell ---------- */
function ChannelTabs({
  active,
  commentsId,
  railOffsetLg,
  railOffsetXl,
  profile,
  uid,
  onChange,
  dataSaverOn,
  userDataSaver,
  onToggleDataSaver,
}: {
  active: TabKey;
  railOffsetLg: string;
  railOffsetXl: string;
  commentsId: string;
  profile: any;
  uid: any;
  onChange: (k: TabKey) => void;
  dataSaverOn: boolean;
  userDataSaver: boolean;
  onToggleDataSaver: () => void;
}) {
  const router = useRouter();

  return (
    <div className="relative h-full flex items-center">
      <div className="mx-auto w-full px-3 flex items-center justify-center">
        <div
          className={cn(
            "flex w-full justify-center items-center gap-2",
            "overflow-x-auto no-scrollbar",
            commentsId ? "lg:mr-0" : "lg:mr-[100px]"
          )}
        >
          {/* Tabs pill group */}
          <div className="inline-flex items-center gap-1 rounded-full bg-white/80 border border-gray-200 shadow-sm px-1 py-1 backdrop-blur-md">
            {TABS.map((k) => {
              const isActive = active === k;
              return (
                <button
                  key={k}
                  onClick={() => onChange(k)}
                  className={cn(
                    "relative px-1 lg:px-3 py-1.5 text-xs lg:text-sm w-[60px] lg:w-[96px]",
                    "rounded-full font-semibold flex-shrink-0 flex items-center justify-center transition",
                    isActive
                      ? "bg-[#233F39] text-white shadow-sm"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <span className="relative z-10">{LABEL[k]}</span>
                </button>
              );
            })}
          </div>

          {/* Dive In */}
          <button
            onClick={() => router.push("/dive")}
            className="flex px-1 lg:px-3 py-1.5 text-xs lg:text-sm w-[85px] lg:w-[100px] gap-2 rounded-full items-center justify-center font-semibold border transition
                       bg-white/90 text-gray-800 border-gray-200 hover:bg-gray-50 flex-shrink-0 shadow-sm"
          >
            <IoTelescopeOutline />
            <span>Dive In</span>
          </button>

          {/* Search (desktop) */}
          <button
            onClick={() => router.push("/search")}
            className="hidden lg:inline-flex items-center justify-center rounded-full border border-gray-200 bg-white/90 hover:bg-gray-50 shadow-sm p-2 flex-shrink-0"
            aria-label="Search"
          >
            <IoSearch />
          </button>

          {/* Data saver pill */}
          <button
            type="button"
            onClick={onToggleDataSaver}
            disabled={!uid}
            className={cn(
              "ml-1 flex items-center gap-1 px-1.5 py-1.5 rounded-full border text-[11px] font-semibold flex-shrink-0 shadow-sm bg-white/90",
              dataSaverOn
                ? "text-emerald-700 border-emerald-200"
                : "text-gray-700 border-gray-200 hover:bg-gray-50"
            )}
            title={
              dataSaverOn
                ? "Data saver active – videos may preload less and cap resolution to save your data."
                : "Data saver off – videos can use higher resolution and more aggressive preloading."
            }
          >
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: dataSaverOn ? "#16A34A" : "#9CA3AF" }}
            />
            <span>Data saver</span>
          </button>
        </div>
      </div>
    </div>
  );
}



function useChannelFeed(tab: TabKey, uid?: string) {
  const following = useFollowing(uid);
  const [items, setItems] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "forYou") {
        if (!uid) {
          setItems(await fetchPublicForYou(40));
        } else {
          setItems(await fetchServerFeed("forYou", uid));
        }
      } else {
        if (!uid) {
          setItems([]); // gated
        } else {
          setItems(await fetchServerFeed(tab, uid));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [tab, uid]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (uid ? items.filter((it) => canSee(it, uid, following)) : items),
    [items, uid, following]
  );

  return { items: visible, loading, reload: load };
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

function FeedShell() {
  const { user } = useAuth();
  const uid = user?.uid;
  const profile = useUserProfile(uid);
  const { effectiveType, saveData } = useNetworkProfile();

  const userDataSaver = !!profile?.dataSaverVideos;
  const isVerySlow =
    effectiveType === "2g" || effectiveType === "slow-2g";
  const isFast =
    effectiveType === "4g" || effectiveType === "5g";
  const globalDataSaverOn = !!saveData;

  const dataSaverOn = userDataSaver || globalDataSaverOn || isVerySlow;

  const preloadMode: PreloadMode = dataSaverOn
    ? "none" // 🧵 user wants to save data or connection is very slow
    : isFast && !globalDataSaverOn
      ? "aggressive" // 💨 good connection, no data-saver → preload more neighbors
      : "light"; // default
  // 🎚 Clamp HLS resolution based on network/data saver
  let hlsMaxHeight: number | undefined;
  if (dataSaverOn || isVerySlow) {
    // super conservative: up to 480p
    hlsMaxHeight = 480;
  } else if (!isFast) {
    // mid-speed (3G-ish): allow up to 720p
    hlsMaxHeight = 720;
  } else {
    // fast 4G / Wi-Fi: no cap (full resolution)
    hlsMaxHeight = undefined;
  }

  const [tab, setTab] = useState<TabKey>("forYou");
  const { items, loading, reload } = useChannelFeed(tab, uid);
  const showTopLoader = useProgressIndicator(loading);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [commentsId, setCommentsId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  // gate changes
  const router = useRouter();
  // 🔄 Toggle user preference in Firestore
  const [updatingDataSaver, setUpdatingDataSaver] = useState(false);

  const toggleUserDataSaver = useCallback(async () => {
    if (!uid) {
      router.push("/getstarted?next=/");
      return;
    }
    if (updatingDataSaver) return;
    setUpdatingDataSaver(true);
    try {
      await setDoc(
        doc(db, "users", uid),
        { dataSaverVideos: !userDataSaver },
        { merge: true }
      );
    } catch (e) {
      console.warn("Failed to toggle dataSaverVideos", e);
    } finally {
      setUpdatingDataSaver(false);
    }
  }, [uid, router, userDataSaver, updatingDataSaver]);
  const changeTab = useCallback((k: TabKey) => {
    if (!uid && (k === "following" || k === "nearby")) {
      router.push("/getstarted?next=/");
      setTab("forYou");
      return;
    }
    setTab(k);
  }, [uid, router]);

  useEffect(() => {
    if (!isDesktop && commentsId) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [isDesktop, commentsId]);

  const openComments = useCallback((id: string) => setCommentsId(id), []);
  const closeComments = useCallback(() => setCommentsId(null), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeComments(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeComments]);

  // step scroll (unchanged)
  const { goPrev, goNext, index } = useStepScroll(
    scrollerRef as unknown as React.RefObject<HTMLElement>,
    () => items.length,
    true
  );
  useEffect(() => {
    if (!commentsId) return;
    const current = items[index];
    if (!current) return;
    if (current.id !== commentsId) setCommentsId(current.id);
  }, [index, items, commentsId]);

  const atTop = index <= 0;
  const atEnd = index >= Math.max(0, items.length - 1);

  const railOffsetLg = "lg:right-[0px]";
  const railOffsetXl = "xl:right-[0px]";

  const goUpload = () => {
    if (!uid) router.push("/getstarted?next=/studio/upload");
    else router.push("/studio/upload");
  };
  const TAB_BAR_H = 56; // px — tweak to taste
  return (
    <MuteProvider>
      <AppShell
        rightRail={
          <RightRail
            open={!!commentsId}
            mode="sidebar"
            deedId={commentsId ?? undefined}
            onClose={closeComments}
            currentUser={{
              uid: uid || undefined,
              photoURL: profile?.photoURL ?? user?.photoURL ?? undefined,
              handle: profile?.handle,
            }}
          />
        }
      >

        {/* Feed scroller */}
        <section
          ref={scrollerRef}
          tabIndex={0}
          className="w-full flex flex-col items-center gap-0 overflow-y-scroll no-scrollbar scroll-smooth outline-none"
          style={{
            height: "100svh",
            scrollSnapType: "y mandatory" as any,
            overscrollBehaviorY: "contain",
          }}
        >
          {/* Sticky translucent bar */}

          <div
            className="sticky p-0 top-0 z-30 w-full"
          // style={{ height: TAB_BAR_H }}
          >
            <div
              className="h-full w-full p-1 border-b backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(35,63,57,0.94), rgba(199,146,87,0.87))",
                borderColor: "rgba(15,23,42,0.18)",
                boxShadow: "0 16px 40px rgba(15,23,42,0.35)",
              }}
            >
              <ChannelTabs
                uid={uid}
                profile={profile}
                commentsId={commentsId ?? ""}
                railOffsetLg={railOffsetLg}
                railOffsetXl={railOffsetXl}
                active={tab}
                onChange={changeTab}
                dataSaverOn={dataSaverOn}
                userDataSaver={userDataSaver}
                onToggleDataSaver={toggleUserDataSaver}
              />
              <TopLoader active={showTopLoader} color="#FDE68A" />
            </div>
          </div>

          {showTopLoader && items.length === 0 && (
            <div
              data-snap-item="1"
              className={[
                "w-full flex items-center justify-center snap-start transition-[right] duration-200",
                commentsId ? "lg:mr-0" : "lg:mr-[100px]",
              ].join(" ")}
              style={{ height: `100svh`, scrollSnapStop: "always" }}
            >
              <SkeletonCard railOpen={!!commentsId} tabOffsetPx={TAB_BAR_H} />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="py-10 text-sm text-white/80">No deeds yet.</div>
          )}


          {items.map((item) => (
            <div
              key={item.id}
              data-snap-item="1"
              className={[
                "w-full flex items-center justify-center snap-start transition-[right] duration-200",
                commentsId ? "lg:mr-0" : "lg:mr-[100px]",
              ].join(" ")}
              style={{ height: `100svh`, scrollSnapStop: "always" }}
            >
              <VideoCard
                item={item}
                uid={uid}
                scrollRootRef={scrollerRef}
                onOpenComments={openComments}
                railOpen={!!commentsId}
                onFirstFrame={undefined}
                tabOffsetPx={TAB_BAR_H} // ⬅️ pass down (new prop)
                dataSaverOn={dataSaverOn}   // 👈 NEW
                hlsMaxHeight={hlsMaxHeight}
              />
            </div>
          ))}
        </section>

        {/* Up/Down steppers */}
        <div
          className={[
            "fixed right-3 md:right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 md:gap-3 transition-[right] duration-200",
            commentsId ? `${railOffsetLg} ${railOffsetXl}` : "right-3 md:right-4",
          ].join(" ")}
        >
          <button
            onClick={goPrev}
            disabled={atTop}
            aria-label="Previous"
            className="rounded-full border border-gray-200 bg-gray-200 shadow p-2 md:p-3 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
          >
            <IoChevronUp size={18} />
          </button>
          <button
            onClick={goNext}
            disabled={atEnd}
            aria-label="Next"
            className="rounded-full border border-gray-200 bg-gray-200 shadow p-2 md:p-3 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
          >
            <IoChevronDown size={18} />
          </button>
        </div>

        {/* Mobile upload FAB */}
        <button
          className="lg:hidden fixed right-4 bottom-4 rounded-full shadow-md p-3 text-white"
          style={{ backgroundColor: EKARI.primary }}
          aria-label="Upload"
          onClick={goUpload}
        >
          <IoAdd size={22} />
        </button>

        {/* Mobile comments overlay (same RightRail instance) */}
        <div
          className={[
            "lg:hidden fixed inset-0 z-[60] transition",
            commentsId ? "pointer-events-auto" : "pointer-events-none",
          ].join(" ")}
          aria-hidden={!commentsId}
        >
          <div
            className={[
              "absolute inset-0 backdrop-blur-[2px] transition-opacity",
              commentsId ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={closeComments}
          />
          <div
            className={[
              "absolute inset-x-0 bottom-0 max-h-[88vh] h-[80vh]",
              "rounded-t-2xl bg-white shadow-xl",
              "transition-transform duration-300 will-change-transform",
              commentsId ? "translate-y-0" : "translate-y-full",
            ].join(" ")}
            role="dialog"
            aria-modal="true"
          >
            <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-gray-300" />
            <RightRail
              open={!!commentsId}
              mode="sheet"
              deedId={commentsId ?? undefined}
              onClose={closeComments}
              currentUser={{
                uid: uid || undefined,
                photoURL: user?.photoURL,
                handle: profile?.handle,
              }}
            />
          </div>
        </div>

      </AppShell>
      <AdjacentPreloadWeb
        items={items}
        activeIndex={index}
        mode={preloadMode}
      />
    </MuteProvider>
  );
}

/* ---------- One-item step scrolling (unchanged) ---------- */
function useStepScroll(
  rootRef: React.RefObject<HTMLElement | null>,
  getCount: () => number,
  enabled = true
) {
  const lockRef = useRef(false);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const targetTopRef = useRef<number | null>(null);

  const step = () => itemHeight(rootRef.current);
  const isEditable = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) return true;
    if (el.closest('[role="textbox"]')) return true;
    return false;
  };
  const goToIndex = useCallback(
    (i: number) => {
      const root = rootRef.current;
      if (!root) return;
      const total = getCount();
      const clamped = Math.max(0, Math.min(total - 1, i));
      indexRef.current = clamped;
      setIndex(clamped);
      targetTopRef.current = clamped * step();
      (root as any).scrollTo({ top: targetTopRef.current, behavior: "smooth" });
    },
    [rootRef, getCount]
  );

  useEffect(() => {
    if (!enabled) return;
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
      if (isEditable(e.target)) return;
      const k = e.key;
      if (k === " " || k === "Spacebar" || e.code === "Space") {
        e.preventDefault();
        lockRef.current = true;
        goToIndex(indexRef.current + (e.shiftKey ? -1 : 1));
        return;
      }
      if (k === "ArrowDown" || k === "PageDown") {
        e.preventDefault();
        lockRef.current = true;
        goToIndex(indexRef.current + 1);
        return;
      }
      if (k === "ArrowUp" || k === "PageUp") {
        e.preventDefault();
        lockRef.current = true;
        goToIndex(indexRef.current - 1);
        return;
      }
    };

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = (root as any).scrollTop;
        const idx = Math.round(s / step());
        if (idx !== indexRef.current) {
          indexRef.current = idx;
          setIndex(idx);
        }
      });
    };

    let rafMon = 0;
    const monitor = () => {
      if (targetTopRef.current == null) {
        rafMon = requestAnimationFrame(monitor);
        return;
      }
      const diff = Math.abs((root as any).scrollTop - targetTopRef.current);
      if (diff < 2) {
        targetTopRef.current = null;
        lockRef.current = false;
      } else {
        rafMon = requestAnimationFrame(monitor);
      }
    };
    rafMon = requestAnimationFrame(monitor);

    indexRef.current = Math.round(((root as any).scrollTop) / step());
    setIndex(indexRef.current);

    (root as any).addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    (root as any).addEventListener("scroll", onScroll, { passive: true });

    return () => {
      (root as any).removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      (root as any).removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rafMon);
    };
  }, [rootRef, goToIndex, getCount, enabled]);

  useEffect(() => {
    const onResize = () => {
      const root = rootRef.current;
      if (!root) return;
      const i = Math.round(((root as any).scrollTop) / step());
      (root as any).scrollTo({ top: i * step() });
      indexRef.current = i;
      setIndex(i);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [rootRef]);

  const goPrev = useCallback(() => goToIndex(indexRef.current - 1), [goToIndex]);
  const goNext = useCallback(() => goToIndex(indexRef.current + 1), [goToIndex]);

  return { goPrev, goNext, index };
}

/* ---------- Root: Splash + decision + Feed ---------- */
// ...existing imports...
// nothing extra to import

// ...

/* ---------- Root: Splash + decision + Feed ---------- */
export default function RootPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const decidedRef = useRef(false);
  const [phase, setPhase] = useState<"splash" | "feed">("splash");

  // NEW: splash memory key (session-based)
  const SPLASH_KEY = "__ekari_splash_seen_v1__";
  const [splashSeen, setSplashSeen] = useState<boolean>(false);

  // Prefetch routes
  useEffect(() => {
    router.prefetch("/deeds");
    router.prefetch("/getstarted");
    router.prefetch("/studio/upload");
  }, [router]);

  // NEW: read session flag once on mount
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem(SPLASH_KEY) === "1";
      if (seen) {
        setSplashSeen(true);
        // IMPORTANT: skip splash immediately if already seen.
        setPhase("feed");
      }
    } catch {
      // ignore storage errors, fallback to splash
    }
  }, []);

  // Decide where to go (respect splashSeen)
  useEffect(() => {
    if (authLoading || decidedRef.current) return;

    (async () => {
      decidedRef.current = true;

      // Only delay for the actual first splash; if splashSeen, no delay.
      const minDelay = splashSeen ? Promise.resolve() : new Promise((r) => setTimeout(r, 600));

      let goFeed = true;
      try {
        if (user?.uid) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.exists() ? (snap.data() as { handle?: string }) : undefined;
          const hasHandle = typeof data?.handle === "string" && data.handle.trim().length > 0;
          if (!hasHandle) goFeed = false;
        }
      } catch (e) {
        console.error("[Splash] Firestore read error:", e);
        goFeed = true; // be permissive on errors
      }

      await minDelay;

      if (goFeed) {
        setPhase("feed");
      } else {
        router.replace("/getstarted");
      }

      // Mark splash as seen if this was the first time
      if (!splashSeen) {
        try {
          sessionStorage.setItem(SPLASH_KEY, "1");
          setSplashSeen(true);
        } catch {
          /* ignore */
        }
      }
    })();
  }, [authLoading, user?.uid, router, splashSeen]);

  if (phase === "splash" && !splashSeen) {
    // show only on true first load in this tab
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: THEME.forest }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 140, damping: 16, mass: 0.6 }}
        >
          <Image
            src="/ekarihub-logo-green.png"
            alt="ekarihub"
            width={320}
            height={86}
            onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/ekarihub-logo.png")}
            priority
          />
        </motion.div>
      </main>
    );
  }

  // If splashSeen (or decision finished), render feed shell
  return <FeedShell />;
}

