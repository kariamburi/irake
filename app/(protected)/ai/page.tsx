"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Image as ImageIcon, Menu, X, ArrowLeft } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { useRouter } from "next/navigation";
import { storage, db } from "@/lib/firebase";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

/* ---------------------------- THEME & HELPERS ---------------------------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  ink: "#0F172A",
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

type Role = "user" | "assistant";
type Msg = {
  id: string;
  role: Role;
  text?: string;
  imageUrl?: string | null;
  createdAt: number;
};

type Conv = {
  id: string;
  title?: string;
  pinned?: boolean;
  archived?: boolean;
  lastMessageAt?: any;
  updatedAt?: any;
  messageCount?: number;
};

const WELCOME: Msg = {
  id: "sys-welcome",
  role: "assistant",
  text:
    "Hi! I’m ekari AI 🌿— your smart assistant on ekarihub here to help you diagnose crops and livestock, explore markets, understand local regulations and guide you through the entire agribusiness and green-living ecosystem with instant answers, smart insights, and photo analysis.",
  createdAt: Date.now(),
};

function safeTsToMs(ts: any): number {
  if (!ts) return Date.now();
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return Date.now();
}

/* ---------------- responsive helpers ---------------- */
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

export default function Page() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const { user } = useAuth();

  const aiEndpoint =
    process.env.NEXT_PUBLIC_EKARI_AI_ENDPOINT ||
    "https://us-central1-ekarihub-aed5a.cloudfunctions.net/ekariAiChat";

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [lastSentAt, setLastSentAt] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  // ✅ Web-safe timer type (no NodeJS.Timeout)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingMsgIdRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToEnd = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToEnd, [messages]);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    typingMsgIdRef.current = null;
    setIsTyping(false);
  }, []);

  useEffect(() => () => stopTyping(), [stopTyping]);

  // Close mobile drawer on desktop resize
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileHistoryOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---------------------------- HISTORY: FETCH CONVERSATIONS ----------------------------
  const fetchConversations = useCallback(async () => {
    if (!user?.uid) {
      setConvs([]);
      return;
    }
    setLoadingConvs(true);
    try {
      const qy = query(
        collection(db, "ekariAiConversations"),
        where("uid", "==", user.uid),
        orderBy("lastMessageAt", "desc"),
        limit(50)
      );
      const snap = await getDocs(qy);
      setConvs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } finally {
      setLoadingConvs(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ---------------------------- HISTORY: LOAD MESSAGES ----------------------------
  const loadConversation = useCallback(
    async (convId: string) => {
      if (!user?.uid) return;
      stopTyping();
      setConversationId(convId);
      setLoadingMsgs(true);
      try {
        const qy = query(
          collection(db, "ekariAiConversations", convId, "messages"),
          orderBy("createdAt", "asc"),
          limit(200)
        );
        const snap = await getDocs(qy);
        const loaded: Msg[] = snap.docs.map((d) => {
          const m = d.data() as any;
          return {
            id: d.id,
            role: m.role,
            text: m.text || undefined,
            imageUrl: m.imageUrl || null,
            createdAt: safeTsToMs(m.createdAt),
          };
        });

        setMessages(loaded.length ? loaded : [WELCOME]);
      } finally {
        setLoadingMsgs(false);
        setMobileHistoryOpen(false);
      }
    },
    [user?.uid, stopTyping]
  );

  const startNewChat = useCallback(() => {
    stopTyping();
    setConversationId(null);
    setMessages([WELCOME]);
    setInput("");
    setPendingImage(null);
    setPendingFile(null);
    setMobileHistoryOpen(false);
  }, [stopTyping]);

  // ---------------------------- SEND TO AI ----------------------------
  const sendToAI = useCallback(
    async (prompt: string, file?: File | null): Promise<string> => {
      try {
        let imageUrl: string | null = null;

        if (file) {
          const key = `ekariAi/${user?.uid || "anon"}/${Date.now()}_${file.name || "image.jpg"}`;
          const ref = sRef(storage, key);
          await uploadBytes(ref, file);
          imageUrl = await getDownloadURL(ref);
        }

        const res = await fetch(aiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: prompt,
            imageUrl,
            uid: user?.uid || null,
            conversationId,
          }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error("Ekari AI HTTP error:", res.status, body);
          return "Sorry — I couldn't process that request. Please try again.";
        }

        const data = await res.json();
        if (data.conversationId) setConversationId(data.conversationId);

        fetchConversations();

        return data.reply || "Sorry — I couldn't generate a response. Please try again.";
      } catch (err) {
        console.error("Ekari AI error:", err);
        return "Sorry — something went wrong. Please check your connection and try again.";
      }
    },
    [aiEndpoint, user?.uid, conversationId, fetchConversations]
  );

  /* ------------------- ChatGPT-like typing (word streaming) ------------------- */
  const animateAssistantReply = useCallback(
    (fullText: string) => {
      if (!fullText) return;

      stopTyping();

      const id = `ai_${Date.now()}`;
      typingMsgIdRef.current = id;

      setMessages((prev) => [...prev, { id, role: "assistant", text: "", createdAt: Date.now() }]);
      setIsTyping(true);

      let index = 0;

      const tick = () => {
        const msgId = typingMsgIdRef.current;
        if (!msgId) return;

        const total = fullText.length;
        const progress = total ? index / total : 1;

        const baseDelay = progress < 0.3 ? 12 : progress < 0.7 ? 18 : 26;

        const nextWordBoundary = () => {
          let i = index;
          while (i < total && /\s/.test(fullText[i])) i++;
          while (i < total && !/\s/.test(fullText[i])) i++;
          if (i < total && fullText[i] === " ") i++;
          return Math.min(total, Math.max(i, index + 1));
        };

        const nextIndex = nextWordBoundary();
        const lastTyped = fullText[nextIndex - 1] || "";

        let extraPause = 0;
        if (/[.,!?;:)]/.test(lastTyped)) extraPause += 140;
        if (lastTyped === "\n") extraPause += 180;

        const slice = fullText.slice(0, nextIndex);

        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, text: slice } : m)));
        index = nextIndex;

        if (index >= total) {
          stopTyping();
          return;
        }

        typingTimerRef.current = setTimeout(tick, baseDelay + extraPause);
      };

      typingTimerRef.current = setTimeout(tick, 180);
    },
    [stopTyping]
  );

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text && !pendingImage && !pendingFile) return;

    if (text.length > 800) {
      alert("Please keep your question under 800 characters.");
      return;
    }

    const now = Date.now();
    if (now - lastSentAt < 3500) {
      alert("Please wait a few seconds before sending another question.");
      return;
    }
    setLastSentAt(now);

    stopTyping();

    const userMsg: Msg = {
      id: `user_${now}`,
      role: "user",
      text,
      imageUrl: pendingImage,
      createdAt: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingImage(null);

    const fileToSend = pendingFile;
    setPendingFile(null);

    setSending(true);

    try {
      const reply = await sendToAI(text || "(image only)", fileToSend);
      setSending(false);
      animateAssistantReply(reply);
    } catch {
      setSending(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: "assistant",
          text: "⚠️ Sorry—something went wrong. Please try again.",
          createdAt: Date.now(),
        },
      ]);
    }
  }, [input, pendingImage, pendingFile, sendToAI, lastSentAt, animateAssistantReply, stopTyping]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingImage(URL.createObjectURL(file));
  };

  const mineBg = hexToRgba(EKARI.gold, 0.09);
  const mineBorder = hexToRgba(EKARI.gold, 0.6);
  const theirsBg = "#FFFFFF";
  const theirsBrd = "#E5E7EB";

  const activeConvTitle = useMemo(() => {
    const c = convs.find((x) => x.id === conversationId);
    return c?.title || "ekari AI";
  }, [convs, conversationId]);

  const goBack = useCallback(() => {
    // Nice UX: close drawer first if open
    if (mobileHistoryOpen) {
      setMobileHistoryOpen(false);
      return;
    }
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [mobileHistoryOpen, router]);

  const HistoryList = (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-slate-200 flex items-center justify-between">
        <div className="text-sm font-extrabold text-slate-900">History</div>
        <button
          onClick={startNewChat}
          className="text-[12px] font-semibold rounded-full px-3 py-1 border border-slate-200 hover:bg-slate-50"
        >
          New Ask
        </button>
      </div>

      <div className="p-2 flex-1 overflow-y-auto">
        {loadingConvs ? (
          <div className="text-xs text-slate-500 p-2">Loading…</div>
        ) : convs.length === 0 ? (
          <div className="text-xs text-slate-500 p-2">No chats yet.</div>
        ) : (
          <div className="flex flex-col gap-1">
            {convs.map((c) => {
              const active = c.id === conversationId;
              return (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={[
                    "text-left w-full rounded-xl px-3 py-2 border transition",
                    active
                      ? "bg-[#233F39] text-white border-[#233F39]"
                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800",
                  ].join(" ")}
                  title={c.title || "Chat"}
                >
                  <div className="text-[13px] font-semibold truncate">{c.title || "New Ask"}</div>
                  <div className={["text-[11px] mt-0.5", active ? "text-white/70" : "text-slate-500"].join(" ")}>
                    {typeof c.messageCount === "number" ? `${c.messageCount} msgs` : " "}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-200 flex gap-2">
        <button
          onClick={fetchConversations}
          className="flex-1 text-[12px] font-semibold rounded-xl px-3 py-2 border border-slate-200 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );

  /* ---------------- MOBILE shell (fixed inset + sticky header like MarketPage) ---------------- */
  if (isMobile) {
    return (
      <div className="fixed inset-0 bg-white">
        {/* Sticky header */}
        <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="h-14 px-3 flex items-center justify-between gap-2">
            <button
              onClick={goBack}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex-1 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] px-3 py-1 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {activeConvTitle} • Agribusiness assistant
              </span>
            </div>

            <button
              onClick={() => setMobileHistoryOpen(true)}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
              aria-label="Open history"
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="px-3 pb-3 flex items-center gap-2">
            <button
              onClick={startNewChat}
              className="text-[12px] font-semibold rounded-full px-3 py-1 border border-slate-200 bg-white"
            >
              New Ask
            </button>
            <button
              onClick={fetchConversations}
              className="text-[12px] font-semibold rounded-full px-3 py-1 border border-slate-200 bg-white"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Content: messages + composer (reserve space for composer + safe area) */}
        <div className="h-[calc(100dvh-100px)] flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto overscroll-contain bg-[#F6F7F9]">
            <div className="px-3 py-3 space-y-3">
              {loadingMsgs ? <div className="text-sm text-slate-500">Loading conversation…</div> : null}

              {messages.map((msg) => {
                const mine = msg.role === "user";
                return (
                  <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={[
                        "rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed border shadow-sm bg-white",
                        mine ? "max-w-[92%]" : "max-w-[94%]",
                      ].join(" ")}
                      style={{
                        background: mine ? mineBg : theirsBg,
                        borderColor: mine ? mineBorder : theirsBrd,
                      }}
                    >
                      {msg.imageUrl && (
                        <div className="mb-2 overflow-hidden rounded-xl">
                          <Image
                            src={msg.imageUrl}
                            alt="upload"
                            width={520}
                            height={520}
                            className="rounded-xl object-cover w-full h-auto"
                          />
                        </div>
                      )}
                      {!!msg.text && <p className="whitespace-pre-wrap text-slate-900">{msg.text}</p>}
                    </div>
                  </div>
                );
              })}

              {(sending && !isTyping) || isTyping ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-slate-200 px-3 py-1 text-[11px] text-slate-500 shadow-sm">
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                    </span>
                    <span>{isTyping ? "ekari AI is typing…" : "ekari AI is thinking…"}</span>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />

              <p className="pt-2 text-[11px] text-slate-400 text-center">
                ekari AI provides guidance only and is not a substitute for a certified agronomist or legal advisor.
              </p>

              {/* spacer so last message isn't hidden behind composer */}
              <div style={{ height: "calc(88px + env(safe-area-inset-bottom))" }} />
            </div>
          </div>

          {/* Pending image preview (above composer) */}
          <AnimatePresence>
            {pendingImage && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="px-3 pb-2 bg-white border-t border-slate-200"
              >
                <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <Image src={pendingImage} alt="Preview" width={900} height={500} className="w-full h-28 object-cover" />
                  <button
                    onClick={() => {
                      setPendingImage(null);
                      setPendingFile(null);
                    }}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 border border-slate-200 transition rounded-full px-2 py-1 text-xs"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Composer pinned to bottom with safe area */}
          <div
            className="border-t border-slate-200 bg-white"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="px-3 py-3 flex flex-col gap-1">
              <div className="flex items-end gap-2">
                <label
                  className="cursor-pointer bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-center hover:bg-slate-50 transition"
                  title="Attach image"
                >
                  <ImageIcon size={18} className="text-slate-700" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
                </label>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about crop issues, inputs, or rules…"
                  className="flex-1 resize-none bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm
                             placeholder-slate-400 focus:outline-none focus:ring-2
                             focus:ring-[rgba(199,146,87,0.45)] max-h-32 min-h-[42px]"
                  rows={1}
                  onInput={(e) => {
                    const ta = e.currentTarget;
                    ta.style.height = "auto";
                    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />

                <button
                  onClick={onSend}
                  disabled={sending || (!input.trim() && !pendingImage && !pendingFile)}
                  className="p-3 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition shadow"
                  style={{ backgroundColor: EKARI.gold }}
                  aria-label="Send"
                >
                  {sending ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 leading-snug pt-1">
                Tip: Press <span className="font-semibold">Enter</span> to send •{" "}
                <span className="font-semibold">Shift+Enter</span> for a new line
              </div>
            </div>
          </div>
        </div>

        {/* Mobile History Drawer */}
        <AnimatePresence>
          {mobileHistoryOpen && (
            <motion.div
              className="md:hidden fixed inset-0 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/40" onClick={() => setMobileHistoryOpen(false)} />
              <motion.div
                className="absolute left-0 top-0 bottom-0 w-[88%] max-w-[360px] bg-white shadow-2xl"
                initial={{ x: -420 }}
                animate={{ x: 0 }}
                exit={{ x: -420 }}
                transition={{ type: "spring", stiffness: 360, damping: 34 }}
              >
                <div className="h-14 border-b border-slate-200 px-3 flex items-center justify-between">
                  <div className="text-sm font-extrabold text-slate-900">History</div>
                  <button
                    onClick={() => setMobileHistoryOpen(false)}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                    aria-label="Close history"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="h-[calc(100%-3.5rem)]">{HistoryList}</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ---------------- DESKTOP shell (AppShell + sidebar + go back in header) ---------------- */
  return (
    <AppShell>
      <div className="w-full min-h-[100dvh]">
        <div className="mx-auto w-full max-w-6xl px-2 sm:px-3 md:px-4 py-2">
          <div className="h-[calc(100dvh-2.5rem)] flex gap-3">
            {/* Sidebar */}
            <aside className="hidden md:flex w-72 flex-col rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-xl overflow-hidden">
              {HistoryList}
            </aside>

            {/* Main */}
            <div className="relative flex h-full w-full flex-col rounded-2xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              {/* Header */}
              <div className="border-b flex-shrink-0 bg-white">
                <div className="px-4 py-3 flex items-center justify-between gap-2">
                  <button
                    onClick={goBack}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
                    aria-label="Go back"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="flex-1 flex justify-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] px-3 py-1 border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {activeConvTitle} • Agribusiness assistant
                    </span>
                  </div>

                  <div className="w-10" />
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto overscroll-contain bg-[#F6F7F9]">
                <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
                  {loadingMsgs ? <div className="text-sm text-slate-500">Loading conversation…</div> : null}

                  {messages.map((msg) => {
                    const mine = msg.role === "user";
                    return (
                      <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed border shadow-sm bg-white"
                          style={{
                            background: mine ? mineBg : theirsBg,
                            borderColor: mine ? mineBorder : theirsBrd,
                          }}
                        >
                          {msg.imageUrl && (
                            <div className="mb-2 overflow-hidden rounded-xl">
                              <Image
                                src={msg.imageUrl}
                                alt="upload"
                                width={520}
                                height={520}
                                className="rounded-xl object-cover w-full h-auto"
                              />
                            </div>
                          )}
                          {!!msg.text && <p className="whitespace-pre-wrap text-slate-900">{msg.text}</p>}
                        </div>
                      </div>
                    );
                  })}

                  {(sending && !isTyping) || isTyping ? (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-slate-200 px-3 py-1 text-[11px] text-slate-500 shadow-sm">
                        <span className="flex gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.1s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                        </span>
                        <span>{isTyping ? "ekari AI is typing…" : "ekari AI is thinking…"}</span>
                      </div>
                    </div>
                  ) : null}

                  <div ref={messagesEndRef} />

                  <p className="mt-2 text-[11px] text-slate-400 text-center">
                    ekari AI provides guidance only and is not a substitute for a certified agronomist or legal advisor.
                  </p>
                </div>
              </div>

              {/* Pending image preview overlay */}
              <AnimatePresence>
                {pendingImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    className="absolute bottom-[88px] left-6 right-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl max-w-xl mx-auto"
                  >
                    <div className="relative">
                      <Image src={pendingImage} alt="Preview" width={900} height={500} className="w-full h-40 object-cover" />
                      <button
                        onClick={() => {
                          setPendingImage(null);
                          setPendingFile(null);
                        }}
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 border border-slate-200 transition rounded-full px-2 py-1 text-xs"
                      >
                        Close
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Composer */}
              <div className="border-t border-slate-200 bg-white flex-shrink-0">
                <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-1">
                  <div className="flex items-end gap-2">
                    <label
                      className="cursor-pointer bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-center hover:bg-slate-50 transition"
                      title="Attach image"
                    >
                      <ImageIcon size={18} className="text-slate-700" />
                      <input type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
                    </label>

                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about crop issues, inputs, or rules…"
                      className="flex-1 resize-none bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm
                                 placeholder-slate-400 focus:outline-none focus:ring-2
                                 focus:ring-[rgba(199,146,87,0.45)] max-h-32 min-h-[42px]"
                      rows={1}
                      onInput={(e) => {
                        const ta = e.currentTarget;
                        ta.style.height = "auto";
                        ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          onSend();
                        }
                      }}
                    />

                    <button
                      onClick={onSend}
                      disabled={sending || (!input.trim() && !pendingImage && !pendingFile)}
                      className="p-3 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition shadow"
                      style={{ backgroundColor: EKARI.gold }}
                      aria-label="Send"
                    >
                      {sending ? (
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 leading-snug pt-1">
                    Tip: Press <span className="font-semibold">Enter</span> to send •{" "}
                    <span className="font-semibold">Shift+Enter</span> for a new line
                  </div>
                </div>
              </div>
            </div>
            {/* end main */}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
