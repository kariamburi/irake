"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    IoPause,
    IoPlay,
    IoVolumeHigh,
    IoVolumeMute,
} from "react-icons/io5";
import { Deed } from "../data/deedsFeedWeb";
import { DeedOverlayWeb } from "./DeedOverlayWeb";
import { useGlobalMuteWeb } from "../hooks/useGlobalMuteWeb";
import { useDeedEngagementWeb } from "../hooks/useDeedEngagementWeb";
import PhotoSliderPlayer from "@/app/components/PhotoSliderPlayer";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

type Props = {
    item: Deed;
    uid?: string | null;
    isActive: boolean;
    shouldLoad: boolean;
    shouldPreload?: boolean;
    commented?: boolean;
    onOpenComments?: (deedId: string) => void;
    dataSaverOn?: boolean;
    hlsMaxHeight?: number;
    loading?: boolean;
};

function getMuxSrc(playbackId?: string) {
    if (!playbackId) return null;
    return `https://stream.mux.com/${playbackId}.m3u8`;
}

function detectOrientationFromElement(
    width?: number | null,
    height?: number | null
): Deed["orientation"] {
    if (!width || !height) return null;
    if (width > height) return "landscape";
    if (height > width) return "portrait";
    return "square";
}

function getMediaFit(
    orientation: Deed["orientation"],
    aspectRatioValue?: number | null
): "cover" | "contain" {
    if (orientation === "portrait") return "cover";
    if (orientation === "landscape") return "contain";
    if (orientation === "square") return "contain";

    if (typeof aspectRatioValue === "number") {
        if (aspectRatioValue < 0.9) return "cover";
        if (aspectRatioValue > 1.1) return "contain";
        return "contain";
    }

    return "cover";
}

function getMediaStageClass() {
    return "absolute inset-0 flex items-center justify-center overflow-hidden bg-black";
}

function getMediaClass(fit: "cover" | "contain") {
    return fit === "cover"
        ? "block h-full w-full object-cover"
        : "block h-auto w-auto max-h-full max-w-full object-contain";
}

function formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

function clamp(n: number, min: number, max: number) {
    return Math.min(Math.max(n, min), max);
}

