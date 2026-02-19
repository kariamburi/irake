"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type PhotoItem = {
    url: string;
    previewUrl?: string | null;
};

// ✅ Exclusive audio (TikTok-like)
let CURRENT_AUDIO: HTMLAudioElement | null = null;
function playExclusiveAudio(a: HTMLAudioElement) {
    try {
        if (CURRENT_AUDIO && CURRENT_AUDIO !== a) {
            CURRENT_AUDIO.pause();
            CURRENT_AUDIO.currentTime = 0;
        }
        CURRENT_AUDIO = a;
        a.play().catch(() => { });
    } catch { }
}
function pauseIfCurrentAudio(a: HTMLAudioElement) {
    try {
        if (CURRENT_AUDIO === a) CURRENT_AUDIO = null;
        a.pause();
    } catch { }
}

export function PhotoSliderPlayer({
    photos,
    audioUrl,
    intervalMs = 3000,
    paused = false,          // pauses slides + audio
    muted = false,           // respects global mute
    audioAllowed = true,     // gesture unlock (optional)
    showAudioIndicator = true,
    onIndexChange,
    onFirstLoad,
    onLoadError,
    className,
    fit = "cover",
}: {
    photos: PhotoItem[];
    audioUrl?: string;
    intervalMs?: number;
    paused?: boolean;
    muted?: boolean;
    audioAllowed?: boolean;
    showAudioIndicator?: boolean;
    onIndexChange?: (index: number) => void;
    onFirstLoad?: () => void;
    onLoadError?: (errIndex: number, url?: string) => void;
    className?: string;
    fit?: "cover" | "contain";
}) {
    const [index, setIndex] = useState(0);
    const [fullLoaded, setFullLoaded] = useState(false);

    const timerRef = useRef<number | null>(null);
    const firstLoadedRef = useRef(false);

    // 🎵 audio ref
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const count = photos.length;

    // stable signature (detects actual list changes)
    const signature = useMemo(() => photos.map((p) => p.url).join("|"), [photos]);

    // reset on photo set change
    useEffect(() => {
        setIndex(0);
        setFullLoaded(false);
        firstLoadedRef.current = false;

        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, [signature]);

    // autoplay slides
    useEffect(() => {
        if (paused || count <= 1) return;

        if (timerRef.current) window.clearInterval(timerRef.current);

        timerRef.current = window.setInterval(() => {
            setIndex((i) => (i + 1) % count);
        }, intervalMs);

        return () => {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [paused, intervalMs, count]);

    // notify parent index change
    useEffect(() => {
        onIndexChange?.(index);
    }, [index, onIndexChange]);

    // when slide changes, wait for full image
    useEffect(() => {
        setFullLoaded(false);
    }, [index]);

    // 🎵 audio behavior (TikTok-style)
    useEffect(() => {
        // no audio
        if (!audioUrl) {
            if (audioRef.current) pauseIfCurrentAudio(audioRef.current);
            return;
        }

        // create once per url
        if (!audioRef.current || (audioRef.current as any).__src !== audioUrl) {
            if (audioRef.current) pauseIfCurrentAudio(audioRef.current);

            const a = new Audio(audioUrl);
            (a as any).__src = audioUrl;
            a.loop = true;
            a.preload = "auto";
            audioRef.current = a;
        }

        const a = audioRef.current!;
        a.muted = muted;

        // pause conditions
        if (paused || muted || !audioAllowed) {
            pauseIfCurrentAudio(a);
            return;
        }

        // play
        playExclusiveAudio(a);

        return () => {
            // when component unmounts / url changes
            pauseIfCurrentAudio(a);
        };
    }, [audioUrl, paused, muted, audioAllowed]);

    if (!count) return null;

    const current = photos[Math.max(0, Math.min(count - 1, index))];
    const objectClass = fit === "contain" ? "object-contain" : "object-cover";

    return (
        <div className={`relative w-full h-full overflow-hidden ${className ?? ""}`}>
            {/* preview blur */}
            {!!current.previewUrl && !fullLoaded && (
                <img
                    src={current.previewUrl}
                    alt=""
                    aria-hidden
                    className={`absolute inset-0 h-full w-full ${objectClass} blur-[14px] scale-[1.03] opacity-90`}
                    draggable={false}
                    decoding="async"
                />
            )}

            <AnimatePresence initial={false}>
                <motion.img
                    key={`${index}:${current.url}`}
                    src={current.url}
                    alt=""
                    className={`absolute inset-0 h-full w-full ${objectClass}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    draggable={false}
                    decoding="async"
                    loading="eager"
                    fetchPriority="high"
                    onLoad={() => {
                        setFullLoaded(true);
                        if (!firstLoadedRef.current) {
                            firstLoadedRef.current = true;
                            onFirstLoad?.();
                        }
                    }}
                    onError={() => {
                        onLoadError?.(index, current.url);
                        if (!firstLoadedRef.current) {
                            firstLoadedRef.current = true;
                            onFirstLoad?.();
                        }
                    }}
                />
            </AnimatePresence>

            {/* 🎵 small audio badge */}
            {audioUrl && showAudioIndicator && (
                <div className="absolute top-3 left-3 z-20 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white flex items-center gap-1">
                    <span>{muted ? "🔇" : "🔊"}</span>
                    <span className="opacity-80">{muted ? "Muted" : "Sound"}</span>
                </div>
            )}

            {/* TikTok segmented progress */}
            {count > 1 && (
                <div className="absolute left-3 right-3 bottom-3 z-20">
                    <div className="flex items-center gap-1.5">
                        {photos.map((_, i) => {
                            const active = i === index;
                            return (
                                <div
                                    key={i}
                                    className="relative h-[3px] flex-1 rounded-full overflow-hidden bg-white/25"
                                >
                                    <motion.div
                                        className="absolute inset-0 bg-white"
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: active ? 1 : 0 }}
                                        transition={{
                                            duration: active ? intervalMs / 1000 : 0.15,
                                            ease: "linear",
                                        }}
                                        style={{ transformOrigin: "left" }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
