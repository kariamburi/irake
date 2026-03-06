"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IoPause, IoPlay, IoMusicalNotes } from "react-icons/io5";

export type PhotoItem = {
    url: string;
    previewUrl?: string | null;
};

/** ✅ Exclusive audio (TikTok-like) */
let CURRENT_AUDIO: HTMLAudioElement | null = null;

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

async function playExclusiveAudio(audio: HTMLAudioElement) {
    try {
        if (CURRENT_AUDIO && CURRENT_AUDIO !== audio) {
            try {
                CURRENT_AUDIO.pause();
                CURRENT_AUDIO.currentTime = 0;
            } catch { }
        }
        CURRENT_AUDIO = audio;
        await audio.play().catch(() => { });
    } catch { }
}

function pauseIfCurrentAudio(audio: HTMLAudioElement) {
    try {
        if (CURRENT_AUDIO === audio) CURRENT_AUDIO = null;
        audio.pause();
    } catch { }
}

export function PhotoSliderPlayer({
    photos,
    audioUrl,
    intervalMs = 3000,
    paused = false, // external pause
    muted = false,
    audioAllowed = true,
    showProgress = true,
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
    showProgress?: boolean;
    showAudioIndicator?: boolean;
    onIndexChange?: (index: number) => void;
    onFirstLoad?: () => void;
    onLoadError?: (errIndex: number, url?: string) => void;
    className?: string;
    fit?: "cover" | "contain";
}) {
    const [index, setIndex] = useState(0);
    const [fullLoaded, setFullLoaded] = useState(false);
    const [manualPaused, setManualPaused] = useState(false);

    /** ✅ prevents black flash: keep previous frame behind until current loads */
    const [prevUrl, setPrevUrl] = useState<string | null>(null);

    /** progress 0..1 */
    const [progress, setProgress] = useState(0);

    const rafRef = useRef<number | null>(null);
    const lastTRef = useRef<number>(0);

    const firstLoadedRef = useRef(false);

    /** audio */
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastAudioUrlRef = useRef<string | null>(null);

    const count = photos.length;
    const signature = useMemo(() => photos.map((p) => p.url).join("|"), [photos]);

    /** ✅ only these pauses now */
    const isPaused = paused || manualPaused;

    const clearRaf = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const goNext = useCallback(() => {
        setIndex((i) => (count ? (i + 1) % count : 0));
    }, [count]);

    const goPrev = useCallback(() => {
        setIndex((i) => (count ? (i - 1 + count) % count : 0));
    }, [count]);

    const startProgressLoop = useCallback(
        (from: number) => {
            clearRaf();
            setProgress(from);
            lastTRef.current = 0;

            if (count <= 1) return;
            if (isPaused) return;
            if (!firstLoadedRef.current) return;

            const tick = (t: number) => {
                rafRef.current = requestAnimationFrame(tick);

                if (isPaused) {
                    lastTRef.current = t;
                    return;
                }

                if (!firstLoadedRef.current) {
                    lastTRef.current = t;
                    return;
                }

                if (!lastTRef.current) {
                    lastTRef.current = t;
                    return;
                }

                const dt = t - lastTRef.current;
                lastTRef.current = t;

                setProgress((p) => {
                    const next = p + dt / intervalMs;
                    if (next >= 1) {
                        goNext();
                        return 0;
                    }
                    return next;
                });
            };

            rafRef.current = requestAnimationFrame(tick);
        },
        [clearRaf, count, goNext, intervalMs, isPaused]
    );

    /** reset on photos change */
    useEffect(() => {
        setIndex(0);
        setFullLoaded(false);
        setManualPaused(false);
        setPrevUrl(null);
        setProgress(0);
        firstLoadedRef.current = false;
        lastTRef.current = 0;
        clearRaf();
    }, [signature, clearRaf]);

    /** notify parent */
    useEffect(() => {
        onIndexChange?.(index);
    }, [index, onIndexChange]);

    /** index changes => restart segment */
    useEffect(() => {
        setFullLoaded(false);
        setProgress(0);
        lastTRef.current = 0;

        if (!isPaused && count > 1) {
            startProgressLoop(0);
        }
    }, [index, isPaused, count, startProgressLoop]);

    /** pause/resume => freeze + resume */
    useEffect(() => {
        if (count <= 1) return;

        if (isPaused) {
            clearRaf();
            return;
        }

        startProgressLoop(progress);
    }, [isPaused, count, progress, startProgressLoop, clearRaf]);

    /** ✅ track previous url to prevent black flash */
    useEffect(() => {
        if (!count) return;
        const prevIndex = clamp(index - 1, 0, count - 1);
        const prev = photos[prevIndex]?.url;
        setPrevUrl(prev || null);
    }, [index, count, photos]);

    /** ✅ prefetch next image for smoother transitions */
    useEffect(() => {
        if (!count) return;
        const next = photos[(index + 1) % count]?.url;
        if (!next) return;

        const img = new window.Image();
        img.src = next;
    }, [index, count, photos]);

    /** audio behavior */
    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!audioUrl) {
                if (audioRef.current) pauseIfCurrentAudio(audioRef.current);
                return;
            }

            if (!audioRef.current || lastAudioUrlRef.current !== audioUrl) {
                if (audioRef.current) {
                    pauseIfCurrentAudio(audioRef.current);
                }

                const a = new Audio(audioUrl);
                a.loop = true;
                a.preload = "auto";

                audioRef.current = a;
                lastAudioUrlRef.current = audioUrl;
            }

            const a = audioRef.current!;
            a.muted = !!muted;
            a.loop = true;

            if (isPaused || muted || !audioAllowed) {
                pauseIfCurrentAudio(a);
                return;
            }

            if (!cancelled) {
                await playExclusiveAudio(a);
            }
        };

        run();

        return () => {
            cancelled = true;
            if (audioRef.current) pauseIfCurrentAudio(audioRef.current);
        };
    }, [audioUrl, isPaused, muted, audioAllowed]);

    /** cleanup */
    useEffect(() => {
        return () => {
            clearRaf();

            const a = audioRef.current;
            audioRef.current = null;
            lastAudioUrlRef.current = null;

            if (a) {
                pauseIfCurrentAudio(a);
                try {
                    a.src = "";
                } catch { }
            }
        };
    }, [clearRaf]);

    if (!count) return null;

    const current = photos[clamp(index, 0, count - 1)];
    const objectClass = fit === "contain" ? "object-contain" : "object-cover";

    const toggleManualPause = useCallback(() => {
        if (paused) return;
        setManualPaused((p) => !p);
    }, [paused]);

    return (
        <div
            className={`relative h-full w-full overflow-hidden bg-black select-none ${className ?? ""}`}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* ✅ Optional blurred preview behind */}
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

            {/* ✅ Previous stays behind (prevents black flash) */}
            {!!prevUrl && prevUrl !== current.url && (
                <img
                    key={`prev:${prevUrl}`}
                    src={prevUrl}
                    alt=""
                    aria-hidden
                    className={`absolute inset-0 h-full w-full ${objectClass}`}
                    draggable={false}
                    decoding="async"
                />
            )}

            {/* ✅ Current fades in smoothly */}
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

                            if (!isPaused && count > 1) {
                                startProgressLoop(progress);
                            }
                        }
                    }}
                    onError={() => {
                        onLoadError?.(index, current.url);

                        if (!firstLoadedRef.current) {
                            firstLoadedRef.current = true;
                            onFirstLoad?.();

                            if (!isPaused && count > 1) {
                                startProgressLoop(progress);
                            }
                        }
                    }}
                />
            </AnimatePresence>

            {/* ✅ Invisible 3-zone tap overlay (Prev / Play-Pause / Next) */}
            <div className="absolute inset-0 z-20 flex mb-[180px] mr-16">
                <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={goPrev}
                    className="h-full w-1/3 bg-transparent"
                />
                <button
                    type="button"
                    aria-label={isPaused ? "Play slideshow" : "Pause slideshow"}
                    onClick={toggleManualPause}
                    disabled={paused}
                    className="h-full w-1/3 bg-transparent disabled:cursor-not-allowed"
                />
                <button
                    type="button"
                    aria-label="Next photo"
                    onClick={goNext}
                    className="h-full w-1/3 bg-transparent"
                />
            </div>

            {/* paused hint */}
            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="rounded-full bg-black/35 px-4 py-3 backdrop-blur">
                            <IoPause className="text-white" size={18} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* optional small play hint when not paused and center zone is used */}
            <AnimatePresence>
                {!isPaused && manualPaused === false && false && (
                    <motion.div
                        className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                    >
                        <div className="rounded-full bg-black/35 px-4 py-3 backdrop-blur">
                            <IoPlay className="text-white" size={18} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Audio indicator */}
            {showAudioIndicator && !!audioUrl && !muted && (
                <div className="absolute right-3 top-3 z-40">
                    <div className="rounded-full bg-black/35 px-2.5 py-1 backdrop-blur">
                        <IoMusicalNotes className="text-white" size={13} />
                    </div>
                </div>
            )}

            {/* progress bars */}
            {showProgress && count > 1 && (
                <div className="absolute left-3 right-3 top-3 z-40 pointer-events-none">
                    <div className="flex items-center gap-1.5">
                        {photos.map((_, i) => {
                            const done = i < index;
                            const active = i === index;
                            const fill = done ? 1 : active ? progress : 0;

                            return (
                                <div
                                    key={i}
                                    className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/25"
                                >
                                    <div
                                        className="absolute inset-0 bg-white"
                                        style={{
                                            transformOrigin: "left",
                                            transform: `scaleX(${fill})`,
                                            transition: active ? "none" : "transform 120ms linear",
                                        }}
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

export default PhotoSliderPlayer;