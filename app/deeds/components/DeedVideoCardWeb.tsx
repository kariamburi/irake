"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Hls from "hls.js";
import {
    IoPause,
    IoPlay,
    IoVolumeHigh,
    IoVolumeMute,
} from "react-icons/io5";
import { Deed } from "../data/deedsFeedWeb";
import { DeedOverlayWeb } from "./DeedOverlayWeb";
import DeedContextOverlay from "./DeedContextOverlay";
import { useGlobalMuteWeb } from "../hooks/useGlobalMuteWeb";
import { useDeedEngagementWeb } from "../hooks/useDeedEngagementWeb";
import PhotoSliderPlayer from "@/app/components/PhotoSliderPlayer";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { DonateDialogWeb } from "@/app/components/DonateDialogWeb";
import { useRecordDeedViewWeb } from "@/app/hooks/useRecordDeedViewWeb";

type Props = {
    item: Deed;
    uid?: string | null;
    isActive: boolean;
    shouldLoad: boolean;
    shouldPreload?: boolean;
    commented?: boolean;
    onOpenComments?: (deedId: string) => void;
    onSupportClick?: (deedId: Deed) => void;
    onUserBlocked?: (authorId: string) => void;
    dataSaverOn?: boolean;
    hlsMaxHeight?: number;
    loading?: boolean;
    isSuspended?: boolean;
    suspendedReason?: string | null;
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
    // Desktop mock uses edge-to-edge media. Keep arguments for future rules.
    void orientation;
    void aspectRatioValue;
    return "cover";
}

function getMediaStageClass() {
    return "absolute inset-0 overflow-hidden bg-[#102718]";
}

