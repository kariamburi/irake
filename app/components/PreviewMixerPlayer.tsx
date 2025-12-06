"use client";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

/* Brand */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
};

type Mode = "video" | "videoWithMusic" | "photo" | "photoWithMusic";

export type PreviewMixerPlayerProps = {
    /** Modal-style visibility flag (like ConfirmModal) */
    open?: boolean;
    /** Optional callback if you later want to close from inside */
    onClose?: () => void;

    videoUri?: string | null;
    photoUri?: string | null;
    posterUri?: string | null;
    musicUri?: string | null;
    musicOffsetMs?: number; // +ve = music starts later
    musicGain?: number; // 0..1
    videoGain?: number; // 0..1 (web-only knob)
    photoDurationSec?: number;
    isLooping?: boolean;

    positionSec?: number;
    onPositionSecChange?: (sec: number) => void;

    showControls?: boolean;
    onOffsetChange?: (ms: number) => void;
    onGainChange?: (gain01: number) => void; // music gain
    onVideoGainChange?: (gain01: number) => void; // video gain

    onPlayState?: (playing: boolean) => void;

    aspect?: number; // default 9/16
};

export default function PreviewMixerPlayer({
    open = true,
    onClose,

    videoUri,
    photoUri,
    posterUri,
    musicUri,
    musicOffsetMs = 0,
    musicGain = 0.8,
    videoGain = 1,
    photoDurationSec = 8,
    isLooping = true,

    positionSec,
    onPositionSecChange,

    showControls = true,
    onOffsetChange,
    onGainChange,
    onVideoGainChange,

    onPlayState,
    aspect = 9 / 16,
}: PreviewMixerPlayerProps) {
    const mode: Mode = useMemo(() => {
        if (videoUri && musicUri) return "videoWithMusic";
        if (videoUri) return "video";
        if (photoUri && musicUri) return "photoWithMusic";
        return "photo";
    }, [videoUri, photoUri, musicUri]);

    const vref = useRef<HTMLVideoElement>(null);
    const aref = useRef<HTMLAudioElement>(null);

    const [videoDurMs, setVideoDurMs] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [internalPosMs, setInternalPosMs] = useState(0);

    // Modal-like visibility state (ConfirmModal style)
    const [sheetVisible, setSheetVisible] = useState<boolean>(open);

    useEffect(() => {
        if (open) {
            const id = requestAnimationFrame(() => setSheetVisible(true));
            return () => cancelAnimationFrame(id);
        } else {
            setSheetVisible(false);
        }
    }, [open]);

    const mainDurationMs = useMemo(() => {
        if (mode === "video" || mode === "videoWithMusic") {
            return Math.max(0, videoDurMs);
        }
        return Math.max(0, Math.floor(photoDurationSec * 1000));
    }, [mode, videoDurMs, photoDurationSec]);

    const posMsControlled = useMemo(() => {
        if (typeof positionSec === "number" && isFinite(positionSec)) {
            return Math.max(
                0,
                Math.min(mainDurationMs, Math.floor(positionSec * 1000))
            );
        }
        return internalPosMs;
    }, [positionSec, mainDurationMs, internalPosMs]);

    // Volumes
    useEffect(() => {
        if (vref.current) vref.current.volume = clamp01(videoGain);
    }, [videoGain]);

    useEffect(() => {
        if (aref.current) aref.current.volume = clamp01(musicGain);
    }, [musicGain]);

    const onLoadedMetadata = useCallback(() => {
        const v = vref.current;
        if (!v) return;
        const d = (v.duration || 0) * 1000;
        setVideoDurMs(isFinite(d) ? Math.max(0, Math.floor(d)) : 0);
    }, []);

    const soundPosForMain = useCallback(
        (mainMs: number) => Math.max(0, mainMs - musicOffsetMs),
        [musicOffsetMs]
    );

    const play = useCallback(async () => {
        if (isPlaying) return;
        const startAt = posMsControlled;

        if (vref.current && (mode === "video" || mode === "videoWithMusic")) {
            try {
                vref.current.currentTime = startAt / 1000;
            } catch { }
        }
        if (aref.current && musicUri) {
            try {
                aref.current.currentTime = soundPosForMain(startAt) / 1000;
            } catch { }
        }

        const startVideo = async () => {
            try {
                await vref.current?.play();
            } catch { }
        };
        const startAudio = async () => {
            try {
                await aref.current?.play();
            } catch { }
        };

        // No music case or pure video
        if (!musicUri || mode === "video" || (mode === "photo" && !musicUri)) {
            if (mode === "video") await startVideo();
            setIsPlaying(true);
            onPlayState?.(true);
            return;
        }

        // With music
        if (musicOffsetMs === 0) {
            await Promise.all([startVideo(), startAudio()]);
        } else if (musicOffsetMs > 0) {
            await startVideo();
            setTimeout(() => {
                void startAudio();
            }, musicOffsetMs);
        } else {
            await startAudio();
            setTimeout(() => {
                void startVideo();
            }, Math.abs(musicOffsetMs));
        }
        setIsPlaying(true);
        onPlayState?.(true);
    }, [
        isPlaying,
        posMsControlled,
        mode,
        musicUri,
        musicOffsetMs,
        onPlayState,
        soundPosForMain,
    ]);

    const pause = useCallback(async () => {
        if (!isPlaying) return;
        try {
            vref.current?.pause();
        } catch { }
        try {
            aref.current?.pause();
        } catch { }
        setIsPlaying(false);
        onPlayState?.(false);
    }, [isPlaying, onPlayState]);

    // Progress / loop
    useEffect(() => {
        let raf = 0;
        let startTs = 0;

        const loop = () => {
            let now = internalPosMs;

            if (mode === "video" || mode === "videoWithMusic") {
                const v = vref.current;
                if (v && isFinite(v.currentTime)) {
                    now = Math.max(0, Math.floor(v.currentTime * 1000));
                    if (isLooping && v.ended) {
                        try {
                            v.currentTime = 0;
                            void v.play();
                        } catch { }
                        if (aref.current && musicUri) {
                            try {
                                aref.current.currentTime =
                                    soundPosForMain(0) / 1000;
                                void aref.current.play();
                            } catch { }
                        }
                    }
                }
            } else {
                if (isPlaying) {
                    if (startTs === 0)
                        startTs = Date.now() - internalPosMs;
                    now = Date.now() - startTs;
                    if (now > mainDurationMs) {
                        if (isLooping) {
                            startTs = Date.now();
                            now = 0;
                            if (aref.current && musicUri) {
                                try {
                                    aref.current.currentTime =
                                        soundPosForMain(0) / 1000;
                                } catch { }
                            }
                        } else {
                            now = mainDurationMs;
                            setIsPlaying(false);
                            onPlayState?.(false);
                        }
                    }
                } else {
                    startTs = 0;
                }
            }

            if (typeof positionSec !== "number") {
                setInternalPosMs(now);
            } else {
                onPositionSecChange?.(now / 1000);
            }

            raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [
        mode,
        internalPosMs,
        isPlaying,
        mainDurationMs,
        isLooping,
        positionSec,
        onPositionSecChange,
        musicUri,
        soundPosForMain,
        onPlayState,
    ]);

    const setMainPositionMs = useCallback(
        (ms: number) => {
            const clamped = Math.max(
                0,
                Math.min(mainDurationMs, Math.floor(ms))
            );
            onPositionSecChange?.(clamped / 1000);
            if (typeof positionSec !== "number") setInternalPosMs(clamped);

            if (
                vref.current &&
                (mode === "video" || mode === "videoWithMusic")
            ) {
                try {
                    vref.current.currentTime = clamped / 1000;
                } catch { }
            }
            if (aref.current && musicUri) {
                try {
                    aref.current.currentTime =
                        soundPosForMain(clamped) / 1000;
                } catch { }
            }
        },
        [
            mainDurationMs,
            positionSec,
            mode,
            musicUri,
            soundPosForMain,
            onPositionSecChange,
        ]
    );

    const pretty = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r.toString().padStart(2, "0")}`;
    };

    // If closed (ConfirmModal-style), render nothing
    if (!sheetVisible) return null;

    // --- RENDER
    return (
        <div className="w-full">
            {/* Stage: keeps aspect; expands but never overflows view */}
            <div
                className="relative mx-auto w-full overflow-hidden rounded-2xl"
                style={{
                    background: "#000",
                    aspectRatio: String(aspect),
                    maxHeight: "90svh",
                    height: "min(90svh, 800px)", // portrait-friendly
                }}
            >
                {mode === "video" || mode === "videoWithMusic" ? (
                    <video
                        ref={vref}
                        src={videoUri || undefined}
                        poster={posterUri || undefined}
                        onLoadedMetadata={onLoadedMetadata}
                        playsInline
                        controls={false}
                        muted={false}
                        loop={isLooping}
                        className="h-full w-full object-contain"
                    />
                ) : (
                    <div className="h-full w-full bg-black">
                        {photoUri && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={photoUri}
                                alt="preview"
                                className="h-full w-full object-contain"
                            />
                        )}
                    </div>
                )}

                {musicUri ? (
                    <audio
                        ref={aref}
                        src={musicUri}
                        preload="auto"
                        loop={isLooping}
                    />
                ) : null}

                {/* Center Play/Pause overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <button
                        type="button"
                        aria-label={isPlaying ? "Pause" : "Play"}
                        onClick={isPlaying ? pause : play}
                        className="pointer-events-auto h-16 w-16 rounded-full shadow-lg backdrop-blur-sm transition active:scale-95"
                        style={{
                            background: isPlaying
                                ? `${EKARI.gold}E6`
                                : `${EKARI.forest}E6`,
                            color: "#fff",
                            border: "2px solid #ffffff66",
                        }}
                    >
                        <PlayPauseIcon playing={isPlaying} />
                    </button>
                </div>

                {/* Bottom controls overlay */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
                    {musicUri ? (
                        <div className="mt-1 text-xs text-white/95">
                            <div>
                                Music Offset:{" "}
                                <span>{Math.round(musicOffsetMs)} ms</span>
                            </div>
                            <div>
                                Music Gain:{" "}
                                <span>{Math.round(musicGain * 100)}%</span>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-1 text-xs text-white/95">
                            <div className="mt-2 text-xs">
                                No music selected.
                            </div>
                        </div>
                    )}

                    {(mode === "video" || mode === "videoWithMusic") && (
                        <div className="mt-1 text-xs text-white/95">
                            Video Gain:{" "}
                            <span>
                                {Math.round((videoGain || 0) * 100)}%
                            </span>
                        </div>
                    )}

                    <div
                        className="rounded-xl px-3 pb-3 pt-2"
                        style={{
                            background:
                                "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.25), rgba(0,0,0,0))",
                        }}
                    >
                        <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-white/95">
                            <span>{pretty(posMsControlled)}</span>
                            <span>{pretty(mainDurationMs)}</span>
                        </div>

                        <ThemedRange
                            dark
                            className="pointer-events-auto"
                            min={0}
                            max={Math.max(1, mainDurationMs)}
                            step={10}
                            value={posMsControlled}
                            onChange={(v) => setMainPositionMs(v)}
                            percent={toPercent(
                                posMsControlled,
                                0,
                                Math.max(1, mainDurationMs)
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* External music/video controls panel (currently commented out) */}
            {/* 
            {showControls && (
                ...
            )} 
            */}
        </div>
    );
}

/* === Icons === */
function PlayPauseIcon({ playing }: { playing: boolean }) {
    if (!playing) {
        return (
            <svg
                viewBox="0 0 24 24"
                className="mx-auto h-6 w-6"
                fill="currentColor"
                role="img"
                aria-hidden="true"
            >
                <path d="M8 5v14l11-7z" />
            </svg>
        );
    }
    return (
        <svg
            viewBox="0 0 24 24"
            className="mx-auto h-6 w-6"
            fill="currentColor"
            role="img"
            aria-hidden="true"
        >
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
    );
}

/* Themed range (supports light or dark overlays) */
function ThemedRange({
    min,
    max,
    step,
    value,
    onChange,
    percent,
    className,
    dark = false,
}: {
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (v: number) => void;
    percent: number;
    className?: string;
    dark?: boolean;
}) {
    const trackBg = dark
        ? `linear-gradient(to right, ${EKARI.gold} ${percent}%, #ffffff33 ${percent} 100%)`
        : `linear-gradient(to right, ${EKARI.forest} 0% ${percent}%, ${EKARI.hair} ${percent}% 100%)`;

    return (
        <div className={className}>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className={[
                    "w-full h-2 rounded-full appearance-none cursor-pointer outline-none",
                    "focus-visible:ring-2 focus-visible:ring-offset-0",
                    "[&::-webkit-slider-runnable-track]:appearance-none",
                    "[&::-moz-range-track]:appearance-none",
                    "[&::-webkit-slider-thumb]:appearance-none",
                    "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
                    "[&::-webkit-slider-thumb]:rounded-full",
                    "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
                    "[&::-webkit-slider-thumb]:shadow",
                    "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4",
                    "[&::-moz-range-thumb]:rounded-full",
                    "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white",
                ].join(" ")}
                style={{ background: trackBg } as React.CSSProperties}
            />
            <style jsx>{`
                input[type="range"]::-webkit-slider-thumb {
                    background: ${EKARI.gold};
                }
                input[type="range"]::-moz-range-thumb {
                    background: ${EKARI.gold};
                }
                input[type="range"]:focus-visible {
                    box-shadow: 0 0 0 2px ${EKARI.forest}33;
                }
            `}</style>
        </div>
    );
}

function clamp01(v: number) {
    return Math.max(0, Math.min(1, v));
}

function toPercent(val: number, min: number, max: number) {
    if (max <= min) return 0;
    const p = ((val - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, p));
}
