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
    paused = false, // external pause
    muted = false,
    audioAllowed = true,
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

    // local (gesture) pause
    const [holdPaused, setHoldPaused] = useState(false);

    // progress (0..1) for active segment (we animate it ourselves)
    const [progress, setProgress] = useState(0);
    const rafRef = useRef<number | null>(null);
    const lastTRef = useRef<number>(0);

    const firstLoadedRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const count = photos.length;
    const signature = useMemo(() => photos.map((p) => p.url).join("|"), [photos]);

    const isPaused = paused || holdPaused;

    // ===== reset when photos change =====
    useEffect(() => {
        setIndex(0);
        setFullLoaded(false);
        setProgress(0);
        firstLoadedRef.current = false;

        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTRef.current = 0;
    }, [signature]);

    // notify parent
    useEffect(() => {
        onIndexChange?.(index);
    }, [index, onIndexChange]);

    // when slide changes
    useEffect(() => {
        setFullLoaded(false);
        setProgress(0);
        lastTRef.current = 0;
    }, [index]);

    // ===== progress + autoplay (TikTok style) =====
    useEffect(() => {
        if (count <= 1) return;

        // stop raf
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTRef.current = 0;

        const tick = (t: number) => {
            rafRef.current = requestAnimationFrame(tick);

            // pause
            if (isPaused) {
                lastTRef.current = t; // keep time fresh to avoid jumps
                return;
            }

            // wait until first image is loaded to feel smoother (optional)
            // if you want strict behavior, remove this block.
            if (!firstLoadedRef.current) {
                lastTRef.current = t;
                return;
            }

            if (!lastTRef.current) lastTRef.current = t;
            const dt = t - lastTRef.current;
            lastTRef.current = t;

            setProgress((p) => {
                const next = p + dt / intervalMs;
                if (next >= 1) {
                    // advance
                    setIndex((i) => (i + 1) % count);
                    return 0;
                }
                return next;
            });
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [count, intervalMs, isPaused]);

    // ===== audio behavior =====
    useEffect(() => {
        if (!audioUrl) {
            if (audioRef.current) pauseIfCurrentAudio(audioRef.current);
            return;
        }

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

        if (isPaused || muted || !audioAllowed) {
            pauseIfCurrentAudio(a);
            return;
        }

        playExclusiveAudio(a);

        return () => {
            pauseIfCurrentAudio(a);
        };
    }, [audioUrl, isPaused, muted, audioAllowed]);

    if (!count) return null;

    const current = photos[Math.max(0, Math.min(count - 1, index))];
    const objectClass = fit === "contain" ? "object-contain" : "object-cover";

    // ===== TikTok gestures: tap L/R, hold to pause, drag while holding to scrub =====
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pointerState = useRef<{
        down: boolean;
        startX: number;
        lastX: number;
        scrubbing: boolean;
        holding: boolean;
    }>({ down: false, startX: 0, lastX: 0, scrubbing: false, holding: false });

    const holdTimerRef = useRef<number | null>(null);

    const goNext = () => setIndex((i) => Math.min(count - 1, i + 1));
    const goPrev = () => setIndex((i) => Math.max(0, i - 1));

    function clearHoldTimer() {
        if (holdTimerRef.current) {
            window.clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
    }

    function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        if (count <= 0) return;
        (e.currentTarget as any).setPointerCapture?.(e.pointerId);

        pointerState.current.down = true;
        pointerState.current.startX = e.clientX;
        pointerState.current.lastX = e.clientX;
        pointerState.current.scrubbing = false;
        pointerState.current.holding = false;

        // Hold threshold like TikTok
        clearHoldTimer();
        holdTimerRef.current = window.setTimeout(() => {
            pointerState.current.holding = true;
            setHoldPaused(true);
        }, 180);
    }

    function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        if (!pointerState.current.down) return;

        const x = e.clientX;
        const dx = x - pointerState.current.startX;
        pointerState.current.lastX = x;

        // If holding, allow scrubbing (slide back/forward)
        if (pointerState.current.holding) {
            const threshold = 22; // feels good on mobile + desktop
            if (Math.abs(dx) >= threshold) {
                pointerState.current.scrubbing = true;

                // step by step (like “scrub to previous/next”)
                if (dx > 0) {
                    // moved right => previous
                    pointerState.current.startX = x;
                    goPrev();
                } else {
                    // moved left => next
                    pointerState.current.startX = x;
                    goNext();
                }
            }
        } else {
            // if user moves finger before hold triggers, cancel hold
            if (Math.abs(dx) > 10) clearHoldTimer();
        }
    }

    function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
        if (!pointerState.current.down) return;
        pointerState.current.down = false;

        clearHoldTimer();

        // If we were holding, just release (resume)
        if (pointerState.current.holding) {
            pointerState.current.holding = false;
            setHoldPaused(false);
            return;
        }

        // Tap behavior (left/right zones)
        const el = containerRef.current;
        const w = el?.getBoundingClientRect().width || 1;
        const x = e.clientX - (el?.getBoundingClientRect().left || 0);

        // If user dragged (even without hold), ignore tap
        const tapDx = Math.abs(pointerState.current.lastX - pointerState.current.startX);
        if (tapDx > 10) return;

        if (x < w * 0.35) goPrev();
        else goNext();
    }

    function onPointerCancel() {
        pointerState.current.down = false;
        pointerState.current.holding = false;
        clearHoldTimer();
        setHoldPaused(false);
    }

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full overflow-hidden select-none touch-none ${className ?? ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
        >
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
                    transition={{ duration: 0.28 }}
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

            {/* Pause overlay (subtle) */}
            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        className="absolute inset-0 z-20 flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="rounded-full bg-black/35 backdrop-blur px-4 py-2 text-white text-xs font-semibold">
                            Paused
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Audio indicator (optional) */}
            {showAudioIndicator && !!audioUrl && !muted && (
                <div className="absolute top-3 right-3 z-30">
                    <div className="rounded-full bg-black/35 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-white">
                        ♪
                    </div>
                </div>
            )}

            {/* TikTok segmented progress (top) */}
            {count > 1 && (
                <div className="absolute left-3 right-3 top-3 z-30">
                    <div className="flex items-center gap-1.5">
                        {photos.map((_, i) => {
                            const done = i < index;
                            const active = i === index;
                            const fill = done ? 1 : active ? progress : 0;

                            return (
                                <div
                                    key={i}
                                    className="relative h-[3px] flex-1 rounded-full overflow-hidden bg-white/25"
                                >
                                    <div
                                        className="absolute inset-0 bg-white"
                                        style={{
                                            transformOrigin: "left",
                                            transform: `scaleX(${Math.max(0, Math.min(1, fill))})`,
                                            transition: active ? "none" : "transform 120ms linear",
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tap zones hint (optional, invisible but improves hit targets) */}
            <div className="absolute inset-0 z-10">
                <div className="absolute left-0 top-0 h-full w-[35%]" />
                <div className="absolute right-0 top-0 h-full w-[65%]" />
            </div>
        </div>
    );
}