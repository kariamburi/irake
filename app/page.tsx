"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
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
  IoSearch,
  IoTelescopeOutline,
  IoMusicalNotesOutline,
  IoExpandOutline,
  IoClose,
  IoChatbubblesOutline,
  IoGitNetworkOutline,
  IoStorefrontOutline,
  IoHome,
  IoCartOutline,
  IoCompassOutline,
  IoHomeOutline,
  IoInformationCircleOutline,
  IoPersonCircleOutline,
  IoSparklesOutline,
  IoChatbubbleOutline,
  IoNotificationsOutline,
  IoFilmOutline,
  IoChevronForward,
  IoMenu,
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
import { DonateDialogWeb } from "./components/DonateDialogWeb";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import OpenInAppBanner from "./components/OpenInAppBanner";

// 🔗 single source of truth for deed data
import { PlayerItem, toPlayerItem } from "@/lib/fire-queries";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";

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
const LABEL: Record<TabKey, string> = {
  forYou: "For You",
  following: "Following",
  nearby: "Nearby",
};

/* ---------- Utils ---------- */
function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 ? 1 : 0) + "K";
  return String(n);
}

function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(queryStr);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [queryStr]);
  return matches;
}

function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}

/* ---------- Visibility ---------- */
type Visibility = "public" | "followers" | "private";

type UserSnap = {
  userId: string;
  name?: string | null;
  handle?: string | null;
  photoURL?: string | null;
};

async function getUserSnap(uid: string): Promise<UserSnap> {
  const us = await getDoc(doc(db, "users", uid));
  const u = (us.data() as any) || {};
  return {
    userId: uid,
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
        (crypto?.randomUUID?.() ??
          Math.random().toString(36).slice(2) + Date.now().toString(36));
      if (v.length < 16) v = v.padEnd(16, "x");
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return "anon_device_" + Math.random().toString(36).slice(2).padEnd(16, "x");
  }
}

async function recordViewWeb(params: { deedId: string; uid?: string }) {
  const { deedId, uid } = params;
  try {
    const baseId = uid ?? getOrMakeDeviceId();
    const viewId = `${deedId}_${baseId}`; // ✅ idempotent
    const ref = doc(db, "views", viewId);
    const snap = await getDoc(ref);
    if (snap.exists()) return;

    const payload: any = { deedId, createdAt: serverTimestamp() };

    if (uid) {
      const us = await getUserSnap(uid);
      payload.userId = uid;
      payload.user = {
        name: us.name ?? null,
        handle: us.handle ?? null,
        photoURL: us.photoURL ?? null,
      };
    } else {
      payload.deviceId = baseId;
    }

    await setDoc(ref, payload);
  } catch {
    // ignore
  }
}

const canSee = (item: PlayerItem, uid?: string, following: Set<string> = new Set()): boolean => {
  const v = (item.visibility ?? "public") as Visibility;
  if (v === "public") return true;
  if (!uid) return false;
  if (item.authorId === uid) return true;
  if (v === "followers") return following.has(item.authorId);
  return false;
};

/* ---------- Following ---------- */
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
          if (x?.followingId) s.add(String(x.followingId));
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

/* ---------- Loader helpers ---------- */
function useProgressIndicator(isLoading: boolean, minMs = 300, delayMs = 120) {
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
  if (!uid) return [];

  const uniq = (arr: string[]) => Array.from(new Set(arr.map(String).filter(Boolean)));

  const fetchDeedsByIds = async (ids: string[]) => {
    const base = collection(db, "deeds");
    const docs: { id: string; data: any }[] = [];

    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const qs = await getDocs(query(base, where(documentId(), "in", batch)));
      qs.forEach((d) => docs.push({ id: d.id, data: d.data() }));
    }

    const map = new Map(docs.map((x) => [x.id, x.data]));
    const missing = ids.filter((id) => !map.has(id));

    const items = ids
      .map((id) => toPlayerItem(map.get(id), id))
      .filter(Boolean) as PlayerItem[];

    return { items, missing };
  };

  try {
    const feedDocRef = doc(db, `feeds/${uid}/surfaces/${surface}`);
    const feedSnap = await getDoc(feedDocRef);

    const now = Date.now();
    let ids: string[] | null = null;

    // 1) Try cache with TTL
    if (feedSnap.exists()) {
      const d = feedSnap.data() as any;
      const ttlSec = Number(d?.ttlSec ?? 60);
      const updatedAtMs =
        typeof d?.updatedAt?.toMillis === "function" ? d.updatedAt.toMillis() : 0;
      const fresh = updatedAtMs && now - updatedAtMs < ttlSec * 1000;

      if (fresh && Array.isArray(d.ids) && d.ids.length > 0) {
        ids = uniq(d.ids);
      }
    }

    // 2) Refresh
    if (!ids || !ids.length) {
      const functions = getFunctions(app, "us-central1");
      const refreshFeed = httpsCallable<{ surface: TabKey }, { ids: string[] }>(functions, "refreshFeed");
      try {
        const res = await refreshFeed({ surface });
        ids = uniq(res.data?.ids || []);
      } catch (e) {
        // stale fallback
        if (feedSnap.exists()) {
          const d = feedSnap.data() as any;
          if (Array.isArray(d.ids) && d.ids.length) ids = uniq(d.ids);
        }
      }
    }

    if (!ids || !ids.length) return [];

    // 3) Fetch deeds
    const { items, missing } = await fetchDeedsByIds(ids);

    // 4) Heal if too many missing
    if (missing.length > 0) {
      const missingRatio = missing.length / Math.max(1, ids.length);
      if (missingRatio >= 0.3 || items.length < 5) {
        try {
          const functions = getFunctions(app, "us-central1");
          const refreshFeed = httpsCallable<{ surface: TabKey }, { ids: string[] }>(
            functions,
            "refreshFeed"
          );
          const res2 = await refreshFeed({ surface });
          const ids2 = uniq(res2.data?.ids || []);
          if (ids2.length) {
            const { items: items2 } = await fetchDeedsByIds(ids2);
            return items2;
          }
        } catch {
          // ignore
        }
      }
    }

    return items;
  } catch {
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
    if (likeId) unsubSelf = onSnapshot(doc(db, "likes", likeId), (s) => setLiked(s.exists()));
    const unsubCount = onSnapshot(query(collection(db, "likes"), where("deedId", "==", itemId)), (s) =>
      setCount(s.size)
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
    if (s.exists()) {
      await deleteDoc(ref);
    } else {
      const userSnap = await getUserSnap(uid);
      await setDoc(ref, {
        deedId: itemId,
        userId: uid,
        user: {
          name: userSnap.name ?? null,
          handle: userSnap.handle ?? null,
          photoURL: userSnap.photoURL ?? null,
        },
        createdAt: Date.now(),
      });
    }
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
    if (s.exists()) {
      await deleteDoc(ref);
    } else {
      const userSnap = await getUserSnap(uid);
      await setDoc(ref, {
        deedId: itemId,
        userId: uid,
        user: {
          name: userSnap.name ?? null,
          handle: userSnap.handle ?? null,
          photoURL: userSnap.photoURL ?? null,
        },
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

    if (video.canPlayType("application/vnd.apple.mpegURL")) {
      (video as any).src = src;
      return;
    }

    let hls: any;

    (async () => {
      const mod = await import("hls.js");
      const Hls = mod.default;
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
              if (h <= maxHeight && i > capIndex) capIndex = i;
            }

            if (capIndex >= 0) hls.autoLevelCapping = capIndex;
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

function VideoPreload({ src, poster }: { src: string; poster?: string | null }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
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
    if (it && it.mediaType === "video" && it.mediaUrl) candidates.push(it);
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
        <VideoPreload key={`preload_${it.id}`} src={it.mediaUrl!} poster={it.posterUrl} />
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
    videos.current.forEach((v) => ((v as any).muted = m));
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

/* ---------- Sizing: desktop card vs mobile full screen ---------- */
const CARD_ASPECT = 9 / 16;
const CARD_ASPECT_INV = 16 / 9;

function useDeedBox(params: {
  railOpen: boolean;
  topOffsetPx: number;
  isMobile: boolean;
}) {
  const { railOpen, topOffsetPx, isMobile } = params;
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 360, h: 640 });

  const recalc = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // ✅ Mobile TikTok: full screen per item
    if (isMobile) {
      setBox({ w: vw, h: vh }); // FULL BLEED
      return;
    }

    // Desktop: card sizing logic
    const targetH = Math.max(520, vh - topOffsetPx);
    const targetW = Math.round(targetH * CARD_ASPECT);

    const railW = railOpen && vw >= 1024 ? 380 : 0;
    const sideGutter = vw >= 1024 ? 72 : 24;
    const usableW = Math.max(320, vw - railW - sideGutter * 2);

    if (targetW <= usableW) setBox({ w: targetW, h: targetH });
    else {
      const w = Math.floor(usableW);
      const h = Math.floor(w / CARD_ASPECT_INV);
      setBox({ w, h });
    }
  }, [railOpen, topOffsetPx, isMobile]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  return box;
}

/* ---------- Profiles ---------- */
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
  const [state, setState] = useState<{ effectiveType?: string; saveData?: boolean }>({});

  useEffect(() => {
    const nav: any = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;
    if (!conn) return;

    const update = () => {
      setState({ effectiveType: conn.effectiveType, saveData: !!conn.saveData });
    };

    update();
    conn.addEventListener?.("change", update);
    return () => conn.removeEventListener?.("change", update);
  }, []);

  return state;
}

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
      setProfile({ handle: data?.handle, photoURL: data?.photoURL });
    });
    return () => unsub();
  }, [authorId]);

  return profile;
}

