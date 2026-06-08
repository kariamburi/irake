"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoPause, IoMusicalNotes } from "react-icons/io5";

export type PhotoItem = {
    url: string;
    previewUrl?: string | null;
};

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
function useIsDesktop(breakpoint = 1024) {
    const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

    useEffect(() => {
        const update = () => setIsDesktop(window.innerWidth >= breakpoint);
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [breakpoint]);

    return isDesktop;
}
export function PhotoSliderPlayer({
    photos,
    audioUrl,
    intervalMs = 5000,
    autoStartDelayMs = 1500,
    paused = false,
    muted = false,
    audioAllowed = true,
    showProgress = true,
    showAudioIndicator = true,
    onIndexChange,
    onFirstLoad,
    onLoadError,
    className,
    fit = "cover",
    progressPosition = "bottom",
    progressTopOffset = 0,
    progressBottomOffset = 20,
}: {
    photos: PhotoItem[];
    audioUrl?: string;
    intervalMs?: number;
    autoStartDelayMs?: number;
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
    progressPosition?: "top" | "bottom";
    progressTopOffset?: number;
    progressBottomOffset?: number;
}) {
    const [index, setIndex] = useState(0);
    const [manualPaused, setManualPaused] = useState(false);
    const [loadedMap, setLoadedMap] = useState<Record<number, boolean>>({});
    const [progress, setProgress] = useState(0);
    const [prevUrl, setPrevUrl] = useState<string | null>(null);
    const isDesktop = useIsDesktop();
    /** measured natural image sizes from browser */
    const [measuredSizes, setMeasuredSizes] = useState<
        Record<string, { width: number; height: number }>
    >({});

    const count = photos.length;
    const isPaused = paused || manualPaused;
    const signature = useMemo(() => photos.map((p) => p.url).join("|"), [photos]);

    const firstLoadedRef = useRef(false);
    const rafRef = useRef<number | null>(null);
    const lastTRef = useRef<number>(0);
    const autoDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastAudioUrlRef = useRef<string | null>(null);

    const clearRaf = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const clearAutoDelay = useCallback(() => {
        if (autoDelayRef.current) {
            clearTimeout(autoDelayRef.current);
            autoDelayRef.current = null;
        }
    }, []);

    const clearAllAuto = useCallback(() => {
        clearRaf();
        clearAutoDelay();
        lastTRef.current = 0;
    }, [clearRaf, clearAutoDelay]);

    const goNext = useCallback(() => {
        if (!count) return;
        setIndex((i) => (i + 1) % count);
    }, [count]);

    const goPrev = useCallback(() => {
        if (!count) return;
        setIndex((i) => (i - 1 + count) % count);
    }, [count]);

    const startProgressFrom = useCallback(
        (from: number) => {
            clearRaf();
            setProgress(from);
            lastTRef.current = 0;

            if (count <= 1) return;
            if (isPaused) return;

            const tick = (t: number) => {
                rafRef.current = requestAnimationFrame(tick);

                if (isPaused) {
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
                        clearRaf();
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

    const scheduleAutoplay = useCallback(() => {
        if (count <= 1) return;
        if (isPaused) return;

        clearAllAuto();
        setProgress(0);

        autoDelayRef.current = setTimeout(() => {
            if (isPaused) return;
            startProgressFrom(0);
        }, autoStartDelayMs);
    }, [count, isPaused, clearAllAuto, autoStartDelayMs, startProgressFrom]);

    useEffect(() => {
        setIndex(0);
        setManualPaused(false);
        setLoadedMap({});
        setProgress(0);
        setPrevUrl(null);
        setMeasuredSizes({});
        firstLoadedRef.current = false;
        clearAllAuto();
    }, [signature, clearAllAuto]);

    useEffect(() => {
        onIndexChange?.(index);
    }, [index, onIndexChange]);

    useEffect(() => {
        if (!count) return;

        const prevIndex = clamp(index - 1, 0, count - 1);
        const prev = photos[prevIndex]?.url;
        setPrevUrl(prev || null);
    }, [index, count, photos]);

    useEffect(() => {
        if (!count) return;

        const next = photos[(index + 1) % count]?.url;
        const prev = photos[(index - 1 + count) % count]?.url;

        if (next) {
            const img = new window.Image();
            img.src = next;
        }

        if (prev) {
            const img = new window.Image();
            img.src = prev;
        }
    }, [index, count, photos]);

    useEffect(() => {
        clearAllAuto();
        setProgress(0);

        if (count > 1 && !isPaused) {
            scheduleAutoplay();
        }
    }, [index, count, isPaused, scheduleAutoplay, clearAllAuto]);

    useEffect(() => {
        if (count <= 1) return;

        if (isPaused) {
            clearAllAuto();
            return;
        }

        scheduleAutoplay();
    }, [isPaused, count, scheduleAutoplay, clearAllAuto]);

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
                    try {
                        audioRef.current.src = "";
                    } catch { }
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

    useEffect(() => {
        return () => {
            clearAllAuto();

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
    }, [clearAllAuto]);

    const onSlideLoaded = useCallback(
        (i: number) => {
            setLoadedMap((prev) => {
                if (prev[i]) return prev;
                return { ...prev, [i]: true };
            });

            if (!firstLoadedRef.current) {
                firstLoadedRef.current = true;
                onFirstLoad?.();
            }
        },
        [onFirstLoad]
    );

    const toggleManualPause = useCallback(() => {
        if (paused) return;
        setManualPaused((p) => !p);
    }, [paused]);

    const getPhotoFit = useCallback(
        (url?: string): "cover" | "contain" => {
            if (!url) return fit;

            const size = measuredSizes[url];
            if (!size?.width || !size?.height) return fit;

            const ratio = size.width / size.height;

            /** Landscape */
            if (ratio > 1.1) return "contain";

            /** Square / near-square */
            if (ratio >= 0.85 && ratio <= 1.1) return "contain";

            /** Extremely tall images from random sources */
            if (ratio < 0.7) return "contain";

            /** Normal portrait phone photos */
            return "cover";
        },
        [fit, measuredSizes]
    );

    if (!count) return null;

    const current = photos[clamp(index, 0, count - 1)];
    // const currentFit = getPhotoFit(current?.url);
    // const objectClass = currentFit === "contain" ? "object-contain" : "object-cover";
    const objectClass = "object-contain";
    const progressStyle =
        progressPosition === "top"
            ? { top: `${progressTopOffset}px` }
            : { bottom: `${isDesktop ? progressBottomOffset : 60}px` };

    return (
        <div
            className={`relative h-full w-full overflow-hidden bg-black select-none ${className ?? ""}`}
            onContextMenu={(e) => e.preventDefault()}
        >
            {!!current.previewUrl && !loadedMap[index] && (
                <img
                    src={current.previewUrl}
                    alt=""
                    aria-hidden
                    className={`absolute inset-0 h-full w-full ${objectClass} object-center scale-[1.03] blur-[14px] opacity-90`}
                    draggable={false}
                    decoding="async"
                />
            )}

            {!!prevUrl && prevUrl !== current.url && (
                <img
                    key={`prev:${prevUrl}`}
                    src={prevUrl}
                    alt=""
                    aria-hidden
                    className={`absolute inset-0 h-full w-full ${objectClass} object-center`}
                    draggable={false}
                    decoding="async"
                />
            )}

            <img
                key={`${index}:${current.url}`}
                src={current.url}
                alt=""
                className={`absolute inset-0 h-full w-full ${objectClass} object-center transition-opacity duration-300`}
                draggable={false}
                decoding="async"
                loading="eager"
                fetchPriority="high"
                onLoad={(e) => {
                    const img = e.currentTarget;
                    const naturalWidth = img.naturalWidth;
                    const naturalHeight = img.naturalHeight;

                    if (naturalWidth && naturalHeight) {
                        setMeasuredSizes((prev) => {
                            const existing = prev[current.url];
                            if (
                                existing &&
                                existing.width === naturalWidth &&
                                existing.height === naturalHeight
                            ) {
                                return prev;
                            }

                            return {
                                ...prev,
                                [current.url]: {
                                    width: naturalWidth,
                                    height: naturalHeight,
                                },
                            };
                        });
                    }

                    onSlideLoaded(index);
                }}
                onError={() => {
                    onLoadError?.(index, current.url);
                    onSlideLoaded(index);
                }}
            />

            <div className="absolute inset-0 z-20 flex">
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

            {isPaused && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                    <div className="rounded-full bg-black/35 px-4 py-3 backdrop-blur">
                        <IoPause className="text-white" size={18} />
                    </div>
                </div>
            )}

            {showAudioIndicator && !!audioUrl && !muted && (
                <div className="absolute right-3 top-3 z-40">
                    <div className="rounded-full bg-black/35 px-2.5 py-1 backdrop-blur">
                        <IoMusicalNotes className="text-white" size={13} />
                    </div>
                </div>
            )}

            {showProgress && count > 1 && (
                <div
                    className="absolute left-3 right-3 z-40 pointer-events-none"
                    style={progressStyle}
                >
                    <div className="rounded-full px-2 py-2">
                        <div className="flex items-center gap-1.5">
                            {photos.map((_, i) => {
                                const done = i < index;
                                const active = i === index;
                                const fill = done ? 1 : active ? progress : 0;

                                return (
                                    <div
                                        key={i}
                                        className="relative h-[4px] flex-1 overflow-hidden rounded-full bg-white/25"
                                    >
                                        <div
                                            className="absolute inset-y-0 left-0 bg-white"
                                            style={{
                                                width: `${fill * 100}%`,
                                                transition: active ? "none" : "width 120ms linear",
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PhotoSliderPlayer;