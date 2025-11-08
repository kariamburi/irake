"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Ekari brand (keep in sync with your page constants) */
const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
};

type Mode = "video" | "videoWithMusic" | "photo" | "photoWithMusic";

export type PreviewMixerProps = {
    /** Video blob/object URL (preferred in create mode) */
    videoUri?: string | null;
    /** If no video, you can pass a photo/thumb to simulate a timed preview */
    photoUri?: string | null;
    /** Optional poster to show before video starts */
    posterUri?: string | null;

    /** Optional music URL (external or uploaded blob/object URL) */
    musicUri?: string | null;

    /** Start delay for music relative to main timeline in ms (+ve = start later) */
    musicOffsetMs?: number;
    /** Linear 0..1 gain (UI can convert from dB outside) */
    musicGain01?: number;
    /** Video element volume (linear 0..1) */
    videoGain01?: number;

    /** Photo preview duration (seconds) when no video */
    photoDurationSec?: number;
    /** Loop playback */
    isLooping?: boolean;

    /** Controlled position (sec); if omitted, internal state drives it */
    positionSec?: number;
    onPositionSecChange?: (sec: number) => void;

    /** Show offset/gain controls inside the component */
    showControls?: boolean;
    onOffsetChange?: (ms: number) => void;
    onMusicGainChange?: (gain01: number) => void;
    onVideoGainChange?: (gain01: number) => void;

    /** Callback for play/pause toggles */
    onPlayState?: (playing: boolean) => void;

    /** UI */
    title?: string;
    aspect?: number; // default 9/16
};