/* ---------- Channel tabs ---------- */
function ChannelTabs({
  active,
  commentsId,
  uid,
  onChange,
  dataSaverOn,
  onToggleDataSaver,
}: {
  active: TabKey;
  commentsId: string;
  uid: any;
  onChange: (k: TabKey) => void;
  dataSaverOn: boolean;
  onToggleDataSaver: () => void;
}) {
  const router = useRouter();
  return (
    <div className="relative h-full flex items-center">
      <div className="mx-auto w-full px-3 flex items-center justify-center">
        <div className={cn("flex w-full justify-center items-center gap-2", "overflow-x-auto no-scrollbar")}>
          <div className="inline-flex items-center gap-1 rounded-full bg-white/85 border border-white/30 shadow-sm px-1 py-1 backdrop-blur-md">
            {TABS.map((k) => {
              const isActive = active === k;
              return (
                <button
                  key={k}
                  onClick={() => onChange(k)}
                  className={cn(
                    "relative px-2 lg:px-3 py-1.5 text-xs lg:text-sm w-[72px] lg:w-[92px]",
                    "rounded-full font-semibold flex-shrink-0 flex items-center justify-center transition",
                    isActive ? "bg-[#233F39] text-white shadow-sm" : "text-gray-800 hover:bg-white/60"
                  )}
                >
                  <span className="relative z-10">{LABEL[k]}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => router.push("/dive")}
            className="flex px-2 lg:px-3 py-1.5 text-xs lg:text-sm w-[92px] lg:w-[110px] gap-2 rounded-full items-center justify-center font-semibold border transition
                       bg-white/85 text-gray-900 border-white/30 hover:bg-white flex-shrink-0 shadow-sm"
          >
            <IoTelescopeOutline />
            <span>Dive In</span>
          </button>

          {/**  <button
            type="button"
            onClick={onToggleDataSaver}
            disabled={!uid}
            className={cn(
              "ml-1 flex items-center gap-2 px-2 py-1.5 rounded-full border text-[11px] font-semibold flex-shrink-0 shadow-sm",
              "bg-black/30 text-white border-white/20 hover:bg-black/40 disabled:opacity-60"
            )}
            title="Data saver"
          >
            <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: dataSaverOn ? "#16A34A" : "#9CA3AF" }} />
            <span>Data saver</span>
          </button>*/}

          <button
            onClick={() => router.push("/search")}
            className="hidden lg:inline-flex items-center justify-center rounded-full border border-white/25 text-white hover:bg-white/10 shadow-sm p-2 flex-shrink-0"
            aria-label="Search"
          >
            <IoSearch />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Feed data ---------- */
function useChannelFeed(tab: TabKey, uid?: string) {
  const following = useFollowing(uid);
  const [items, setItems] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "forYou") {
        if (!uid) setItems(await fetchPublicForYou(40));
        else setItems(await fetchServerFeed("forYou", uid));
      } else {
        if (!uid) setItems([]);
        else setItems(await fetchServerFeed(tab, uid));
      }
    } finally {
      setLoading(false);
    }
  }, [tab, uid]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => (uid ? items.filter((it) => canSee(it, uid, following)) : items), [items, uid, following]);
  return { items: visible, loading, reload: load };
}

/* ---------- Skeleton ---------- */
function SkeletonCard({
  cardH,
  isMobile,
}: {
  cardH: number;
  isMobile: boolean;
}) {
  return (
    <div className="relative pt-[70px] mb-0">
      <article
        className={cn(
          "relative overflow-hidden bg-black",
          isMobile
            ? "w-full rounded-none"
            : "lg:w-[375px] rounded-[28px] shadow-[0_22px_60px_rgba(0,0,0,.12)]"
        )}
        style={{ height: cardH }}
      />
    </div>
  );
}

/* ---------- VideoCard ---------- */
function VideoCard({
  item,
  uid,
  scrollRootRef,
  onOpenComments,
  isMobile,
  cardH,
  dataSaverOn,
  hlsMaxHeight,
}: {
  item: PlayerItem;
  uid?: string;
  scrollRootRef: React.RefObject<Element | null>;
  onOpenComments: (deedId: string) => void;
  isMobile: boolean;
  cardH: number;
  dataSaverOn?: boolean;
  hlsMaxHeight?: number;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const fsVideoRef = React.useRef<HTMLVideoElement | null>(null);

  const { muted, toggleMute, registerVideo, unregisterVideo } = useGlobalMute();
  const router = useRouter();
  const authorProfile = useAuthorProfile(item.authorId);

  const [mediaReady, setMediaReady] = useState(item.mediaType !== "video");
  const [fitMode, setFitMode] = useState<"cover" | "contain">("cover");
  const firstFrameFiredRef = useRef(false);

  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenKind, setFullscreenKind] = useState<"video" | "photo" | null>(null);

  const { liked, count: likeCount, toggle: toggleLike } = useLikes(item.id, uid);
  const commentsCount = useCommentsCount(item.id);
  const { saved, toggle: toggleSave } = useBookmarks(item.id, uid);
  const totalBookmarks = useBookmarkTotalFromDeed(item.id);
  const totalShares = useShareTotalFromDeed(item.id);
  const { following, followersCount, toggle: toggleFollow } = useFollowAuthor(item.authorId, uid);

  const [donateOpen, setDonateOpen] = useState(false);

  const canSupport = !!item.authorId && uid !== item.authorId;
  const showFollow = (!uid || uid !== item.authorId) && !following;

  const avatar = authorProfile?.photoURL || item.authorPhotoURL || "/avatar-placeholder.png";
  const music = item.music;
  const isLibrarySound = music?.source === "library" && !!music?.coverUrl;
  const soundLabel = isLibrarySound ? music?.title || "Library sound" : "Original sound";
  const soundAvatar = isLibrarySound ? (music?.coverUrl as string) : avatar;

  const [playing, setPlaying] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);

  const tags = useMemo(() => (item.tags ?? []).filter(Boolean), [item.tags]);
  const MAX_COLLAPSED_TAGS = 3;

  const hasCaption = !!item.text;
  const hasTags = tags.length > 0;
  const captionTooLong = (item.text?.length ?? 0) > 80;
  const tagsHidden = tags.length > MAX_COLLAPSED_TAGS;
  const visibleTags = captionExpanded ? tags : tags.slice(0, MAX_COLLAPSED_TAGS);
  const showMoreToggle = captionTooLong || tagsHidden;

  // fire first frame
  const fireFirstFrameOnce = useCallback(() => {
    if (firstFrameFiredRef.current) return;
    firstFrameFiredRef.current = true;
  }, []);

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

  // autoplay
  useAutoPlay(videoRef, {
    root: scrollRootRef,
    threshold: isMobile ? 0.55 : 0.35,
    rootMargin: isMobile ? "-10% 0px -10% 0px" : "-30% 0px -30% 0px",
    initialMuted: muted,
  });

  useHls(videoRef, item.mediaUrl || undefined, { maxHeight: hlsMaxHeight });
  useHls(
    fsVideoRef,
    fullscreenOpen && fullscreenKind === "video" ? item.mediaUrl || undefined : undefined,
    { maxHeight: hlsMaxHeight }
  );

  // register inline video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    registerVideo(v);
    return () => unregisterVideo(v);
  }, [registerVideo, unregisterVideo]);

  useEffect(() => {
    if (videoRef.current) (videoRef.current as any).muted = muted;
  }, [muted]);

  // fullscreen register
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

  useEffect(() => {
    if (!fullscreenOpen || fullscreenKind !== "video") return;
    const v = fsVideoRef.current;
    if (!v) return;
    (v as any).muted = muted;
  }, [muted, fullscreenOpen, fullscreenKind]);

  // playing state
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

  // reset expanded on new item
  useEffect(() => setCaptionExpanded(false), [item.id]);

  // view logging (same logic)
  const viewLoggedRef = useRef(false);
  useEffect(() => {
    viewLoggedRef.current = false;
  }, [item.id]);

  useEffect(() => {
    if (viewLoggedRef.current) return;

    if (item.mediaType === "photo") {
      const t = window.setTimeout(async () => {
        if (viewLoggedRef.current) return;
        viewLoggedRef.current = true;
        await recordViewWeb({ deedId: item.id, uid });
      }, 2000);
      return () => window.clearTimeout(t);
    }

    if (item.mediaType === "video") {
      const v = videoRef.current;
      if (!v) return;

      const onTime = async () => {
        if (viewLoggedRef.current) return;

        const watchedMs = (v.currentTime ?? 0) * 1000;
        const durMs = (v.duration ?? 0) * 1000;
        const ratio = durMs ? watchedMs / durMs : 0;

        if (watchedMs >= 3000 || ratio >= 0.4) {
          viewLoggedRef.current = true;
          v.removeEventListener("timeupdate", onTime);
          await recordViewWeb({ deedId: item.id, uid });
        }
      };

      v.addEventListener("timeupdate", onTime);
      return () => v.removeEventListener("timeupdate", onTime);
    }
  }, [item.id, item.mediaType, uid]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) pauseIfCurrent(v);
    else playExclusive(v);
  };

  const onShare = async () => {
    const handle = authorProfile?.handle || item.authorUsername;
    const url = handle
      ? `${location.origin}/${encodeURIComponent(handle.startsWith("@") ? handle : `@${handle}`)}/deed/${item.id}`
      : `${location.origin}/`;

    try {
      if (navigator.share) {
        await navigator.share({ title: item.text || "ekarihub", text: item.text || "", url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied!");
      }

      const baseId = uid ?? getOrMakeDeviceId();
      const sid = `${item.id}_${baseId}_${Date.now()}`;
      const payload: any = { deedId: item.id, createdAt: serverTimestamp() };

      if (uid) {
        const userSnap = await getUserSnap(uid);
        payload.userId = uid;
        payload.user = {
          name: userSnap.name ?? null,
          handle: userSnap.handle ?? null,
          photoURL: userSnap.photoURL ?? null,
        };
      } else {
        payload.deviceId = baseId;
      }
      await setDoc(doc(db, "shares", sid), payload);
    } catch { }
  };

  const onLikeClick = () => {
    if (!uid) return router.push("/getstarted?next=/");
    toggleLike();
  };
  const onSaveClick = () => {
    if (!uid) return router.push("/getstarted?next=/");
    toggleSave();
  };
  const onCommentsClick = () => {
    if (!uid) return router.push("/getstarted?next=/");
    onOpenComments(item.id);
  };
  const onFollowClick = async () => {
    if (!uid) return router.push("/getstarted?next=/");
    await toggleFollow();
  };
  const onSupportClick = () => {
    if (!uid) return router.push("login/?next=/");
    setDonateOpen(true);
  };

  const onViewProfileClick = () => {
    const handle = authorProfile?.handle || item.authorUsername;
    if (!handle) return;
    router.push(`/${encodeURIComponent(handle.startsWith("@") ? handle : `@${handle}`)}`);
  };

  // ✅ MOBILE-ONLY TikTok UI mode tuning
  const railBtn = isMobile ? "h-14 w-14" : "h-10 w-10";
  const railIcon = isMobile ? 26 : 22;
  const railCount = isMobile ? "text-[10px]" : "text-[10px]";
  //const railTextColor = isMobile ? "text-white" : "md:text-gray-900 text-white";
  const railTextColor = isMobile ? "text-white" : "text-white";
  const railBg = isMobile ? "bg-white/10 border-white/15" : "bg-black/40 md:bg-white/95 border-white/30 md:border-gray-200";

  return (
    <div className={cn("relative w-full", isMobile ? "" : "py-1")}>
      <article
        className={cn(
          "group relative overflow-hidden bg-black",
          isMobile
            ? "w-full rounded-none shadow-none"
            : "w-full lg:w-[375px] rounded-[28px] shadow-[0_22px_60px_rgba(0,0,0,.65)] bg-gradient-to-b from-[#0B1513] via-black to-black",
          !isMobile && "transition-transform duration-300 ease-out md:hover:-translate-y-1 md:hover:shadow-[0_28px_80px_rgba(0,0,0,.85)]"
        )}
        style={{ height: cardH }}
      >
        {!mediaReady && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <BouncingBallLoader />
          </div>
        )}

        {/* top controls */}
        {item.mediaType === "video" && (
          <>
            <div className="absolute left-3 top-[50px] z-20 flex items-center gap-2">
              <button
                onClick={toggleMute}
                aria-label={muted ? "Unmute video (global)" : "Mute video (global)"}
                className="rounded-full bg-black/40 text-white p-2 hover:bg-black/70 backdrop-blur-sm border border-white/20"
              >
                {muted ? <IoVolumeMute size={18} /> : <IoVolumeHigh size={18} />}
              </button>
            </div>

            {/* ✅ hide desktop hover play button on mobile */}
            {!isMobile && (
              <button
                onClick={togglePlay}
                aria-label={playing ? "Pause video" : "Play video"}
                className={cn(
                  "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20",
                  "rounded-full bg-black/40 text-white p-5 shadow-lg hover:bg-black/75",
                  "backdrop-blur-sm transition-opacity duration-200",
                  playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                )}
              >
                {playing ? <IoPause size={28} /> : <IoPlay size={28} />}
              </button>
            )}
          </>
        )}

        {/* fullscreen toggle */}
        {item.mediaUrl && (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
            <button
              onClick={() => {
                if (item.mediaType === "video") {
                  const v = videoRef.current;
                  if (v) pauseIfCurrent(v);
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

        {/* media */}
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
                "h-full w-full",
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
              className={cn("h-full w-full", fitMode === "contain" ? "object-contain" : "object-cover")}
              onLoad={handleImageReady}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-white/90">No media</div>
          )}
        </div>

        {/* bottom overlay */}
        <div
          className={cn(
            "absolute left-0 right-0 bottom-0",
            "bg-gradient-to-t from-black/85 via-black/35 to-transparent",
            "transition-opacity duration-200",
            mediaReady ? "opacity-100" : "opacity-0 pointer-events-none",
            isMobile ? "p-4 pb-16 mr-[60px]" : "p-4"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              onClick={onViewProfileClick}
              className={cn(
                "relative h-10 w-10 rounded-full overflow-hidden bg-gray-200 shrink-0",
                (authorProfile?.handle || item.authorUsername) ? "cursor-pointer" : "cursor-default"
              )}
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#C79257] via-transparent to-[#233F39] opacity-70" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt={authorProfile?.handle || item.authorUsername || item.authorId || "author"}
                className="relative h-full w-full object-cover border border-white/30 rounded-full"
              />
            </div>

            <div onClick={onViewProfileClick} className="cursor-pointer min-w-0 flex flex-col">
              <div className="text-white/95 font-bold text-sm truncate">
                {authorProfile?.handle
                  ? authorProfile.handle
                  : item.authorUsername
                    ? item.authorUsername
                    : (item.authorId ?? "").slice(0, 6)}
              </div>
              <div className="text-white/70 text-[11px]" title={`${followersCount} followers`}>
                {formatCount(followersCount)} Followers
              </div>
            </div>

            {showFollow && (
              <button
                onClick={onFollowClick}
                className="ml-auto rounded-full px-3 py-1 text-xs font-bold text-white bg-[#C79257] hover:bg-[#FCD34D] shadow-sm"
              >
                Follow
              </button>
            )}
          </div>

          {/* ✅ TikTok-style caption spacing */}
          {(hasCaption || hasTags) && (
            <motion.div className="mt-1 w-full" layout transition={{ type: "spring", stiffness: 260, damping: 26 }}>
              {hasCaption && (
                <div className="relative w-full">
                  <motion.p
                    layout
                    className={cn(
                      "text-white/95 w-full text-[14px] leading-5",
                      "cursor-pointer",
                      captionExpanded ? "" : "line-clamp-2"
                    )}
                    onClick={() => setCaptionExpanded((v) => !v)}
                  >
                    {item.text}
                  </motion.p>
                </div>
              )}

              {hasTags && (
                <motion.div layout className="mt-2 w-full flex flex-wrap items-center gap-2">
                  {visibleTags.map((tag: any) => (
                    <button
                      key={tag}
                      type="button"
                      className="px-2.5 py-1 rounded-full border border-white/25 bg-black/25 text-[12px] text-white font-semibold hover:bg-black/60 transition-colors"
                      onClick={() => router.push(`/search?tag=${encodeURIComponent(tag)}&tab=Tags`)}
                    >
                      #{tag}
                    </button>
                  ))}
                  {showMoreToggle && (
                    <button
                      type="button"
                      onClick={() => setCaptionExpanded((v) => !v)}
                      className="text-[12px] text-white/90 font-semibold"
                    >
                      {captionExpanded ? "less" : "… more"}
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* sound row */}
          <div className="mt-3 flex items-center gap-2">
            {isLibrarySound && (
              <div className="h-6 w-6 rounded-full overflow-hidden bg-black/40 flex-shrink-0 border border-white/25">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={soundAvatar} alt={soundLabel} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex items-center gap-2 text-[12px] text-white/85 min-w-0">
              <IoMusicalNotesOutline className="flex-shrink-0" size={16} />
              <span className="truncate max-w-[220px]">{soundLabel}</span>
            </div>
          </div>
        </div>

        {/* action rail */}
        <div
          className={cn(
            "absolute z-40 flex flex-col items-center gap-2",
            "right-3 top-1/2 -translate-y-1/2",
            "transition-opacity duration-200",
            mediaReady ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}

        >

          {canSupport && (
            <>
              <button
                aria-label="Uplift this deed"
                title="Uplift this deed"
                onClick={onSupportClick}
                className={cn(
                  railBtn,
                  "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition backdrop-blur-sm border",
                  railBg
                )}
              >
                💰
              </button>
              <div className={cn("mt-0.5 leading-3 font-bold", railCount, railTextColor)}>Uplift</div>
            </>
          )}

          <button
            aria-label="Like"
            aria-pressed={liked}
            onClick={onLikeClick}
            className={cn(
              railBtn,
              "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition backdrop-blur-sm border",
              railBg
            )}
          >
            <IoHeart size={railIcon} style={{ color: likeCount ? THEME.forest : THEME.gold }} />
          </button>
          <div className={cn("mt-0.5 leading-3 font-extrabold", railCount, railTextColor)}>{formatCount(likeCount)}</div>

          <button
            aria-label="Comments"
            onClick={onCommentsClick}
            className={cn(
              railBtn,
              "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition backdrop-blur-sm border",
              railBg
            )}
          >
            <IoChatbubble size={railIcon} style={{ color: commentsCount ? THEME.forest : THEME.gold }} />
          </button>
          <div className={cn("mt-0.5 leading-3 font-extrabold", railCount, railTextColor)}>{formatCount(commentsCount)}</div>

          <button
            aria-label="Save"
            onClick={onSaveClick}
            className={cn(
              railBtn,
              "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition backdrop-blur-sm border",
              railBg
            )}
          >
            <IoBookmark size={railIcon} style={{ color: totalBookmarks ? THEME.forest : THEME.gold }} />
          </button>
          <div className={cn("mt-0.5 leading-3 font-extrabold", railCount, railTextColor)}>{formatCount(totalBookmarks)}</div>

          <button
            aria-label="Share"
            onClick={onShare}
            className={cn(
              railBtn,
              "grid place-items-center rounded-full hover:shadow-lg hover:scale-105 active:scale-95 transition backdrop-blur-sm border",
              railBg
            )}
          >
            <IoArrowRedo size={railIcon} style={{ color: totalShares ? THEME.forest : THEME.gold }} />
          </button>
          <div className={cn("mt-0.5 leading-3 font-extrabold", railCount, railTextColor)}>{formatCount(totalShares)}</div>
          {/* ✅ MOBILE: mute/unmute lives on rail so it never gets hidden */}
          {isMobile && item.mediaType === "video" && (
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className={cn(
                railBtn,
                "grid place-items-center text-white  hover:scale-105 active:scale-95 transition"
              )}
            >
              {muted ? <IoVolumeMute size={18} /> : <IoVolumeHigh size={18} />}
            </button>
          )}
        </div>
      </article>

      {/* fullscreen */}
      {fullscreenOpen && item.mediaUrl && (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center">
          <button
            onClick={() => {
              setFullscreenOpen(false);
              setFullscreenKind(null);
              const v = fsVideoRef.current;
              if (v) pauseIfCurrent(v);
            }}
            className="absolute top-4 right-4 rounded-full bg-black/70 border border-white/30 p-2 text-white hover:bg-black/90"
            aria-label="Close fullscreen"
            title="Close"
          >
            <IoClose size={20} />
          </button>

          {fullscreenKind === "video" && item.mediaType === "video" && item.mediaUrl && (
            <video
              ref={fsVideoRef}
              poster={item.posterUrl || undefined}
              playsInline
              loop
              controls
              className="max-h-[92vh] max-w-[92vw] object-contain"
              src={item.mediaUrl.endsWith(".m3u8") ? undefined : item.mediaUrl}
              onClick={(e) => {
                const v = e.currentTarget;
                if (v.paused) playExclusive(v);
                else pauseIfCurrent(v);
              }}
            />
          )}

          {fullscreenKind === "photo" && item.mediaType === "photo" && item.mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.mediaUrl} alt={item.text || "photo"} className="max-h-[92vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl" />
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

/* ---------- Step scroll (1 item per screen) ---------- */
function useStepScroll(
  rootRef: React.RefObject<HTMLElement | null>,
  getCount: () => number,
  enabled = true
) {
  const lockRef = useRef(false);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const targetTopRef = useRef<number | null>(null);

  const step = () => {
    const root = rootRef.current;
    return root?.clientHeight ?? window.innerHeight;
  };

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

/* ---------- FeedShell ---------- */
function FeedShell() {
  const { user } = useAuth();
  const uid = user?.uid;

  const router = useRouter();
  const profile = useUserProfile(uid);

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const { effectiveType, saveData } = useNetworkProfile();
  const userDataSaver = !!profile?.dataSaverVideos;
  const isVerySlow = effectiveType === "2g" || effectiveType === "slow-2g";
  const isFast = effectiveType === "4g" || effectiveType === "5g";
  const globalDataSaverOn = !!saveData;

  const dataSaverOn = userDataSaver || globalDataSaverOn || isVerySlow;
  const preloadMode: PreloadMode = dataSaverOn ? "none" : isFast && !globalDataSaverOn ? "aggressive" : "light";

  let hlsMaxHeight: number | undefined;
  if (dataSaverOn || isVerySlow) hlsMaxHeight = 480;
  else if (!isFast) hlsMaxHeight = 720;
  else hlsMaxHeight = undefined;

  const [tab, setTab] = useState<TabKey>("forYou");
  const { items, loading } = useChannelFeed(tab, uid);

  const showTopLoader = useProgressIndicator(loading);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [commentsId, setCommentsId] = useState<string | null>(null);

  // ✅ Mobile TikTok sizing: card = full screen
  const TAB_BAR_H = 56;
  const { h: cardH } = useDeedBox({
    railOpen: !!commentsId,
    topOffsetPx: TAB_BAR_H,
    isMobile,
  });

  const openComments = useCallback((id: string) => setCommentsId(id), []);
  const closeComments = useCallback(() => setCommentsId(null), []);

  // lock body behind mobile sheet
  useEffect(() => {
    if (!isDesktop && commentsId) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isDesktop, commentsId]);

  // esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeComments();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeComments]);

  // step scroll
  const { goPrev, goNext, index } = useStepScroll(scrollerRef as any, () => items.length, true);
  const atTop = index <= 0;
  const atEnd = index >= Math.max(0, items.length - 1);

  // data saver toggle
  const [updatingDataSaver, setUpdatingDataSaver] = useState(false);
  const toggleUserDataSaver = useCallback(async () => {
    if (!uid) return router.push("/getstarted?next=/");
    if (updatingDataSaver) return;
    setUpdatingDataSaver(true);
    try {
      await setDoc(doc(db, "users", uid), { dataSaverVideos: !userDataSaver }, { merge: true });
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

  const goUpload = () => {
    if (!uid) router.push("/getstarted?next=/studio/upload");
    else router.push("/studio/upload");
  };

  return (
    <MuteProvider>
      {isMobile ? (
        <MobileShell
          uid={uid}
          user={user}
          profile={profile}
          tab={tab}
          setTab={setTab}
          items={items}
          loading={loading}
          commentsId={commentsId}
          openComments={openComments}
          closeComments={closeComments}
          cardH={cardH}
          scrollerRef={scrollerRef}
          dataSaverOn={dataSaverOn}
          toggleUserDataSaver={toggleUserDataSaver}
          preloadMode={preloadMode}
          index={index}
          hlsMaxHeight={hlsMaxHeight}
          goUpload={goUpload}
          changeTab={changeTab}
        />
      ) : (
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
          {/* ✅ nicer desktop background */}
          <div className={cn("fixed inset-0 -z-10", isMobile ? "bg-black" : "bg-gradient-to-b from-gray-50 via-white to-gray-50")} />

          <OpenInAppBanner
            webUrl={typeof window !== "undefined" ? window.location.href : "https://ekarihub.com/"}
            appUrl="ekarihub://"
            title="Open ekarihub in the app"
            subtitle="Best experience in the app."
          />

          {/* scroller */}
          <section
            ref={scrollerRef}
            tabIndex={0}
            className={cn(
              "w-full flex flex-col items-center overflow-y-scroll no-scrollbar scroll-smooth outline-none",
              isMobile ? "bg-black" : "bg-transparent"
            )}
            style={{
              height: "100svh",
              scrollSnapType: "y mandatory" as any,
              overscrollBehaviorY: "contain",

            }}
          >
            {/* sticky bar */}
            <div className="sticky top-0 z-30 w-full">
              <div
                className="relative h-[56px] w-full p-1 border-b backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl"
                style={{
                  background: "linear-gradient(135deg, rgba(35,63,57,0.94), rgba(199,146,87,0.87))",
                  borderColor: "rgba(15,23,42,0.18)",
                  boxShadow: "0 16px 40px rgba(15,23,42,0.35)",
                }}
              >
                <ChannelTabs
                  uid={uid}
                  commentsId={commentsId ?? ""}
                  active={tab}
                  onChange={changeTab}
                  dataSaverOn={dataSaverOn}
                  onToggleDataSaver={toggleUserDataSaver}
                />
                <TopLoader active={showTopLoader} color="#FDE68A" />
              </div>
            </div>

            {/* loading skeleton */}
            {showTopLoader && items.length === 0 && (
              <div
                data-snap-item="1"
                className="w-full snap-start flex items-center justify-center"
                style={{
                  height: cardH,                 // keeps your snap sizing
                  minHeight: "100vh",            // ensures true screen-centering
                  scrollSnapStop: "always",
                  // padding: "16px",
                }}
              >
                <SkeletonCard cardH={cardH} isMobile={isMobile} />
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className={cn("py-10 text-sm", isMobile ? "text-white/80" : "text-gray-600")}>
                No deeds yet.
              </div>
            )}

            {/* ✅ each deed is exactly one screen on mobile */}
            {items.map((item) => (
              <div
                key={item.id}
                data-snap-item="1"
                className={cn(
                  "w-full snap-start",
                  // ✅ center feed area on desktop
                  isMobile ? "" : "flex justify-center",
                  // ✅ add spacing so first card doesn't sit under the top bar
                  isMobile ? "" : "pt-[60px] mb-2"
                )}
                style={{
                  height: cardH,
                  scrollSnapStop: "always",
                }}
              >
                <div className={cn(isMobile ? "w-full" : "w-full max-w-[420px]")}>
                  <VideoCard
                    item={item}
                    uid={uid}
                    scrollRootRef={scrollerRef}
                    onOpenComments={openComments}
                    isMobile={isMobile}
                    cardH={cardH}
                    dataSaverOn={dataSaverOn}
                    hlsMaxHeight={hlsMaxHeight}
                  />
                </div>
              </div>

            ))}
          </section>

          {/* desktop up/down */}
          <div className="hidden lg:inline">
            <div className="fixed right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3">
              <button
                onClick={goPrev}
                disabled={atTop}
                aria-label="Previous"
                className="rounded-full border border-gray-200 bg-white shadow p-2 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <IoChevronUp size={18} />
              </button>
              <button
                onClick={goNext}
                disabled={atEnd}
                aria-label="Next"
                className="rounded-full border border-gray-200 bg-white shadow p-2 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
              >
                <IoChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* mobile upload FAB */}
          <button
            className="lg:hidden fixed right-4 bottom-4 rounded-full shadow-md p-4 text-white z-[55]"
            style={{ backgroundColor: EKARI.primary }}
            aria-label="Upload"
            onClick={goUpload}
          >
            <IoAdd size={24} />
          </button>

          {/* mobile comments sheet */}
          <div
            className={cn(
              "lg:hidden fixed inset-0 z-[60] transition",
              commentsId ? "pointer-events-auto" : "pointer-events-none"
            )}
            aria-hidden={!commentsId}
          >
            <div
              className={cn(
                "absolute inset-0 backdrop-blur-[2px] transition-opacity",
                commentsId ? "opacity-100" : "opacity-0"
              )}
              onClick={closeComments}
            />
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 max-h-[88vh] h-[80vh]",
                "rounded-t-2xl bg-white shadow-xl",
                "transition-transform duration-300 will-change-transform",
                commentsId ? "translate-y-0" : "translate-y-full"
              )}
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

          <AdjacentPreloadWeb items={items} activeIndex={index} mode={preloadMode} />
        </AppShell>)}
    </MuteProvider>
  );
}
function useIsActivePath(href: string, alsoMatch: string[] = []) {
  const pathname = usePathname() || "/";
  const matches = [href, ...alsoMatch];
  return matches.some(
    (m) =>
      pathname === m ||
      (m !== "/" && pathname.startsWith(m + "/")) ||
      (m === "/" && pathname === "/")
  );
}

function badgeText(n?: number) {
  if (!n || n <= 0) return "";
  if (n > 999) return "999+";
  if (n > 99) return "99+";
  return String(n);
}
type MenuItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  alsoMatch?: string[];
  requiresAuth?: boolean;
  badgeCount?: number;
};


function SideMenuSheet({
  open,
  onClose,
  onNavigate,
  items,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string, requiresAuth?: boolean) => void;
  items: MenuItem[];
}) {
  // lock scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[120] transition",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {/* backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* sheet */}
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-[86%] max-w-[340px]",
          "bg-white shadow-2xl border-r",
          "transition-transform duration-300 will-change-transform",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ borderColor: EKARI.hair }}
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div className="h-[56px] px-4 flex items-center justify-between border-b" style={{ borderColor: EKARI.hair }}>
          <div className="font-black" style={{ color: EKARI.text }}>Menu</div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl grid place-items-center border hover:bg-black/5"
            style={{ borderColor: EKARI.hair }}
            aria-label="Close menu"
          >
            <IoClose size={20} />
          </button>
        </div>

        {/* items */}
        <nav className="p-2 overflow-y-auto h-[calc(100%-56px)]">
          {items.map((it) => (
            <MenuRow
              key={it.key}
              item={it}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function MenuRow({
  item,
  onNavigate,
}: {
  item: MenuItem;
  onNavigate: (href: string, requiresAuth?: boolean) => void;
}) {
  const active = useIsActivePath(item.href, item.alsoMatch);
  const bt = badgeText(item.badgeCount);
  const showBadge = !!bt;

  return (
    <button
      onClick={() => onNavigate(item.href, item.requiresAuth)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition",
        "hover:bg-black/5"
      )}
      style={{
        color: EKARI.text,
        backgroundColor: active ? "rgba(199,146,87,0.10)" : undefined,
        border: active ? "1px solid rgba(199,146,87,0.35)" : "1px solid transparent",
      }}
    >
      <span
        className="relative h-10 w-10 rounded-xl grid place-items-center border bg-white"
        style={{ borderColor: active ? "rgba(199,146,87,0.45)" : EKARI.hair }}
      >
        <span style={{ color: active ? THEME.gold : THEME.forest }} className="text-[18px]">
          {item.icon}
        </span>

        {showBadge && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-[6px] rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-sm">
            {bt}
          </span>
        )}
      </span>

      <div className="flex-1 min-w-0">
        <div className={cn("text-sm truncate", active ? "font-black" : "font-extrabold")}>
          {item.label}
        </div>

      </div>

      <IoChevronForward size={18} style={{ color: EKARI.subtext }} />
    </button>
  );
}

function MobileShell(props: any) {
  const {
    uid,
    user,
    profile,
    tab,
    changeTab,
    items,
    loading,
    commentsId,
    openComments,
    closeComments,
    cardH,
    scrollerRef,
    dataSaverOn,
    toggleUserDataSaver,
    preloadMode,
    index,
    hlsMaxHeight,
    goUpload,
  } = props;

  type MenuItem = {
    key: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    alsoMatch?: string[];
    requiresAuth?: boolean;
    badgeCount?: number;
  };

  function buildFullMenu(params: {
    uid?: string;
    handle?: string | null;
    notifTotal?: number;
    unreadDM?: number;
  }) {
    const { uid, handle, notifTotal, unreadDM } = params;

    const profileHref =
      handle && handle.trim().length > 0 ? `/${handle}` : "/getstarted";

    const items: MenuItem[] = [
      { key: "deeds", label: "Deeds", href: "/", icon: <IoHomeOutline /> },
      { key: "market", label: "ekariMarket", href: "/market", icon: <IoCartOutline /> },
      { key: "nexus", label: "Nexus", href: "/nexus", icon: <IoCompassOutline /> },

      {
        key: "studio",
        label: "Deed studio",
        href: "/studio/upload",
        icon: <IoFilmOutline />,
        requiresAuth: true,
      },
      {
        key: "notifications",
        label: "Notifications",
        href: "/notifications",
        icon: <IoNotificationsOutline />,
        requiresAuth: true,
        badgeCount: uid ? notifTotal ?? 0 : 0,
      },
      {
        key: "bonga",
        label: "Bonga",
        href: "/bonga",
        icon: <IoChatbubbleOutline />,
        requiresAuth: true,
        badgeCount: uid ? unreadDM ?? 0 : 0,
      },
      { key: "ai", label: "ekari AI", href: "/ai", icon: <IoSparklesOutline /> },

      // ✅ the two extra ones you have on desktop:
      {
        key: "profile",
        label: "Profile",
        href: profileHref,
        icon: <IoPersonCircleOutline />,
        requiresAuth: true,
      },
      {
        key: "about",
        label: "About ekarihub",
        href: "/about",
        icon: <IoInformationCircleOutline />,
      },
    ];

    return items;
  }
  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ same hook used by LeftNavDesktop
  const { unreadDM, notifTotal } = useInboxTotalsWeb(!!uid, uid);

  // if you have profile handle available here, pass it. If not, just null.
  const handle = (profile as any)?.handle ?? null;

  const fullMenu = useMemo(
    () =>
      buildFullMenu({
        uid,
        handle,
        notifTotal,
        unreadDM,
      }),
    [uid, handle, notifTotal, unreadDM]
  );

  const navigateFromMenu = (href: string, requiresAuth?: boolean) => {
    setMenuOpen(false);
    if (requiresAuth && !uid) {
      window.location.href = `/getstarted?next=${encodeURIComponent(href)}`;
      return;
    }
    window.location.href = href;
  };

  // ✅ Full-bleed black background like TikTok / your app
  return (
    <div className="fixed inset-0 bg-black">
      {/* TikTok-style "Open app" bar */}
      <OpenInAppBanner
        webUrl={typeof window !== "undefined" ? window.location.href : "https://ekarihub.com/"}
        appUrl="ekarihub://"
        title="Open ekarihub"
        subtitle="Best experience in the app."
      //variant="tiktok"
      />

      {/* Feed scroller */}
      <section
        ref={scrollerRef}
        tabIndex={0}
        className="w-full h-[100svh] overflow-y-scroll no-scrollbar scroll-smooth outline-none"
        style={{
          scrollSnapType: "y mandatory" as any,
          overscrollBehaviorY: "contain",
          paddingBottom: "calc(72px + env(safe-area-inset-bottom))", // ✅ keep above bottom tabs
        }}
      >
        {/* Top overlay bar (tabs + icons) */}
        <div className="sticky top-2 z-50">
          <div
            className="h-[50px] w-full px-3 flex items-center justify-between"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,0))",
            }}
          >
            <button
              onClick={() => setMenuOpen(true)}
              className="h-9 w-9 grid place-items-center text-white"
              aria-label="Open menu"
            >
              <IoMenu size={20} />
            </button>

            {/* Left: Dive In */}
            <button
              onClick={() => (window.location.href = "/dive")}
              className="px-2 lg:px-3 py-2 rounded-full bg-white/15 text-white text-[10px] lg:text-xs font-semibold backdrop-blur-md border border-white/10"
            >
              Dive In
            </button>

            {/* Center: tabs */}
            <div className="flex items-center gap-1 lg:gap-2 bg-white/15 rounded-full p-1 backdrop-blur-md border border-white/10">
              {TABS.map((k) => {
                const isActive = tab === k;
                return (
                  <button
                    key={k}
                    onClick={() => changeTab(k)}
                    className={cn(
                      "px-1 lg:px-3 py-2 w-[56px] lg:w-full rounded-full text-[10px] lg:text-xs font-bold",
                      isActive ? "bg-white text-black" : "text-white/90"
                    )}
                  >
                    {LABEL[k]}
                  </button>
                );
              })}
            </div>

            {/* Right: search + avatar */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => (window.location.href = "/search")}
                className="h-10 w-10 rounded-full bg-white/15 grid place-items-center text-white backdrop-blur-md border border-white/10"
                aria-label="Search"
              >
                <IoSearch size={18} />
              </button>

              <button
                onClick={() => (window.location.href = uid ? "/profile" : "/getstarted?next=/")}
                className="h-10 w-10 rounded-full overflow-hidden bg-white/10 border border-white/10"
                aria-label="Profile"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile?.photoURL ?? user?.photoURL ?? "/avatar-placeholder.png"}
                  alt="Me"
                  className="h-full w-full object-cover"
                />
              </button>
            </div>
          </div>
        </div>

        {/* Feed items (1 per screen) */}
        {items.map((item: PlayerItem) => (
          <div
            key={item.id}
            data-snap-item="1"
            className="w-full snap-start"
            style={{ height: cardH, scrollSnapStop: "always" }}
          >
            <VideoCard
              item={item}
              uid={uid}
              scrollRootRef={scrollerRef}
              onOpenComments={openComments}
              isMobile={true}
              cardH={cardH}
              dataSaverOn={dataSaverOn}
              hlsMaxHeight={hlsMaxHeight}
            />
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="py-10 text-sm text-white/80 text-center">No deeds yet.</div>
        )}
      </section>
      {/* MOBILE comments sheet */}
      <div
        className={cn(
          "fixed inset-0 z-[90] transition",
          commentsId ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!commentsId}
      >
        {/* backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity",
            commentsId ? "opacity-100" : "opacity-0"
          )}
          onClick={closeComments}
        />

        {/* sheet */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 max-h-[88vh] h-[80vh]",
            "rounded-t-2xl bg-white shadow-xl",
            "transition-transform duration-300 will-change-transform",
            commentsId ? "translate-y-0" : "translate-y-full"
          )}
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
              photoURL: profile?.photoURL ?? user?.photoURL ?? null,
              handle: profile?.handle ?? null,
              name: (user as any)?.displayName ?? null,
            }}
          />
        </div>
      </div>
      <SideMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={navigateFromMenu}
        items={fullMenu}
      />

      {/* Bottom tabs like your app */}
      <MobileBottomTabs onUpload={goUpload} />
    </div>
  );
}

function MobileBottomTabs({ onUpload }: { onUpload: () => void }) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"; // ✅ only exact home
    return pathname === href || pathname.startsWith(href + "/");
  };

  const activeClass = "text-white";
  const inactiveClass = "text-white/70";

  const activeIconStyle = { color: EKARI.primary };
  const inactiveIconStyle = { color: "rgba(255,255,255,.70)" };

  const homeActive = isActive("/");
  const marketActive = isActive("/market");
  const nexusActive = isActive("/nexus");
  const bongaActive = isActive("/bonga");

  return (
    <div
      className="fixed left-0 right-0 z-[60]"
      style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto w-full max-w-[520px] h-[64px] px-4 flex items-center justify-between"
        style={{
          backgroundColor: "#000000",
          borderTop: "1px solid rgba(255,255,255,.10)",
        }}
      >
        {/* Home / Deeds */}
        <button
          onClick={() => router.push("/")}
          className={`flex flex-col items-center gap-1 ${homeActive ? activeClass : inactiveClass}`}
          aria-current={homeActive ? "page" : undefined}
        >
          {homeActive ? (
            <IoHome size={20} style={activeIconStyle} />
          ) : (
            <IoHomeOutline size={20} style={inactiveIconStyle} />
          )}
          <span className={`text-[11px] ${homeActive ? "font-black" : "font-semibold"}`}>
            Deeds
          </span>
          {homeActive && (
            <span
              className="mt-0.5 h-[3px] w-6 rounded-full"
              style={{ backgroundColor: EKARI.primary }}
            />
          )}
        </button>

        {/* Market */}
        <button
          onClick={() => router.push("/market")}
          className={`flex flex-col items-center gap-1 ${marketActive ? activeClass : inactiveClass}`}
          aria-current={marketActive ? "page" : undefined}
        >
          <IoCartOutline size={20} style={marketActive ? activeIconStyle : inactiveIconStyle} />
          <span className={`text-[11px] ${marketActive ? "font-black" : "font-semibold"}`}>
            ekariMarket
          </span>
        </button>

        {/* Center + */}
        <button
          onClick={onUpload}
          className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg"
          style={{ backgroundColor: EKARI.primary }}
          aria-label="Create"
        >
          <IoAdd size={26} color="#111827" />
        </button>

        {/* Nexus */}
        <button
          onClick={() => router.push("/nexus")}
          className={`flex flex-col items-center gap-1 ${nexusActive ? activeClass : inactiveClass}`}
          aria-current={nexusActive ? "page" : undefined}
        >
          <IoCompassOutline size={20} style={nexusActive ? activeIconStyle : inactiveIconStyle} />
          <span className={`text-[11px] ${nexusActive ? "font-black" : "font-semibold"}`}>
            Nexus
          </span>
        </button>

        {/* Bonga */}
        <button
          onClick={() => router.push("/bonga")}
          className={`flex flex-col items-center gap-1 ${bongaActive ? activeClass : inactiveClass}`}
          aria-current={bongaActive ? "page" : undefined}
        >
          <IoChatbubblesOutline size={20} style={bongaActive ? activeIconStyle : inactiveIconStyle} />
          <span className={`text-[11px] ${bongaActive ? "font-black" : "font-semibold"}`}>
            Bonga
          </span>
        </button>
      </div>
    </div>
  );
}


/* ---------- Root ---------- */
export default function RootPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const decidedRef = useRef(false);
  const [phase, setPhase] = useState<"splash" | "feed">("splash");

  const SPLASH_KEY = "__ekari_splash_seen_v1__";
  const [splashSeen, setSplashSeen] = useState<boolean>(false);

  useEffect(() => {
    router.prefetch("/deeds");
    router.prefetch("/getstarted");
    router.prefetch("/studio/upload");
  }, [router]);

  useEffect(() => {
    try {
      const seen = sessionStorage.getItem(SPLASH_KEY) === "1";
      if (seen) {
        setSplashSeen(true);
        setPhase("feed");
      }
    } catch { }
  }, []);

  useEffect(() => {
    if (authLoading || decidedRef.current) return;

    (async () => {
      decidedRef.current = true;

      const minDelay = splashSeen ? Promise.resolve() : new Promise((r) => setTimeout(r, 600));
      let goFeed = true;

      try {
        if (user?.uid) {
          const snap = await getDoc(doc(db, "users", user.uid));
          const data = snap.exists() ? (snap.data() as { handle?: string }) : undefined;
          const hasHandle = typeof data?.handle === "string" && data.handle.trim().length > 0;
          if (!hasHandle) goFeed = false;
        }
      } catch {
        goFeed = true;
      }

      await minDelay;

      if (goFeed) setPhase("feed");
      else router.replace("/getstarted");

      if (!splashSeen) {
        try {
          sessionStorage.setItem(SPLASH_KEY, "1");
          setSplashSeen(true);
        } catch { }
      }
    })();
  }, [authLoading, user?.uid, router, splashSeen]);

  if (phase === "splash" && !splashSeen) {
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

  return <FeedShell />;
}
