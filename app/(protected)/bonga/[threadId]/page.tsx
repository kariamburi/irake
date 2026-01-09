// app/bonga/[threadId]/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  doc,
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
  updateDoc,
  DocumentSnapshot,
  deleteField,
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
  IoMicOutline,
  IoPause,
  IoPlay,
  IoSearchOutline,
  IoSend,
} from "react-icons/io5";

import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

/* ================================================================ */

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
};

type UserLite = {
  uid?: string;
  firstName?: string;
  surname?: string;
  handle?: string;
  photoURL?: string;
  followersCount?: number;
  followingCount?: number;
};

type ListingCtx = {
  id: string;
  name?: string;
  image?: string;
  imageUrl?: string;
  imageUrls?: string[];
  price?: number;
  currency?: "KES" | "USD" | string;
  unit?: string;
  type?: string;
  category?: string;
  url?: string;
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
  listing?: ListingCtx | any;
  readBy?: Record<string, boolean>;
};

type ThreadRow = {
  id: string; // threadId
  threadId: string;
  peerId: string;
  unread?: number;
  lastMessageText?: string;
  lastMessageType?: string;
  lastMessageAt?: any;
  updatedAt?: any;
  createdAt?: any;
};

function participantsArray(a: string, b: string) {
  return [a, b].sort();
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  return null;
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

function formatListTime(ts: any) {
  const d = tsToDate(ts);
  if (!d) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return formatMsgTime(ts);
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 7) return d.toLocaleDateString("en-KE", { weekday: "short" });
  return d.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
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

function normalizeUser(uid: string, raw: any): UserLite {
  const r = raw || {};
  return {
    uid,
    firstName: r.firstName ?? r.name ?? "",
    surname: r.surname ?? r.lastName ?? "",
    handle: r.handle ?? r.username ?? "",
    photoURL: r.photoURL ?? r.photo ?? r.imageUrl ?? "",
    followersCount: r.followersCount ?? 0,
    followingCount: r.followingCount ?? 0,
  };
}

function stripUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripUndefined).filter((x) => x !== undefined) as any;
  if (v && typeof v === "object") {
    const out: any = {};
    for (const [k, val] of Object.entries(v as any)) {
      const cleaned = stripUndefined(val);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return v === undefined ? (undefined as any) : v;
}

function fmtMoney(n?: number, currency: "KES" | "USD" = "KES") {
  const safe = Number.isFinite(Number(n)) ? Number(n) : 0;
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return (currency === "USD" ? "$" : "KSh ") + safe.toLocaleString("en-KE");
  }
}

/* --- emoji --- */
const EMOJI_SETS: string[][] = [
  ["😀", "😁", "😂", "🤣", "😅", "😊", "😍", "😘", "😜", "🤗", "🤩", "🤔"],
  ["👍", "👎", "👏", "🙌", "🙏", "💪", "🤝", "👋", "👌", "✌️", "🤞", "🫶"],
  ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💘", "💝", "💔"],
  ["🎉", "✨", "🔥", "🌟", "💯", "✅", "❌", "⚡", "☀️", "🌙", "⭐", "🍀"],
];

function safeStr(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    return "";
  }
  return "";
}

function tsToMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  const d = tsToDate(ts);
  return d ? d.getTime() : 0;
}

function agoShort(ms: number) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return "now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ================================================================ */

