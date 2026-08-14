"use client";

import React, { useEffect, useMemo, useState } from "react";
import { IoClose, IoPlay, IoExpandOutline } from "react-icons/io5";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import PreviewMixerPlayer from "./PreviewMixerPlayer";

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
    videoUri,
    photoUri,
    posterUri,
    musicUri,
    musicOffsetMs = 0,
    musicGain = 0.8,
    videoGain = 1,
    photoDurationSec = 8,
    isLooping = true,
    title = "Preview",
    showControls = true,
    onOffsetChange,
    onGainChange,
    onVideoGainChange,
}: PreviewMixerCardProps) {
    const [open, setOpen] = useState(false);

    const thumb = useMemo(
        () => posterUri || photoUri || undefined,
        [posterUri, photoUri]
    );

    const hasVideo = !!videoUri;

    useEffect(() => {
        if (!open) return;

        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    return (
        <>
            <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setOpen(true)}
                className="group w-[150px] overflow-hidden rounded-[16px] border border-[#DDD8CC] bg-[#FBFAF6] text-left shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
                <div
                    className="relative w-full overflow-hidden bg-black"
                    style={{ aspectRatio: "9 / 16" }}
                >
                    {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={thumb}
                            alt={title || "Preview"}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        />
                    ) : (
                        <div className="grid h-full w-full place-items-center text-white/30">
                            Preview
                        </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                    {hasVideo ? (
                        <span className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur">
                            <IoPlay size={13} />
                        </span>
                    ) : null}

                    <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur">
                        <IoExpandOutline size={14} />
                    </span>
                </div>

                {title ? (
                    <div className="px-3 py-2">
                        <div className="text-[10px] font-black text-slate-700">
                            {title}
                        </div>
                        <div className="mt-0.5 text-[8px] font-semibold text-slate-400">
                            Open full preview
                        </div>
                    </div>
                ) : null}
            </motion.button>

            {typeof document !== "undefined"
                ? createPortal(
                    <AnimatePresence>
                        {open ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
                            >
                                <button
                                    type="button"
                                    className="absolute inset-0"
                                    onClick={() => setOpen(false)}
                                    aria-label="Close preview"
                                />

                                <motion.div
                                    initial={{ opacity: 0, scale: 0.97, y: 8 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.98, y: 6 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 260,
                                        damping: 25,
                                    }}
                                    className="relative z-10 flex max-h-[96svh] w-full max-w-[900px] flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[#0B120E] shadow-2xl"
                                >
                                    <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3">
                                        <div>
                                            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                                                Deed studio
                                            </div>
                                            <div className="text-[11px] font-black text-white">
                                                Media preview
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setOpen(false)}
                                            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/[0.10]"
                                            aria-label="Close preview"
                                        >
                                            <IoClose size={17} />
                                        </button>
                                    </div>

                                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                                        <PreviewMixerPlayer
                                            videoUri={videoUri || undefined}
                                            photoUri={
                                                !videoUri
                                                    ? photoUri || undefined
                                                    : undefined
                                            }
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
                                </motion.div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>,
                    document.body
                )
                : null}
        </>
    );
}