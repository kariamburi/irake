// app/page.tsx
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
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "./hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import RightRail from "@/app/components/RightRail";
import UserAvatarMenu from "./components/UserAvatarMenu";
import LoginButton from "./components/LoginButton";

// 🔗 single source of truth for deed data
import { PlayerItem, toPlayerItem } from "@/lib/fire-queries";

/* ---------- Theme ---------- */
const THEME = { forest: "#233F39", gold: "#C79257", white: "#FFFFFF" };
const EKARI = {
  bg: "#ffffff",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
  primary: "#C79257",
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

/* ---------- Small helpers ---------- */
function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0) + "K";
  return String(n);
}

/* ---------- Hooks ---------- */
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

function useFeed(uid?: string) {
  const following = useFollowing(uid);
  const [items, setItems] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const base = collection(db, "deeds");

    const qPublic = query(
      base,
      where("visibility", "==", "public"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribers: Array<() => void> = [];
    let currentPublic: PlayerItem[] = [];
    let currentOwn: PlayerItem[] = [];

    const emit = () => {
      const map = new Map<string, PlayerItem>();
      for (const it of [...currentPublic, ...currentOwn]) map.set(it.id, it);
      const merged = Array.from(map.values()).sort(
        (a, b) => (a.createdAt ?? 0) < (b.createdAt ?? 0) ? 1 : -1
      );
      setItems(merged);
      setLoading(false);
    };

    unsubscribers.push(
      onSnapshot(
        qPublic,
        (snap) => {
          currentPublic = snap.docs.map((d) => toPlayerItem(d.data(), d.id));
          emit();
        },
        () => {
          currentPublic = [];
          emit();
        }
      )
    );

    if (uid) {
      const qOwn = query(
        base,
        where("authorId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      unsubscribers.push(
        onSnapshot(
          qOwn,
          (snap) => {
            currentOwn = snap.docs.map((d) => toPlayerItem(d.data(), d.id));
            emit();
          },
          () => {
            currentOwn = [];
            emit();
          }
        )
      );
    } else {
      currentOwn = [];
    }

    return () => unsubscribers.forEach((u) => u());
  }, [uid]);

  const visible = useMemo(
    () => (uid ? items.filter((it) => canSee(it, uid, following)) : items),
    [items, uid, following]
  );

  return { items: visible, loading };
}

function useLikes(itemId: string, uid?: string) {
  const likeId = uid ? `${itemId}_${uid}` : undefined;
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let unsubSelf = () => {};
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

/* ---------- Engagement hooks: comments / bookmarks / follow / totals ---------- */
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
    if (s.exists()) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        deedId: itemId,
        userId: uid,
        createdAt: serverTimestamp(),
      });
    }
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

/** follow/unfollow top-level follows/{follower_following} */
function useFollowAuthor(authorId?: string, uid?: string) {
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  const followDocId = uid && authorId ? `${uid}_${authorId}` : undefined;

  useEffect(() => {
    let unsubSelf = () => {};
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

/* ---------- Video helpers (autoplay + HLS + exclusive) ---------- */
let CURRENT_PLAYING: HTMLVideoElement | null = null;
function playExclusive(el: HTMLVideoElement) {
  if (CURRENT_PLAYING && CURRENT_PLAYING !== el) CURRENT_PLAYING.pause();
  CURRENT_PLAYING = el;
  el.play().catch(() => {});
}
function pauseIfCurrent(el: HTMLVideoElement) {
  if (CURRENT_PLAYING === el) CURRENT_PLAYING = null;
  el.pause();
}

function useHls(videoRef: React.RefObject<HTMLVideoElement | null>, src?: string | null) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isHls = src.endsWith(".m3u8");
    if (!isHls) {
      (video as any).src = src;
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegURL")) {
      (video as any).src = src;
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
        (video as any).src = src;
      }
    })();

    return () => {
      hls?.destroy?.();
    };
  }, [videoRef, src]);
}

/** Autoplay in view, global-muted aware */
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
    CURRENT_PLAYING?.play().catch(() => {});
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