export default function BongaThreadPage() {
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const sp = useSearchParams();

  const { user } = useAuth();
  const uid = user?.uid || "";

  const rtdb = getDatabase();

  const threadId = String(params.threadId || "");
  const qsPeerId = sp.get("peerId") || "";
  const qsPeerName = sp.get("peerName") || "";
  const qsPeerHandle = sp.get("peerHandle") || "";
  const qsPeerPhotoURL = sp.get("peerPhotoURL") || "";
  const debug = sp.get("debug") === "1";

  // deep-link listing (optional)
  const initialListing: ListingCtx | null = useMemo(() => {
    const id = sp.get("listingId") || "";
    if (!id) return null;
    const priceRaw = sp.get("listingPrice");
    const price = priceRaw ? Number(priceRaw) : undefined;
    return {
      id,
      name: sp.get("listingName") || "",
      image: sp.get("listingImage") || "",
      imageUrl: sp.get("listingImage") || "",
      price: Number.isFinite(price as any) ? price : undefined,
      currency: (sp.get("listingCurrency") || "KES") as any,
      unit: sp.get("listingUnit") || "",
      type: sp.get("listingType") || "marketListing",
      url: sp.get("listingUrl") || `/market/${encodeURIComponent(id)}`,
    };
  }, [sp]);

  /* ---------------- LEFT SIDEBAR STATE ---------------- */
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [peerCache, setPeerCache] = useState<Record<string, UserLite>>({});

  /* ---------------- RIGHT PANEL STATE ---------------- */
  const [activePeerId, setActivePeerId] = useState(qsPeerId);
  const [peerQs] = useState({
    peerName: qsPeerName,
    peerHandle: qsPeerHandle,
    peerPhotoURL: qsPeerPhotoURL,
  });

  const [pending, setPending] = useState<ListingCtx | null>(initialListing);
  const [pendingSent, setPendingSent] = useState(false);

  const [threadReady, setThreadReady] = useState(false);
  const [threadCtx, setThreadCtx] = useState<any>(null);

  const [peer, setPeer] = useState<(UserLite & { online?: boolean; lastActiveAt?: any }) | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Message[]>([]);
  const [pagingOlder, setPagingOlder] = useState(false);
  const [oldestDoc, setOldestDoc] = useState<DocumentSnapshot | null>(null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const [showJump, setShowJump] = useState(false);

  const [viewer, setViewer] = useState<{ open: boolean; url: string }>({ open: false, url: "" });
  const [emojiOpen, setEmojiOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // audio recording (web)
  const [isRecording, setIsRecording] = useState(false);
  const [recMs, setRecMs] = useState(0);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recTimerRef = useRef<any>(null);

  // audio playback (only one at once)
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioState, setAudioState] = useState<Record<string, { playing: boolean; pct: number }>>({});

  // 🔎 Track "active map" like Cloud Function
  const [activeMapSnap, setActiveMapSnap] = useState<{ myMs: number; peerMs: number }>({
    myMs: 0,
    peerMs: 0,
  });

  const peerActiveNow = useMemo(() => {
    const peerMs = activeMapSnap.peerMs;
    return peerMs > 0 && Date.now() - peerMs < 60_000;
  }, [activeMapSnap.peerMs]);

  const myActiveNow = useMemo(() => {
    const myMs = activeMapSnap.myMs;
    return myMs > 0 && Date.now() - myMs < 60_000;
  }, [activeMapSnap.myMs]);

  const ctxListing: ListingCtx | null = useMemo(() => {
    const l = threadCtx?.listing;
    if (!l?.id) return null;
    return {
      id: String(l.id),
      name: l.name || "",
      image: l.image || l.imageUrl || l.imageUrls?.[0] || "",
      imageUrl: l.image || l.imageUrl || l.imageUrls?.[0] || "",
      imageUrls: l.imageUrls || (l.imageUrl ? [l.imageUrl] : []),
      price: typeof l.price === "number" ? l.price : Number(l.price || 0),
      currency: l.currency || "KES",
      unit: l.unit || "",
      type: l.type || "marketListing",
      category: l.category || "",
      url: l.url || `/market/${encodeURIComponent(String(l.id))}`,
    };
  }, [threadCtx]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }, []);

  const headerTitle =
    peer?.firstName || peerQs.peerName || peer?.handle || peerQs.peerHandle || "Message";

  const onlineNow = !!peer?.online;
  const lastActiveAny = peer?.lastActiveAt;

  /* ================================================================
   *  LEFT SIDEBAR: load threads list (desktop)
   * ================================================================ */
  useEffect(() => {
    if (!uid) {
      setThreads([]);
      setThreadsLoading(false);
      return;
    }

    setThreadsLoading(true);

    const qy = query(
      collection(db, "userThreads", uid, "threads"),
      orderBy("updatedAt", "desc"),
      limit(60)
    );

    const unsub = onSnapshot(
      qy,
      async (snap) => {
        const rows = snap.docs.map((d) => {
          const v = d.data() as any;
          return {
            id: d.id,
            threadId: v.threadId || d.id,
            peerId: v.peerId || "",
            unread: v.unread ?? 0,
            lastMessageText: safeStr(v.lastMessageText || v.lastMessage),
            lastMessageType: safeStr(v.lastMessageType),
            lastMessageAt: v.lastMessageAt || null,
            updatedAt: v.updatedAt || null,
            createdAt: v.createdAt || null,
          } as ThreadRow;
        });

        setThreads(rows);

        const need = Array.from(
          new Set(rows.map((r) => r.peerId).filter(Boolean).filter((pid) => !peerCache[pid]))
        );

        if (need.length) {
          try {
            const pairs = await Promise.all(
              need.map(async (pid) => {
                const s = await getDoc(doc(db, "users", pid));
                return [pid, normalizeUser(pid, s.data())] as const;
              })
            );
            setPeerCache((p) => {
              const next = { ...p };
              for (const [pid, u] of pairs) next[pid] = u;
              return next;
            });
          } catch {
            // ignore
          }
        }

        setThreadsLoading(false);
      },
      () => setThreadsLoading(false)
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;

    return threads.filter((t) => {
      const p = peerCache[t.peerId];
      const name = `${p?.firstName || ""} ${p?.surname || ""}`.trim().toLowerCase();
      const handle = (p?.handle || "").toLowerCase();
      const last = (t.lastMessageText || "").toLowerCase();
      return name.includes(q) || handle.includes(q) || last.includes(q);
    });
  }, [threads, search, peerCache]);

  /* ================================================================
   *  RIGHT PANEL: derive peerId if missing
   * ================================================================ */
  useEffect(() => {
    (async () => {
      if (!uid || !threadId) return;
      if (activePeerId) return;

      try {
        const snap = await getDoc(doc(db, "threads", threadId));
        if (!snap.exists()) return;

        const data = snap.data() as any;
        const parts: string[] = data?.participants || [];
        const other = parts.find((p) => p !== uid) || "";
        if (other) setActivePeerId(other);
      } catch (e) {
        console.error("derive peerId error:", e);
      }
    })();
  }, [uid, threadId, activePeerId]);

  /* ================================================================
   *  RIGHT PANEL: ensure thread exists + mark read
   * ================================================================ */
  useEffect(() => {
    if (!uid || !activePeerId || !threadId) return;

    let cancelled = false;

    (async () => {
      try {
        // don't force updatedAt here; let dmMessageCreated control it.
        await getDoc(doc(db, "threads", threadId));
      } catch { }

      // ensure thread exists
      try {
        await setDoc(
          doc(db, "threads", threadId),
          {
            participants: participantsArray(uid, activePeerId),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(), // ✅ add this
          },
          { merge: true }
        );
      } catch (err) {
        console.error("Thread ensure setDoc failed:", err);
      }

      // mark my mirror read
      try {

        await setDoc(
          doc(db, "userThreads", uid, "threads", threadId),
          { unread: 0, lastReadAt: serverTimestamp() },
          { merge: true }
        );
      } catch (err) {

        console.error("userThreads setDoc failed:", err);
      }

      if (!cancelled) setThreadReady(true);
    })();

    return () => {
      cancelled = true;
      setThreadReady(false);
    };
  }, [uid, activePeerId, threadId]);

  /* ================================================================
   *  RIGHT PANEL: peer public info + presence
   * ================================================================ */
  useEffect(() => {
    if (!activePeerId) return;
    const uRef = doc(db, "users", activePeerId);
    const unsub = onSnapshot(uRef, (snap) => {
      const u = normalizeUser(activePeerId, snap.data());
      setPeer((prev) => ({ ...(prev || {}), ...(u || {}) }));
      setPeerCache((p) => ({ ...p, [activePeerId]: u }));
    });
    return () => unsub();
  }, [activePeerId]);

  useEffect(() => {
    if (!activePeerId) return;
    const sRef = rtdbRef(rtdb, `/status/${activePeerId}`);
    const off = onValue(sRef, (snap) => {
      const v = snap.val() || {};
      setPeer((p) => ({
        ...(p || {}),
        online: v.state === "online",
        lastActiveAt:
          typeof v.lastChanged === "number" ? new Date(v.lastChanged) : p?.lastActiveAt ?? null,
      }));
    });
    return () => off();
  }, [activePeerId, rtdb]);

  /* ================================================================
   *  RIGHT PANEL: typing + threadContext + activeMap tracker
   * ================================================================ */
  useEffect(() => {
    if (!threadId || !activePeerId || !uid) return;
    const tRef = doc(db, "threads", threadId);
    const unsub = onSnapshot(tRef, (snap) => {
      const data = snap.data() || {};
      const typing = (data as any).typing || {};
      setPeerTyping(!!typing[activePeerId]);
      setThreadCtx((data as any).threadContext || null);

      // 🔎 active map (same source your cloud function reads)
      const myTs = (snap as any).get?.(`active.${uid}`) ?? (data as any)?.active?.[uid] ?? null;
      const peerTs =
        (snap as any).get?.(`active.${activePeerId}`) ??
        (data as any)?.active?.[activePeerId] ??
        null;

      setActiveMapSnap({
        myMs: tsToMillis(myTs),
        peerMs: tsToMillis(peerTs),
      });
    });
    return () => unsub();
  }, [threadId, activePeerId, uid]);

  /* ================================================================
   *  RIGHT PANEL: active presence heartbeat ✅ IMPORTANT
   *  - updates active.{uid} immediately
   *  - refreshes every 25s while visible
   * ================================================================ */
  useEffect(() => {
    if (!uid || !threadId) return;

    const tRef = doc(db, "threads", threadId);

    const writeActive = (val: boolean) =>
      updateDoc(tRef, { [`active.${uid}`]: val ? serverTimestamp() : deleteField() }).catch(() => { });

    let timer: any = null;

    const startHeartbeat = () => {
      if (timer) return;
      // write immediately, then keep refreshing
      writeActive(true);
      timer = setInterval(() => {
        if (!document.hidden) writeActive(true);
      }, 25_000);
    };

    const stopHeartbeat = () => {
      if (timer) clearInterval(timer);
      timer = null;
      writeActive(false);
    };

    const onVisibility = () => {
      if (document.hidden) stopHeartbeat();
      else startHeartbeat();
    };

    const onBeforeUnload = () => stopHeartbeat();

    if (!document.hidden) startHeartbeat();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      stopHeartbeat();
    };
  }, [uid, threadId]);

  /* ================================================================
   *  RIGHT PANEL: typing scheduler
   * ================================================================ */
  const typingTimers = useRef<{ startT: any; stopT: any; isTyping: boolean }>({
    startT: null,
    stopT: null,
    isTyping: false,
  });

  const setTyping = useCallback(
    async (val: boolean) => {
      if (!uid || !threadId) return;
      await updateDoc(doc(db, "threads", threadId), { [`typing.${uid}`]: val }).catch(() => { });
    },
    [uid, threadId]
  );

  const scheduleTyping = useCallback(
    (hasText: boolean) => {
      if (!uid || !threadId) return;

      if (typingTimers.current.startT) clearTimeout(typingTimers.current.startT);
      if (typingTimers.current.stopT) clearTimeout(typingTimers.current.stopT);

      if (!hasText) {
        typingTimers.current.stopT = setTimeout(() => {
          if (typingTimers.current.isTyping) {
            typingTimers.current.isTyping = false;
            setTyping(false).catch(() => { });
          }
        }, 250);
        return;
      }

      if (!typingTimers.current.isTyping) {
        typingTimers.current.startT = setTimeout(() => {
          typingTimers.current.isTyping = true;
          setTyping(true).catch(() => { });
        }, 0);
      }

      typingTimers.current.stopT = setTimeout(() => {
        if (typingTimers.current.isTyping) {
          typingTimers.current.isTyping = false;
          setTyping(false).catch(() => { });
        }
      }, 700);
    },
    [uid, threadId, setTyping]
  );

  useEffect(() => {
    return () => scheduleTyping(false);
  }, [scheduleTyping]);

  /* ================================================================
   *  RIGHT PANEL: messages live
   * ================================================================ */
  useEffect(() => {
    if (!threadReady || !threadId) return;

    setLoading(true);

    const qy = query(
      collection(db, "threads", threadId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(25)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Message[];
        setItems(docs);
        setOldestDoc(snap.docs[0] ?? null);
        setLoading(false);

        if (uid) {
          setDoc(
            doc(db, "userThreads", uid, "threads", threadId),
            { unread: 0, lastReadAt: serverTimestamp() },
            { merge: true }
          ).catch(() => { });
        }

        scrollToBottom("auto");
      },
      (err) => {
        console.error("messages onSnapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [threadReady, threadId, uid, scrollToBottom]);

  /* ================================================================
   *  RIGHT PANEL: load older
   * ================================================================ */
  const loadOlder = useCallback(async () => {
    if (!oldestDoc || pagingOlder || !threadId) return;
    setPagingOlder(true);

    const el = listRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;

    try {
      const qOld = query(
        collection(db, "threads", threadId, "messages"),
        orderBy("createdAt", "asc"),
        endBefore(oldestDoc),
        limitToLast(25)
      );

      const snap = await getDocs(qOld);
      const older = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Message[];
      if (!older.length) return;

      setItems((prev) => [...older, ...prev]);
      setOldestDoc(snap.docs[0] ?? null);

      requestAnimationFrame(() => {
        const el2 = listRef.current;
        if (!el2) return;
        const newHeight = el2.scrollHeight;
        const delta = newHeight - prevHeight;
        el2.scrollTop = prevTop + delta;
      });
    } finally {
      setPagingOlder(false);
    }
  }, [oldestDoc, pagingOlder, threadId]);

  /* ================================================================
   *  RIGHT PANEL: jump button
   * ================================================================ */
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

  /* ================================================================
   *  RIGHT PANEL: send functions
   * ================================================================ */
  const sendProduct = useCallback(
    async (listing: any, text?: string) => {
      if (!uid || !activePeerId || !threadId) return;

      const t = (text ?? "").trim();
      const safeListing = stripUndefined(listing);

      const payload: any = {
        from: uid,
        to: activePeerId,
        type: "product",
        createdAt: serverTimestamp(),
        readBy: { [uid]: true },
        listing: safeListing,
      };
      if (t) payload.text = t;

      await addDoc(collection(db, "threads", threadId, "messages"), payload);
    },
    [uid, activePeerId, threadId]
  );


  // auto-send deep-link pending listing once
  useEffect(() => {
    if (!threadReady || !uid || !activePeerId || !threadId) return;
    if (!pending || pendingSent) return;

    (async () => {
      try {
        // await sendProduct(pending);
        setPendingSent(true);
        setPending(null);
        scrollToBottom("smooth");
      } catch (e) {
        console.error("auto-send pending listing failed:", e);
      }
    })();
  }, [threadReady, uid, activePeerId, threadId, pending, pendingSent, sendProduct, scrollToBottom]);

  const sendText = useCallback(
    async (text: string) => {
      if (!uid || !activePeerId || !threadId) return;
      const t = text.trim();
      if (!t && !pending) return;

      const hasListing = !!pending?.id;
      await addDoc(collection(db, "threads", threadId, "messages"), {
        text: t || "",

        from: uid,
        to: activePeerId,

        // ✅ make it explicit in message type for rendering + mirrors
        type: hasListing ? "product" : "text",

        // ✅ attach listing payload (small + safe)
        listing: hasListing
          ? {
            id: pending!.id,
            name: pending!.name || "",
            image: pending!.image || "",
            price: typeof pending!.price === "number" ? pending!.price : null,
            currency: pending!.currency || "KES",
            type: pending!.type || "marketListing",
            url: pending!.url || `/market/${encodeURIComponent(pending!.id)}`,
          }
          : null,

        createdAt: serverTimestamp(),
        readBy: { [uid]: true },
      });

      // ✅ clear after sending so next msg is normal
      if (hasListing) setPending(null);
    },
    [uid, activePeerId, threadId, pending]
  );
  const onSend = useCallback(async () => {
    const t = input.trim();
    if (!t && !pending?.id) return;

    await sendText(t);
    setInput("");
    scheduleTyping(false);
    scrollToBottom("smooth");
    // if (textareaRef.current) textareaRef.current.style.height = "40px";
  }, [input, pending, sendText, scheduleTyping, scrollToBottom]);

  const sendImageFile = useCallback(
    async (file: File) => {
      if (!uid || !activePeerId || !threadId) return;

      const msgDoc = await addDoc(collection(db, "threads", threadId, "messages"), {
        from: uid,
        to: activePeerId,
        type: "image" as const,
        createdAt: serverTimestamp(),
        readBy: { [uid]: true },
        uploading: true,
      });

      try {
        const path = `threads/${threadId}/images/${msgDoc.id}/original-${file.name || "image"}`;
        const blobRef = storageRef(storage, path);
        await uploadBytes(blobRef, file);
        const url = await getDownloadURL(blobRef);

        await updateDoc(doc(db, "threads", threadId, "messages", msgDoc.id), {
          imageUrl: url,
          uploading: false,
        });

        scrollToBottom("smooth");
      } catch (e) {
        console.error("image upload failed:", e);
        await updateDoc(doc(db, "threads", threadId, "messages", msgDoc.id), {
          error: true,
          uploading: false,
        }).catch(() => { });
      }
    },
    [uid, activePeerId, threadId, scrollToBottom]
  );

  const onPickImage = () => fileInputRef.current?.click();
  const onPickCamera = () => cameraInputRef.current?.click();
  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await sendImageFile(f);
    e.target.value = "";
  };

  /* ================================================================
   *  RIGHT PANEL: audio record/send
   * ================================================================ */
  const startRecording = useCallback(async () => {
    if (!uid || !activePeerId || !threadId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recChunksRef.current = [];

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recChunksRef.current.push(ev.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
      mediaRecRef.current = mr;

      setIsRecording(true);
      setRecMs(0);

      if (recTimerRef.current) clearInterval(recTimerRef.current);
      recTimerRef.current = setInterval(() => setRecMs((p) => p + 200), 200);
    } catch (e) {
      console.error("mic permission/recording failed:", e);
    }
  }, [uid, activePeerId, threadId]);

  const cancelRecording = useCallback(async () => {
    try {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      recTimerRef.current = null;

      const mr = mediaRecRef.current;
      if (mr && mr.state !== "inactive") mr.stop();
      mediaRecRef.current = null;

      setIsRecording(false);
      setRecMs(0);
      recChunksRef.current = [];
    } catch (e) {
      console.error("cancelRecording error:", e);
    }
  }, []);

  const finishRecording = useCallback(async () => {
    if (!uid || !activePeerId || !threadId) return;

    const mr = mediaRecRef.current;
    if (!mr) return;

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      if (mr.state !== "inactive") mr.stop();
      else resolve();
    });

    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;

    setIsRecording(false);

    const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
    recChunksRef.current = [];
    mediaRecRef.current = null;

    const msgDoc = await addDoc(collection(db, "threads", threadId, "messages"), {
      from: uid,
      to: activePeerId,
      type: "audio" as const,
      createdAt: serverTimestamp(),
      readBy: { [uid]: true },
      uploading: true,
    });

    try {
      const path = `threads/${threadId}/audio/${msgDoc.id}/recording.webm`;
      const blobRef = storageRef(storage, path);
      await uploadBytes(blobRef, blob);
      const url = await getDownloadURL(blobRef);

      await updateDoc(doc(db, "threads", threadId, "messages", msgDoc.id), {
        audioUrl: url,
        uploading: false,
      });

      scrollToBottom("smooth");
    } catch (e) {
      console.error("audio upload failed:", e);
      await updateDoc(doc(db, "threads", threadId, "messages", msgDoc.id), {
        error: true,
        uploading: false,
      }).catch(() => { });
    } finally {
      setRecMs(0);
    }
  }, [uid, activePeerId, threadId, scrollToBottom]);

  const toggleAudio = useCallback((msgId: string, url: string) => {
    if (activeAudioRef.current) {
      const a = activeAudioRef.current;
      if ((a as any).__msgId !== msgId) a.pause();
    }

    let audioEl: HTMLAudioElement | null = null;

    if (activeAudioRef.current && (activeAudioRef.current as any).__msgId === msgId) {
      audioEl = activeAudioRef.current;
    } else {
      audioEl = new Audio(url);
      (audioEl as any).__msgId = msgId;
      activeAudioRef.current = audioEl;

      audioEl.addEventListener("timeupdate", () => {
        const pct = audioEl!.duration ? audioEl!.currentTime / audioEl!.duration : 0;
        setAudioState((p) => ({ ...p, [msgId]: { playing: !audioEl!.paused, pct } }));
      });

      audioEl.addEventListener("ended", () => {
        setAudioState((p) => ({ ...p, [msgId]: { playing: false, pct: 0 } }));
      });
    }

    if (!audioEl) return;

    if (audioEl.paused) {
      audioEl.play().catch(() => { });
      setAudioState((p) => ({ ...p, [msgId]: { playing: true, pct: p[msgId]?.pct ?? 0 } }));
    } else {
      audioEl.pause();
      setAudioState((p) => ({ ...p, [msgId]: { playing: false, pct: p[msgId]?.pct ?? 0 } }));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      recTimerRef.current = null;

      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
    };
  }, []);

  /* ================================================================
   *  UI Helpers
   * ================================================================ */
  const mmss = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const mm = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const TypingBubble = () => (
    <div className="px-4 mt-2 mb-2">
      <div
        className="inline-flex items-center gap-2 border shadow-sm px-3 py-2"
        style={{
          maxWidth: "75%",
          backgroundColor: "rgba(199,146,87,0.10)",
          borderRadius: 16,
          borderTopLeftRadius: 6,
          borderColor: "rgba(199,146,87,0.35)",
        }}
      >
        <span className="inline-flex gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "120ms" }} />
          <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" style={{ animationDelay: "240ms" }} />
        </span>
        <span className="text-xs font-semibold" style={{ color: EKARI.dim }}>
          Typing…
        </span>
      </div>
    </div>
  );

  const openThread = (t: ThreadRow) => {
    const p = peerCache[t.peerId];
    const qs = new URLSearchParams();
    if (t.peerId) qs.set("peerId", t.peerId);
    if (p?.firstName) qs.set("peerName", p.firstName);
    if (p?.handle) qs.set("peerHandle", p.handle);
    if (p?.photoURL) qs.set("peerPhotoURL", p.photoURL);
    router.push(`/bonga/${encodeURIComponent(t.threadId)}?${qs.toString()}`);
  };

  /* ================================================================
   *  Guard: not signed in
   * ================================================================ */
  if (!uid) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ backgroundColor: EKARI.sand }}>
          <div>
            <div className="text-lg font-extrabold" style={{ color: EKARI.text }}>
              Sign in to view your chats
            </div>
            <div className="text-sm mt-1" style={{ color: EKARI.dim }}>
              Your conversations will appear here.
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ================================================================
   *  Layout
   * ================================================================ */
  const Layout = (
    <div className="w-full h-[100dvh] overflow-hidden" style={{ backgroundColor: EKARI.sand }}>
      <div className="mx-auto w-full max-w-6xl h-[100dvh] flex bg-white border-x overflow-hidden" style={{ borderColor: EKARI.hair }}>
        {/* ===================== LEFT: Sidebar (desktop) ===================== */}
        <aside className="hidden md:flex w-[360px] border-r flex-col h-full overflow-hidden" style={{ borderColor: EKARI.hair }}>
          <div className="h-[54px] px-3 flex items-center justify-between border-b bg-white shrink-0" style={{ borderColor: EKARI.hair }}>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl grid place-items-center" style={{ backgroundColor: "rgba(35,63,57,0.10)", color: EKARI.forest }}>
                <IoChatbubblesOutline size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm" style={{ color: EKARI.text }}>Inbox</div>
                <div className="text-[11px] truncate" style={{ color: EKARI.dim }}>Your conversations</div>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-black/5" title="Search" type="button">
              <IoSearchOutline size={18} color={EKARI.dim} />
            </button>
          </div>

          <div className="px-3 py-2 border-b bg-white shrink-0" style={{ borderColor: EKARI.hair }}>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2 bg-gray-50" style={{ borderColor: EKARI.hair }}>
              <IoSearchOutline size={16} color={EKARI.dim} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search inbox..."
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: EKARI.text }}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {threadsLoading ? (
              <div className="h-full flex items-center justify-center py-10"><BouncingBallLoader /></div>
            ) : filteredThreads.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>No conversations</div>
                <div className="text-xs mt-1" style={{ color: EKARI.dim }}>Start chatting from a profile or listing.</div>
              </div>
            ) : (
              <div className="py-2">
                {filteredThreads.map((t) => {
                  const p = peerCache[t.peerId];
                  if (!p?.handle) return null;
                  const name = (p?.firstName || p?.handle || "User") + (p?.surname ? ` ${p.surname}` : "");
                  const isActive = t.threadId === threadId;
                  const ts = t.lastMessageAt || t.updatedAt;

                  const subtitle =
                    t.lastMessageType === "image"
                      ? "📷 Photo"
                      : t.lastMessageType === "audio"
                        ? "🎤 Voice"
                        : t.lastMessageType === "product"
                          ? "🛒 Product"
                          : t.lastMessageText || "Say hi 👋";

                  return (
                    <button
                      key={t.threadId}
                      type="button"
                      onClick={() => openThread(t)}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-black/5"
                      style={{
                        backgroundColor: isActive ? "rgba(35,63,57,0.06)" : "transparent",
                        borderLeft: isActive ? `3px solid ${EKARI.forest}` : "3px solid transparent",
                      }}
                    >
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        <Image src={p?.photoURL || "/avatar-placeholder.png"} alt={name} fill className="object-cover" sizes="44px" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold text-sm truncate" style={{ color: EKARI.text }}>{name}</div>
                          <div className="text-[11px] shrink-0" style={{ color: EKARI.dim }}>{formatListTime(ts)}</div>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <div className="text-xs truncate" style={{ color: EKARI.dim }}>{subtitle}</div>

                          {!!(t.unread && t.unread > 0) && (
                            <div className="min-w-[20px] h-5 px-2 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0" style={{ backgroundColor: EKARI.gold, color: "#fff" }}>
                              {t.unread > 99 ? "99+" : t.unread}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* ===================== RIGHT: Thread Panel ===================== */}
        <main className="relative flex-1 min-w-0 flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="h-[54px] px-3 flex items-center justify-between border-b bg-white sticky top-0 z-30 shrink-0" style={{ borderColor: EKARI.hair }}>
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => router.back()} className="md:hidden p-2 rounded-lg hover:bg-black/5" aria-label="Back" title="Back" type="button">
                <IoArrowBack size={20} color={EKARI.text} />
              </button>

              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-100">
                  {onlineNow && (
                    <span className="absolute right-0.5 bottom-0.5 w-[14px] h-[14px] rounded-full border-2 z-10" style={{ backgroundColor: "#16A34A", borderColor: EKARI.sand }} />
                  )}
                  <Image src={peer?.photoURL || peerQs.peerPhotoURL || "/avatar-placeholder.png"} alt={headerTitle} fill className="object-cover" sizes="36px" />
                </div>

                <div className="min-w-0">
                  <div className="font-extrabold text-slate-900 text-sm truncate">{headerTitle}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {peerTyping ? "Typing…" : peerActiveNow ? "Active now" : lastSeenText(onlineNow, lastActiveAny)}
                  </div>
                </div>
              </div>
            </div>

            <button className="p-2 rounded-lg hover:bg-black/5" aria-label="Report" title="Report conversation" type="button">
              <IoFlagOutline size={18} color={EKARI.dim} />
            </button>
          </div>

          {/* Debug panel */}
          {debug && (
            <div className="border-b bg-white px-3 py-2 text-[12px]" style={{ borderColor: EKARI.hair, color: EKARI.text }}>
              <div className="flex flex-wrap gap-x-5 gap-y-1 items-center">
                <div><b>myActiveNow:</b> {String(myActiveNow)}</div>
                <div><b>peerActiveNow:</b> {String(peerActiveNow)}</div>
                <div><b>my active:</b> {agoShort(activeMapSnap.myMs)}</div>
                <div><b>peer active:</b> {agoShort(activeMapSnap.peerMs)}</div>
                <div><b>threadId:</b> {threadId}</div>
              </div>
              <div className="text-[11px]" style={{ color: EKARI.dim }}>
                Tip: open same thread on another device, add <b>?debug=1</b>, watch peerActiveNow flip true/false.
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={listRef}
            className="flex-1 min-h-0 overflow-y-auto bg-gray-50"
            style={{ paddingTop: 8, paddingBottom: 16, scrollbarGutter: "stable both-edges" }}
          >
            {loading || !threadReady ? (
              <div className="h-full flex items-center justify-center" style={{ color: EKARI.dim }}>
                <BouncingBallLoader />
              </div>
            ) : items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-6 text-center">
                <div className="w-full max-w-md rounded-2xl border bg-white shadow-sm p-4" style={{ borderColor: EKARI.hair }}>
                  <div className="mx-auto mb-3 h-16 w-16 rounded-2xl flex items-center justify-center bg-gray-50">
                    <IoChatbubblesOutline size={34} color={EKARI.forest} />
                  </div>
                  <div className="font-extrabold text-slate-900 text-lg">Start a conversation</div>
                  <div className="text-xs text-slate-500 mt-1">{lastSeenText(onlineNow, lastActiveAny)}</div>

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
                </div>
              </div>
            ) : (
              <div className="px-4 py-4 pb-0">
                {oldestDoc && (
                  <div className="mb-2 flex justify-center">
                    <button
                      onClick={loadOlder}
                      disabled={pagingOlder}
                      className="h-8 px-3 rounded-lg border text-xs font-bold transition hover:bg-black/5 disabled:opacity-60"
                      style={{ borderColor: EKARI.hair, color: EKARI.text }}
                      type="button"
                    >
                      {pagingOlder ? "Loading…" : "Load older"}
                    </button>
                  </div>
                )}

                {items.map((msg, idx) => {
                  const mine = msg.from === uid;
                  const prev = items[idx - 1];
                  const next = items[idx + 1];
                  const prevSame = !!prev && prev.from === msg.from;
                  const nextSame = !!next && next.from === msg.from;
                  const isFirst = !prevSame;
                  const isLast = !nextSame;
                  const showAvatar = !mine && isLast;

                  const bubbleBg = mine ? "rgba(35,63,57,0.10)" : "rgba(199,146,87,0.10)";
                  const bubbleBr = mine ? "rgba(35,63,57,0.35)" : "rgba(199,146,87,0.35)";

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${mine ? "justify-end" : "justify-start"} items-end gap-2 ${isFirst ? "mt-3" : "mt-1"} ${isLast ? "mb-1" : "mb-0"}`}
                    >
                      {!mine && (
                        <div className="w-7 flex justify-center">
                          {showAvatar ? (
                            <div className="relative w-7 h-7 rounded-full overflow-hidden bg-gray-200">
                              <Image src={peer?.photoURL || peerQs.peerPhotoURL || "/avatar-placeholder.png"} alt="avatar" fill className="object-cover" sizes="28px" />
                            </div>
                          ) : (
                            <div className="w-7 h-7" />
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[78%]`}>
                        <div
                          className={[
                            "text-[15px] border shadow-sm px-3 py-2",
                            "max-w-full break-words whitespace-pre-wrap leading-5",
                            mine
                              ? isFirst
                                ? "rounded-2xl rounded-tr-md"
                                : "rounded-2xl rounded-tr-md rounded-br-md"
                              : isFirst
                                ? "rounded-2xl rounded-tl-md"
                                : "rounded-2xl rounded-tl-md rounded-bl-md",
                          ].join(" ")}
                          style={{ backgroundColor: bubbleBg, borderColor: bubbleBr }}
                        >
                          {msg.uploading ? (
                            <div className="flex items-center gap-2 opacity-80">
                              <span className="w-3 h-3 rounded-full animate-pulse bg-slate-400" />
                              <span>Uploading…</span>
                            </div>
                          ) : msg.error ? (
                            <span className="text-red-500">Failed to send</span>
                          ) : msg.type === "image" && msg.imageUrl ? (
                            <button type="button" onClick={() => setViewer({ open: true, url: msg.imageUrl! })} className="block" title="Open image">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={msg.imageUrl} alt="Sent image" className="rounded-xl bg-gray-100 max-w-full" style={{ width: 280, height: "auto", objectFit: "cover" }} />
                            </button>
                          ) : msg.type === "audio" && msg.audioUrl ? (
                            <div className="w-[240px] max-w-full">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleAudio(msg.id, msg.audioUrl!)}
                                  className="w-9 h-9 rounded-full border bg-white flex items-center justify-center hover:bg-black/5"
                                  style={{ borderColor: EKARI.hair }}
                                  title="Play/Pause"
                                >
                                  {audioState[msg.id]?.playing ? <IoPause size={18} color={EKARI.text} /> : <IoPlay size={18} color={EKARI.text} />}
                                </button>

                                <div className="flex-1">
                                  <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                                    <div
                                      className="h-2 rounded-full"
                                      style={{
                                        width: `${Math.round((audioState[msg.id]?.pct ?? 0) * 100)}%`,
                                        backgroundColor: EKARI.forest,
                                      }}
                                    />
                                  </div>
                                  <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                                    Voice message
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : msg.type === "product" && msg.listing?.id ? (
                            <div className="space-y-2">
                              {!!msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}

                              <button
                                type="button"
                                onClick={() => {
                                  const url = msg.listing?.url || `/market/${encodeURIComponent(msg.listing!.id)}`;
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
                                      ? `USD ${(Number(msg.listing.price || 0)).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                                      : `KSh ${(Number(msg.listing.price || 0)).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`}
                                  </div>
                                </div>

                                <IoChevronForward size={16} style={{ color: EKARI.dim }} />
                              </button>
                            </div>
                          ) : (
                            !!msg.text && <span>{msg.text}</span>
                          )}
                        </div>

                        {isLast && <div className="mt-1 text-[11px] text-slate-500 px-1">{formatMsgTime(msg.createdAt)}</div>}
                      </div>
                    </div>
                  );
                })}

                {peerTyping && <TypingBubble />}
                <div ref={endRef} className="h-0" />
              </div>
            )}
          </div>

          {/* Jump to latest */}
          {showJump && items.length > 0 && (
            <button
              onClick={() => scrollToBottom("smooth")}
              className="absolute right-4 bottom-[88px] z-40 h-9 px-3 rounded-full text-sm font-extrabold shadow-md"
              style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
              type="button"
            >
              Jump to latest
            </button>
          )}

          {/* Attached product preview */}
          {!!pending && (
            <div className="absolute left-0 right-0 bottom-[72px] z-40 px-3">
              <div className="mx-auto w-full max-w-3xl">
                <div className="rounded-2xl border bg-white shadow-md px-3 py-2 flex items-center justify-between" style={{ borderColor: EKARI.hair }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                      <Image src={pending.image || pending.imageUrl || "/product-placeholder.jpg"} alt={pending.name || "Attached product"} fill className="object-cover" sizes="44px" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold truncate" style={{ color: EKARI.text }}>{pending.name || "Attached product"}</div>
                      <div className="text-xs truncate" style={{ color: EKARI.dim }}>
                        {fmtMoney(pending.price, (pending.currency as any) || "KES")}
                        {pending.unit ? ` • ${pending.unit}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(pending.url || `/market/${encodeURIComponent(pending.id)}`)}
                      className="h-8 px-3 rounded-full border text-xs font-extrabold hover:bg-black/5"
                      style={{ borderColor: "rgba(199,146,87,0.32)", backgroundColor: "rgba(199,146,87,0.16)", color: EKARI.text }}
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => setPending(null)}
                      className="h-8 w-8 rounded-full border bg-gray-50 hover:bg-white grid place-items-center"
                      style={{ borderColor: EKARI.hair }}
                      aria-label="Remove attachment"
                      title="Remove"
                    >
                      <IoClose size={18} color={EKARI.dim} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Composer / Recorder */}
          <div className="sticky bottom-0 z-40 border-t bg-white shrink-0" style={{ borderColor: EKARI.hair }}>
            {isRecording ? (
              <div className="px-3 py-2">
                <div className="flex items-center gap-3 rounded-2xl border bg-white px-3 py-2" style={{ borderColor: EKARI.hair }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                      {mmss(recMs)}
                    </div>
                  </div>

                  <div className="flex-1 h-7 rounded-xl bg-black/5" />

                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="h-9 w-9 rounded-full border bg-red-50 grid place-items-center hover:bg-red-100"
                    style={{ borderColor: "#FCA5A5" }}
                    title="Cancel"
                  >
                    <IoPause size={0} />
                    <IoClose size={18} color="#EF4444" />
                  </button>

                  <button
                    type="button"
                    onClick={finishRecording}
                    className="h-9 px-4 rounded-full font-extrabold text-sm shadow-sm"
                    style={{ backgroundColor: EKARI.gold, color: "#fff" }}
                    title="Send voice"
                  >
                    Send
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-2xl border bg-gray-50 px-3 py-2 relative" style={{ borderColor: EKARI.hair }}>
                    {pending && (
                      <div
                        className="mb-2 rounded-xl border bg-white p-2 flex items-center gap-2"
                        style={{ borderColor: EKARI.hair }}
                      >
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <Image
                            src={pending.image || "/product-placeholder.jpg"}
                            alt={pending.name || "Product"}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {pending.name || "Product inquiry"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {pending.url}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="h-8 w-8 rounded-full hover:bg-black/5 text-slate-600 font-black"
                          onClick={() => setPending(null)}
                          title="Remove product"
                          aria-label="Remove product"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {!pending?.id && ctxListing?.id && (
                      <div className="mb-2">
                        <button
                          type="button"
                          onClick={() => setPending(ctxListing)}
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold hover:bg-black/5"
                          style={{ borderColor: EKARI.hair, color: EKARI.text }}
                          title="Attach last referenced product"
                        >
                          🛒 Attach product
                        </button>
                      </div>
                    )}

                    <textarea
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        scheduleTyping(e.target.value.trim().length > 0);
                      }}
                      onBlur={() => scheduleTyping(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          onSend();
                        }
                      }}
                      placeholder="Message..."
                      rows={1}
                      className="w-full bg-transparent outline-none text-[15px] resize-none max-h-40 leading-5"
                      style={{ minHeight: 40 }}
                    />

                    <div className="flex items-center gap-2 pt-2">
                      <button className="w-9 h-9 rounded-full flex items-center justify-center" title="Emoji" type="button" onClick={() => setEmojiOpen(true)} style={{ backgroundColor: "#F3F4F6" }}>
                        <IoHappyOutline size={20} color={EKARI.text} />
                      </button>

                      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFileChosen} />
                      <button className="w-9 h-9 rounded-full flex items-center justify-center" title="Image" type="button" onClick={onPickImage} style={{ backgroundColor: "#F3F4F6" }}>
                        <IoImageOutline size={20} color={EKARI.text} />
                      </button>

                      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={onFileChosen} />
                      <button className="w-9 h-9 rounded-full flex items-center justify-center" title="Camera" type="button" onClick={onPickCamera} style={{ backgroundColor: "#F3F4F6" }}>
                        <IoCameraOutline size={20} color={EKARI.text} />
                      </button>

                      <button className="w-9 h-9 rounded-full flex items-center justify-center" title="Voice" type="button" onClick={startRecording} style={{ backgroundColor: "#F3F4F6" }}>
                        <IoMicOutline size={20} color={EKARI.text} />
                      </button>
                    </div>

                    {emojiOpen && (
                      <div className="fixed inset-0 z-[100] bg-black/40 flex items-end justify-center" onClick={() => setEmojiOpen(false)}>
                        <div className="w-full max-w-3xl bg-white rounded-t-2xl border-t border-x p-3" style={{ borderColor: EKARI.hair }} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-extrabold" style={{ color: EKARI.text }}>Choose emoji</div>
                            <button type="button" onClick={() => setEmojiOpen(false)} className="h-9 w-9 rounded-full border bg-gray-50 grid place-items-center" style={{ borderColor: EKARI.hair }} aria-label="Close">
                              <IoClose size={18} color={EKARI.dim} />
                            </button>
                          </div>

                          <div className="max-h-[45vh] overflow-y-auto">
                            {EMOJI_SETS.map((row, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-1 mb-2">
                                {row.map((emo) => (
                                  <button
                                    key={emo}
                                    type="button"
                                    className="h-10 rounded-lg hover:bg-black/5 text-2xl"
                                    onClick={() => {
                                      setInput((v) => (v ? `${v} ${emo}` : emo));
                                      setEmojiOpen(false);
                                    }}
                                    title={emo}
                                  >
                                    {emo}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={onSend}
                    disabled={(!input.trim() && !pending?.id) || sending}
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm"
                    title="Send"
                    type="button"
                    style={{ backgroundColor: EKARI.gold }}
                  >
                    {sending ? <span className="text-white text-sm font-extrabold">…</span> : <IoSend size={18} color="#fff" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Full-screen image viewer */}
      {viewer.open && (
        <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4" onClick={() => setViewer({ open: false, url: "" })}>
          <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center" onClick={() => setViewer({ open: false, url: "" })} aria-label="Close" type="button">
            <IoClose size={22} color="#fff" />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer.url} alt="Full" className="max-h-[90vh] max-w-[92vw] object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="md:hidden">{Layout}</div>
      <div className="hidden md:block">
        <AppShell>{Layout}</AppShell>
      </div>
    </>
  );
}
