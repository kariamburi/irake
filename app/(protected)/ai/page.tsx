"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Send, Image as ImageIcon, Sparkles } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import { useAuth } from "@/app/hooks/useAuth";
import { storage } from "@/lib/firebase";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";

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

const SUGGESTIONS = [
  "Diagnose: spots on maize leaves",
  "Best fertilizer schedule for tomatoes",
  "Kenya export regulations for avocados",
];

export default function Page() {
  const { user } = useAuth();
  const aiEndpoint =
    process.env.NEXT_PUBLIC_EKARI_AI_ENDPOINT ||
    "https://us-central1-ekarihub-aed5a.cloudfunctions.net/ekariAiChat";

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "sys-welcome",
      role: "assistant",
      text:
        "Hi! I’m ekari AI 🌿— your smart assistant on ekarihub here to help you diagnose crops and livestock, explore markets, understand local regulations and guide you through the entire agribusiness and green-living ecosystem with instant answers, smart insights, and photo analysis.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [lastSentAt, setLastSentAt] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(scrollToEnd, [messages]);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  const sendToAI = useCallback(
    async (prompt: string, file?: File | null): Promise<string> => {
      try {
        let imageUrl: string | null = null;

        if (file) {
          const key = `ekariAi/${user?.uid || "anon"}/${Date.now()}_${file.name || "image.jpg"
            }`;
          const ref = sRef(storage, key);
          await uploadBytes(ref, file);
          imageUrl = await getDownloadURL(ref);
        }

        const res = await fetch(aiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: prompt,
            imageUrl,
            uid: user?.uid || null,
          }),
        });

        if (!res.ok) {
          console.error("Ekari AI HTTP error:", res.status);
          return "Sorry — I couldn't process that request. Please try again.";
        }

        const data = await res.json();
        return (
          data.reply ||
          "Sorry — I couldn't generate a response. Please try again."
        );
      } catch (err) {
        console.error("Ekari AI error:", err);
        return "Sorry — something went wrong. Please check your connection and try again.";
      }
    },
    [aiEndpoint, user?.uid]
  );

  const animateAssistantReply = useCallback((fullText: string) => {
    if (!fullText) return;

    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    const id = `ai_${Date.now()}`;
    const createdAt = Date.now();

    setMessages((prev) => [
      ...prev,
      { id, role: "assistant", text: "", createdAt },
    ]);

    setIsTyping(true);

    let index = 0;
    const step = Math.max(1, Math.floor(fullText.length / 120));
    const interval = setInterval(() => {
      index = Math.min(fullText.length, index + step);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, text: fullText.slice(0, index) } : m
        )
      );

      if (index >= fullText.length) {
        clearInterval(interval);
        typingIntervalRef.current = null;
        setIsTyping(false);
      }
    }, 18);

    typingIntervalRef.current = interval;
  }, []);

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
  }, [
    input,
    pendingImage,
    pendingFile,
    sendToAI,
    lastSentAt,
    animateAssistantReply,
  ]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPendingImage(url);
  };

  const mineBg = hexToRgba(EKARI.gold, 0.09);
  const mineBorder = hexToRgba(EKARI.gold, 0.6);
  const theirsBg = "#FFFFFF";
  const theirsBrd = "#E5E7EB";

  return (
    <AppShell>
      {/* Outer wrapper: lock to viewport & hide page scrolling */}
      <div className="flex items-center h-full w-full overflow-hidden">
        {/* Card: full-height, flex column, only middle scrolls */}
        <div
          className="
            relative mx-auto flex h-full w-full max-w-5xl flex-col
          
            md:rounded-2xl md:border md:border-slate-200 md:shadow-sm
            md:h-[calc(100vh-1rem)]
            overflow-hidden
          "
        >
          {/* Header / top bar (fixed within card) */}
          <div className="border-b backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl flex-shrink-0"

            style={{
              background:
                "linear-gradient(135deg, rgba(35,63,57,0.94), rgba(199,146,87,0.87))",
              borderColor: "rgba(15,23,42,0.18)",
              boxShadow: "0 16px 40px rgba(15,23,42,0.35)",
            }}
          >
            <div className="px-3 sm:px-4 py-3 flex items-center justify-between">
              <div className="w-8 hidden sm:block" />

              <div className="flex flex-col items-center w-full">
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] px-3 py-1 border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    ekari AI • Agribusiness assistant
                  </span>
                </div>
              </div>

              <div className="w-8 hidden sm:block" />
            </div>

            <div className="pb-3 px-3 sm:px-4">
              <div className="max-w-3xl mx-auto flex flex-col gap-2">
                <div className="mt-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(s)}
                      className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs whitespace-nowrap
                                 bg-white border border-slate-200 hover:border-slate-300 text-slate-700
                                 shadow-sm transition"
                    >
                      <Sparkles size={14} className="text-emerald-700" />
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Messages area: the ONLY scrollable region */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-3">
              {messages.map((msg) => {
                const mine = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"
                      }`}
                  >
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
                            width={360}
                            height={360}
                            className="rounded-xl object-cover w-full h-auto"
                          />
                        </div>
                      )}
                      {!!msg.text && (
                        <p className="whitespace-pre-wrap text-slate-900">
                          {msg.text}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {sending && !isTyping && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-slate-200 px-3 py-1 text-[11px] text-slate-500 shadow-sm">
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                    </span>
                    <span>ekari AI is thinking…</span>
                  </div>
                </div>
              )}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-slate-200 px-3 py-1 text-[11px] text-slate-500 shadow-sm">
                    <span className="flex gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                    </span>
                    <span>ekari AI is typing…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />

              <p className="mt-2 text-[11px] text-slate-400 text-center">
                ekari AI provides guidance only and is not a substitute for a
                certified agronomist or legal advisor.
              </p>
            </div>
          </div>

          {/* Pending image preview overlay (stays above scroll, below composer) */}
          {pendingImage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-24 left-3 right-3 sm:left-6 sm:right-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl max-w-xl mx-auto"
            >
              <div className="relative">
                <Image
                  src={pendingImage}
                  alt="Preview"
                  width={800}
                  height={400}
                  className="w-full h-36 sm:h-40 object-cover"
                />
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

          {/* Composer / bottom bar (fixed within card) */}
          <div className="border-t border-slate-200 bg-white flex-shrink-0">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-1">
              <div className="flex items-end gap-2">
                <label
                  className="cursor-pointer bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-center
                             hover:bg-slate-50 transition"
                  title="Attach image"
                >
                  <ImageIcon size={18} className="text-slate-700" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImagePick}
                  />
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
                  disabled={
                    sending || (!input.trim() && !pendingImage && !pendingFile)
                  }
                  className="p-3 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed
                             active:scale-95 transition shadow"
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
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
