// app/bonga/[threadId]/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  addDoc,
  collection,
  doc,
  DocumentSnapshot,
  endBefore,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
} from "firebase/firestore";
import { getDatabase, onValue, ref as rtdbRef } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  IoArrowBack,
  IoCameraOutline,
  IoChatbubblesOutline,
  IoChevronForward,
  IoClose,
  IoFlagOutline,
  IoHappyOutline,
  IoImageOutline,
  IoMenu,
  IoSearchOutline,
  IoSend,
} from "react-icons/io5";

import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import SmartAvatar from "@/app/components/SmartAvatar";
import { Button } from "@/components/ui/button";

/* --- Emoji grid (no dependency) --- */
const EmojiPickerList = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😘", "😎", "🤗", "🤔", "😴", "😅", "😇", "😉", "🙃", "🙂", "😭", "😤", "😡", "🤯",
  "🤝", "👍", "👎", "👏", "🙏", "💪", "👌", "🤌", "🙌", "🫶", "🤙", "💖", "💗", "💜", "🔥", "✨", "🎉", "🥳", "💯", "✅",
  "❌", "⚠️", "☑️", "🩷", "🧡", "💛", "💚", "💙", "🖤", "🤍", "🤎", "🍀", "🌟", "⭐️", "🌈", "☀️", "🌙", "🌸", "🌼",
  "🐶", "🐱", "🦄", "🐣", "🍕", "🍔", "🍟", "🍩", "☕️",
];

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
};

const hexToRgba = (hex: string, a = 1) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

type UserLite = {
  firstName?: string;
  surname?: string;
  handle?: string;
  photoURL?: string;
};

type ListingCtx = {
  id: string;
  name?: string;
  image?: string;
  price?: number;
  currency?: "KES" | "USD" | string;
  type?: string;
  url?: string;
};

type LastMessage =
  | { type: "text"; text: string; from: string; to: string; createdAt: any }
  | { type: "image"; from: string; to: string; createdAt: any }
  | { type: "audio"; from: string; to: string; createdAt: any }
  | { type: "product"; from: string; to: string; createdAt: any; listing?: ListingCtx }
  | undefined;

type ThreadMirror = {
  threadId: string;
  peerId: string;
  unread?: number;
  updatedAt?: any;
  lastMessage?: LastMessage;
};

type RowData = {
  threadId: string;
  peerId: string;
  peer: UserLite | null;
  lastMessage?: LastMessage;
  unread: number;
  updatedAt?: any;
};

type Message = {
  id: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  uploading?: boolean;
  error?: boolean;
  from: string;
  to: string;
  createdAt: any;
  type: "text" | "image" | "audio" | "product";
  listing?: ListingCtx;
  readBy?: Record<string, boolean>;
};

/* -------- responsive helpers -------- */
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
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}
function useIsDesktop() {
  return useMediaQuery("(min-width: 768px)");
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  return null;
}
function shortTime(ts: any) {
  const d = tsToDate(ts);
  if (!d) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${m} ${ampm}`;
  }
  const mon = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  return `${mon} ${day}`;
}
function formatMsgTime(ts: any) {
  const d = tsToDate(ts);
  if (!d) return "";
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m} ${ampm}`;
}

function previewOf(last?: LastMessage) {
  if (!last) return "";
  if (last.type === "text") return last.text || "";
  if (last.type === "image") return "📷 Photo";
  if (last.type === "audio") return "🎤 Voice message";
  if (last.type === "product") return `🛒 ${last.listing?.name || "Product inquiry"}`;
  return "";
}

function lastSeenText(online?: boolean, lastActive?: any) {
  if (online) return "Online";
  const d = tsToDate(lastActive);
  if (!d) return "last seen recently";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `last seen ${h}h ago`;
  const days = Math.floor(h / 24);
  return `last seen ${days}d ago`;
}

function participantsArray(a: string, b: string) {
  return [a, b].sort();
}

function normalizeUser(raw: any): UserLite | null {
  if (!raw) return null;
  return {
    firstName: raw.firstName ?? raw.name ?? "",
    surname: raw.surname ?? raw.lastName ?? "",
    handle: raw.handle ?? raw.username ?? "",
    photoURL: raw.photoURL ?? raw.photo ?? raw.imageUrl ?? "",
  };
}

function parseThreadAndQsFromUrl() {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("bonga");
  const tId = idx >= 0 ? parts[idx + 1] || "" : "";
  const qs = url.searchParams;

  return {
    threadId: tId,
    peerId: qs.get("peerId") || "",
    peerName: qs.get("peerName") || "",
    peerPhotoURL: qs.get("peerPhotoURL") || "",
    peerHandle: qs.get("peerHandle") || "",
  };
}

/* ================================================================ */

