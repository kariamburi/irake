"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Image as ImageIcon,
  Menu,
  X,
  ArrowLeft,
  Sparkles,
  Plus,
  RefreshCw,
  MessageSquareText,
  Leaf,
  PawPrint,
  Store,
  Scale,
  Bot,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { storage, db } from "@/lib/firebase";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

/* ---------------------------- THEME & HELPERS ---------------------------- */
const EKARI = {
  forest: "#173C2E",
  forestSoft: "#214C3A",
  gold: "#F39A22",
  sand: "#F8F7F2",
  paper: "#FBFAF6",
  hair: "#DDD8CC",
  ink: "#0F172A",
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

type Role = "user" | "assistant";

type Msg = {
  id: string;
  role: Role;
  text?: string;
  imageUrl?: string | null;
  createdAt: number;
  renderAsMarkdown?: boolean;
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

const MAX_IMAGE_MB = 6;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function fileToMb(n: number) {
  return Math.round((n / (1024 * 1024)) * 10) / 10;
}

async function uploadImageAndGetUrl(file: File, uid: string | null) {
  if (!ALLOWED.includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error(`Image too large: ${fileToMb(file.size)}MB (max ${MAX_IMAGE_MB}MB)`);
  }

  const safeName = (file.name || "image.jpg").replace(/[^\w.\-]/g, "_");
  const key = `ekariAi/${uid || "anon"}/${Date.now()}_${safeName}`;
  const ref = sRef(storage, key);

  const snap = await uploadBytes(ref, file, {
    contentType: file.type || "image/jpeg",
    cacheControl: "public,max-age=31536000",
  });

  if (!snap?.metadata?.fullPath) {
    throw new Error("Upload failed (no metadata returned).");
  }

  const url = await getDownloadURL(ref);
  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error("Upload succeeded but could not get download URL.");
  }

  return { url, path: snap.metadata.fullPath };
}

const WELCOME: Msg = {
  id: "sys-welcome",
  role: "assistant",
  text:
    "Hi! I’m ekari AI 🌿— your smart assistant on ekarihub here to help you diagnose crops and livestock, explore markets, understand local regulations and guide you through the entire agribusiness and green-living ecosystem with instant answers, smart insights, and photo analysis.",
  createdAt: Date.now(),
  renderAsMarkdown: true,
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

/* ---------------- markdown styling ---------------- */
const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-[24px] font-extrabold leading-tight text-slate-900 mt-2 mb-3">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-[21px] font-extrabold leading-tight text-slate-900 mt-2 mb-3">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-[18px] font-bold leading-tight text-slate-900 mt-2 mb-2">{children}</h3>
  ),
  h4: ({ children }: any) => (
    <h4 className="text-[16px] font-bold leading-tight text-slate-900 mt-2 mb-2">{children}</h4>
  ),
  p: ({ children }: any) => (
    <p className="whitespace-pre-wrap text-slate-900 text-[15px] leading-7 mb-3 last:mb-0">{children}</p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc pl-5 space-y-1 mb-3 text-slate-900 text-[15px] leading-7">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal pl-5 space-y-1 mb-3 text-slate-900 text-[15px] leading-7">{children}</ol>
  ),
  li: ({ children }: any) => <li className="leading-7">{children}</li>,
  strong: ({ children }: any) => <strong className="font-extrabold text-slate-900">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-4 border-[rgba(199,146,87,0.9)] pl-3 py-1 my-3 text-slate-700">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }: any) =>
    inline ? (
      <code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[13px] text-[#233F39]">{children}</code>
    ) : (
      <code className="block rounded-xl bg-slate-100 p-3 text-[13px] leading-6 text-slate-900 overflow-x-auto">
        {children}
      </code>
    ),
  pre: ({ children }: any) => <pre className="my-3 overflow-x-auto">{children}</pre>,
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-[rgb(35,63,57)] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  table: ({ children }: any) => (
    <div className="my-3 overflow-x-auto">
      <table className="min-w-full border-collapse border border-slate-200 text-[14px]">{children}</table>
    </div>
  ),
  thead: ({ children }: any) => <thead className="bg-slate-50">{children}</thead>,
  th: ({ children }: any) => (
    <th className="border border-slate-200 px-3 py-2 text-left font-bold text-slate-900">{children}</th>
  ),
  td: ({ children }: any) => <td className="border border-slate-200 px-3 py-2 text-slate-800">{children}</td>,
};

function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="[&_>*:first-child]:mt-0 [&_>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const incomingPrompt =
    searchParams.get("prompt");

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

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingMsgIdRef = useRef<string | null>(null);

  const inputRef =
    useRef<HTMLTextAreaElement | null>(null);

  const consumedPromptRef =
    useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  //const scrollToEnd = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const scrollToEnd = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, scrollToEnd]);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    typingMsgIdRef.current = null;
    setIsTyping(false);
  }, []);

  useEffect(() => () => stopTyping(), [stopTyping]);

  /*
   * Context hand-off into ekari AI.
   *
   * Other ekarihub surfaces can navigate here using:
   * /ai?prompt=<encoded prompt>
   *
   * We PREFILL the composer instead of auto-sending so the user
   * can review/edit the question or attach an image before sending.
   */
  useEffect(() => {
    const prompt =
      incomingPrompt?.trim();

    if (!prompt) {
      return;
    }

    // Avoid consuming the same prompt repeatedly on rerenders.
    if (
      consumedPromptRef.current ===
      prompt
    ) {
      return;
    }

    consumedPromptRef.current =
      prompt;

    // Treat an incoming suggestion as a fresh question.
    stopTyping();
    setConversationId(null);
    setMessages([WELCOME]);
    setPendingImage(null);
    setPendingFile(null);
    setMobileHistoryOpen(false);

    setInput(prompt);

    const focusTimer =
      window.setTimeout(() => {
        inputRef.current?.focus();

        inputRef.current?.setSelectionRange(
          prompt.length,
          prompt.length
        );

        /*
         * Clean the URL after consuming the prompt so refresh/back
         * does not accidentally prefill the same question again.
         */
        router.replace("/ai", {
          scroll: false,
        });
      }, 120);

    return () => {
      window.clearTimeout(
        focusTimer
      );
    };
  }, [
    incomingPrompt,
    router,
    stopTyping,
  ]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileHistoryOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
            renderAsMarkdown: m.role === "assistant",
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

  const sendToAI = useCallback(
    async (prompt: string, file?: File | null): Promise<string> => {
      let imageUrl: string | null = null;

      try {
        if (file) {
          const up = await uploadImageAndGetUrl(file, user?.uid || null);
          imageUrl = up.url;
          console.log("✅ Image uploaded:", { path: up.path, imageUrl });
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
          return `Sorry — the AI server returned an error (${res.status}). Please try again.`;
        }

        const data = await res.json();

        if (data.conversationId) setConversationId(data.conversationId);
        fetchConversations();

        return data.reply || "Sorry — I couldn't generate a response. Please try again.";
      } catch (err: any) {
        console.error("sendToAI failed:", {
          message: err?.message,
          code: err?.code,
          name: err?.name,
          stack: err?.stack,
        });

        if (String(err?.message || "").toLowerCase().includes("upload")) {
          return `Image upload failed: ${err?.message || "Unknown error"}`;
        }

        return err?.message
          ? `Sorry — ${err.message}`
          : "Sorry — something went wrong. Please check your connection and try again.";
      }
    },
    [aiEndpoint, user?.uid, conversationId, fetchConversations]
  );

  const animateAssistantReply = useCallback(
    (fullText: string) => {
      if (!fullText) return;

      stopTyping();

      const id = `ai_${Date.now()}`;
      typingMsgIdRef.current = id;

      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "assistant",
          text: "",
          createdAt: Date.now(),
          renderAsMarkdown: true, // ✅ markdown immediately
        },
      ]);
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

        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                ...m,
                text: slice,
                renderAsMarkdown: true, // ✅ keep markdown on every tick
              }
              : m
          )
        );

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
      renderAsMarkdown: false,
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
          renderAsMarkdown: true,
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

  const mineBg = "#FFF5E7";
  const mineBorder = hexToRgba(EKARI.gold, 0.48);
  const theirsBg = EKARI.paper;
  const theirsBrd = EKARI.hair;

  const activeConvTitle = useMemo(() => {
    const c = convs.find((x) => x.id === conversationId);
    return c?.title || "ekari AI";
  }, [convs, conversationId]);

  const goBack = useCallback(() => {
    if (mobileHistoryOpen) {
      setMobileHistoryOpen(false);
      return;
    }
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [mobileHistoryOpen, router]);

  const renderMessageBody = (msg: Msg, mine: boolean) => {
    if (!msg.text) return null;

    if (mine) {
      return <p className="whitespace-pre-wrap text-slate-900">{msg.text}</p>;
    }

    return <AssistantMarkdown text={msg.text} />;
  };

  const HistoryList = (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8F7F2]">
      <div className="border-b border-[#E4DED2] px-3.5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.11em] text-slate-400">
              Conversations
            </div>
            <div className="mt-0.5 text-[15px] font-black text-slate-900">
              History
            </div>
          </div>

          <button
            onClick={startNewChat}
            className={[
              "inline-flex h-9 items-center gap-1.5 rounded-full",
              "bg-[#173C2E] px-3.5",
              "text-[11px] font-black text-white",
              "transition-all duration-200 ease-out",
              "hover:-translate-y-0.5 hover:bg-[#214C3A]",
              "active:translate-y-0 active:scale-[0.98]",
            ].join(" ")}
          >
            <Plus size={14} />
            New Ask
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 no-scrollbar">
        {loadingConvs ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-2xl border border-[#E4DED2] bg-white p-3"
              >
                <div className="h-3 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-2.5 w-1/4 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : convs.length === 0 ? (
          <div className="flex h-full items-center justify-center px-3 text-center">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
                <MessageSquareText size={21} />
              </div>

              <div className="mt-3 text-[13px] font-black text-slate-700">
                No chats yet
              </div>

              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                Start a new question and your conversations will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {convs.map((c) => {
              const active = c.id === conversationId;

              return (
                <button
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={[
                    "group w-full rounded-2xl border px-3 py-2.5 text-left",
                    "transition-all duration-200 ease-out",
                    active
                      ? "border-[#173C2E] bg-[#173C2E] text-white shadow-[0_8px_18px_rgba(23,60,46,0.12)]"
                      : "border-[#E4DED2] bg-[#FBFAF6] text-slate-800 hover:translate-x-0.5 hover:border-[#CFC8BA] hover:bg-white",
                  ].join(" ")}
                  title={c.title || "Chat"}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={[
                        "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                        active
                          ? "bg-white/10 text-[#F39A22]"
                          : "bg-[#E8ECE8] text-[#173C2E]",
                      ].join(" ")}
                    >
                      <Sparkles size={15} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-black">
                        {c.title || "New Ask"}
                      </div>

                      <div
                        className={[
                          "mt-1 text-[10px] font-medium",
                          active ? "text-white/55" : "text-slate-400",
                        ].join(" ")}
                      >
                        {typeof c.messageCount === "number"
                          ? `${c.messageCount} message${c.messageCount === 1 ? "" : "s"}`
                          : "Conversation"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-[#E4DED2] p-2.5">
        <button
          onClick={fetchConversations}
          className={[
            "inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl",
            "border border-[#D9D3C7] bg-[#FBFAF6]",
            "text-[11px] font-black text-slate-600",
            "transition-all duration-200",
            "hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]",
            "active:scale-[0.98]",
          ].join(" ")}
        >
          <RefreshCw size={14} />
          Refresh history
        </button>
      </div>
    </div>
  );

  const quickPrompts = [
    {
      label: "Diagnose a crop",
      prompt: "Help me diagnose a crop problem. Tell me what details or photo you need.",
      icon: <Leaf size={17} />,
    },
    {
      label: "Livestock advice",
      prompt: "I need livestock advice. Help me understand the problem and what I should check first.",
      icon: <PawPrint size={17} />,
    },
    {
      label: "Market insights",
      prompt: "Give me practical market insights for a farmer selling produce in Kenya.",
      icon: <Store size={17} />,
    },
    {
      label: "Farming regulations",
      prompt: "Help me understand the key farming or agribusiness regulations relevant to my question in Kenya.",
      icon: <Scale size={17} />,
    },
  ];

  const useQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  const isNewConversation =
    !conversationId &&
    messages.length === 1 &&
    messages[0]?.id === WELCOME.id;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-[#F8F7F2]">
        <header className="sticky top-0 z-50 shrink-0 border-b border-[#E4DED2] bg-[#173C2E]/95 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-3">
            <button
              onClick={goBack}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.10]"
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F39A22]/15 text-[#F39A22]">
                  <Sparkles size={16} />
                </span>

                <div className="min-w-0">
                  <div className="truncate text-[13px] font-black text-white">
                    ekari AI
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px] font-semibold text-white/45">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Agribusiness intelligence
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setMobileHistoryOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.10]"
              aria-label="Open history"
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F8F7F2]">
          <div className="mx-auto max-w-3xl space-y-3 px-3 py-4">
            {loadingMsgs ? (
              <div className="text-sm text-slate-400">
                Loading conversation…
              </div>
            ) : null}

            {isNewConversation ? (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[22px] border border-[#DDD8CC] bg-[#FBFAF6] p-4"
              >
                <div className="flex gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#E8ECE8] text-[#173C2E]">
                    <Bot size={21} />
                  </span>

                  <div>
                    <div className="text-[15px] font-black text-slate-900">
                      What can I help you with?
                    </div>

                    <p className="mt-1 text-[12px] leading-5 text-slate-500">
                      Ask about crops, livestock, markets, weather, inputs,
                      regulations or upload a farm photo for analysis.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {quickPrompts.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => useQuickPrompt(item.prompt)}
                      className={[
                        "flex min-h-16 items-start gap-2 rounded-2xl border border-[#E4DED2]",
                        "bg-white p-3 text-left",
                        "transition-all duration-200",
                        "hover:border-[#F39A22]/45 hover:bg-[#FFF9F0]",
                        "active:scale-[0.98]",
                      ].join(" ")}
                    >
                      <span className="mt-0.5 text-[#F39A22]">
                        {item.icon}
                      </span>

                      <span className="text-[11px] font-black leading-4 text-slate-700">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.section>
            ) : null}

            {messages.map((msg) => {
              const mine = msg.role === "user";

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "rounded-[18px] border px-3.5 py-3 text-[14px] leading-relaxed",
                      "shadow-[0_6px_18px_rgba(15,23,42,0.04)]",
                      mine ? "max-w-[90%]" : "max-w-[94%]",
                    ].join(" ")}
                    style={{
                      background: mine ? mineBg : theirsBg,
                      borderColor: mine ? mineBorder : theirsBrd,
                    }}
                  >
                    {msg.imageUrl ? (
                      <div className="mb-2 overflow-hidden rounded-xl">
                        <Image
                          src={msg.imageUrl}
                          alt="upload"
                          width={520}
                          height={520}
                          className="h-auto w-full rounded-xl object-cover"
                        />
                      </div>
                    ) : null}

                    {renderMessageBody(msg, mine)}
                  </div>
                </motion.div>
              );
            })}

            {(sending && !isTyping) || isTyping ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#E4DED2] bg-[#FBFAF6] px-3 py-1.5 text-[10px] font-semibold text-slate-400">
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#F39A22]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#F39A22] [animation-delay:0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#F39A22] [animation-delay:0.2s]" />
                  </span>

                  {isTyping ? "ekari AI is typing…" : "ekari AI is thinking…"}
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />

            <p className="pt-2 text-center text-[10px] leading-5 text-slate-400">
              ekari AI provides guidance only and is not a substitute for a
              certified agronomist, veterinarian or legal advisor.
            </p>

            <div style={{ height: "calc(104px + env(safe-area-inset-bottom))" }} />
          </div>
        </div>

        <AnimatePresence>
          {pendingImage ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="shrink-0 border-t border-[#E4DED2] bg-[#FBFAF6] px-3 pt-2"
            >
              <div className="relative overflow-hidden rounded-xl border border-[#DDD8CC]">
                <Image
                  src={pendingImage}
                  alt="Preview"
                  width={900}
                  height={500}
                  className="h-24 w-full object-cover"
                />

                <button
                  onClick={() => {
                    setPendingImage(null);
                    setPendingFile(null);
                  }}
                  className="absolute right-2 top-2 rounded-full border border-white/30 bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div
          className="shrink-0 border-t border-[#E4DED2] bg-[#FBFAF6]/95 backdrop-blur-xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="px-3 py-2.5">
            <div className="flex items-end gap-2">
              <label
                className={[
                  "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl",
                  "border border-[#D9D3C7] bg-white text-[#173C2E]",
                  "transition-all duration-200 hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]",
                ].join(" ")}
                title="Attach image"
              >
                <ImageIcon size={18} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImagePick}
                />
              </label>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask ekari AI about your farm…"
                className={[
                  "min-h-[44px] max-h-32 flex-1 resize-none rounded-[16px]",
                  "border border-[#D9D3C7] bg-white px-3.5 py-2.5",
                  "text-sm text-slate-800 outline-none placeholder:text-slate-400",
                  "transition-all duration-200",
                  "focus:border-[#F39A22]/60 focus:ring-2 focus:ring-[#F39A22]/10",
                ].join(" ")}
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
                className={[
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                  "bg-[#F39A22] text-white",
                  "shadow-[0_8px_18px_rgba(243,154,34,0.20)]",
                  "transition-all duration-200",
                  "hover:-translate-y-0.5 hover:bg-[#E98C12]",
                  "active:translate-y-0 active:scale-95",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                ].join(" ")}
                aria-label="Send"
              >
                {sending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileHistoryOpen ? (
            <motion.div
              className="fixed inset-0 z-[60] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-black/45"
                onClick={() => setMobileHistoryOpen(false)}
              />

              <motion.div
                className="absolute bottom-0 left-0 top-0 w-[88%] max-w-[360px] bg-[#F8F7F2] shadow-2xl"
                initial={{ x: -420 }}
                animate={{ x: 0 }}
                exit={{ x: -420 }}
                transition={{
                  type: "spring",
                  stiffness: 360,
                  damping: 34,
                }}
              >
                <div className="flex h-14 items-center justify-between border-b border-[#E4DED2] px-3">
                  <div className="text-sm font-black text-slate-900">
                    Chat history
                  </div>

                  <button
                    onClick={() => setMobileHistoryOpen(false)}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white"
                    aria-label="Close history"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="h-[calc(100%-3.5rem)]">
                  {HistoryList}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <AppShell handle={user?.displayName ?? undefined}>
      <div className="h-[100svh] w-full overflow-hidden bg-[#F8F7F2]">
        <div className="flex h-full w-full">
          {/* AI HISTORY RAIL */}
          <motion.aside
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="hidden h-full w-[270px] shrink-0 border-r border-[#E4DED2] bg-[#F8F7F2] lg:block xl:w-[286px]"
          >
            {HistoryList}
          </motion.aside>

          {/* MAIN AI WORKSPACE */}
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex h-full flex-col">
              {/* HERO */}
              <motion.header
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                className="relative shrink-0 overflow-hidden bg-[#173C2E]"
              >
                <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/[0.035]" />
                <div className="pointer-events-none absolute -bottom-24 right-28 h-48 w-48 rounded-full bg-[#F39A22]/10" />

                <div className="flex items-center gap-4 px-5 py-4">
                  <button
                    onClick={goBack}
                    className={[
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      "border border-white/15 bg-white/[0.06] text-white",
                      "transition-all duration-200",
                      "hover:bg-white/[0.11] active:scale-95",
                    ].join(" ")}
                    aria-label="Go back"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F39A22]/15 text-[#F39A22]">
                    <Sparkles size={19} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.11em] text-[#F39A22]">
                      Ekarihub Intelligence
                    </div>

                    <div className="mt-0.5 flex min-w-0 items-center gap-2">
                      <h1 className="truncate text-[18px] font-black text-white">
                        {activeConvTitle}
                      </h1>

                      <span className="hidden items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[9px] font-bold text-white/50 sm:inline-flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Agribusiness assistant
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startNewChat}
                    className={[
                      "inline-flex h-10 shrink-0 items-center gap-2 rounded-full",
                      "border border-white/15 bg-white/[0.07] px-4",
                      "text-[11px] font-black text-white",
                      "transition-all duration-200",
                      "hover:-translate-y-0.5 hover:bg-white/[0.12]",
                      "active:translate-y-0 active:scale-[0.98]",
                    ].join(" ")}
                  >
                    <Plus size={14} />
                    New Ask
                  </button>
                </div>
              </motion.header>

              {/* CONVERSATION */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F8F7F2] no-scrollbar">
                <div className="mx-auto max-w-[860px] space-y-3 px-5 py-5">
                  {loadingMsgs ? (
                    <div className="text-sm text-slate-400">
                      Loading conversation…
                    </div>
                  ) : null}

                  {isNewConversation ? (
                    <motion.section
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28 }}
                      className={[
                        "rounded-[22px] border border-[#DDD8CC] bg-[#FBFAF6]",
                        "p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-4">
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E8ECE8] text-[#173C2E]">
                          <Bot size={23} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="text-[17px] font-black text-slate-900">
                            Ask ekari AI
                          </div>

                          <p className="mt-1 max-w-2xl text-[12px] font-medium leading-5 text-slate-500">
                            Get help with crops, livestock, inputs, markets,
                            weather, regulations and agribusiness decisions.
                            You can also upload a photo for analysis.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {quickPrompts.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => useQuickPrompt(item.prompt)}
                            className={[
                              "group rounded-2xl border border-[#E4DED2] bg-white p-3 text-left",
                              "transition-all duration-200 ease-out",
                              "hover:-translate-y-0.5 hover:border-[#F39A22]/45 hover:bg-[#FFF9F0]",
                              "active:translate-y-0 active:scale-[0.98]",
                            ].join(" ")}
                          >
                            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFF4E3] text-[#F39A22] transition-transform duration-200 group-hover:scale-105">
                              {item.icon}
                            </span>

                            <div className="mt-2 text-[11px] font-black text-slate-700">
                              {item.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.section>
                  ) : null}

                  {messages.map((msg) => {
                    const mine = msg.role === "user";

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18 }}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={[
                            "rounded-[18px] border px-4 py-3 text-[14px] leading-relaxed",
                            "shadow-[0_8px_22px_rgba(15,23,42,0.035)]",
                            mine ? "max-w-[76%]" : "max-w-[84%]",
                          ].join(" ")}
                          style={{
                            background: mine ? mineBg : theirsBg,
                            borderColor: mine ? mineBorder : theirsBrd,
                          }}
                        >
                          {msg.imageUrl ? (
                            <div className="mb-2 overflow-hidden rounded-xl">
                              <Image
                                src={msg.imageUrl}
                                alt="upload"
                                width={520}
                                height={520}
                                className="h-auto w-full rounded-xl object-cover"
                              />
                            </div>
                          ) : null}

                          {renderMessageBody(msg, mine)}
                        </div>
                      </motion.div>
                    );
                  })}

                  {(sending && !isTyping) || isTyping ? (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[#E4DED2] bg-[#FBFAF6] px-3 py-1.5 text-[10px] font-semibold text-slate-400">
                        <span className="flex gap-0.5">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#F39A22]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#F39A22] [animation-delay:0.1s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#F39A22] [animation-delay:0.2s]" />
                        </span>

                        {isTyping
                          ? "ekari AI is typing…"
                          : "ekari AI is thinking…"}
                      </div>
                    </div>
                  ) : null}

                  <div ref={messagesEndRef} />

                  <p className="pt-2 text-center text-[10px] leading-5 text-slate-400">
                    ekari AI provides guidance only and is not a substitute for
                    a certified agronomist, veterinarian or legal advisor.
                  </p>
                </div>
              </div>

              {/* IMAGE PREVIEW */}
              <AnimatePresence>
                {pendingImage ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="shrink-0 border-t border-[#E4DED2] bg-[#FBFAF6] px-5 pt-3"
                  >
                    <div className="mx-auto max-w-[860px]">
                      <div className="relative max-w-sm overflow-hidden rounded-xl border border-[#DDD8CC] shadow-sm">
                        <Image
                          src={pendingImage}
                          alt="Preview"
                          width={900}
                          height={500}
                          className="h-28 w-full object-cover"
                        />

                        <button
                          onClick={() => {
                            setPendingImage(null);
                            setPendingFile(null);
                          }}
                          className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* COMPOSER */}
              <div className="shrink-0 border-t border-[#E4DED2] bg-[#FBFAF6]/95 backdrop-blur-xl">
                <div className="mx-auto max-w-[860px] px-5 py-3">
                  <div className="flex items-end gap-2">
                    <label
                      className={[
                        "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl",
                        "border border-[#D9D3C7] bg-white text-[#173C2E]",
                        "transition-all duration-200",
                        "hover:-translate-y-0.5 hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]",
                        "active:translate-y-0",
                      ].join(" ")}
                      title="Attach image"
                    >
                      <ImageIcon size={18} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImagePick}
                      />
                    </label>

                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about crops, livestock, markets, weather or regulations…"
                      className={[
                        "min-h-[44px] max-h-32 flex-1 resize-none rounded-[16px]",
                        "border border-[#D9D3C7] bg-white px-4 py-2.5",
                        "text-[13px] font-medium text-slate-800 outline-none placeholder:text-slate-400",
                        "transition-all duration-200",
                        "focus:border-[#F39A22]/60 focus:ring-2 focus:ring-[#F39A22]/10",
                      ].join(" ")}
                      rows={1}
                      onInput={(e) => {
                        const ta = e.currentTarget;
                        ta.style.height = "auto";
                        ta.style.height =
                          Math.min(ta.scrollHeight, 128) + "px";
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
                      disabled={
                        sending ||
                        (!input.trim() && !pendingImage && !pendingFile)
                      }
                      className={[
                        "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                        "bg-[#F39A22] text-white",
                        "shadow-[0_8px_18px_rgba(243,154,34,0.20)]",
                        "transition-all duration-200",
                        "hover:-translate-y-0.5 hover:bg-[#E98C12]",
                        "active:translate-y-0 active:scale-95",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                      ].join(" ")}
                      aria-label="Send"
                    >
                      {sending ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>

                  <div className="pt-1.5 text-[9px] font-medium text-slate-400">
                    Enter to send · Shift+Enter for a new line · Images up to{" "}
                    {MAX_IMAGE_MB}MB
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}