export function DeedVideoCardWeb({
    item,
    uid,
    isActive,
    shouldLoad,
    shouldPreload = false,
    commented = false,
    onOpenComments,
}: Props) {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const progressTrackRef = useRef<HTMLDivElement | null>(null);

    const [runtimeOrientation, setRuntimeOrientation] =
        useState<Deed["orientation"]>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [dragTime, setDragTime] = useState<number | null>(null);

    const [isBuffering, setIsBuffering] = useState(false);
    const [hasLoadedFrame, setHasLoadedFrame] = useState(false);

    // controls center icon visibility by user interaction, not autoplay
    const [showCenterControl, setShowCenterControl] = useState(true);

    const { muted, toggleMute } = useGlobalMuteWeb();

    const {
        liked,
        likeCount,
        commentedCount,
        saved,
        toggleLike,
        toggleSave,
        totalBookmarks,
        totalShares,
        share,
    } = useDeedEngagementWeb(item.id, uid);

    const isPhoto = item.type === "photo";
    const poster = item.posterUrl || item.media?.[0]?.thumbUrl || null;

    const videoSrc = useMemo(() => {
        return item.mediaUrl || getMuxSrc(item.muxPlaybackId || undefined);
    }, [item.mediaUrl, item.muxPlaybackId]);

    const sliderPhotos = useMemo(
        () =>
            Array.isArray(item.photoItems)
                ? item.photoItems.map((p) => ({
                    url: p.url,
                    previewUrl: p.previewUrl ?? null,
                }))
                : [],
        [item.photoItems]
    );

    const sliderAudioUrl = item.music?.url || undefined;
    const hasInDeedAudio = !isPhoto || !!sliderAudioUrl;

    const mediaOrientation = runtimeOrientation || item.orientation || null;
    const fit = getMediaFit(mediaOrientation, item.aspectRatioValue ?? null);
    const mediaClass = getMediaClass(fit);
    const mediaStageClass = getMediaStageClass();

    const displayedTime = isScrubbing && dragTime != null ? dragTime : currentTime;
    const progressPct =
        duration > 0 ? clamp((displayedTime / duration) * 100, 0, 100) : 0;

    useEffect(() => {
        const video = videoRef.current;
        if (!video || isPhoto) return;

        if (isActive) return;

        if (shouldPreload && shouldLoad) {
            try {
                video.load();
            } catch { }
        }
    }, [isActive, isPhoto, shouldLoad, shouldPreload, videoSrc]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = muted;
    }, [muted]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (!shouldLoad || isPhoto) {
            video.pause();
            setIsPlaying(false);
            setIsBuffering(false);
            setShowCenterControl(true);
            return;
        }

        video.muted = muted;

        if (isActive) {
            // autoplay active item, but DO NOT show pause button by default
            setIsBuffering(true);
            const p = video.play();

            if (p && typeof p.catch === "function") {
                p.then(() => {
                    setIsPlaying(true);
                    setShowCenterControl(false);
                }).catch(() => {
                    setIsPlaying(false);
                    setShowCenterControl(true);
                    setIsBuffering(false);
                });
            }
        } else {
            video.pause();
            setIsPlaying(false);
            setIsBuffering(false);
            setShowCenterControl(false);
        }
    }, [isActive, shouldLoad, isPhoto, muted]);

    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;

        setRuntimeOrientation(
            detectOrientationFromElement(video.videoWidth, video.videoHeight)
        );
        setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };

    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (!video || isScrubbing) return;
        setCurrentTime(video.currentTime || 0);
    };

    const handlePlay = () => {
        setIsPlaying(true);
        setIsBuffering(false);
        // hide pause icon during normal autoplay/play
        setShowCenterControl(false);
    };



    const handlePause = () => {
        setIsPlaying(false);
        setIsBuffering(false);
        // only when paused should center control be visible
        setShowCenterControl(true);
    };

    const handleWaiting = () => {
        setIsBuffering(true);
    };

    const handlePlaying = () => {
        setIsBuffering(false);
        setHasLoadedFrame(true);
    };

    const handleCanPlay = () => {
        setIsBuffering(false);
    };

    const handleLoadedData = () => {
        setHasLoadedFrame(true);
        setIsBuffering(false);
    };

    const requireAuth = (nextAction: () => void) => {
        if (!uid) {
            router.push("/getstarted?next=/deeds");
            return;
        }
        nextAction();
    };

    const onLikeClick = () => requireAuth(toggleLike);
    const onSaveClick = () => requireAuth(toggleSave);

    const onShareClick = async () => {
        await share({
            authorHandle: item.authorUsername ?? null,
            caption: item.text ?? null,
        });
    };

    const commonOverlayProps = {
        item,
        commented,
        liked,
        saved,
        muted,
        showMute: false,
        likeCount,
        commentCount: commentedCount,
        shareCount: totalShares,
        saveCount: totalBookmarks,
        onToggleLike: onLikeClick,
        onToggleSave: onSaveClick,
        onShare: onShareClick,
        onToggleMute: toggleMute,
        onOpenComments,
    };

    const togglePlayPause = async () => {
        const video = videoRef.current;
        if (!video) return;

        try {
            if (video.paused) {
                setIsBuffering(true);
                await video.play();
                setIsPlaying(true);
                setShowCenterControl(false);
            } else {
                video.pause();
                setIsPlaying(false);
                setShowCenterControl(true);
            }
        } catch {
            setIsBuffering(false);
            setIsPlaying(!video.paused);
            setShowCenterControl(video.paused);
        }
    };

    const handleMediaClick = async () => {
        if (isPhoto) return;
        await togglePlayPause();
    };

    const seekToClientX = (clientX: number) => {
        const track = progressTrackRef.current;
        const video = videoRef.current;
        if (!track || !video || !duration) return;

        const rect = track.getBoundingClientRect();
        const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
        const nextTime = pct * duration;
        setDragTime(nextTime);
        return nextTime;
    };

    const handleProgressPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (isPhoto) return;
        const track = progressTrackRef.current;
        if (!track) return;

        track.setPointerCapture?.(e.pointerId);
        setIsScrubbing(true);
        seekToClientX(e.clientX);
    };

    const handleProgressPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (!isScrubbing || isPhoto) return;
        seekToClientX(e.clientX);
    };

    const commitScrub = (clientX?: number) => {
        const video = videoRef.current;
        if (!video) {
            setIsScrubbing(false);
            setDragTime(null);
            return;
        }

        let nextTime = dragTime;
        if (typeof clientX === "number") {
            nextTime = seekToClientX(clientX) ?? nextTime;
        }

        if (typeof nextTime === "number" && Number.isFinite(nextTime)) {
            video.currentTime = nextTime;
            setCurrentTime(nextTime);
        }

        setIsScrubbing(false);
        setDragTime(null);
    };

    const handleProgressPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
        if (isPhoto) return;
        commitScrub(e.clientX);
    };

    if (isPhoto) {
        return (
            <article className="h-full w-full px-0 py-0 md:px-3 lg:px-4 md:py-2">
                <div className="relative h-full w-full overflow-hidden rounded-none bg-black md:rounded-2xl">
                    <div className={mediaStageClass}>
                        {sliderPhotos.length > 0 ? (
                            <PhotoSliderPlayer
                                photos={sliderPhotos}
                                audioUrl={sliderAudioUrl}
                                paused={!isActive || !shouldLoad}
                                muted={muted}
                                audioAllowed={isActive && shouldLoad}
                                showProgress={sliderPhotos.length > 1}
                                showAudioIndicator={false}
                                fit={fit}
                                className="h-full w-full"
                            />
                        ) : poster ? (
                            <img
                                src={poster}
                                alt={item.text || "Photo deed"}
                                className={mediaClass}
                                loading="eager"
                                style={
                                    fit === "contain"
                                        ? { maxWidth: "100%", maxHeight: "100%" }
                                        : undefined
                                }
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-sm text-white/70">
                                No image
                            </div>
                        )}
                    </div>

                    <DeedOverlayWeb {...commonOverlayProps} />
                </div>
            </article>
        );
    }

    return (
        <article className="h-full w-full px-0 py-0 md:px-3 lg:px-4 md:py-2">
            <div className="relative h-full w-full overflow-hidden rounded-none bg-black md:rounded-2xl">
                <button
                    type="button"
                    onClick={handleMediaClick}
                    className="absolute inset-0 z-[5] block cursor-pointer bg-transparent"
                    aria-label={isPlaying ? "Pause video" : "Play video"}
                />

                <div className={mediaStageClass}>
                    {!shouldLoad ? (
                        <>
                            {poster ? (
                                <img
                                    src={poster}
                                    alt={item.text || "Video poster"}
                                    className={mediaClass}
                                    loading="eager"
                                    style={
                                        fit === "contain"
                                            ? { maxWidth: "100%", maxHeight: "100%" }
                                            : undefined
                                    }
                                />
                            ) : (
                                <div className="h-full w-full bg-black" />
                            )}
                        </>
                    ) : (
                        <video
                            ref={videoRef}
                            className={mediaClass}
                            src={videoSrc ?? undefined}
                            poster={poster ?? undefined}
                            muted={muted}
                            loop
                            playsInline
                            preload={isActive ? "auto" : shouldPreload ? "auto" : "metadata"}
                            controls={false}
                            onLoadedMetadata={handleLoadedMetadata}
                            onLoadedData={handleLoadedData}
                            onCanPlay={handleCanPlay}
                            onWaiting={handleWaiting}
                            onPlaying={handlePlaying}
                            onTimeUpdate={handleTimeUpdate}
                            onPlay={handlePlay}
                            onPause={handlePause}
                            style={
                                fit === "contain"
                                    ? { maxWidth: "100%", maxHeight: "100%" }
                                    : undefined
                            }
                        />
                    )}
                </div>

                {shouldLoad && isBuffering && (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                        <div className="rounded-full bg-black/35 px-4 py-3 backdrop-blur-sm">
                            <BouncingBallLoader />
                        </div>
                    </div>
                )}

                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    {showCenterControl && !isBuffering && (
                        <button
                            type="button"
                            onClick={togglePlayPause}
                            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full bg-black/20 text-white backdrop-blur-sm transition hover:bg-black/30"
                            aria-label={isPlaying ? "Pause video" : "Play video"}
                        >
                            {isPlaying ? <IoPause size={28} /> : <IoPlay size={28} />}
                        </button>
                    )}
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
                    <div className="pointer-events-auto px-4 pb-[50px] lg:pb-0">
                        <div className="rounded-2xl bg-transparent px-2 py-1">
                            <div className="flex items-center gap-2">
                                {hasInDeedAudio ? (
                                    <div className="pointer-events-none z-30">
                                        <button
                                            type="button"
                                            onClick={toggleMute}
                                            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full text-white transition hover:bg-black/30"
                                            aria-label={muted ? "Unmute audio" : "Mute audio"}
                                            title={muted ? "Unmute" : "Mute"}
                                        >
                                            {muted ? (
                                                <IoVolumeMute size={20} />
                                            ) : (
                                                <IoVolumeHigh size={20} />
                                            )}
                                        </button>
                                    </div>
                                ) : null}

                                <span className="w-[40px] shrink-0 text-[11px] font-semibold text-white/90">
                                    {formatTime(displayedTime)}
                                </span>

                                <div
                                    ref={progressTrackRef}
                                    className="relative h-4 flex-1 cursor-pointer touch-none"
                                    onPointerDown={handleProgressPointerDown}
                                    onPointerMove={handleProgressPointerMove}
                                    onPointerUp={handleProgressPointerUp}
                                    onPointerCancel={() => commitScrub()}
                                >
                                    <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/25" />
                                    <div
                                        className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                    <div
                                        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                                        style={{ left: `${progressPct}%` }}
                                    />
                                </div>

                                <span className="w-[40px] shrink-0 text-right text-[11px] font-semibold text-white/90">
                                    {formatTime(duration)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <DeedOverlayWeb {...commonOverlayProps} />
            </div>
        </article>
    );
}