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
  IoPersonCircleOutline,
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

  forest: "#233F39",
  gold: "#C79257",
  // ...
};



/* ---------- Channels ---------- */
type TabKey = "forYou" | "following" | "nearby";
const TABS: TabKey[] = ["forYou", "following", "nearby"];
const LABEL: Record<TabKey, string> = {
  forYou: "For You",
  following: "Following",
  nearby: "Nearby",
};

/* ---------- Visibility check ---------- */
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
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0) + "K";
  return String(n);
}

/* ---------- Following ---------- */
function useFollowing(uid?: string) {
  const [following, setFollowing] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!uid) {
      setFollowing(new Set());
      return;
    }
    const qF = query(
      collection(db, "follows"),
      where("followerId", "==", uid)
    );
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
      const functions = getFunctions(app, "us-central1");
      const refreshFeed = httpsCallable<{ surface: TabKey }, { ids: string[] }>(
        functions,
        "refreshFeed"
      );

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

/* ---------- Likes / Comments / Bookmarks / Shares ---------- */
function useLikes(itemId: string, uid?: string) {
  const likeId = uid ? `${itemId}_${uid}` : undefined;
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let unsubSelf = () => { };
    if (likeId)
      unsubSelf = onSnapshot(doc(db, "likes", likeId), (s) =>
        setLiked(s.exists())
      );
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
    const qC = query(
      collection(db, "comments"),
      where("deedId", "==", itemId)
    );
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
    const unsub = onSnapshot(doc(db, "bookmarks", bookmarkId), (s) =>
      setSaved(s.exists())
    );
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
      unsubSelf = onSnapshot(doc(db, "follows", followDocId), (s) =>
        setFollowing(s.exists())
      );
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

/* ---------- Video helpers ---------- */
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
          capLevelToPlayerSize: true,
        });

        hls.loadSource(src);
        hls.attachMedia(video);

        const maxHeight = opts.maxHeight;
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

type PreloadMode = "none" | "light" | "aggressive";

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
    pushIfVideo(items[activeIndex + 1]);
  } else {
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
  const {
    root,
    threshold = 0.35,
    rootMargin = "-30% 0px -30% 0px",
    initialMuted,
  } = opts;

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
        if (entry.isIntersecting && entry.intersectionRatio >= threshold)
          activate();
        else deactivate();
      },
      {
        root: root?.current ?? null,
        threshold: [0, 0.15, threshold, 0.8, 1],
        rootMargin,
      }
    );
    io.observe(el);

    const onLoaded = () => {
      const rootEl = (root?.current ?? null) as Element | null;
      const rect = el.getBoundingClientRect();
      const vr = rootEl
        ? rootEl.getBoundingClientRect()
        : ({
          top: 0,
          bottom: window.innerHeight,
          height: window.innerHeight,
        } as DOMRect);
      const overlap = Math.max(
        0,
        Math.min(rect.bottom, vr.bottom) - Math.max(rect.top, vr.top)
      );
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
    () => ({
      muted,
      toggleMute,
      setMuted: setMutedAndApply,
      registerVideo,
      unregisterVideo,
    }),
    [muted, toggleMute, setMutedAndApply, registerVideo, unregisterVideo]
  );
  return <MuteContext.Provider value={value}>{children}</MuteContext.Provider>;
}

/* ---------- UI helpers ---------- */
function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

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
        className="relative overflow-hidden rounded-[0px] bg-white shadow-[0_22px_60px_rgba(0,0,0,.12)]"
        style={{ width: cardW, height: cardH, top: tabOffsetPx - 5 }}
      >
        <div className="h-full w-full bg-white" />
      </article>
    </div>
  );
}