function getMediaClass(fit: "cover" | "contain") {
    return [
        "block h-full w-full",
        fit === "cover" ? "object-cover" : "object-contain",
    ].join(" ");
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
    onSupportClick,
    onUserBlocked,
    isSuspended,
    suspendedReason,

}: Props) {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<Hls | null>(null);
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

    const engagementEnabled = isActive && shouldLoad;

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
    } = useDeedEngagementWeb(
        engagementEnabled ? item.id : "",
        engagementEnabled ? uid : null
    );

    useRecordDeedViewWeb({
        deedId: item.id,
        authorId: item.authorId,
        viewerId: uid || null,
        isActive,
        shouldLoad,
    });
    const isPhoto = item.type === "photo";
    const poster = item.posterUrl || item.media?.[0]?.thumbUrl || null;

    const videoSrc = useMemo(() => {
        if (item.muxPlaybackId) {
            return getMuxSrc(item.muxPlaybackId);
        }

        return item.mediaUrl || null;
    }, [item.muxPlaybackId, item.mediaUrl]);

    const isHlsSource = useMemo(() => {
        return !!videoSrc && /\.m3u8($|\?)/i.test(videoSrc);
    }, [videoSrc]);

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

    // Keep mute state in sync without rebuilding the HLS instance.
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = muted;
    }, [muted]);

    // Attach the media source. This effect only changes when the deed/source changes.
    useEffect(() => {
        const video = videoRef.current;

        if (!video || isPhoto || !shouldLoad || !videoSrc) {
            return;
        }

        let cancelled = false;

        // Clean up any previous HLS instance before attaching a new source.
        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }

        setIsBuffering(true);
        setHasLoadedFrame(false);
        setCurrentTime(0);
        setDuration(0);

        // Direct MP4 / normal browser-supported URL.
        if (!isHlsSource) {
            video.src = videoSrc;
            video.load();

            return () => {
                cancelled = true;
                video.pause();
                video.removeAttribute("src");
                video.load();
            };
        }

        // Prefer hls.js first on Chrome / Edge / Firefox.
        // Safari normally falls through to native HLS because Hls.isSupported()
        // may be false when Media Source Extensions are unavailable/unsuitable.
        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                startLevel: -1,
                maxBufferLength: 20,
                maxMaxBufferLength: 30,
            });

            hlsRef.current = hls;

            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                if (cancelled) return;

                console.log("DEED_HLS_MEDIA_ATTACHED", {
                    deedId: item.id,
                    videoSrc,
                });

                hls.loadSource(videoSrc);
            });

            hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
                if (cancelled) return;

                console.log("DEED_HLS_MANIFEST_PARSED", {
                    deedId: item.id,
                    videoSrc,
                    levels: data.levels?.length ?? 0,
                });

                setIsBuffering(false);
            });

            hls.on(Hls.Events.LEVEL_LOADED, () => {
                if (cancelled) return;
                setIsBuffering(false);
            });

            hls.on(Hls.Events.FRAG_BUFFERED, () => {
                if (cancelled) return;
                setHasLoadedFrame(true);
                setIsBuffering(false);
            });

            hls.on(Hls.Events.ERROR, (_event, data) => {
                console.error("DEED_HLS_ERROR", {
                    deedId: item.id,
                    muxPlaybackId: item.muxPlaybackId,
                    mediaUrl: item.mediaUrl,
                    videoSrc,
                    type: data.type,
                    details: data.details,
                    fatal: data.fatal,
                    responseCode: (data as any)?.response?.code,
                    responseText: (data as any)?.response?.text,
                    url: (data as any)?.url,
                    errorMessage: data.error?.message,
                });

                if (!data.fatal) return;

                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;

                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;

                    default:
                        hls.destroy();

                        if (hlsRef.current === hls) {
                            hlsRef.current = null;
                        }

                        setIsBuffering(false);
                        setShowCenterControl(true);
                        break;
                }
            });

            hls.attachMedia(video);

            return () => {
                cancelled = true;
                video.pause();
                hls.destroy();

                if (hlsRef.current === hls) {
                    hlsRef.current = null;
                }
            };
        }

        // Native HLS fallback, mainly Safari / iOS.
        const nativeHls =
            video.canPlayType("application/vnd.apple.mpegurl") ||
            video.canPlayType("application/x-mpegURL");

        if (nativeHls) {
            console.log("DEED_NATIVE_HLS", {
                deedId: item.id,
                videoSrc,
                nativeHls,
            });

            video.src = videoSrc;
            video.load();

            return () => {
                cancelled = true;
                video.pause();
                video.removeAttribute("src");
                video.load();
            };
        }

        console.error("DEED_VIDEO_UNSUPPORTED", {
            deedId: item.id,
            muxPlaybackId: item.muxPlaybackId,
            mediaUrl: item.mediaUrl,
            videoSrc,
        });

        setIsBuffering(false);
        setShowCenterControl(true);

        return () => {
            cancelled = true;
        };
    }, [
        item.id,
        item.mediaUrl,
        item.muxPlaybackId,
        isPhoto,
        shouldLoad,
        videoSrc,
        isHlsSource,
    ]);

    // Play/pause the already-attached source when the deed becomes active/inactive.
    useEffect(() => {
        const video = videoRef.current;
        if (!video || isPhoto || !shouldLoad) return;

        let cancelled = false;

        const syncPlayback = async () => {
            if (!isActive) {
                video.pause();

                if (!cancelled) {
                    setIsPlaying(false);
                    setIsBuffering(false);
                    setShowCenterControl(false);
                }

                return;
            }

            try {
                video.muted = muted;

                // If HLS is still attaching/loading, play() may reject temporarily.
                // canplay/playing will update state when the media becomes ready.
                setIsBuffering(true);

                await video.play();

                if (cancelled) return;

                setIsPlaying(true);
                setShowCenterControl(false);
                setIsBuffering(false);
            } catch (error) {
                if (cancelled) return;

                console.warn("DEED_AUTOPLAY_NOT_READY", {
                    deedId: item.id,
                    muxPlaybackId: item.muxPlaybackId,
                    videoSrc,
                    currentSrc: video.currentSrc,
                    readyState: video.readyState,
                    networkState: video.networkState,
                    errorName: error instanceof Error ? error.name : String(error),
                    errorMessage: error instanceof Error ? error.message : String(error),
                });

                setIsPlaying(false);
                setShowCenterControl(true);
                setIsBuffering(false);
            }
        };

        void syncPlayback();

        const onCanPlay = () => {
            if (!cancelled && isActive && video.paused) {
                void syncPlayback();
            }
        };

        video.addEventListener("canplay", onCanPlay);

        return () => {
            cancelled = true;
            video.removeEventListener("canplay", onCanPlay);
        };
    }, [
        isActive,
        isPhoto,
        shouldLoad,
        muted,
        item.id,
        item.muxPlaybackId,
        videoSrc,
    ]);

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

    const canSupport = !!uid && uid !== item.authorId;

    const handleSupport = () => {
        if (!canSupport) return;
        if (!uid) {
            router.push("/getstarted?next=/deeds");
            return;
        }
        onSupportClick?.(item);
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
        uid,
        item,
        commented: engagementEnabled ? commented : false,
        liked: engagementEnabled ? liked : false,
        saved: engagementEnabled ? saved : false,
        muted,
        showMute: false,

        likeCount: engagementEnabled ? likeCount : item.stats?.likes ?? 0,
        commentCount: engagementEnabled ? commentedCount : item.stats?.comments ?? 0,
        shareCount: engagementEnabled ? totalShares : item.stats?.shares ?? 0,
        saveCount: engagementEnabled
            ? totalBookmarks
            : item.stats?.saves ?? item.stats?.bookmarks ?? 0,

        onToggleLike: onLikeClick,
        onToggleSave: onSaveClick,
        onShare: onShareClick,
        onToggleMute: toggleMute,
        onOpenComments,
    };

    const togglePlayPause = async () => {
        const video = videoRef.current;

        if (!video) {
            console.error("DEED_PLAY_NO_VIDEO_ELEMENT", {
                deedId: item.id,
            });
            return;
        }

        console.log("DEED_PLAY_CLICK", {
            deedId: item.id,
            muxPlaybackId: item.muxPlaybackId,
            mediaUrl: item.mediaUrl,
            videoSrc,
            isHlsSource,
            paused: video.paused,
            currentSrc: video.currentSrc,
            readyState: video.readyState,
            networkState: video.networkState,
            mediaErrorCode: video.error?.code ?? null,
            mediaErrorMessage: video.error?.message ?? null,
        });

        try {
            if (video.paused) {
                video.muted = muted;
                setIsBuffering(true);

                await video.play();

                setIsPlaying(true);
                setShowCenterControl(false);
                setIsBuffering(false);
            } else {
                video.pause();
                setIsPlaying(false);
                setShowCenterControl(true);
                setIsBuffering(false);
            }
        } catch (error) {
            console.error("DEED_MANUAL_PLAY_FAILED", {
                deedId: item.id,
                muxPlaybackId: item.muxPlaybackId,
                mediaUrl: item.mediaUrl,
                videoSrc,
                currentSrc: video.currentSrc,
                readyState: video.readyState,
                networkState: video.networkState,
                mediaErrorCode: video.error?.code ?? null,
                mediaErrorMessage: video.error?.message ?? null,
                errorName: error instanceof Error ? error.name : String(error),
                errorMessage: error instanceof Error ? error.message : String(error),
            });

            setIsBuffering(false);
            setIsPlaying(false);
            setShowCenterControl(true);
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
            <article className="h-full w-full">
                <div className="relative h-full w-full overflow-hidden bg-[#102718]">
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
                                        ? {
                                            maxWidth: "100%",
                                            maxHeight: "100%",
                                        }
                                        : undefined
                                }
                            />
                        ) : (
                            <div className="grid h-full w-full place-items-center text-sm text-white/70">
                                No image
                            </div>
                        )}
                    </div>

                    {/* Photo slider audio mute/unmute button */}
                    {!!sliderAudioUrl && shouldLoad && (
                        <div className="pointer-events-none absolute bottom-[50px] left-4 z-30 lg:bottom-2">
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    toggleMute();
                                }}
                                className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/40"
                                aria-label={
                                    muted
                                        ? "Unmute photo audio"
                                        : "Mute photo audio"
                                }
                                title={muted ? "Unmute" : "Mute"}
                            >
                                {muted ? (
                                    <IoVolumeMute size={20} />
                                ) : (
                                    <IoVolumeHigh size={20} />
                                )}
                            </button>
                        </div>
                    )}

                    <DeedContextOverlay
                        deed={item}
                        isActive={isActive}
                    />

                    <DeedOverlayWeb
                        {...commonOverlayProps}
                        canSupport={canSupport}
                        onSupportClick={handleSupport}
                        onUserBlocked={onUserBlocked}
                        isSuspended={isSuspended}
                        suspendedReason={suspendedReason}
                    />
                </div>
            </article>
        );
    }

    return (
        <article className="h-full w-full">
            <div className="relative h-full w-full overflow-hidden bg-[#102718]">
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
                            onError={(event) => {
                                const video = event.currentTarget;
                                const code = video.error?.code ?? 0;
                                const message = video.error?.message || "Unknown media error";

                                console.error(
                                    [
                                        "DEED_VIDEO_ELEMENT_ERROR",
                                        `deedId=${item.id}`,
                                        `muxPlaybackId=${item.muxPlaybackId ?? "none"}`,
                                        `videoSrc=${videoSrc ?? "none"}`,
                                        `currentSrc=${video.currentSrc || "none"}`,
                                        `code=${code}`,
                                        `message=${message}`,
                                        `networkState=${video.networkState}`,
                                        `readyState=${video.readyState}`,
                                    ].join(" | ")
                                );
                            }}
                            style={{
                                width: "100%",
                                height: "100%",
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                            }}
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

                <DeedContextOverlay
                    deed={item}
                    isActive={isActive}
                />

                <DeedOverlayWeb
                    {...commonOverlayProps}
                    canSupport={canSupport}
                    onSupportClick={handleSupport}
                    onUserBlocked={onUserBlocked}
                    isSuspended={isSuspended}
                    suspendedReason={suspendedReason}
                />

            </div>
        </article>
    );
}