/* ---------- Video Engagement (views + watch) ---------- */
function getOrMakeDeviceId(): string {
  const k = "__ekari_device_id__";
  try {
    let v = localStorage.getItem(k);
    if (!v || v.length < 16) {
      v = (crypto?.randomUUID?.() ??
        (Math.random().toString(36).slice(2) + Date.now().toString(36)));
      if (v.length < 16) v = v.padEnd(16, "x");
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "anon_device_" + Math.random().toString(36).slice(2).padEnd(16, "x");
  }
}

function useVideoEngagement({
  videoRef,
  item,
  uid,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  item: PlayerItem;
  uid?: string;
}) {
  const watchedMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const haveMarkedViewRef = useRef(false);

  const markViewOnce = async () => {
    if (haveMarkedViewRef.current) return;
    haveMarkedViewRef.current = true;

    const payload: any = { deedId: item.id, createdAt: serverTimestamp() };
    let id: string;
    if (uid) {
      payload.userId = uid;
      id = `${item.id}_${uid}`;
    } else {
      const d = getOrMakeDeviceId();
      payload.deviceId = d;
      id = `${item.id}_${d}`;
    }

    try {
      await setDoc(doc(db, "views", id), payload, { merge: true });
    } catch {}
  };

  const flushWatch = async () => {
    const delta = Math.round(watchedMsRef.current);
    watchedMsRef.current = 0;
    lastTickRef.current = null;
    if (delta <= 0) return;

    const payload: any = {
      deedId: item.id,
      ms: Math.min(delta, 10000),
      createdAt: serverTimestamp(),
    };
    let id: string;
    if (uid) {
      payload.userId = uid;
      id = `${item.id}_${uid}_${Date.now()}`;
    } else {
      const d = getOrMakeDeviceId();
      payload.deviceId = d;
      id = `${item.id}_${d}_${Date.now()}`;
    }

    try {
      await setDoc(doc(db, "watch", id), payload);
    } catch {}
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    watchedMsRef.current = 0;
    lastTickRef.current = null;
    haveMarkedViewRef.current = false;

    const onPlay = () => {
      lastTickRef.current = performance.now();
      markViewOnce();
    };
    const onPause = () => {
      const now = performance.now();
      if (lastTickRef.current != null) {
        watchedMsRef.current += now - lastTickRef.current;
        lastTickRef.current = null;
      }
    };
    const onTimeUpdate = () => {
      const now = performance.now();
      if (lastTickRef.current != null) {
        watchedMsRef.current += now - lastTickRef.current;
        lastTickRef.current = now;
      }
    };
    const onEnded = () => {
      onPause();
      flushWatch();
    };
    const onVisibility = () => {
      if (document.hidden) {
        onPause();
        flushWatch();
      }
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onVisibility);
    const onBeforeUnload = () => flushWatch();
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flushWatch();
    };
  }, [videoRef, item.id, uid]);

  return null;
}

/* ---------- UI helpers ---------- */
function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- Skeleton ---------- */
function SkeletonCard() {
  return (
    <div className="h-[100svh] w-full flex items-center justify-center snap-start">
      <article className="relative overflow-hidden rounded-2xl border bg-black shadow-[0_8px_30px_rgba(0,0,0,.12)] aspect-[9/16] max-h-[98vh] sm:max-h-[92vh]">
        <div className="h-full w-full">
          <div className="h-full w-full animate-pulse bg-[rgb(24,24,24)]" />
        </div>
        <div className="absolute right-3 bottom-3 md:right-20 z-10 flex gap-2 md:flex-col">
          <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
          <div className="h-3 w-8 rounded bg-white/10 animate-pulse md:self-center" />
        </div>
        <div className="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
            <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="mt-2 h-3 w-40 rounded bg-white/10 animate-pulse" />
        </div>
      </article>
    </div>
  );
}

