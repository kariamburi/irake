// app/messages/[threadId]/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limitToLast,
  addDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  endBefore,
  getDoc,
  DocumentSnapshot,
} from "firebase/firestore";
import { ref as rtdbRef, onValue, getDatabase } from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  IoArrowBack,
  IoSend,
  IoHappyOutline,
  IoImageOutline,
  IoCameraOutline,
  IoFlagOutline,
  IoChatbubblesOutline,
} from "react-icons/io5";

import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import AppShell from "@/app/components/AppShell";

/* --- Emoji grid (no dependency) --- */
const EmojiPickerList = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "😘",
  "😎",
  "🤗",
  "🤔",
  "😴",
  "😅",
  "😇",
  "😉",
  "🙃",
  "🙂",
  "😭",
  "😤",
  "😡",
  "🤯",
  "🤝",
  "👍",
  "👎",
  "👏",
  "🙏",
  "💪",
  "👌",
  "🤌",
  "🙌",
  "🫶",
  "🤙",
  "💖",
  "💗",
  "💜",
  "🔥",
  "✨",
  "🎉",
  "🥳",
  "💯",
  "✅",
  "❌",
  "⚠️",
  "☑️",
  "🩷",
  "🧡",
  "💛",
  "💚",
  "💙",
  "🖤",
  "🤍",
  "🤎",
  "🍀",
  "🌟",
  "⭐️",
  "🌈",
  "☀️",
  "🌙",
  "🌸",
  "🌼",
  "🐶",
  "🐱",
  "🦄",
  "🐣",
  "🍕",
  "🍔",
  "🍟",
  "🍩",
  "☕️",
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
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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
  type: "text" | "image" | "audio";
  readBy?: Record<string, boolean>;
};

/* --- tiny utils --- */
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