export default function PreviewMixer({
    videoUri,
    photoUri,
    posterUri,
    musicUri,
    musicOffsetMs = 0,
    musicGain01 = 0.8,
    videoGain01 = 1,
    photoDurationSec = 8,
    isLooping = true,
    positionSec,
    onPositionSecChange,
    showControls = true,
    onOffsetChange,
    onMusicGainChange,
    onVideoGainChange,
    onPlayState,
    title = "Preview",
    aspect = 9 / 16,
}: PreviewMixerProps) {
    const mode: Mode = useMemo(() => {
        if (videoUri && musicUri) return "videoWithMusic";
        if (videoUri) return "video";
        if (photoUri && musicUri) return "photoWithMusic";
        return "photo";
    }, [videoUri, photoUri, musicUri]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const musicRef = useRef<HTMLAudioElement>(null);

    const [videoDurMs, setVideoDurMs] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [internalPosMs, setInternalPosMs] = useState(0);

    const mainDurationMs = useMemo(() => {
        if (mode === "video" || mode === "videoWithMusic") return Math.max(0, videoDurMs);
        return Math.max(0, Math.floor(photoDurationSec * 1000));
    }, [mode, videoDurMs, photoDurationSec]);

    const posMsControlled = useMemo(() => {
        if (typeof positionSec === "number" && Number.isFinite(positionSec)) {
            return Math.max(0, Math.min(mainDurationMs, Math.floor(positionSec * 1000)));
        }
        return internalPosMs;
    }, [positionSec, mainDurationMs, internalPosMs]);

    // attach volumes
    useEffect(() => {
        if (videoRef.current) videoRef.current.volume = clamp01(videoGain01);
    }, [videoGain01]);
    useEffect(() => {
        if (musicRef.current) musicRef.current.volume = clamp01(musicGain01);
    }, [musicGain01]);

    // load video metadata → duration
    const onLoadedMetadata = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;
        const dur = (v.duration || 0) * 1000;
        setVideoDurMs(isFinite(dur) ? Math.max(0, Math.floor(dur)) : 0);
    }, []);

    const pretty = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${m}:${r.toString().padStart(2, "0")}`;
    };

    const soundPosForMain = useCallback(
        (mainMs: number) => Math.max(0, mainMs - musicOffsetMs),
        [musicOffsetMs]
    );

    const play = useCallback(async () => {
        if (isPlaying) return;
        const startAtMain = posMsControlled;

        // seek both
        if (videoRef.current && (mode === "video" || mode === "videoWithMusic")) {
            try { videoRef.current.currentTime = startAtMain / 1000; } catch { }
        }
        if (musicRef.current && musicUri) {
            try { musicRef.current.currentTime = soundPosForMain(startAtMain) / 1000; } catch { }
        }

        const startVideo = async () => {
            if (!videoRef.current) return;
            try { await videoRef.current.play(); } catch { }
        };
        const startMusic = async () => {
            if (!musicRef.current) return;
            try { await musicRef.current.play(); } catch { }
        };

        // choreography
        if (!musicUri || mode === "video" || (mode === "photo" && !musicUri)) {
            if (mode === "video") await startVideo();
            setIsPlaying(true);
            onPlayState?.(true);
            return;
        }

        if (musicOffsetMs === 0) {
            await Promise.all([startVideo(), startMusic()]);
        } else if (musicOffsetMs > 0) {
            await startVideo();
            setTimeout(() => { startMusic(); }, musicOffsetMs);
        } else {
            await startMusic();
            setTimeout(() => { startVideo(); }, Math.abs(musicOffsetMs));
        }
        setIsPlaying(true);
        onPlayState?.(true);
    }, [isPlaying, posMsControlled, mode, musicUri, musicOffsetMs, onPlayState, soundPosForMain]);

    const pause = useCallback(async () => {
        if (!isPlaying) return;
        try { videoRef.current?.pause(); } catch { }
        try { musicRef.current?.pause(); } catch { }
        setIsPlaying(false);
        onPlayState?.(false);
    }, [isPlaying, onPlayState]);

    // RAF driver for UI (and photo timeline)
    useEffect(() => {
        let raf = 0;
        let startTs = 0;

        const loop = () => {
            let mainMsNow = internalPosMs;

            if (mode === "video" || mode === "videoWithMusic") {
                const v = videoRef.current;
                if (v && isFinite(v.currentTime)) {
                    mainMsNow = Math.max(0, Math.floor((v.currentTime || 0) * 1000));
                    // loop for video if needed (native loop handles media, we just mirror UI)
                    if (isLooping && v.ended) {
                        try { v.currentTime = 0; v.play(); } catch { }
                        if (musicRef.current && musicUri) {
                            try { musicRef.current.currentTime = soundPosForMain(0) / 1000; musicRef.current.play(); } catch { }
                        }
                    }
                }
            } else {
                // photo timeline is synthetic
                if (isPlaying) {
                    if (startTs === 0) startTs = Date.now() - internalPosMs;
                    mainMsNow = Date.now() - startTs;
                    if (mainMsNow > mainDurationMs) {
                        if (isLooping) {
                            startTs = Date.now();
                            mainMsNow = 0;
                            if (musicRef.current && musicUri) {
                                try { musicRef.current.currentTime = soundPosForMain(0) / 1000; } catch { }
                            }
                        } else {
                            mainMsNow = mainDurationMs;
                            setIsPlaying(false);
                            onPlayState?.(false);
                        }
                    }
                } else {
                    startTs = 0;
                }
            }

            if (typeof positionSec !== "number") setInternalPosMs(mainMsNow);
            else onPositionSecChange?.(mainMsNow / 1000);

            raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [
        mode, internalPosMs, isPlaying, mainDurationMs, isLooping,
        positionSec, onPositionSecChange, musicUri, soundPosForMain, onPlayState
    ]);

    // scrub
    const setMainPositionMs = useCallback((ms: number) => {
        const clamped = Math.max(0, Math.min(mainDurationMs, Math.floor(ms)));
        onPositionSecChange?.(clamped / 1000);
        if (typeof positionSec !== "number") setInternalPosMs(clamped);

        if (videoRef.current && (mode === "video" || mode === "videoWithMusic")) {
            try { videoRef.current.currentTime = clamped / 1000; } catch { }
        }
        if (musicRef.current && musicUri) {
            try { musicRef.current.currentTime = soundPosForMain(clamped) / 1000; } catch { }
        }
    }, [mainDurationMs, positionSec, mode, musicUri, soundPosForMain, onPositionSecChange]);

    return (
        <div className="w-full">
            {/* Media */}
            <div
                className="relative w-full overflow-hidden rounded-xl"
                style={{ backgroundColor: "#000", aspectRatio: String(aspect) }}
            >
                {(mode === "video" || mode === "videoWithMusic") ? (
                    <video
                        ref={videoRef}
                        src={videoUri || undefined}
                        poster={posterUri || undefined}
                        onLoadedMetadata={onLoadedMetadata}
                        playsInline
                        controls={false}
                        muted={false}
                        loop={isLooping}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="h-full w-full">
                        {photoUri ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photoUri} alt="Preview" className="h-full w-full object-cover" />
                        ) : null}
                    </div>
                )}

                {/* Hidden music element */}
                {musicUri ? (
                    <audio ref={musicRef} src={musicUri} preload="auto" loop={isLooping} />
                ) : null}
            </div>

            {/* Transport */}
            <div className="mt-3 flex items-center justify-between">
                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                    {pretty(posMsControlled)}
                </div>

                {!isPlaying ? (
                    <button
                        onClick={play}
                        className="rounded-lg px-4 py-2 text-sm font-extrabold text-white"
                        style={{ backgroundColor: EKARI.forest }}
                    >
                        Play
                    </button>
                ) : (
                    <button
                        onClick={pause}
                        className="rounded-lg px-4 py-2 text-sm font-extrabold text-white"
                        style={{ backgroundColor: EKARI.gold }}
                    >
                        Pause
                    </button>
                )}

                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                    {pretty(mainDurationMs)}
                </div>
            </div>

            {/* Scrubber (EKARI themed) */}
            <ThemedRange
                className="mt-2"
                min={0}
                max={Math.max(1, mainDurationMs)}
                step={10}
                value={posMsControlled}
                onChange={(v) => setMainPositionMs(v)}
                percent={toPercent(posMsControlled, 0, Math.max(1, mainDurationMs))}
            />

            {/* Music & Video controls */}
            {showControls && (
                <div className="mt-4 rounded-xl border p-3" style={{ borderColor: EKARI.hair, background: "#FFFFFF" }}>
                    <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>{title}</div>

                    {musicUri && (
                        <>
                            <div className="mt-3 text-xs font-bold" style={{ color: EKARI.text }}>
                                Music Offset: <span style={{ color: EKARI.dim }}>{Math.round(musicOffsetMs)} ms</span>
                            </div>
                            <ThemedRange
                                min={-5000} max={5000} step={50}
                                value={musicOffsetMs}
                                onChange={(v) => onOffsetChange?.(Math.round(v))}
                                percent={toPercent(musicOffsetMs, -5000, 5000)}
                            />

                            <div className="mt-3 text-xs font-bold" style={{ color: EKARI.text }}>
                                Music Gain: <span style={{ color: EKARI.dim }}>{Math.round(musicGain01 * 100)}%</span>
                            </div>
                            <ThemedRange
                                min={0} max={1} step={0.01}
                                value={musicGain01}
                                onChange={(v) => onMusicGainChange?.(clamp01(v))}
                                percent={toPercent(musicGain01, 0, 1)}
                            />
                        </>
                    )}

                    {(mode === "video" || mode === "videoWithMusic") && (
                        <>
                            <div className="mt-3 text-xs font-bold" style={{ color: EKARI.text }}>
                                Video Gain: <span style={{ color: EKARI.dim }}>{Math.round(videoGain01 * 100)}%</span>
                            </div>
                            <ThemedRange
                                min={0} max={1} step={0.01}
                                value={videoGain01}
                                onChange={(v) => onVideoGainChange?.(clamp01(v))}
                                percent={toPercent(videoGain01, 0, 1)}
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

/** EKARI-themed range input */
function ThemedRange({
    min, max, step, value, onChange, percent, className,
}: {
    min: number; max: number; step: number; value: number;
    onChange: (v: number) => void;
    percent: number;
    className?: string;
}) {
    return (
        <div className={className}>
            <input
                type="range"
                min={min} max={max} step={step}
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
                style={{
                    background: `linear-gradient(to right, ${EKARI.forest} 0% ${percent}%, ${EKARI.hair} ${percent}% 100%)`,
                } as React.CSSProperties}
            />
            <style jsx>{`
        input[type="range"]::-webkit-slider-thumb { background: ${EKARI.gold}; }
        input[type="range"]::-moz-range-thumb { background: ${EKARI.gold}; }
        input[type="range"]:focus-visible { box-shadow: 0 0 0 2px ${EKARI.forest}33; }
      `}</style>
        </div>
    );
}

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function toPercent(val: number, min: number, max: number) {
    if (max <= min) return 0;
    const p = ((val - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, p));
}