/* ---------- Feed Card ---------- */
function VideoCard({
  item,
  uid,
  scrollRootRef,
  onFirstFrame,
  onOpenComments,
  railOpen,
}: {
  item: PlayerItem;
  uid?: string;
  scrollRootRef: React.RefObject<Element | null>;
  onFirstFrame?: () => void;
  onOpenComments: (deedId: string) => void;
  railOpen: boolean;
}) {
  const { w: cardW, h: cardH } = useDeedBox(railOpen);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const { muted, toggleMute, registerVideo, unregisterVideo } = useGlobalMute();
  const router = useRouter();

  const [mediaReady, setMediaReady] = useState(item.mediaType !== "video");
  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");
  const firstFrameFiredRef = useRef(false);

  const { liked, count: likeCount, toggle: toggleLike } = useLikes(item.id, uid);
  const commentsCount = useCommentsCount(item.id);
  const { saved, toggle: toggleSave } = useBookmarks(item.id, uid);
  const totalBookmarks = useBookmarkTotalFromDeed(item.id);
  const totalShares = useShareTotalFromDeed(item.id);
  const { following, followersCount, toggle: toggleFollow } = useFollowAuthor(item.authorId, uid);

  useVideoEngagement({ videoRef, item, uid });

  const onShare = async () => {
    const url = `${location.origin}/deed/${item.id}`;
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
      if (uid) payload.userId = uid;
      else payload.deviceId = baseId;
      await setDoc(doc(db, "shares", sid), payload);
    } catch {}
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

  /** Build /@handle path if handle exists */
  const handleToPath = (h?: string) =>
    h ? `/${encodeURIComponent(h.startsWith("@") ? h : `@${h}`)}` : null;

  const onViewProfileClick = (handle?: string) => {
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
      setFitMode((v as any).videoWidth > (v as any).videoHeight ? "contain" : "cover");
    }
    setMediaReady(true);
    fireFirstFrameOnce();
  };

  const handleImageReady: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setFitMode(img.naturalWidth > img.naturalHeight ? "contain" : "cover");
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
  useHls(videoRef, item.mediaUrl || undefined);

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

  const avatar = item.authorPhotoURL || "/avatar-placeholder.png";

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

  // Show follow button only if:
  // - viewer is signed out OR viewer.uid !== authorId
  // - and not currently following
  const showFollow = (!uid || uid !== item.authorId) && !following;

  return (
    <div className="relative">
      <article
        className="
          group relative overflow-hidden rounded-2xl border bg-black
          shadow-[0_8px_30px_rgba(0,0,0,.12)]
        "
        style={{ width: cardW, height: cardH }}
      >
        {/* Top overlay controls */}
        {item.mediaType === "video" && (
          <>
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
          </>
        )}

        <div className="w-full h-full flex items-center justify-center bg-black">
          {item.mediaType === "video" && item.mediaUrl ? (
            <video
              ref={videoRef}
              poster={item.posterUrl}
              playsInline
              loop
              controlsList="nodownload noremoteplayback"
              preload="metadata"
              className={[
                "max-h-full max-w-full",
                fitMode === "contain" ? "object-contain" : "object-cover",
              ].join(" ")}
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
              className={[
                "max-h-full max-w-full",
                fitMode === "contain" ? "object-contain" : "object-cover",
              ].join(" ")}
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
          className={[
            "absolute left-0 right-0 bottom-0 p-3 sm:p-4",
            "bg-gradient-to-t from-black/70 to-black/0",
            "transition-opacity duration-200",
            mediaReady ? "opacity-100" : "opacity-0 pointer-events-none",
          ].join(" ")}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              onClick={() => onViewProfileClick(item.authorUsername)}
              className={cn(
                "h-8 w-8 rounded-full overflow-hidden bg-gray-200 shrink-0",
                item.authorUsername ? "cursor-pointer" : "cursor-default"
              )}
              aria-label={
                item.authorUsername ? `Open ${item.authorUsername} profile` : undefined
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt={item.authorUsername || item.authorId || "author"}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-white/95 font-bold text-sm truncate">
                {item.authorUsername
                  ? `${item.authorUsername}`
                  : (item.authorId ?? "").slice(0, 6)}
              </div>
              <div className="text-white/70 text-[11px]">
                {formatCount(followersCount)} followers
              </div>
            </div>

            {showFollow && (
              <button
                onClick={onFollowClick}
                className="ml-auto rounded-full px-3 py-1 text-xs font-bold text-white hover:opacity-90"
                style={{ backgroundColor: EKARI.primary }}
                aria-label="Follow"
                title="Follow"
              >
                Follow
              </button>
            )}
          </div>
          {!!item.text && (
            <p className="text-white/95 text-sm leading-5 line-clamp-3">{item.text}</p>
          )}
        </div>
      </article>

      {/* Action rail */}
      <div
        className={[
          "absolute z-10 flex flex-col items-center gap-1.5",
          "right-3 top-1/2 -translate-y-1/2",
          "md:right-[-72px]",
          "transition-opacity duration-200",
          mediaReady ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        {/* Like */}
        <button
          aria-label="Like"
          aria-pressed={liked}
          onClick={onLikeClick}
          className={[
            "grid place-items-center rounded-full shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition",
            "h-11 w-11 md:h-12 md:w-12",
            "bg-black/30 text-white md:bg-gray-100 md:text-gray-900 backdrop-blur-sm",
          ].join(" ")}
        >
          <IoHeart className={liked ? "fill-red-500 text-red-500" : ""} size={22} />
        </button>
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-800">
          {formatCount(likeCount)}
        </div>

        {/* Comments */}
        <button
          aria-label="Comments"
          onClick={onCommentsClick}
          className="h-11 w-11 md:h-12 md:w-12 grid place-items-center rounded-full bg-black/30 text-white md:bg-gray-100 md:text-gray-900 backdrop-blur-sm shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition"
        >
          <IoChatbubble size={22} />
        </button>
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-800">
          {formatCount(commentsCount)}
        </div>

        {/* Save */}
        <button
          aria-label="Save"
          onClick={onSaveClick}
          className="h-11 w-11 md:h-12 md:w-12 grid place-items-center rounded-full bg-black/30 text-white md:bg-gray-100 md:text-gray-900 backdrop-blur-sm shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition"
        >
          <IoBookmark className={saved ? "text-[#C79257]" : ""} size={22} />
        </button>
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-800">
          {formatCount(totalBookmarks)}
        </div>

        {/* Share */}
        <button
          aria-label="Share"
          onClick={onShare}
          className="h-11 w-11 md:h-12 md:w-12 grid place-items-center rounded-full bg-black/30 text-white md:bg-gray-100 md:text-gray-900 backdrop-blur-sm shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition"
        >
          <IoArrowRedo size={22} />
        </button>
        <div className="mt-0.5 text-[11px] md:text-[12px] leading-3 font-extrabold text-white md:text-gray-800">
          {formatCount(totalShares)}
        </div>
      </div>
    </div>
  );
}

const CARD_ASPECT = 9 / 16;
const CARD_ASPECT_INV = 16 / 9;

/** Prefer full height (100svh); shrink proportionally if width is tight. */
function useDeedBox(railOpen: boolean) {
  const [box, setBox] = React.useState<{ w: number; h: number }>({ w: 360, h: 640 });

  const recalc = React.useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const targetH = vh;
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
  }, [railOpen]);

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
  const [profile, setProfile] = useState<{ handle?: string; photoURL?: string } | null>(null);

  useEffect(() => {
    if (!uid) { setProfile(null); return; }
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any | undefined;
      setProfile({
        handle: data?.handle,
        // prefer Firestore photoURL if you store it there; fall back to auth later
        photoURL: data?.photoURL,
      });
    });
    return () => unsub();
  }, [uid]);

  return profile;
}
/* ---------- Feed shell (wrapped by AppShell) ---------- */
function FeedShell() {
  const { user } = useAuth();
  const uid = user?.uid;
  const profile = useUserProfile(uid);
  const { items, loading } = useFeed(uid);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [commentsId, setCommentsId] = useState<string | null>(null);

  const openComments = useCallback((id: string) => setCommentsId(id), []);
  const closeComments = useCallback(() => setCommentsId(null), []);
  const [snapReady, setSnapReady] = useState(false);

  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isDesktop && commentsId) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isDesktop, commentsId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeComments();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeComments]);

  useEffect(() => {
    if (!loading && items.length > 0 && !snapReady) {
      const t = setTimeout(() => setSnapReady(true), 800);
      return () => clearTimeout(t);
    }
  }, [loading, items.length, snapReady]);

  const { goPrev, goNext, index } = useStepScroll(
    scrollerRef as unknown as React.RefObject<HTMLElement>,
    () => items.length,
    snapReady
  );
  useEffect(() => {
    if (!commentsId) return;
    const current = items[index];
    if (!current) return;
    if (current.id !== commentsId) setCommentsId(current.id);
  }, [index, items, commentsId]);

  const atTop = index <= 0;
  const atEnd = index >= Math.max(0, items.length - 1);
  const router = useRouter();
  const goUpload = () => {
    if (!uid) router.push("/getstarted?next=/studio/upload");
    else router.push("/studio/upload");
  };

  const railOffsetLg = "lg:right-[400px]";
  const railOffsetXl = "xl:right-[440px]";
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
              // prefer Firestore photoURL; otherwise the Auth one
              photoURL: profile?.photoURL ?? user?.photoURL ?? undefined,
              handle: profile?.handle, // <- comes from Firestore
            }}
          />
        }
      >
        <div
          className={[
            "fixed top-3 md:top-4 z-40 transition-[right] duration-200",
            commentsId ? `${railOffsetLg} ${railOffsetXl}` : "right-3 md:right-4",
          ].join(" ")}
        >
          {uid ? (
            <UserAvatarMenu
              uid={uid}
              photoURL={profile?.photoURL ?? user?.photoURL ?? undefined}
              handle={profile?.handle}
            />
          ) : (
            <LoginButton />
          )}
        </div>

        <section
          ref={scrollerRef}
          tabIndex={0}
          className="w-full flex flex-col items-center gap-0 overflow-y-scroll overflow-x-hidden no-scrollbar scroll-smooth outline-none"
          style={{
            height: "100svh",
            scrollSnapType: (snapReady ? "y mandatory" : "none") as any,
            overscrollBehaviorY: "contain",
          }}
        >
          {(loading || (!snapReady && items.length > 0)) && <SkeletonCard />}

          {!loading && items.length === 0 && (
            <div className="py-10 text-sm" style={{ color: EKARI.subtext }}>
              No deeds yet.
            </div>
          )}

          {items.map((item, i) => (
            <div
              key={item.id}
              data-snap-item="1"
              className={[
                "h-[100svh] w-full flex items-center justify-center snap-start transition-[right] duration-200",
                commentsId ? "lg:mr-10" : "lg:mr-[200px]",
              ].join(" ")}
              style={{ scrollSnapStop: "always" }}
            >
              <VideoCard
                item={item}
                uid={uid}
                scrollRootRef={scrollerRef}
                onOpenComments={openComments}
                railOpen={!!commentsId}
                onFirstFrame={i === 0 ? () => setSnapReady(true) : undefined}
              />
            </div>
          ))}
        </section>

        <div
          className={[
            "fixed right-3 md:right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 md:gap-3 transition-[right] duration-200",
            commentsId ? `${railOffsetLg} ${railOffsetXl}` : "right-3 md:right-4",
          ].join(" ")}
        >
          <button
            onClick={goPrev}
            disabled={atTop || !snapReady}
            aria-label="Previous"
            className="rounded-full border border-gray-200 bg-gray-200 shadow p-2 md:p-3 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
          >
            <IoChevronUp size={18} />
          </button>
          <button
            onClick={goNext}
            disabled={atEnd || !snapReady}
            aria-label="Next"
            className="rounded-full border border-gray-200 bg-gray-200 shadow p-2 md:p-3 hover:bg-white disabled:opacity-40 disabled:pointer-events-none"
          >
            <IoChevronDown size={18} />
          </button>
        </div>

        <button
          className="lg:hidden fixed right-4 bottom-4 rounded-full shadow-md p-3 text-white"
          style={{ backgroundColor: EKARI.primary }}
          aria-label="Upload"
          onClick={goUpload}
        >
          <IoAdd size={22} />
        </button>

        {/* Mobile comments overlay (uses the same RightRail) */}
        <div
          className={[
            "lg:hidden fixed inset-0 z-[60] transition",
            commentsId ? "pointer-events-auto" : "pointer-events-none",
          ].join(" ")}
          aria-hidden={!commentsId}
        >
          {/* Backdrop */}
          <div
            className={[
              "absolute inset-0 backdrop-blur-[2px] transition-opacity",
              commentsId ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={closeComments}
          />

          {/* Bottom sheet */}
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
                handle: (user as any)?.handle,
              }}
            />
          </div>
        </div>
      </AppShell>
    </MuteProvider>
  );
}

/* ---------- One-item step scrolling (wheel + keyboard) ---------- */
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
export default function RootPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const decidedRef = useRef(false);
  const [phase, setPhase] = useState<"splash" | "feed">("splash");

  useEffect(() => {
    router.prefetch("/deeds");
    router.prefetch("/getstarted");
    router.prefetch("/studio/upload");
  }, [router]);

  useEffect(() => {
    if (authLoading || decidedRef.current) return;

    (async () => {
      decidedRef.current = true;

      const minDelay = new Promise((r) => setTimeout(r, 700));

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
        goFeed = true;
      }

      await minDelay;

      if (goFeed) setPhase("feed");
      else router.replace("/getstarted");
    })();
  }, [authLoading, user?.uid, router]);

  if (phase === "splash") {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: THEME.forest }}
      >
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
            onError={(e) =>
              ((e.currentTarget as HTMLImageElement).src = "/ekarihub-logo.png")
            }
            priority
          />
        </motion.div>
      </main>
    );
  }

  return <FeedShell />;
}
