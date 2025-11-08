"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Send, Image as ImageIcon, Sparkles, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import AppShell from "../components/AppShell";

/* ---------------------------- THEME & HELPERS ---------------------------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  ink: "#0F172A",
};

const hexToRgba = (hex: string, a = 1) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
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
  "Pesticide safety & PHI for beans",
];

/* -------------------------------- PAGE --------------------------------- */
export default function Page() {
  const router = useRouter();

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "sys-welcome",
      role: "assistant",
      text:
        "Hi! I’m Ekari AI 🌿 Ask me anything about agribusiness, local regulations, or crop health. You can also upload a photo for analysis.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToEnd, [messages]);

  // demo AI
  const sendToAI = async (prompt: string, imageUrl?: string | null): Promise<string> =>
    new Promise((resolve) =>
      setTimeout(() => {
        resolve(
          imageUrl
            ? "From the photo, the leaf lesions resemble early blight. Remove infected leaves, improve spacing, and consider a fungicide like mancozeb (follow local PHI)."
            : "Here’s a general guide:\n• Soil test before applying NPK.\n• Follow label rates & PHI.\n• Keep records for export compliance."
        );
      }, 900)
    );

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text && !pendingImage) return;

    const userMsg: Msg = {
      id: `user_${Date.now()}`,
      role: "user",
      text,
      imageUrl: pendingImage,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPendingImage(null);
    setSending(true);

    try {
      const reply = await sendToAI(text, userMsg.imageUrl);
      setMessages((prev) => [
        ...prev,
        { id: `ai_${Date.now()}`, role: "assistant", text: reply, createdAt: Date.now() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: "assistant",
          text: "⚠️ Sorry—something went wrong. Please try again.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, pendingImage]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingImage(url);
  };

  // ~0.25 fade as requested
  const mineBg = hexToRgba(EKARI.gold, 0.25);
  const mineBorder = hexToRgba(EKARI.gold, 0.45);
  const theirsBg = hexToRgba(EKARI.forest, 0.25);
  const theirsBrd = hexToRgba(EKARI.forest, 0.35);

  return (
    <AppShell>
      <div className="flex h-[100vh] flex-col relative bg-white text-slate-900">
        {/* Header */}
        <div className="border-b border-slate-200 px-3 sm:px-4 py-3 bg-white">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-slate-100 active:scale-95 transition"
              aria-label="Back"
            >
              <ArrowLeft size={22} className="text-slate-800" />
            </button>

            <div className="flex flex-col items-center -mr-10">
              <Image
                src="/ekarihub-logo.png"
                alt="EkariHub"
                width={124}
                height={28}
                className="object-contain"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Agribusiness • Regulations • Crop Health
              </p>
            </div>

            <div className="w-8" />
          </div>

          {/* Smart chips */}
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setInput(s)}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs whitespace-nowrap
                           bg-white border border-slate-200 hover:border-slate-300 text-slate-700
                           shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)] transition"
              >
                <Sparkles size={14} className="text-slate-600" />
                <span>{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 bg-slate-50">
          {messages.map((msg) => {
            const mine = msg.role === "user";
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[82%] rounded-2xl px-3 py-2 text-[15px] leading-relaxed border shadow-sm"
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
                  {!!msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Pending image preview */}
        {pendingImage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-28 left-4 right-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl"
          >
            <div className="relative">
              <Image
                src={pendingImage}
                alt="Preview"
                width={800}
                height={400}
                className="w-full h-40 object-cover"
              />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-700 border border-slate-200 transition rounded-full px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}

        {/* Composer */}
        <div className="border-t border-slate-200 p-3 flex items-end gap-2 bg-white">
          <label
            className="cursor-pointer bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-center
                       hover:bg-slate-50 transition"
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
                       focus:ring-[rgba(199,146,87,0.35)] max-h-32 min-h-[42px]"
            rows={1}
            onInput={(e) => {
              const ta = e.currentTarget;
              ta.style.height = "auto";
              ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
            }}
          />

          <button
            onClick={onSend}
            disabled={sending || (!input.trim() && !pendingImage)}
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
    </AppShell>
  );
}