/* ---------- VideoCard ---------- */
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
  SNAP_ITEM_HEIGHT,
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
  SNAP_ITEM_HEIGHT?: any;
}) {
  // const { w: cardW, h: cardH } = useDeedBox(railOpen, tabOffsetPx);
  // const isDesktop = useIsDesktop();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const { muted, toggleMute, registerVideo, unregisterVideo } =
    useGlobalMute();
  const router = useRouter();
  const authorProfile = useAuthorProfile(item.authorId);
  // start as NOT ready for both video + image
  const [mediaReady, setMediaReady] = useState(false);

  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");
  const firstFrameFiredRef = useRef(false);

  const { liked, count: likeCount, toggle: toggleLike } = useLikes(
    item.id,
    uid
  );
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
  const [orientation, setOrientation] = useState<
    "portrait" | "landscape" | "square"
  >("portrait");

  const handleVideoReady = () => {
    const v = videoRef.current;
    if (v && (v as any).videoWidth && (v as any).videoHeight) {
      const vw = (v as any).videoWidth as number;
      const vh = (v as any).videoHeight as number;

      if (vw > vh) {
        setFitMode("contain");         // landscape content inside portrait card
        setOrientation("landscape");
      } else if (vw < vh) {
        setFitMode("cover");           // tall portrait
        setOrientation("portrait");
      } else {
        setFitMode("contain");
        setOrientation("square");
      }
    }
    setMediaReady(true);
    fireFirstFrameOnce();
  };

  const handleImageReady: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      if (w > h) {
        setFitMode("contain");
        setOrientation("landscape");
      } else if (w < h) {
        setFitMode("cover");
        setOrientation("portrait");
      } else {
        setFitMode("contain");
        setOrientation("square");
      }
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

    <div className="relative h-full">
      <article
        className={cn(
          "bg-blue-400 group relative overflow-hidden rounded-[0px]",
          "shadow-[0_22px_60px_rgba(0,0,0,.65)]",
          "bg-gradient-to-b from-[#0B1513] via-black to-black",
          "transition-transform duration-300 ease-out",
          "md:hover:-translate-y-1 md:hover:shadow-[0_28px_80px_rgba(0,0,0,.85)]"
        )}
        style={{
          width: "100%",
          height: SNAP_ITEM_HEIGHT
        }}
      >
        {/* Loader overlay until mediaReady */}
        {!mediaReady && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <BouncingBallLoader />
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
                "max-h-full max-w-full lg:max-w-[700px]"

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
                "max-h-full max-w-full lg:max-w-[700px]",
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
            railOpen ? orientation === "landscape" ? "ml-[80px]" : "ml-[0px]" : "",
            mediaReady ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            {/* Avatar */}
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

            {/* Name + followers */}
            <div
              onClick={onViewProfileClick}
              className="cursor-pointer flex flex-col"
            >
              <div className="text-white/95 flex-1 font-bold text-sm truncate">
                {authorProfile?.handle
                  ? authorProfile.handle
                  : item.authorUsername
                    ? item.authorUsername
                    : (item.authorId ?? "").slice(0, 6)}
              </div>
              <div
                className="flex items-center text-white/70 text-[11px]"
                title={`${followersCount} Follower${followersCount === 1 ? "" : "s"
                  }`}
              >
                {formatCount(followersCount)} Follower
                {followersCount === 1 ? "" : "s"}
              </div>
            </div>

            {/* Right side: Follow + Mute */}
            <div className="ml-auto flex items-center gap-2">
              {showFollow && (
                <button
                  onClick={onFollowClick}
                  className="rounded-full px-3 py-1 text-xs font-bold text-white bg-[#C79257] hover:bg-[#FCD34D] shadow-sm"
                  aria-label="Follow"
                  title="Follow"
                >
                  Follow
                </button>
              )}

              {item.mediaType === "video" && (
                <button
                  onClick={toggleMute}
                  aria-label={
                    muted ? "Unmute video (global)" : "Mute video (global)"
                  }
                  className={cn(
                    "rounded-full bg-black/40 text-white p-2 hover:bg-black/70 backdrop-blur-sm border border-white/20",
                    railOpen ? orientation === "landscape" ? "md:mr-[80px]" : "md:mr-[0px]" : "",

                  )}

                >
                  {muted ? <IoVolumeMute size={18} /> : <IoVolumeHigh size={18} />}
                </button>
              )}
            </div>
          </div>

          {!!item.text && (
            <p className="text-white/95 text-sm leading-5 line-clamp-3">
              {item.text}
            </p>
          )}

          {/* Sound row */}
          <div className="mt-2 flex items-center gap-2">
            {isLibrarySound && (
              <div className="h-5 w-5 rounded-full overflow-hidden bg-black/40 flex-shrink-0 border border-white/30">
                <img
                  src={soundAvatar}
                  alt={soundLabel}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="flex items-center gap-1 text-[11px] text-white/85 min-w-0">
              <IoMusicalNotesOutline className="flex-shrink-0" size={14} />
              <span className="truncate max-w=[180px] sm:max-w-[220px]">
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
          // When comments / RightRail are open, keep rail fully inside the card
          railOpen ? orientation === "landscape" ? "md:right-[120px]" : "md:right-[10px]" : "md:right-[-60px]",

          "top-1/2 -translate-y-1/2 transition-opacity duration-200",
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
            <div className="mt-0.5 text-[11px] md:text-[12px] leading-3  text-white md:text-gray-300">
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
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3  text-white md:text-gray-300">
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
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3  text-white md:text-gray-300">
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
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3  text-white md:text-gray-300">
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
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3  text-white md:text-gray-300">
          {formatCount(totalShares)}
        </div>
      </div>

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
const CARD_ASPECT = 9 / 16; // width / height (portrait)
const CARD_ASPECT_INV = 16 / 9; // height / width (landscape if needed)

function useDeedBox(railOpen: boolean, topOffsetPx = 0) {
  const [box, setBox] = React.useState<{ w: number; h: number }>({
    w: 360,
    h: 640,
  });

  const recalc = React.useCallback(() => {
    if (typeof window === "undefined") return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const railW = railOpen && vw >= 1024 ? 380 : 0;
    const sideGutter = vw >= 1024 ? 48 : 16;
    const usableW = Math.max(320, vw - railW - sideGutter * 2);

    // 💻 Desktop: tall portrait card that fills almost the whole screen height
    if (vw >= 1024) {
      // Leave a tiny breathing room for shadows, etc.
      const maxHFromHeight = vh - 32;
      // Make sure it’s not too tiny on short screens
      const targetH = Math.max(520, maxHFromHeight);

      // width = height * (9/16) → portrait
      const rawW = Math.round(targetH * CARD_ASPECT);
      const targetW = Math.min(usableW, rawW);

      setBox({
        w: targetW,
        h: targetH,
      });
      return;
    }

    // 📱 Mobile: keep tall portrait card, respect tab offset
    const maxHMobile = vh - topOffsetPx;
    const targetH = Math.max(320, maxHMobile);
    const targetW = Math.round(targetH * CARD_ASPECT);

    const mobileUsableW = vw - sideGutter * 2;
    if (targetW <= mobileUsableW) {
      setBox({ w: targetW, h: targetH });
    } else {
      const w = Math.floor(mobileUsableW);
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

/** 🔥 Live author profile for each deed */
function useAuthorProfile(authorId?: string) {
  const [profile, setProfile] = useState<{
    handle?: string;
    photoURL?: string;
  } | null>(null);

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

/* ---------- Channel tabs ---------- */
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
  const avatarUrl: string | undefined =
    profile?.photoURL || profile?.imageUrl || undefined;

  return (
    <div className="relative h-full flex items-center pointer-events-none">
      <div className="w-full px-3 flex items-center justify-center">
        <div
          className={cn(
            "flex w-full items-center justify-center",
            "max-w-[500px] gap-2",
            commentsId ? "lg:mr-0" : "lg:mr-[100px]"
          )}
        >
          {/* LEFT – Dive In button */}
          <button
            type="button"
            onClick={() => router.push("/dive")}
            className="pointer-events-auto flex h-[34px] min-w-[34px] items-center justify-center rounded-full 
                       bg-black/40 px-2 text-[11px] font-extrabold tracking-[0.02em] text-white
                       hover:bg-black/65 transition-colors"
            aria-label="Open Dive"
          >
            <IoTelescopeOutline className="mr-1.5" size={18} />
            {/* always show text now */}
            <span>Dive In</span>
          </button>

          {/* CENTER – Tabs with animated underline */}
          <div className="pointer-events-auto flex-1 px-2">
            <div className="relative flex items-center justify-evenly">
              {TABS.map((k) => {
                const isActive = active === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onChange(k)}
                    className="relative w-[60px] lg:w-[80px] flex-1 select-none px-2 py-1.5 text-center"
                  >
                    <span
                      className={cn(
                        "text-[13px] font-semibold tracking-[0.02em]",
                        "transition-colors",
                        isActive
                          ? "text-white font-extrabold"
                          : "text-white/80"
                      )}
                    >
                      {LABEL[k]}
                    </span>

                    {/* underline sized to the tab width, not tiny */}
                    {isActive && (
                      <motion.span
                        layoutId="feed-tab-underline"
                        className="pointer-events-none absolute -bottom-1 h-[2px] rounded-full bg-white"
                        // inset-x-4 = leave small margins so it “fits” nicely under the label
                        style={{ left: "18%", right: "18%" }}
                        transition={{ type: "spring", stiffness: 260, damping: 24 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT – Search + Avatar + Data saver */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {/* Search icon button */}
            <button
              type="button"
              onClick={() => router.push("/search")}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-black/40 
                         hover:bg-black/65 transition-colors shadow-sm"
              aria-label="Search"
            >
              <IoSearch size={18} className="text-white" />
            </button>



            {/* Data saver pill – compact on the right */}
            {/* Data saver toggle – professional switch-style */}
            <button
              type="button"
              onClick={onToggleDataSaver}
              disabled={!uid}
              role="switch"
              aria-checked={dataSaverOn}
              className={cn(
                "hidden sm:inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                "text-[11px] tracking-[0.02em]",
                // Dive In–style glass pill
                "bg-black/40 text-white backdrop-blur-sm border border-white/20 shadow-sm",
                "hover:bg-black/65 transition-colors",
                !uid && "opacity-60 cursor-not-allowed"
              )}
              title={
                dataSaverOn
                  ? "Data saver active – videos may preload less and cap resolution to save your data."
                  : "Data saver off – videos can use higher resolution and more aggressive preloading."
              }
            >
              {/* Status dot (ON/OFF) */}
              <span
                className={cn(
                  "inline-flex h-2 w-2 rounded-full",
                  dataSaverOn ? "bg-emerald-400" : "bg-gray-400"
                )}
              />

              {/* Label + small hint if user has a saved preference */}
              <span className={cn(
                "flex items-center gap-1",
                dataSaverOn ? "text-emerald-400" : "text-gray-400"
              )}
              >
                <span>Data saver</span>

              </span>
            </button>


          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Channel feed hook ---------- */
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
      v =
        crypto?.randomUUID?.() ??
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

/* ---------- FeedShell (FlatList-style scroll) ---------- */
function FeedShell() {
  const { user } = useAuth();
  const uid = user?.uid;
  const profile = useUserProfile(uid);
  const { effectiveType, saveData } = useNetworkProfile();
  const SNAP_ITEM_HEIGHT = `calc(100vh)`;

  const userDataSaver = !!profile?.dataSaverVideos;
  const isVerySlow = effectiveType === "2g" || effectiveType === "slow-2g";
  const isFast = effectiveType === "4g" || effectiveType === "5g";
  const globalDataSaverOn = !!saveData;

  const dataSaverOn = userDataSaver || globalDataSaverOn || isVerySlow;

  const preloadMode: PreloadMode = dataSaverOn
    ? "none"
    : isFast && !globalDataSaverOn
      ? "aggressive"
      : "light";

  let hlsMaxHeight: number | undefined;
  if (dataSaverOn || isVerySlow) {
    hlsMaxHeight = 480;
  } else if (!isFast) {
    hlsMaxHeight = 720;
  } else {
    hlsMaxHeight = undefined;
  }

  const [tab, setTab] = useState<TabKey>("forYou");
  const { items, loading, reload } = useChannelFeed(tab, uid);
  const showTopLoader = useProgressIndicator(loading);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [commentsId, setCommentsId] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

  // 🔢 Track which deed is "active" (like FlatList index)
  const [activeIndex, setActiveIndex] = useState(0);

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

  const changeTab = useCallback(
    (k: TabKey) => {
      if (!uid && (k === "following" || k === "nearby")) {
        router.push("/getstarted?next=/");
        setTab("forYou");
        return;
      }
      setTab(k);
    },
    [uid, router]
  );

  useEffect(() => {
    if (!isDesktop && commentsId) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isDesktop, commentsId]);

  const openComments = useCallback((id: string) => setCommentsId(id), []);
  const closeComments = useCallback(() => setCommentsId(null), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeComments();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeComments]);

  // 🔧 Step size in pixels (one card)
  const getStepPx = useCallback(() => {
    const root = scrollerRef.current;
    if (!root) {
      if (typeof window !== "undefined") return window.innerHeight || 720;
      return 720;
    }
    return root.clientHeight || 720;
  }, []);

  // 🔼🔽 Scroll by one "card" up or down
  const scrollByDirection = useCallback(
    (dir: 1 | -1) => {
      const root = scrollerRef.current;
      if (!root || !items.length) return;

      const step = getStepPx();
      root.scrollBy({
        top: step * dir,
        behavior: "smooth",
      });

      setActiveIndex((prev) => {
        const next = Math.max(0, Math.min(items.length - 1, prev + dir));
        return next;
      });
    },
    [getStepPx, items.length]
  );

  // ⌨️ Keyboard Up/Down on the scroller
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!items.length) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest('[role="textbox"]'))
      ) {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollByDirection(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollByDirection(-1);
      }
    },
    [items.length, scrollByDirection]
  );

  // 🖱️ Mouse scroll → infer activeIndex from scrollTop
  const handleScroll = useCallback(() => {
    const root = scrollerRef.current;
    if (!root || !items.length) return;
    const step = getStepPx();
    if (!step) return;

    const idx = Math.round(root.scrollTop / step);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    setActiveIndex(clamped);
  }, [getStepPx, items.length]);

  // Keep comments panel in sync with currently active card
  useEffect(() => {
    if (!commentsId) return;
    const current = items[activeIndex];
    if (!current) return;
    if (current.id !== commentsId) setCommentsId(current.id);
  }, [activeIndex, items, commentsId]);

  const atTop = activeIndex <= 0;
  const atEnd = activeIndex >= Math.max(0, items.length - 1);

  const railOffsetLg = "lg:right-[0px]";
  const railOffsetXl = "xl:right-[0px]";

  const goUpload = () => {
    if (!uid) router.push("/getstarted?next=/studio/upload");
    else router.push("/studio/upload");
  };


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
        <div className="w-full items-center h-full">
          {/* Feed scroller */}
          <section
            ref={scrollerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            className="w-full flex h-[calc(100vh-0.5rem)] flex-col items-center gap-0 overflow-y-auto no-scrollbar scroll-smooth outline-none bg-black"
            style={{
              scrollSnapType: "y mandatory" as any,
              overscrollBehaviorY: "contain",
            }}
          >
            {/* Sticky translucent bar */}
            <div className="sticky p-0 top-0 z-30 w-full">
              <div>
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
                  ,
                ].join(" ")}
                style={{ height: SNAP_ITEM_HEIGHT, scrollSnapStop: "always" }}
              >
                <BouncingBallLoader />
              </div>
            )}

            {!loading && items.length === 0 && (
              <div
                data-snap-item="1"
                className={[
                  "w-full flex items-center justify-center snap-start transition-[right] duration-200",
                  commentsId ? "lg:mr-0" : "lg:mr-[100px]",
                ].join(" ")}
                style={{ height: SNAP_ITEM_HEIGHT, scrollSnapStop: "always" }}
              >
                <div className=" text-sm text-white/80">No deeds yet.</div>
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                data-snap-item="1"
                className={[
                  "w-full flex items-center justify-center snap-start transition-[right] duration-200",
                  "bg-black",
                  commentsId ? "lg:w-[200px]" : "lg:mr-0",
                ].join(" ")}
                style={{ height: SNAP_ITEM_HEIGHT, scrollSnapStop: "always" }}
              >
                <VideoCard
                  item={item}
                  uid={uid}
                  scrollRootRef={scrollerRef}
                  onOpenComments={openComments}
                  railOpen={!!commentsId}
                  onFirstFrame={undefined}
                  // tabOffsetPx={TAB_BAR_H}
                  dataSaverOn={dataSaverOn}
                  hlsMaxHeight={hlsMaxHeight}
                  SNAP_ITEM_HEIGHT={SNAP_ITEM_HEIGHT}
                />
              </div>
            ))}
          </section>

          {/* Up/Down steppers (desktop) */}
          <div className="hidden lg:inline">
            <div
              className={[
                "fixed right-0 md:right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 md:gap-3 transition-[right] duration-200",
                commentsId ? `${railOffsetLg} ${railOffsetXl}` : "right-0",
              ].join(" ")}
            >
              <button
                onClick={() => scrollByDirection(-1)}
                disabled={atTop}
                aria-label="Previous"
                className="rounded-full border border-[#C79257] bg-[#C79257] text-white shadow 
                 p-2 md:p-3 hover:bg-[#d9a56c] disabled:opacity-40 disabled:pointer-events-none"
              >
                <IoChevronUp size={18} />
              </button>
              <button
                onClick={() => scrollByDirection(1)}
                disabled={atEnd}
                aria-label="Next"
                className="rounded-full border border-[#C79257] bg-[#C79257] text-white shadow 
                 p-2 md:p-3 hover:bg-[#d9a56c] disabled:opacity-40 disabled:pointer-events-none"
              >
                <IoChevronDown size={18} />
              </button>
            </div>
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

          {/* Mobile comments overlay */}
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
        </div>
      </AppShell>
      <AdjacentPreloadWeb items={items} activeIndex={activeIndex} mode={preloadMode} />
    </MuteProvider>
  );
}

/* ---------- Root: Splash + decision + Feed ---------- */
export default function RootPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const decidedRef = useRef(false);
  const [phase, setPhase] = useState<"splash" | "feed">("splash");

  const SPLASH_KEY = "__ekari_splash_seen_v1__";
  const [splashSeen, setSplashSeen] = useState<boolean>(false);

  // Prefetch routes
  useEffect(() => {
    router.prefetch("/deeds");
    router.prefetch("/getstarted");
    router.prefetch("/studio/upload");
  }, [router]);

  // Read session flag once on mount
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem(SPLASH_KEY) === "1";
      if (seen) {
        setSplashSeen(true);
        setPhase("feed");
      }
    } catch {
      // ignore
    }
  }, []);

  // Decide where to go (respect splashSeen)
  useEffect(() => {
    if (authLoading || decidedRef.current) return;

    (async () => {
      decidedRef.current = true;

      const minDelay = splashSeen
        ? Promise.resolve()
        : new Promise((r) => setTimeout(r, 600));

      let goFeed = true;
      try {
        if (user?.uid) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.exists()
            ? (snap.data() as { handle?: string })
            : undefined;
          const hasHandle =
            typeof data?.handle === "string" &&
            data.handle.trim().length > 0;
          if (!hasHandle) goFeed = false;
        }
      } catch (e) {
        console.error("[Splash] Firestore read error:", e);
        goFeed = true;
      }

      await minDelay;

      if (goFeed) {
        setPhase("feed");
      } else {
        router.replace("/getstarted");
      }

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
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: THEME.forest }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 140,
            damping: 16,
            mass: 0.6,
          }}
        >
          <Image
            src="/ekarihub-logo-green.png"
            alt="ekarihub"
            width={320}
            height={86}
            onError={(e) =>
            ((e.currentTarget as HTMLImageElement).src =
              "/ekarihub-logo.png")
            }
            priority
          />
        </motion.div>
      </main>
    );
  }

  return <FeedShell />;
}
