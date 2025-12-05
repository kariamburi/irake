"use client";
import React, { useEffect, useMemo, useState } from "react";
import PreviewMixerPlayer from "./PreviewMixerPlayer";
import { IoClose, IoPlay } from "react-icons/io5";
import { createPortal } from "react-dom";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
};

export type PreviewMixerCardProps = {
    videoUri?: string | null;
    photoUri?: string | null;
    posterUri?: string | null;

    musicUri?: string | null;
    musicOffsetMs?: number;
    musicGain?: number;
    videoGain?: number;

    photoDurationSec?: number;
    isLooping?: boolean;

    title?: string;
    showControls?: boolean;
    onOffsetChange?: (ms: number) => void;
    onGainChange?: (gain01: number) => void;
    onVideoGainChange?: (gain01: number) => void;
};

export default function PreviewMixerCard({
    videoUri, photoUri, posterUri,
    musicUri, musicOffsetMs = 0, musicGain = 0.8, videoGain = 1,
    photoDurationSec = 8, isLooping = true,
    title = "Preview",
    showControls = true,
    onOffsetChange, onGainChange, onVideoGainChange,
}: PreviewMixerCardProps) {
    const [open, setOpen] = useState(false);
    const thumb = useMemo(() => posterUri || photoUri || undefined, [posterUri, photoUri]);
    const hasVideo = !!videoUri;

    // Lock body scroll when modal open
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [open]);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="w-[150px] overflow-hidden rounded-xl border text-left"
                style={{ borderColor: EKARI.hair, background: "#fff" }}
            >
                <div className="relative w-full" style={{ aspectRatio: "9 / 16", background: "#000" }}>
                    {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="thumb" className="h-full w-full object-cover" />
                    ) : <div className="h-full w-full" />}
                    {hasVideo && (
                        <div className="absolute bottom-2 right-2 rounded-full border px-2 py-1 text-xs text-white"
                            style={{ background: "rgba(0,0,0,0.45)", borderColor: "rgba(255,255,255,0.25)" }}>
                            <IoPlay />
                        </div>
                    )}
                </div>
                <div className="p-2">
                    <div className="truncate text-sm font-extrabold" style={{ color: EKARI.text }}>{title}</div>
                    {musicUri && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-white"
                            style={{ background: EKARI.forest }}>♪ Music</span>
                    )}
                </div>
            </button>

            {open && (
                createPortal(<div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm">
                    <div
                        className="relative w-[95vw] max-w-[900px] rounded-2xl p-3 shadow-xl"
                        style={{ maxHeight: "100svh" }}
                    >
                        {/* Floating Close (overlapping top-right) */}
                        <button
                            onClick={() => setOpen(false)}
                            aria-label="Close"
                            className={[
                                "absolute",
                                "z-[1000]",
                                // overlap corner a bit; adjust to taste:
                                "-top-3 -right-3",
                                "h-10 w-10 rounded-full",
                                "grid place-items-center",

                                "text-white",
                                "transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20",
                            ].join(" ")}
                            style={{
                                // background: EKARI.gold,
                                // respect safe areas (iOS notch)
                                insetInlineEnd: `max(0.75rem, env(safe-area-inset-right))`,
                                insetBlockStart: `max(0.75rem, env(safe-area-inset-top))`,
                            }}
                        >
                            <IoClose className="h-5 w-5" />
                        </button>

                        {/* Content scroll if controls exceed height, while stage never overflows */}
                        <div className="max-h-screen overflow-auto">
                            <PreviewMixerPlayer
                                videoUri={videoUri || undefined}
                                photoUri={!videoUri ? (photoUri || undefined) : undefined}
                                posterUri={posterUri || undefined}
                                musicUri={musicUri || undefined}
                                musicOffsetMs={musicOffsetMs}
                                musicGain={musicGain}
                                videoGain={videoGain}
                                photoDurationSec={photoDurationSec}
                                isLooping={isLooping}
                                showControls={showControls}
                                onOffsetChange={onOffsetChange}
                                onGainChange={onGainChange}
                                onVideoGainChange={onVideoGainChange}
                                aspect={9 / 16}
                            />
                        </div>
                    </div>
                </div>
                    ,
                    document.body)
            )}
        </>
    );
}