/* ================================================================ */

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const sp = useSearchParams();
  const { user } = useAuth();
  const rtdb = getDatabase();

  const uid = user?.uid || "";
  const threadId = params.threadId;

  // From query (mobile parity)
  const peerIdFromQs = sp.get("peerId") || "";
  const peerNameFromQs = sp.get("peerName") || "";
  const peerPhotoURLFromQs = sp.get("peerPhotoURL") || "";
  const peerHandleFromQs = sp.get("peerHandle") || "";

  const [peerId, setPeerId] = useState<string>(peerIdFromQs);
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

  // Messages in ASC → latest sits at the bottom
  const [items, setItems] = useState<Message[]>([]);
  const [paging, setPaging] = useState(false);
  const [oldestDoc, setOldestDoc] = useState<DocumentSnapshot | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);

  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null); // bottom sentinel
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Measure fixed header & composer
  const headerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(54);
  const [composerH, setComposerH] = useState(92);

  // show “jump to latest” when user scrolls up
  const [showJump, setShowJump] = useState(false);

  useLayoutEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.target === headerRef.current) setHeaderH(Math.round(e.contentRect.height));
        if (e.target === composerRef.current) setComposerH(Math.round(e.contentRect.height));
      }
    });
    if (headerRef.current) ro.observe(headerRef.current);
    if (composerRef.current) ro.observe(composerRef.current);
    return () => ro.disconnect();
  }, []);

  // Guard: if uid / threadId missing → don't spin loader forever
  useEffect(() => {
    if (!uid || !threadId) {
      setLoading(false);
    }
  }, [uid, threadId]);

  // Derive peerId if not provided
  // Derive peerId if not provided
  useEffect(() => {
    (async () => {
      if (peerId || !uid || !threadId) return;
      const snap = await getDoc(doc(db, "threads", threadId));

      if (!snap.exists()) {
        // No such thread → stop endless loader, let UI handle “no messages”
        setLoading(false);
        return;
      }

      const data = snap.data() as any;
      const parts: string[] = data?.participants || [];
      const other = parts.find((p) => p !== uid) || "";
      setPeerId(other);
    })();
  }, [uid, threadId, peerId]);


  // Ensure thread + mirror + zero unread
  useEffect(() => {
    if (!uid || !threadId || !peerId) return;
    (async () => {
      try {
        await updateDoc(doc(db, "threads", threadId), { updatedAt: serverTimestamp() });
      } catch {
        await setDoc(doc(db, "threads", threadId), {
          participants: participantsArray(uid, peerId),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await setDoc(
        doc(db, "userThreads", uid, "threads", threadId),
        { threadId, peerId, updatedAt: serverTimestamp(), unread: 0 },
        { merge: true }
      );
      setThreadReady(true);
    })();
  }, [uid, peerId, threadId]);

  // Peer public info
  useEffect(() => {
    if (!peerId) return;
    const uRef = doc(db, "users", peerId);
    const unsub = onSnapshot(uRef, (snap) => {
      const data = snap.data() || {};
      setPeer((prev) => ({
        ...prev,
        ...data,
        followersCount: data?.followersCount ?? 0,
        followingCount: data?.followingCount ?? 0,
      }));
    });
    return () => unsub();
  }, [peerId]);

  // Presence via RTDB
  useEffect(() => {
    if (!peerId) return;
    const sRef = rtdbRef(rtdb, `/status/${peerId}`);
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
  }, [peerId, rtdb]);

  // Typing (from thread doc)
  useEffect(() => {
    if (!threadId || !peerId) return;
    const tRef = doc(db, "threads", threadId);
    const unsub = onSnapshot(tRef, (snap) => {
      const data = snap.data() || {};
      const typing = (data.typing || {}) as Record<string, boolean>;
      setPeerTyping(!!typing[peerId]);
    });
    return () => unsub();
  }, [threadId, peerId]);

  // Helper: smooth scroll to bottom sentinel
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }, []);

  // Track scroll to show/hide “Jump to latest”
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

  // Live messages (ASC with latest at bottom)
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
        const msgs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Message[];
        setItems(msgs);
        setOldestDoc(snap.docs[0] ?? null);
        setLoading(false);
        // mark read
        setDoc(
          doc(db, "userThreads", uid, "threads", threadId),
          { unread: 0, updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(() => { });

        // initial snap → jump without animation
        scrollToBottom("auto");
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [threadReady, threadId, uid, scrollToBottom]);

  // If near bottom and new messages arrive, follow them; don’t yank if reading old ones
  useEffect(() => {
    const el = listRef.current;
    if (!el || loading) return;
    const threshold = 120;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (atBottom) scrollToBottom("smooth");
  }, [items.length, loading, scrollToBottom]);

  // Re-scroll when composer height changes (e.g., textarea expands)
  useEffect(() => {
    scrollToBottom("auto");
  }, [composerH, scrollToBottom]);

  // Debounced typing
  const setTypingDebounced = useMemo(() => {
    let t: any;
    return (val: boolean) => {
      clearTimeout(t);
      t = setTimeout(() => {
        setDoc(
          doc(db, "threads", threadId),
          { typing: { [uid]: val }, updatedAt: serverTimestamp() },
          { merge: true }
        ).catch(() => { });
      }, val ? 0 : 600);
    };
  }, [threadId, uid]);

  // Load older (messages before the current oldest)
  const loadMore = useCallback(async () => {
    if (!oldestDoc || paging) return;
    setPaging(true);
    try {
      const qOld = query(
        collection(db, "threads", threadId, "messages"),
        orderBy("createdAt", "asc"),
        endBefore(oldestDoc),
        limitToLast(25)
      );
      const { getDocs } = await import("firebase/firestore");
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
  }, [oldestDoc, paging, threadId]);

  const sendText = useCallback(
    async (text: string) => {
      if (!uid || !peerId) return;
      const t = text.trim();
      if (!t) return;
      await addDoc(collection(db, "threads", threadId, "messages"), {
        text: t,
        from: uid,
        to: peerId,
        type: "text",
        createdAt: serverTimestamp(),
        readBy: { [uid]: true },
      });
      await updateDoc(doc(db, "threads", threadId), {
        updatedAt: serverTimestamp(),
        lastMessage: {
          text: t,
          type: "text",
          from: uid,
          to: peerId,
          createdAt: serverTimestamp(),
        },
      });
      await setDoc(
        doc(db, "userThreads", uid, "threads", threadId),
        { updatedAt: serverTimestamp(), unread: 0 },
        { merge: true }
      );
    },
    [uid, peerId, threadId]
  );

  const onSend = useCallback(async () => {
    const t = input.trim();
    if (!t) return;
    await sendText(t);
    setInput("");
    setTypingDebounced(false);
    scrollToBottom("smooth");
    if (textareaRef.current) textareaRef.current.style.height = "40px";
  }, [input, sendText, setTypingDebounced, scrollToBottom]);

  const onPickImage = () => fileInputRef.current?.click();

  const onImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    try {
      if (!uid || !peerId) return;

      const msgDoc = await addDoc(collection(db, "threads", threadId, "messages"), {
        from: uid,
        to: peerId,
        type: "image" as const,
        createdAt: serverTimestamp(),
        readBy: { [uid]: true },
        uploading: true,
      });

      const path = `threads/${threadId}/images/${msgDoc.id}/original-${file.name}`;
      const blobRef = storageRef(storage, path);
      await uploadBytes(blobRef, file);
      const url = await getDownloadURL(blobRef);

      await updateDoc(doc(db, "threads", threadId, "messages", msgDoc.id), {
        imageUrl: url,
        uploading: false,
      });
      await updateDoc(doc(db, "threads", threadId), {
        updatedAt: serverTimestamp(),
        lastMessage: { type: "image", from: uid, to: peerId, createdAt: serverTimestamp() },
      });

      scrollToBottom("smooth");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setPreview(null), 1200);
    }
  };

  const headerTitle = peer?.firstName || peerNameFromQs || peer?.handle || "Message";
  const onlineNow = !!peer?.online;
  const lastActiveAny = peer?.lastActiveAt;

  // Bubble colors (Ekari)
  const mineBg = hexToRgba(EKARI.gold, 0.18);
  const mineBorder = hexToRgba(EKARI.gold, 0.38);
  const theirsBg = hexToRgba(EKARI.forest, 0.12);
  const theirsBrd = hexToRgba(EKARI.forest, 0.28);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const adjust = () => {
      ta.style.height = "40px";
      ta.style.height = Math.min(160, ta.scrollHeight) + "px";
    };
    adjust();
  }, [input]);

  const hasMessages = items.length > 0;

  /* ------------------ Empty state (no messages yet) ------------------ */
  const handleQuickEmoji = (emo: string) => {
    setInput((prev) => (prev ? `${prev} ${emo}` : emo));
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      requestAnimationFrame(() => {
        ta.selectionStart = ta.value.length;
        ta.selectionEnd = ta.value.length;
      });
    }
  };

  const EmptyState = () => (
    <div
      className="h-full flex flex-col items-center justify-center px-4"
      style={{ color: EKARI.sub }}
    >
      <div className="max-w-md w-full bg-white border rounded-2xl shadow-sm p-2 text-center">


        <div className="flex flex-col items-center gap-1">

          <div className="flex items-center mt-2 font-extrabold text-slate-900 text-lg">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl flex items-center justify-center"

            >
              <IoChatbubblesOutline size={34} color={EKARI.forest} />
            </div>  Start a conversation
          </div>
          <div className="text-xs text-slate-500">
            {lastSeenText(onlineNow, lastActiveAny)}
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          You haven&apos;t sent any messages yet. Say hi, share a question, or send an image
          to get the conversation going.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {["👋", "😊", "🔥", "👍"].map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleQuickEmoji(q)}
              className="inline-flex items-center justify-center rounded-full border text-sm font-semibold px-3 py-1.5 hover:bg-black/5"
              style={{ borderColor: EKARI.hair, color: EKARI.text }}
            >
              {q}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            const ta = textareaRef.current;
            if (ta) ta.focus();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-extrabold shadow-sm hover:shadow-md"
          style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
        >
          <IoChatbubblesOutline className="mr-2" size={16} />
          Start chatting
        </button>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div className="h-full w-full items-center justify-center flex flex-col overflow-hidden">
        {/* Fixed HEADER */}
        <div className="md:h-[calc(100vh-1rem)] bg-white w-full">
          <div
            ref={headerRef}
            className="top-0 inset-x-0 z-40 bg-white border-b"
            style={{ borderColor: EKARI.hair }}
          >
            <div className="h-[54px] px-3 flex items-center justify-between max-w-[1100px] mx-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.back()}
                  className="p-2 rounded-lg hover:bg-black/5"
                  aria-label="Back"
                >
                  <IoArrowBack size={20} color={EKARI.text} />
                </button>

                <div className="flex items-center gap-3 max-w-[80%]">
                  <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-100">
                    <Image
                      src={peer?.photoURL || peerPhotoURLFromQs || "/avatar-placeholder.png"}
                      alt={headerTitle}
                      fill
                      className="object-cover"
                      sizes="36px"
                    />
                    {onlineNow && (
                      <span
                        className="absolute -right-0 -bottom-0 w-[14px] h-[14px] rounded-full border-2"
                        style={{ backgroundColor: "#16A34A", borderColor: EKARI.sand }}
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 text-sm">
                      {headerTitle}
                    </div>
                    <div className="flex text-xs text-slate-500">
                      {peerTyping ? "Typing…" : lastSeenText(onlineNow, lastActiveAny)}
                    </div>
                  </div>
                </div>
              </div>

              <button
                className="p-2 rounded-lg hover:bg-black/5"
                aria-label="Report"
                title="Report conversation"
              >
                <IoFlagOutline size={18} color={EKARI.dim} />
              </button>
            </div>
          </div>

          {/* SCROLLER */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto bg-gray-50"
            style={{
              paddingTop: headerH + 8,
              paddingBottom: composerH + 8,
              scrollPaddingBottom: composerH + 8,
              scrollbarGutter: "stable both-edges",
            } as React.CSSProperties}
          >
            {loading ? (
              <div
                className="h-full flex items-center justify-center"
                style={{ color: EKARI.dim }}
              >
                <BouncingBallLoader />
              </div>
            ) : !hasMessages ? (
              <EmptyState />
            ) : (
              <div className="px-3 py-3">
                {/* Load older */}
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

                {/* Messages (ASC) */}
                {items.map((msg) => {
                  const mine = msg.from === uid;
                  return (
                    <div
                      key={msg.id}
                      className={`my-2 flex ${mine ? "justify-end" : "justify-start"
                        } items-end gap-2`}
                    >
                      {!mine && (
                        <div className="relative w-6 h-6 rounded-full overflow-hidden bg-gray-200">
                          <Image
                            src={
                              peer?.photoURL ||
                              peerPhotoURLFromQs ||
                              "/avatar-placeholder.png"
                            }
                            alt="avatar"
                            fill
                            className="object-cover"
                            sizes="24px"
                          />
                        </div>
                      )}

                      <div
                        style={{
                          background: mine ? mineBg : theirsBg,
                          borderColor: mine ? mineBorder : theirsBrd,
                        }}
                        className={`max-w-[78%] text-[15px] rounded-2xl px-3 py-2 shadow-sm border ${mine ? "rounded-tr-sm" : "rounded-tl-sm"
                          }`}
                      >
                        {msg.uploading ? (
                          <div className="flex items-center gap-2 opacity-80">
                            <span className="w-3 h-3 rounded-full animate-pulse bg-slate-400" />
                            <span>Uploading…</span>
                          </div>
                        ) : msg.error ? (
                          <span className="text-red-500">Failed to send</span>
                        ) : msg.type === "image" && msg.imageUrl ? (
                          <a
                            href={msg.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.imageUrl}
                              alt="Sent image"
                              className="rounded-xl bg-gray-100 max-w-full"
                              style={{
                                width: 260,
                                height: "auto",
                                objectFit: "cover",
                              }}
                              onLoad={() => scrollToBottom("auto")}
                            />
                          </a>
                        ) : (
                          !!msg.text && (
                            <span className="leading-5 whitespace-pre-wrap break-words">
                              {msg.text}
                            </span>
                          )
                        )}

                        <div className="mt-1 text-[11px] text-slate-600">
                          {formatMsgTime(msg.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* bottom sentinel */}
                <div ref={endRef} className="h-0" />
              </div>
            )}
          </div>

          {/* Jump to latest */}
          {showJump && hasMessages && (
            <button
              onClick={() => scrollToBottom("smooth")}
              className="fixed bottom-[88px] right-4 z-40 h-9 px-3 rounded-full text-sm font-extrabold shadow-md"
              style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
            >
              Jump to latest
            </button>
          )}

          {/* COMPOSER (fixed) */}
          <div
            ref={composerRef}
            className="fixed bottom-0 right-0 left-0 z-50 border-t bg-white"
            style={{
              borderColor: EKARI.hair,
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
            }}
          >
            <div className="mx-auto w-full max-w-[1100px] px-3">
              <div className="flex items-end gap-2 py-2 relative">
                {/* optional avatar placeholder */}
                <div className="hidden sm:flex w-9 h-9 rounded-full bg-gray-200 overflow-hidden items-center justify-center">
                  {user?.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt="You"
                      width={36}
                      height={36}
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-600">
                      {user?.displayName?.[0]?.toUpperCase() || "Y"}
                    </span>
                  )}
                </div>

                <div
                  className="flex-1 border bg-gray-50 rounded-2xl px-3 py-2"
                  style={{ borderColor: EKARI.hair }}
                >
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

                  {/* quick preview for chosen image */}
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
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    {/* Emoji */}
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
                                const ta = textareaRef.current;
                                if (ta) ta.focus();
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

                    {/* Image */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={onImageChosen}
                    />
                    <button
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      title="Image"
                      type="button"
                      onClick={onPickImage}
                      style={{ backgroundColor: "#F3F4F6" }}
                    >
                      <IoImageOutline size={20} color={EKARI.text} />
                    </button>

                    {/* Camera (shortcut → same file input, user can choose camera on mobile) */}
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

                <button
                  onClick={onSend}
                  disabled={!input.trim()}
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 shadow-sm"
                  title="Send"
                  type="button"
                  style={{ backgroundColor: EKARI.gold }}
                >
                  <IoSend size={18} color="#fff" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