function BongaThreadUI() {
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const sp = useSearchParams();
  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  const { user } = useAuth();
  const uid = user?.uid || "";

  const rtdb = getDatabase();

  // route threadId
  const routeThreadId = params.threadId;

  // initial querystring values (deep link / refresh)
  const initialPeerId = sp.get("peerId") || "";
  const initialPeerName = sp.get("peerName") || "";
  const initialPeerPhotoURL = sp.get("peerPhotoURL") || "";
  const initialPeerHandle = sp.get("peerHandle") || "";

  // ✅ Single-page selection state
  const [threadCtx, setThreadCtx] = useState<any>(null);
  const [activeThreadId, setActiveThreadId] = useState(routeThreadId);
  const [activePeerId, setActivePeerId] = useState(initialPeerId);
  const [activePeerQs, setActivePeerQs] = useState({
    peerName: initialPeerName,
    peerPhotoURL: initialPeerPhotoURL,
    peerHandle: initialPeerHandle,
  });

  const initialListing: ListingCtx | null = useMemo(() => {
    const id = sp.get("listingId") || "";
    if (!id) return null;

    const priceRaw = sp.get("listingPrice");
    const price = priceRaw ? Number(priceRaw) : undefined;

    return {
      id,
      name: sp.get("listingName") || "",
      image: sp.get("listingImage") || "",
      price: Number.isFinite(price as any) ? price : undefined,
      currency: (sp.get("listingCurrency") || "KES") as any,
      type: sp.get("listingType") || "marketListing",
      url: sp.get("listingUrl") || `/market/${encodeURIComponent(id)}`,
    };
  }, [sp]);

  const threadContextListing: ListingCtx | null = useMemo(() => {
    const l = threadCtx?.listing;
    if (!l?.id) return null;
    return {
      id: String(l.id),
      name: l.name || "",
      image: l.image || "",
      price: typeof l.price === "number" ? l.price : undefined,
      currency: l.currency || "KES",
      type: l.type || "marketListing",
      url: l.url || `/market/${encodeURIComponent(String(l.id))}`,
    };
  }, [threadCtx]);

  const [pendingListing, setPendingListing] = useState<ListingCtx | null>(initialListing);
  useEffect(() => {
    setPendingListing(initialListing);
  }, [initialListing]);

  // keep in sync if user directly navigates to a new /bonga/<id>
  useEffect(() => {
    setActiveThreadId(routeThreadId);
    if (initialPeerId) setActivePeerId(initialPeerId);
    setActivePeerQs({
      peerName: initialPeerName,
      peerPhotoURL: initialPeerPhotoURL,
      peerHandle: initialPeerHandle,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeThreadId]);

  // ✅ handle back/forward between threads because we use pushState
  useEffect(() => {
    const onPop = () => {
      const parsed = parseThreadAndQsFromUrl();
      if (!parsed) return;

      if (parsed.threadId) setActiveThreadId(parsed.threadId);
      setActivePeerId(parsed.peerId || "");
      setActivePeerQs({
        peerName: parsed.peerName || "",
        peerPhotoURL: parsed.peerPhotoURL || "",
        peerHandle: parsed.peerHandle || "",
      });
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /* ---------------- Sidebar UI ---------------- */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [qStr, setQStr] = useState("");

  // auto-close drawer on desktop
  useEffect(() => {
    if (isDesktop) setSidebarOpen(false);
  }, [isDesktop]);

  const onBack = useCallback(() => {
    if (!isDesktop) {
      router.push("/bonga");
      return;
    }
    router.back();
  }, [isDesktop, router]);

  /* ---------------- Sidebar data ---------------- */
  const [rows, setRows] = useState<RowData[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [pagingRows, setPagingRows] = useState(false);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);

  // caches
  const userCache = useRef<Map<string, UserLite | null>>(new Map());
  const threadCache = useRef<Map<string, LastMessage | undefined>>(new Map());

  const fetchPeer = useCallback(async (peerId: string) => {
    if (userCache.current.has(peerId)) return userCache.current.get(peerId)!;
    try {
      const snap = await getDoc(doc(db, "users", peerId));
      const raw = snap.exists() ? (snap.data() as any) : null;
      const data = normalizeUser(raw);
      userCache.current.set(peerId, data);
      return data;
    } catch (err) {
      console.error("Error fetching peer:", err);
      userCache.current.set(peerId, null);
      return null;
    }
  }, []);

  const fetchLastMessageFromThread = useCallback(async (tId: string) => {
    if (threadCache.current.has(tId)) return threadCache.current.get(tId);
    try {
      const tSnap = await getDoc(doc(db, "threads", tId));
      const data = tSnap.data() as any;
      const last: LastMessage | undefined = data?.lastMessage;
      threadCache.current.set(tId, last);
      return last;
    } catch (err) {
      console.error("Error fetching lastMessage:", err);
      threadCache.current.set(tId, undefined);
      return undefined;
    }
  }, []);

  // Sidebar live list (prefer mirror lastMessage)
  useEffect(() => {
    if (!uid) {
      setRows([]);
      setRowsLoading(false);
      return;
    }

    setRowsLoading(true);

    const qy = query(
      collection(db, "userThreads", uid, "threads"),
      orderBy("updatedAt", "desc"),
      limit(25)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        (async () => {
          try {
            const docs = snap.docs;
            setCursor(docs.length ? docs[docs.length - 1] : null);

            // prevent stale fallback cache if thread updated
            for (const d of docs) {
              const m = d.data() as ThreadMirror;
              threadCache.current.delete(m.threadId);
            }

            const base: RowData[] = await Promise.all(
              docs.map(async (d) => {
                const m = d.data() as ThreadMirror;
                const mirrorLast = (m as any).lastMessage as LastMessage | undefined;

                const [peer, lastFallback] = await Promise.all([
                  fetchPeer(m.peerId),
                  mirrorLast ? Promise.resolve(undefined) : fetchLastMessageFromThread(m.threadId),
                ]);

                const lastMessage = mirrorLast ?? lastFallback;

                return {
                  threadId: m.threadId,
                  peerId: m.peerId,
                  peer: peer ?? null,
                  lastMessage,
                  unread: m.unread ?? 0,
                  updatedAt: (d.data() as any).updatedAt,
                };
              })
            );

            setRows(base);
            setRowsLoading(false);
          } catch (err) {
            console.error("Sidebar snapshot processing error:", err);
            setRows([]);
            setRowsLoading(false);
          }
        })();
      },
      (error) => {
        console.error("Sidebar onSnapshot error:", error);
        setRows([]);
        setRowsLoading(false);
      }
    );

    return () => unsub();
  }, [uid, fetchPeer, fetchLastMessageFromThread]);

  const loadMoreRows = useCallback(async () => {
    if (!uid || !cursor || pagingRows) return;
    setPagingRows(true);
    try {
      const qMore = query(
        collection(db, "userThreads", uid, "threads"),
        orderBy("updatedAt", "desc"),
        startAfter(cursor),
        limit(25)
      );
      const snap = await getDocs(qMore);
      const docs = snap.docs;
      setCursor(docs.length ? docs[docs.length - 1] : null);

      const extra: RowData[] = await Promise.all(
        docs.map(async (d) => {
          const m = d.data() as ThreadMirror;
          threadCache.current.delete(m.threadId);

          const mirrorLast = (m as any).lastMessage as LastMessage | undefined;

          const [peer, lastFallback] = await Promise.all([
            fetchPeer(m.peerId),
            mirrorLast ? Promise.resolve(undefined) : fetchLastMessageFromThread(m.threadId),
          ]);

          const lastMessage = mirrorLast ?? lastFallback;

          return {
            threadId: m.threadId,
            peerId: m.peerId,
            peer: peer ?? null,
            lastMessage,
            unread: m.unread ?? 0,
            updatedAt: (d.data() as any).updatedAt,
          };
        })
      );

      setRows((prev) => [...prev, ...extra]);
    } catch (err) {
      console.error("loadMoreRows error:", err);
    } finally {
      setPagingRows(false);
    }
  }, [uid, cursor, pagingRows, fetchPeer, fetchLastMessageFromThread]);

  const filteredRows = useMemo(() => {
    const term = qStr.trim().toLowerCase();
    let list = rows;
    if (tab === "unread") list = list.filter((r) => (r.unread ?? 0) > 0);
    if (!term) return list;
    return list.filter((r) => {
      const name = r.peer?.firstName || "";
      const handle = r.peer?.handle || "";
      const last = previewOf(r.lastMessage) || "";
      return (
        name.toLowerCase().includes(term) ||
        handle.toLowerCase().includes(term) ||
        last.toLowerCase().includes(term)
      );
    });
  }, [rows, qStr, tab]);

  // ✅ smooth open: update local state + pushState (no Next navigation)
  const openThreadFromSidebar = (row: RowData) => {
    setPendingListing(null);
    setActiveThreadId(row.threadId);
    setActivePeerId(row.peerId);
    setActivePeerQs({
      peerName: row.peer?.firstName ?? "",
      peerPhotoURL: row.peer?.photoURL ?? "",
      peerHandle: row.peer?.handle ?? "",
    });

    const q = new URLSearchParams({
      peerId: row.peerId,
      peerName: row.peer?.firstName ?? "",
      peerPhotoURL: row.peer?.photoURL ?? "",
      peerHandle: row.peer?.handle ?? "",
    });

    const nextUrl = `/bonga/${row.threadId}?${q.toString()}`;
    window.history.pushState({}, "", nextUrl);

    setSidebarOpen(false);
  };

  /* ---------------- Right Chat Panel ---------------- */

  const selectedRow = rows.find((r) => r.threadId === activeThreadId);

  const [peer, setPeer] = useState<{
    photoURL?: string;
    handle?: string;
    firstName?: string;
    surname?: string;
    followersCount?: number;
    followingCount?: number;
    online?: boolean;
    lastActiveAt?: any;
  } | null>(null);

  const [threadReady, setThreadReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<Message[]>([]);
  const [paging, setPaging] = useState(false);
  const [oldestDoc, setOldestDoc] = useState<DocumentSnapshot | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const composerRef = useRef<HTMLDivElement>(null);
  const [composerH, setComposerH] = useState(92);
  const [showJump, setShowJump] = useState(false);

  useLayoutEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.target === composerRef.current) {
          setComposerH(Math.round(e.contentRect.height));
        }
      }
    });
    if (composerRef.current) ro.observe(composerRef.current);
    return () => ro.disconnect();
  }, []);

  // derive peerId from thread participants if missing
  useEffect(() => {
    (async () => {
      if (activePeerId || !uid || !activeThreadId) return;
      const snap = await getDoc(doc(db, "threads", activeThreadId));
      if (!snap.exists()) {
        setLoading(false);
        return;
      }
      const data = snap.data() as any;
      const parts: string[] = data?.participants || [];
      const other = parts.find((p) => p !== uid) || "";
      setActivePeerId(other);
    })();
  }, [uid, activeThreadId, activePeerId]);

  // ensure thread exists
  useEffect(() => {
    if (!uid || !activeThreadId || !activePeerId) return;

    let cancelled = false;

    (async () => {
      try {
        const tRef = doc(db, "threads", activeThreadId);
        const snap = await getDoc(tRef);

        if (!snap.exists()) {
          await setDoc(
            tRef,
            {
              participants: participantsArray(uid, activePeerId),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              typing: {},
              active: {},
              lastReadAt: {},
            },
            { merge: true }
          );
        }

        if (!cancelled) setThreadReady(true);
      } catch (e) {
        console.error("ensure thread error", e);
        if (!cancelled) setThreadReady(false);
      }
    })();

    return () => {
      cancelled = true;
      setThreadReady(false);
    };
  }, [uid, activePeerId, activeThreadId]);

  // peer public info
  useEffect(() => {
    if (!activePeerId) return;
    const uRef = doc(db, "users", activePeerId);
    const unsub = onSnapshot(uRef, (snap) => {
      const raw = snap.data() || {};
      const data = normalizeUser(raw) || {};
      setPeer((prev) => ({
        ...prev,
        ...data,
        followersCount: (raw as any)?.followersCount ?? 0,
        followingCount: (raw as any)?.followingCount ?? 0,
      }));
    });
    return () => unsub();
  }, [activePeerId]);

  // presence via RTDB
  useEffect(() => {
    if (!activePeerId) return;
    const sRef = rtdbRef(rtdb, `/status/${activePeerId}`);
    const off = onValue(sRef, (snap) => {
      const v = snap.val() || {};
      setPeer((p) => ({
        ...(p || {}),
        online: v.state === "online",
        lastActiveAt:
          typeof v.lastChanged === "number"
            ? new Date(v.lastChanged)
            : p?.lastActiveAt ?? null,
      }));
    });
    return () => off();
  }, [activePeerId, rtdb]);

  // typing + thread context
  useEffect(() => {
    if (!activeThreadId || !activePeerId) return;

    const tRef = doc(db, "threads", activeThreadId);
    const unsub = onSnapshot(tRef, (snap) => {
      const data = snap.data() || {};
      const typing = (data as any).typing || {};
      setPeerTyping(!!typing[activePeerId]);

      setThreadCtx((data as any).threadContext || null);
    });

    return () => unsub();
  }, [activeThreadId, activePeerId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }, []);

  // show/hide jump button
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowJump(distance > 160);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // messages live
  useEffect(() => {
    if (!threadReady || !activeThreadId) return;
    setLoading(true);

    const qy = query(
      collection(db, "threads", activeThreadId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(25)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const msgs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Message[];
        setItems(msgs);
        setOldestDoc(snap.docs[0] ?? null);
        setLoading(false);

        // mark read (my mirror)
        if (uid) {
          setDoc(
            doc(db, "userThreads", uid, "threads", activeThreadId),
            { unread: 0, updatedAt: serverTimestamp() },
            { merge: true }
          ).catch(() => { });
        }

        scrollToBottom("auto");
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [threadReady, activeThreadId, uid, scrollToBottom]);

  // follow new msgs if at bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el || loading) return;
    const threshold = 120;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom) scrollToBottom("smooth");
  }, [items.length, loading, scrollToBottom]);

  useEffect(() => {
    scrollToBottom("auto");
  }, [composerH, scrollToBottom]);

  // ✅ typing update uses field-path (does not overwrite typing map)
  const setTypingDebounced = useMemo(() => {
    let t: any;
    return (val: boolean) => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!uid || !activeThreadId) return;
        updateDoc(doc(db, "threads", activeThreadId), {
          [`typing.${uid}`]: val,
          updatedAt: serverTimestamp(),
        }).catch(() => { });
      }, val ? 0 : 600);
    };
  }, [activeThreadId, uid]);

  const loadMore = useCallback(async () => {
    if (!oldestDoc || paging) return;
    setPaging(true);
    try {
      const qOld = query(
        collection(db, "threads", activeThreadId, "messages"),
        orderBy("createdAt", "asc"),
        endBefore(oldestDoc),
        limitToLast(25)
      );
      const snap = await getDocs(qOld);
      const older = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Message[];

      if (older.length > 0 && listRef.current) {
        const el = listRef.current;
        const prevBottom = el.scrollHeight - el.scrollTop;
        setItems((prev) => [...older, ...prev]);
        setOldestDoc(snap.docs[0] ?? null);
        requestAnimationFrame(() => {
          const newScrollTop = el.scrollHeight - prevBottom;
          el.scrollTop = newScrollTop;
        });
      }
    } finally {
      setPaging(false);
    }
  }, [oldestDoc, paging, activeThreadId]);

  /* ---------- SEND ---------- */
  const sendText = useCallback(
    async (text: string) => {
      if (!uid || !activePeerId || !activeThreadId) return;
      const t = text.trim();
      if (!t && !pendingListing) return;

      const hasListing = !!pendingListing?.id;

      await addDoc(collection(db, "threads", activeThreadId, "messages"), {
        text: t || "",
        from: uid,
        to: activePeerId,
        type: hasListing ? "product" : "text",
        listing: hasListing
          ? {
            id: pendingListing!.id,
            name: pendingListing!.name || "",
            image: pendingListing!.image || "",
            price: typeof pendingListing!.price === "number" ? pendingListing!.price : null,
            currency: pendingListing!.currency || "KES",
            type: pendingListing!.type || "marketListing",
            url: pendingListing!.url || `/market/${encodeURIComponent(pendingListing!.id)}`,
          }
          : null,
        createdAt: serverTimestamp(),
        readBy: { [uid]: true },
      });

      if (hasListing) setPendingListing(null);
    },
    [uid, activePeerId, activeThreadId, pendingListing]
  );

  // ✅ Active presence for this thread (field-path)
  useEffect(() => {
    if (!uid || !activeThreadId) return;

    const tRef = doc(db, "threads", activeThreadId);

    const setActive = (val: boolean) =>
      updateDoc(tRef, {
        [`active.${uid}`]: val ? serverTimestamp() : null,
      }).catch(() => { });

    const onVisibility = () => setActive(!document.hidden);
    const onBeforeUnload = () => setActive(false);

    setActive(!document.hidden);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      setActive(false);
    };
  }, [uid, activeThreadId]);

  const onSend = useCallback(async () => {
    const t = input.trim();
    if (!t && !pendingListing?.id) return;

    await sendText(t);
    setInput("");
    setTypingDebounced(false);
    scrollToBottom("smooth");
    if (textareaRef.current) textareaRef.current.style.height = "40px";
  }, [input, pendingListing, sendText, setTypingDebounced, scrollToBottom]);

  const onPickImage = () => fileInputRef.current?.click();

  const onImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));

    try {
      if (!uid || !activePeerId || !activeThreadId) return;

      // create message placeholder
      const msgDoc = await addDoc(collection(db, "threads", activeThreadId, "messages"), {
        from: uid,
        to: activePeerId,
        type: "image" as const,
        createdAt: serverTimestamp(),
        readBy: { [uid]: true },
        uploading: true,
      });

      const path = `threads/${activeThreadId}/images/${msgDoc.id}/original-${file.name}`;
      const blobRef = storageRef(storage, path);
      await uploadBytes(blobRef, file);
      const url = await getDownloadURL(blobRef);

      await updateDoc(doc(db, "threads", activeThreadId, "messages", msgDoc.id), {
        imageUrl: url,
        uploading: false,
      });

      scrollToBottom("smooth");
    } catch (err) {
      console.error("Image send failed:", err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setPreview(null), 1200);
    }
  };

  // bubble colors
  const mineBg = hexToRgba(EKARI.gold, 0.18);
  const mineBorder = hexToRgba(EKARI.gold, 0.38);
  const theirsBg = hexToRgba(EKARI.forest, 0.12);
  const theirsBrd = hexToRgba(EKARI.forest, 0.28);

  // autoresize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "40px";
    ta.style.height = Math.min(160, ta.scrollHeight) + "px";
  }, [input]);

  const headerTitle =
    peer?.firstName ||
    activePeerQs.peerName ||
    peer?.handle ||
    activePeerQs.peerHandle ||
    "Message";

  const onlineNow = !!peer?.online;
  const lastActiveAny = peer?.lastActiveAt;
  const hasMessages = items.length > 0;

  const ringStyle: React.CSSProperties = { ["--tw-ring-color" as any]: EKARI.forest };

  const EmptyState = () => (
    <div className="h-full flex flex-col items-center justify-center px-4" style={{ color: EKARI.sub }}>
      <div className="max-w-md w-full bg-white border rounded-2xl shadow-sm p-4 text-center">
        <div className="mx-auto mb-3 h-16 w-16 rounded-2xl flex items-center justify-center bg-gray-50">
          <IoChatbubblesOutline size={34} color={EKARI.forest} />
        </div>
        <div className="font-extrabold text-slate-900 text-lg">Start a conversation</div>
        <div className="text-xs text-slate-500 mt-1">{lastSeenText(onlineNow, lastActiveAny)}</div>

        <p className="mt-4 text-sm text-slate-600">
          You haven&apos;t sent any messages yet. Say hi, share a question, or send an image.
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {["👋", "😊", "🔥", "👍"].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setInput((p) => (p ? `${p} ${q}` : q))}
              className="inline-flex items-center justify-center rounded-full border text-sm font-semibold px-3 py-1.5 hover:bg-black/5"
              style={{ borderColor: EKARI.hair, color: EKARI.text }}
            >
              {q}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => textareaRef.current?.focus()}
          className="mt-6 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-extrabold shadow-sm hover:shadow-md"
          style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
        >
          <IoChatbubblesOutline className="mr-2" size={16} />
          Start chatting
        </button>
      </div>
    </div>
  );

  if (!uid) {
    // same UI for mobile/desktop, wrapper decides AppShell outside
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6 text-center"
        style={{ backgroundColor: EKARI.sand }}
      >
        <div>
          <div className="text-lg font-extrabold" style={{ color: EKARI.text }}>
            Sign in to view your chats
          </div>
          <div className="text-sm mt-1" style={{ color: EKARI.dim }}>
            Your conversations will appear here.
          </div>
        </div>
      </div>
    );
  }

  const ctxListing = threadCtx?.listing;

  return (
    <div
      className="h-[calc(100vh-0rem)] w-full overflow-hidden min-h-0"
      style={{ backgroundColor: EKARI.sand }}
    >
      <div
        className={clsx(
          "h-full min-h-0",
          isDesktop ? "grid grid-cols-[360px_1fr]" : "flex flex-col"
        )}
      >
        {/* ================= Sidebar (Desktop) ================= */}
        <aside
          className="hidden md:flex h-full min-h-0 border-r bg-white"
          style={{ borderColor: EKARI.hair }}
        >
          <div className="h-full min-h-0 w-full flex flex-col">
            <div
              className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur"
              style={{ borderColor: EKARI.hair }}
            >
              <div className="h-14 px-4 flex items-center justify-between">
                <div className="font-black text-[18px]" style={{ color: EKARI.text }}>
                  Chats
                </div>
                <button
                  onClick={() => router.push("/bonga")}
                  className="text-xs font-extrabold px-3 py-1.5 rounded-full hover:bg-black/5"
                  style={{ color: EKARI.text }}
                >
                  All
                </button>
              </div>

              <div className="px-4 pb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    className="h-8 px-3 rounded-full text-xs font-extrabold transition"
                    onClick={() => setTab("all")}
                    style={{
                      backgroundColor: tab === "all" ? EKARI.forest : "#F3F4F6",
                      color: tab === "all" ? EKARI.sand : EKARI.text,
                    }}
                  >
                    All
                  </button>
                  <button
                    className="h-8 px-3 rounded-full text-xs font-extrabold transition"
                    onClick={() => setTab("unread")}
                    style={{
                      backgroundColor: tab === "unread" ? EKARI.forest : "#F3F4F6",
                      color: tab === "unread" ? EKARI.sand : EKARI.text,
                    }}
                  >
                    Unread
                  </button>

                  <span className="ml-auto text-xs" style={{ color: EKARI.dim }}>
                    {rows.length} thread{rows.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="relative">
                  <input
                    value={qStr}
                    onChange={(e) => setQStr(e.target.value)}
                    placeholder="Search chats…"
                    className="w-full h-10 rounded-xl px-3 pr-9 text-sm outline-none border focus:ring-2"
                    aria-label="Filter chats"
                    style={{ borderColor: EKARI.hair, ["--tw-ring-color" as any]: EKARI.forest }}
                  />
                  {qStr ? (
                    <button
                      onClick={() => setQStr("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-80"
                      aria-label="Clear search"
                      style={{ color: EKARI.dim }}
                    >
                      ✕
                    </button>
                  ) : (
                    <IoSearchOutline
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "#94A3B8" }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {rowsLoading ? (
                <div className="py-16 flex items-center justify-center" style={{ color: EKARI.dim }}>
                  <BouncingBallLoader />
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div
                    className="mx-auto mb-3 h-12 w-12 rounded-full grid place-items-center"
                    style={{ backgroundColor: "#F3F4F6", color: EKARI.text }}
                  >
                    💬
                  </div>
                  <div className="font-extrabold" style={{ color: EKARI.text }}>
                    No conversations
                  </div>
                  <div className="text-sm mt-1" style={{ color: EKARI.dim }}>
                    {qStr ? "Try a different search." : "Start a chat from a profile to see it here."}
                  </div>
                </div>
              ) : (
                <ul className="divide-y p-2" style={{ borderColor: EKARI.hair }}>
                  {filteredRows.map((item) => {
                    const name = item.peer?.firstName || item.peer?.handle || "User";
                    const last = previewOf(item.lastMessage) || "No messages yet";
                    const when = shortTime(item.lastMessage?.createdAt ?? item.updatedAt);
                    const hasUnread = (item.unread ?? 0) > 0;
                    const active = item.threadId === activeThreadId;

                    return (
                      <li key={item.threadId}>
                        <motion.button
                          whileTap={{ scale: 0.985 }}
                          className={clsx(
                            "w-full px-4 py-3 flex items-center gap-3 transition text-left hover:bg-black/5 focus:bg-black/5 focus:outline-none focus:ring-2",
                            active && "bg-black/5"
                          )}
                          onClick={() => openThreadFromSidebar(item)}
                          aria-label={`Open chat with ${name}`}
                          style={ringStyle}
                        >
                          <div className="relative">
                            <SmartAvatar
                              src={item.peer?.photoURL || ""}
                              alt={name}
                              size={46}
                              className={clsx(hasUnread && "ring-2")}
                            />
                            {hasUnread && (
                              <span
                                className="absolute -right-0.5 -bottom-0.5 w-[12px] h-[12px] rounded-full border-2"
                                title="Unread"
                                style={{ backgroundColor: EKARI.forest, borderColor: EKARI.sand }}
                              />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div
                                className={clsx("truncate text-[15px]", hasUnread ? "font-black" : "font-extrabold")}
                                style={{ color: EKARI.text }}
                              >
                                {name}
                              </div>
                              <div className="ml-auto text-[11px]" style={{ color: EKARI.dim }}>
                                {when}
                              </div>
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 min-w-0">
                              <div
                                className={clsx("truncate text-[13px]", hasUnread ? "font-semibold" : "font-normal")}
                                style={{ color: hasUnread ? EKARI.text : EKARI.dim }}
                              >
                                {last}
                              </div>

                              {hasUnread && (
                                <span
                                  className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold"
                                  style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                                >
                                  {item.unread > 99 ? "99+" : item.unread}
                                </span>
                              )}
                            </div>
                          </div>

                          <IoChevronForward size={18} style={{ color: EKARI.sub }} />
                        </motion.button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {filteredRows.length > 0 && (
                <div className="p-4 grid place-items-center">
                  <button
                    onClick={loadMoreRows}
                    disabled={pagingRows || !cursor}
                    className="h-10 rounded-lg px-4 border text-sm font-bold transition disabled:opacity-50"
                    style={{
                      borderColor: EKARI.hair,
                      color: EKARI.text,
                      backgroundColor: EKARI.sand,
                    }}
                  >
                    {pagingRows ? <BouncingBallLoader /> : cursor ? "Load more…" : "No more"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ================= Mobile Sidebar Drawer ================= */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 z-[80] bg-black/40"
            onClick={() => setSidebarOpen(false)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[88%] max-w-[360px] bg-white shadow-xl flex flex-col min-h-0"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-14 px-4 flex items-center justify-between border-b" style={{ borderColor: EKARI.hair }}>
                <div className="font-black text-[18px]" style={{ color: EKARI.text }}>
                  Chats
                </div>
                <button
                  className="p-2 rounded-lg hover:bg-black/5"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close sidebar"
                >
                  <IoClose size={20} color={EKARI.text} />
                </button>
              </div>

              <div className="px-4 py-3 space-y-2 border-b" style={{ borderColor: EKARI.hair }}>
                <div className="flex items-center gap-2">
                  <button
                    className="h-8 px-3 rounded-full text-xs font-extrabold transition"
                    onClick={() => setTab("all")}
                    style={{
                      backgroundColor: tab === "all" ? EKARI.forest : "#F3F4F6",
                      color: tab === "all" ? EKARI.sand : EKARI.text,
                    }}
                  >
                    All
                  </button>
                  <button
                    className="h-8 px-3 rounded-full text-xs font-extrabold transition"
                    onClick={() => setTab("unread")}
                    style={{
                      backgroundColor: tab === "unread" ? EKARI.forest : "#F3F4F6",
                      color: tab === "unread" ? EKARI.sand : EKARI.text,
                    }}
                  >
                    Unread
                  </button>
                </div>

                <div className="relative">
                  <input
                    value={qStr}
                    onChange={(e) => setQStr(e.target.value)}
                    placeholder="Search chats…"
                    className="w-full h-10 rounded-xl px-3 pr-9 text-sm outline-none border focus:ring-2"
                    style={{ borderColor: EKARI.hair, ["--tw-ring-color" as any]: EKARI.forest }}
                  />
                  {qStr ? (
                    <button
                      onClick={() => setQStr("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-80"
                      style={{ color: EKARI.dim }}
                    >
                      ✕
                    </button>
                  ) : (
                    <IoSearchOutline
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: "#94A3B8" }}
                    />
                  )}
                </div>
              </div>

              {ctxListing?.id && (
                <div className="border-b bg-white px-3 py-2" style={{ borderColor: EKARI.hair }}>
                  <button
                    type="button"
                    onClick={() => {
                      const url = ctxListing.url || `/market/${encodeURIComponent(ctxListing.id)}`;
                      router.push(url);
                    }}
                    className="w-full flex items-center gap-2 rounded-xl border bg-gray-50 hover:bg-white transition p-2 text-left"
                    style={{ borderColor: EKARI.hair }}
                    title="Open product"
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      <Image
                        src={ctxListing.image || "/avatar-placeholder.png"}
                        alt={ctxListing.name || "Product"}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-slate-900 truncate">
                        {ctxListing.name || "Product"}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">Conversation about this item</div>
                    </div>

                    <IoChevronForward size={16} style={{ color: EKARI.dim }} />
                  </button>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-y-auto">
                {rowsLoading ? (
                  <div className="py-16 flex items-center justify-center" style={{ color: EKARI.dim }}>
                    <BouncingBallLoader />
                  </div>
                ) : (
                  <ul className="divide-y" style={{ borderColor: EKARI.hair }}>
                    {filteredRows.map((item) => {
                      const name = item.peer?.firstName || item.peer?.handle || "User";
                      const last = previewOf(item.lastMessage) || "No messages yet";
                      const when = shortTime(item.lastMessage?.createdAt ?? item.updatedAt);
                      const hasUnread = (item.unread ?? 0) > 0;
                      const active = item.threadId === activeThreadId;

                      return (
                        <li key={item.threadId}>
                          <button
                            className={clsx(
                              "w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-black/5",
                              active && "bg-black/5"
                            )}
                            onClick={() => openThreadFromSidebar(item)}
                          >
                            <div className="relative">
                              <SmartAvatar
                                src={item.peer?.photoURL || ""}
                                alt={name}
                                size={44}
                                className={clsx(hasUnread && "ring-2")}
                              />
                              {hasUnread && (
                                <span
                                  className="absolute -right-0.5 -bottom-0.5 w-[12px] h-[12px] rounded-full border-2"
                                  style={{ backgroundColor: EKARI.forest, borderColor: EKARI.sand }}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div
                                  className={clsx("truncate text-[15px]", hasUnread ? "font-black" : "font-extrabold")}
                                  style={{ color: EKARI.text }}
                                >
                                  {name}
                                </div>
                                <div className="ml-auto text-[11px]" style={{ color: EKARI.dim }}>
                                  {when}
                                </div>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 min-w-0">
                                <div className="truncate text-[13px]" style={{ color: hasUnread ? EKARI.text : EKARI.dim }}>
                                  {last}
                                </div>
                                {hasUnread && (
                                  <span
                                    className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold"
                                    style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                                  >
                                    {item.unread > 99 ? "99+" : item.unread}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {filteredRows.length > 0 && (
                <div className="p-4 grid place-items-center border-t" style={{ borderColor: EKARI.hair }}>
                  <button
                    onClick={loadMoreRows}
                    disabled={pagingRows || !cursor}
                    className="h-10 rounded-lg px-4 border text-sm font-bold transition disabled:opacity-50"
                    style={{
                      borderColor: EKARI.hair,
                      color: EKARI.text,
                      backgroundColor: EKARI.sand,
                    }}
                  >
                    {pagingRows ? <BouncingBallLoader /> : cursor ? "Load more…" : "No more"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= Right Chat Panel ================= */}
        <main
          className="h-full min-h-0 bg-white relative"
          style={{
            paddingBottom: isDesktop ? 0 : `calc(${composerH}px + env(safe-area-inset-bottom))`,
          }}
        >
          <div className="h-full min-h-0 flex flex-col">
            {/* Top header (chat) */}
            <div className="border-b bg-white z-30" style={{ borderColor: EKARI.hair }}>
              <div className="h-[54px] px-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mobile: back + chats drawer */}
                  <button
                    className="md:hidden p-2 rounded-lg hover:bg-black/5"
                    onClick={onBack}
                    aria-label="Back to chats"
                  >
                    <IoArrowBack size={20} color={EKARI.text} />
                  </button>

                  <button
                    className="md:hidden p-2 rounded-lg hover:bg-black/5"
                    onClick={() => setSidebarOpen(true)}
                    aria-label="Open chats"
                  >
                    <IoMenu size={20} color={EKARI.text} />
                  </button>

                  {/* Desktop: back */}
                  <button
                    onClick={onBack}
                    className="hidden md:inline-flex p-2 rounded-lg hover:bg-black/5"
                    aria-label="Back"
                  >
                    <IoArrowBack size={20} color={EKARI.text} />
                  </button>

                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-100">
                      {onlineNow && (
                        <span
                          className="absolute right-0.5 bottom-0.5 w-[14px] h-[14px] rounded-full border-2 z-10"
                          style={{ backgroundColor: "#16A34A", borderColor: EKARI.sand }}
                        />
                      )}
                      <Image
                        src={
                          peer?.photoURL ||
                          activePeerQs.peerPhotoURL ||
                          selectedRow?.peer?.photoURL ||
                          "/avatar-placeholder.png"
                        }
                        alt={headerTitle}
                        fill
                        className="object-cover"
                        sizes="36px"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="font-extrabold text-slate-900 text-sm truncate">{headerTitle}</div>
                      <div className="text-xs text-slate-500">
                        {peerTyping ? "Typing…" : lastSeenText(onlineNow, lastActiveAny)}
                      </div>
                    </div>
                  </div>
                </div>

                <button className="p-2 rounded-lg hover:bg-black/5" aria-label="Report" title="Report conversation">
                  <IoFlagOutline size={18} color={EKARI.dim} />
                </button>
              </div>
            </div>

            {/* Messages scroller */}
            <div
              ref={listRef}
              className="flex-1 min-h-0 overflow-y-auto bg-gray-50"
              style={{
                paddingTop: 8,
                paddingBottom: composerH + 16,
                scrollPaddingBottom: composerH + 16,
                scrollbarGutter: "stable both-edges",
              } as React.CSSProperties}
            >
              {loading ? (
                <div className="h-full flex items-center justify-center" style={{ color: EKARI.dim }}>
                  <BouncingBallLoader />
                </div>
              ) : !hasMessages ? (
                <EmptyState />
              ) : (
                <div className="px-4 py-4 pb-0">
                  {oldestDoc && (
                    <div className="mb-2 flex justify-center">
                      <button
                        onClick={loadMore}
                        className="h-8 px-3 rounded-lg border text-xs font-bold transition hover:bg-black/5"
                        disabled={paging}
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                      >
                        {paging ? "Loading…" : "Load older"}
                      </button>
                    </div>
                  )}

                  {items.map((msg, i) => {
                    const mine = msg.from === uid;

                    const prev = items[i - 1];
                    const next = items[i + 1];

                    const prevSameSender = !!prev && prev.from === msg.from;
                    const nextSameSender = !!next && next.from === msg.from;

                    const isFirstInGroup = !prevSameSender;
                    const isLastInGroup = !nextSameSender;

                    const rowMt = isFirstInGroup ? "mt-3" : "mt-1";
                    const rowMb = isLastInGroup ? "mb-1" : "mb-0";

                    const showAvatar = !mine && isLastInGroup;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"} items-end gap-2 ${rowMt} ${rowMb}`}
                      >
                        {!mine && (
                          <div className="w-7 flex justify-center">
                            {showAvatar ? (
                              <div className="relative w-7 h-7 rounded-full overflow-hidden bg-gray-200">
                                <Image
                                  src={
                                    peer?.photoURL ||
                                    activePeerQs.peerPhotoURL ||
                                    selectedRow?.peer?.photoURL ||
                                    "/avatar-placeholder.png"
                                  }
                                  alt="avatar"
                                  fill
                                  className="object-cover"
                                  sizes="28px"
                                />
                              </div>
                            ) : (
                              <div className="w-7 h-7" />
                            )}
                          </div>
                        )}

                        <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[78%]`}>
                          <div
                            style={{
                              background: mine ? mineBg : theirsBg,
                              borderColor: mine ? mineBorder : theirsBrd,
                            }}
                            className={[
                              "text-[15px] border shadow-sm px-3 py-2",
                              "max-w-full break-words whitespace-pre-wrap leading-5",
                              mine
                                ? isFirstInGroup
                                  ? "rounded-2xl rounded-tr-md"
                                  : "rounded-2xl rounded-tr-md rounded-br-md"
                                : isFirstInGroup
                                  ? "rounded-2xl rounded-tl-md"
                                  : "rounded-2xl rounded-tl-md rounded-bl-md",
                            ].join(" ")}
                          >
                            {msg.uploading ? (
                              <div className="flex items-center gap-2 opacity-80">
                                <span className="w-3 h-3 rounded-full animate-pulse bg-slate-400" />
                                <span>Uploading…</span>
                              </div>
                            ) : msg.error ? (
                              <span className="text-red-500">Failed to send</span>
                            ) : msg.type === "image" && msg.imageUrl ? (
                              <a href={msg.imageUrl} target="_blank" rel="noreferrer" className="block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={msg.imageUrl}
                                  alt="Sent image"
                                  className="rounded-xl bg-gray-100 max-w-full"
                                  style={{ width: 280, height: "auto", objectFit: "cover" }}
                                  onLoad={() => scrollToBottom("auto")}
                                />
                              </a>
                            ) : msg.type === "product" && msg.listing?.id ? (
                              <div className="space-y-2">
                                {!!msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}

                                <button
                                  type="button"
                                  onClick={() => {
                                    const url =
                                      msg.listing?.url || `/market/${encodeURIComponent(msg.listing!.id)}`;
                                    router.push(url);
                                  }}
                                  className="w-full text-left rounded-xl border bg-white/70 hover:bg-white transition p-2 flex items-center gap-2"
                                  style={{ borderColor: EKARI.hair }}
                                  title="Open product"
                                >
                                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                                    <Image
                                      src={msg.listing.image || "/product-placeholder.jpg"}
                                      alt={msg.listing.name || "Product"}
                                      fill
                                      className="object-cover"
                                      sizes="48px"
                                    />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-extrabold text-slate-900 truncate">
                                      {msg.listing.name || "Product"}
                                    </div>

                                    <div className="text-[11px] text-slate-600 truncate">
                                      {msg.listing.currency === "USD"
                                        ? `USD ${Number(msg.listing.price || 0).toLocaleString("en-US", {
                                          maximumFractionDigits: 2,
                                        })}`
                                        : `KSh ${Number(msg.listing.price || 0).toLocaleString("en-KE", {
                                          maximumFractionDigits: 0,
                                        })}`}
                                    </div>
                                  </div>

                                  <IoChevronForward size={16} style={{ color: EKARI.dim }} />
                                </button>
                              </div>
                            ) : (
                              !!msg.text && <span>{msg.text}</span>
                            )}
                          </div>

                          {isLastInGroup && (
                            <div className="mt-1 text-[11px] text-slate-500 px-1">
                              {formatMsgTime(msg.createdAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={endRef} className="h-0" />
                </div>
              )}
            </div>

            {/* Jump to latest */}
            {showJump && hasMessages && (
              <button
                onClick={() => scrollToBottom("smooth")}
                className="absolute md:static md:hidden bottom-[88px] right-4 z-40 h-9 px-3 rounded-full text-sm font-extrabold shadow-md"
                style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
              >
                Jump to latest
              </button>
            )}

            {/* Composer */}
            <div
              ref={composerRef}
              className={clsx(
                "z-40 border-t bg-white",
                isDesktop ? "sticky bottom-0" : "fixed left-0 right-0 bottom-0"
              )}
              style={{
                borderColor: EKARI.hair,
                paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
              }}
            >
              <div className="w-full px-3">
                <div className="flex items-end gap-2 py-2 relative">
                  <div
                    className="flex-1 border bg-gray-50 rounded-2xl px-3 py-2"
                    style={{ borderColor: EKARI.hair }}
                  >
                    {pendingListing && (
                      <div
                        className="mb-2 rounded-xl border bg-white p-2 flex items-center gap-2"
                        style={{ borderColor: EKARI.hair }}
                      >
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <Image
                            src={pendingListing.image || "/product-placeholder.jpg"}
                            alt={pendingListing.name || "Product"}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {pendingListing.name || "Product inquiry"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{pendingListing.url}</div>
                        </div>

                        <button
                          type="button"
                          className="h-8 w-8 rounded-full hover:bg-black/5 text-slate-600 font-black"
                          onClick={() => setPendingListing(null)}
                          title="Remove product"
                          aria-label="Remove product"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {!pendingListing?.id && threadContextListing?.id && (
                      <div className="mb-2">
                        <button
                          type="button"
                          onClick={() => setPendingListing(threadContextListing)}
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold hover:bg-black/5"
                          style={{ borderColor: EKARI.hair, color: EKARI.text }}
                          title="Attach last referenced product"
                        >
                          🛒 Attach product
                        </button>
                      </div>
                    )}

                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        setTypingDebounced(!!e.target.value.trim());
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          onSend();
                        }
                      }}
                      onBlur={() => setTypingDebounced(false)}
                      placeholder="Message…"
                      rows={1}
                      className="w-full bg-transparent outline-none text-[15px] resize-none max-h-40 leading-5"
                      style={{ height: 40 }}
                    />

                    {preview && (
                      <div className="mt-2 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-24 h-24 rounded-md object-cover border"
                          onLoad={() => scrollToBottom("auto")}
                          style={{ borderColor: EKARI.hair }}
                        />
                        <button
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                          onClick={() => setPreview(null)}
                          aria-label="Remove preview"
                          title="Remove preview"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        title="Emoji"
                        type="button"
                        onClick={() => setShowEmoji((p) => !p)}
                        style={{ backgroundColor: "#F3F4F6" }}
                      >
                        <IoHappyOutline size={20} color={EKARI.text} />
                        {showEmoji && (
                          <div
                            className="absolute bottom-14 left-3 z-50 bg-white rounded-xl shadow-lg p-2 max-w-[260px] w-[240px] h-[180px] overflow-y-auto grid grid-cols-8 gap-1 border"
                            onMouseLeave={() => setShowEmoji(false)}
                            style={{ borderColor: EKARI.hair }}
                          >
                            {EmojiPickerList.map((emo) => (
                              <button
                                key={emo}
                                onClick={() => {
                                  setInput((prev) => prev + emo);
                                  setShowEmoji(false);
                                  textareaRef.current?.focus();
                                }}
                                className="text-xl rounded-md hover:bg-black/5"
                                title={emo}
                                type="button"
                              >
                                {emo}
                              </button>
                            ))}
                          </div>
                        )}
                      </button>

                      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onImageChosen} />

                      <button
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        title="Image"
                        type="button"
                        onClick={onPickImage}
                        style={{ backgroundColor: "#F3F4F6" }}
                      >
                        <IoImageOutline size={20} color={EKARI.text} />
                      </button>

                      <button
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        title="Camera"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ backgroundColor: "#F3F4F6" }}
                      >
                        <IoCameraOutline size={20} color={EKARI.text} />
                      </button>
                    </div>
                  </div>

                  <Button
                    onClick={onSend}
                    disabled={!input.trim() && !pendingListing?.id}
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm"
                    title="Send"
                    type="button"
                    style={{ backgroundColor: EKARI.gold }}
                  >
                    <IoSend size={18} color="#fff" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile-only: open drawer button is in header already, keep clean */}
      </div>

      {/* Optional: small mobile hint (not required) */}
      {isMobile && !isDesktop && !sidebarOpen && filteredRows.length > 0 && (
        <div className="hidden" />
      )}
    </div>
  );
}

export default function BongaThreadLayoutPage() {
  const isMobile = useIsMobile();

  // Your previous behavior: mobile without AppShell, desktop with AppShell
  if (isMobile) return <BongaThreadUI />;

  return (
    <AppShell>
      <BongaThreadUI />
    </AppShell>
  );
}
