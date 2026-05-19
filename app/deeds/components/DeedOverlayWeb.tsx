"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    IoAdd,
    IoImageOutline,
    IoMusicalNotesOutline,
} from "react-icons/io5";

import { cn } from "@/lib/utils";
import { Deed } from "../data/deedsFeedWeb";
import { DeedActionRailWeb } from "./DeedActionRailWeb";
import SmartAvatar from "@/app/components/SmartAvatar";
import { AuthorBadgePill } from "@/app/components/AuthorBadgePill";
import EkariAvatar from "@/app/components/EkariAvatar";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Props = {
    item: Deed;
    commented?: boolean;
    liked: boolean;
    saved: boolean;
    muted?: boolean;
    showMute?: boolean;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    saveCount: number;
    uid?: string | null;
    onToggleLike: () => void;
    onToggleSave: () => void;
    onShare: () => void;
    onToggleMute?: () => void;
    onOpenComments?: (deedId: string) => void;
    onUserBlocked?: (authorId: string) => void;
    canSupport?: boolean;
    onSupportClick?: () => void;

    isMobile?: boolean;
    mediaReady?: boolean;

    avatar?: string | null;
    followersCount?: number;
    timeAgo?: string | null;
    timeTitle?: string | null;

    showFollow?: boolean;
    onFollowClick?: () => void;
    isSuspended?: boolean;
    suspendedReason?: string | null;
    authorProfile?: {
        handle?: string | null;
    } | null;
};

function getSoundLabel(item: Deed) {
    const music = (item as any)?.music;
    const title = music?.title?.trim?.();
    const artist = music?.artist?.trim?.();

    if (title && artist) return `${title} • ${artist}`;
    if (title) return title;
    if (artist) return artist;
    return "Original sound";
}

function getAuthorHandle(item: Deed, authorProfile?: { handle?: string | null } | null) {
    const raw =
        authorProfile?.handle?.trim?.() ||
        (item.authorUsername || "").trim() ||
        "";

    if (!raw) return "@unknown";
    return raw.startsWith("@") ? raw : `@${raw}`;
}

function getCaption(item: Deed) {
    return (item.text || "").trim();
}

function formatCount(value?: number) {
    const n = Number(value || 0);

    if (n >= 1_000_000) {
        const v = n / 1_000_000;
        return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
    }

    if (n >= 1_000) {
        const v = n / 1_000;
        return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}K`;
    }

    return `${n}`;
}

function getPhotoCount(item: Deed) {
    if (Array.isArray((item as any)?.photoItems) && (item as any).photoItems.length > 0) {
        return (item as any).photoItems.length;
    }

    if (Array.isArray((item as any)?.media) && (item as any).media.length > 0) {
        const onlyImages = (item as any).media.filter((m: any) => {
            const kind = String(m?.kind || m?.mediaType || "").toLowerCase();
            return kind === "image" || kind === "photo";
        });
        if (onlyImages.length > 0) return onlyImages.length;
    }

    return 1;
}

function hasMusic(item: Deed) {
    const music = (item as any)?.music;
    return !!(
        music?.url ||
        music?.title ||
        music?.artist ||
        music?.coverUrl
    );
}

export function DeedOverlayWeb({
    item,
    commented = false,
    liked,
    saved,
    muted = true,
    showMute = false,
    likeCount,
    commentCount,
    shareCount,
    saveCount,
    onToggleLike,
    onToggleSave,
    onShare,
    onToggleMute,
    onOpenComments,
    canSupport = false,
    onSupportClick,
    isMobile = false,
    mediaReady = true,
    avatar,
    followersCount = 0,
    timeAgo,
    timeTitle,
    showFollow = false,
    onFollowClick,
    onUserBlocked,
    isSuspended,
    suspendedReason,
    authorProfile = null,
    uid = null,
}: Props) {
    const router = useRouter();
    const [captionExpanded, setCaptionExpanded] = useState(false);

    const caption = getCaption(item);
    const soundLabel = getSoundLabel(item);

    const soundCover = (item as any)?.music?.coverUrl || null;
    const soundAvatar = soundCover || "";
    const isLibrarySound = !!soundCover;

    const isPhotoDeed = item.type === "photo";
    const deedHasMusic = hasMusic(item);
    const photoCount = getPhotoCount(item);

    const shouldShowSoundRow = !isPhotoDeed || deedHasMusic;
    const shouldShowPhotoMetaRow = isPhotoDeed && !deedHasMusic;
    const [actionsOpen, setActionsOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [hiddenBecauseBlocked, setHiddenBecauseBlocked] = useState(false);
    const [successOpen, setSuccessOpen] = useState(false);
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
    const isOwnPost = !!uid && uid === item.authorId;
    const [suspendedOpen, setSuspendedOpen] = useState(false);
    const reportReasons = [
        "Spam",
        "Fraud / Scam",
        "Abuse / Harassment",
        "Inappropriate content",
        "Illegal goods or services",
        "Other",
    ];
    const tags = useMemo(() => {
        const raw = (item as any)?.tags;
        if (!Array.isArray(raw)) return [];
        return raw
            .map((tag: any) => String(tag || "").trim().replace(/^#/, ""))
            .filter(Boolean);
    }, [item]);

    const hasCaption = !!caption;
    const hasTags = tags.length > 0;
    const visibleTags = captionExpanded ? tags : tags.slice(0, 3);
    const showMoreToggle =
        (hasCaption && caption.length > 120) || tags.length > 3;

    const displayAvatar = avatar || item.authorPhotoURL || "";
    const authorHandle = getAuthorHandle(item, authorProfile);
    const onViewProfileClick = () => {
        const raw = (authorProfile?.handle || item.authorUsername || "").trim();
        if (!raw) return;
        const clean = raw.startsWith("@") ? raw : `@${raw}`;
        router.push(`/${clean}`);

    };
    const requireLogin = () => {
        if (!uid) {
            router.push("/getstarted?next=/deeds");
            return false;
        }
        return true;
    };
    const requireActiveAccount = (nextAction: () => void) => {
        if (!requireLogin()) return;

        if (isSuspended) {
            setSuspendedOpen(true);
            return;
        }

        nextAction();
    };
    const submitReport = async () => {
        if (!requireLogin()) return;
        if (!reportReason) return;

        setBusy(true);

        try {
            await addDoc(collection(db, "reports"), {
                type: "deed",
                deedId: item.id,
                reportedUserId: item.authorId,
                reportedBy: uid,
                reason: reportReason,
                status: "open",
                source: "web_app",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                deedSnapshot: {
                    text: item.text || "",
                    authorUsername: item.authorUsername || null,
                    mediaType: item.mediaType || item.type || null,
                },
            });

            setReportOpen(false);
            setActionsOpen(false);
            setReportReason("");
            setSuccessOpen(true);

        } finally {
            setBusy(false);
        }
    };
    const blockUser = async () => {
        if (!requireLogin()) return;
        if (!item.authorId || isOwnPost) return;

        setBusy(true);

        try {
            const blockId = `${uid}_${item.authorId}`;

            await setDoc(
                doc(db, "blocks", blockId),
                {
                    blockerId: uid,
                    blockedUserId: item.authorId,
                    blockedUserHandle: item.authorUsername || null,
                    source: "web_app",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );

            await addDoc(collection(db, "reports"), {
                type: "user_block",
                deedId: item.id,
                reportedUserId: item.authorId,
                reportedBy: uid,
                reason: "Blocked user from deed menu",
                status: "open",
                source: "web_app",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            setHiddenBecauseBlocked(true);
            setActionsOpen(false);
            onUserBlocked?.(item.authorId);
        } finally {
            setBusy(false);
        }
    };



    return (
        <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-black/8 md:from-black/72 md:via-black/10 md:to-transparent" />

            <div className="pointer-events-none absolute inset-0 z-20 md:hidden">
                <div className="pointer-events-auto absolute bottom-[104px] right-2 flex flex-col items-center gap-3">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                if (onViewProfileClick) {
                                    onViewProfileClick();
                                    return;
                                }

                                const raw = (authorProfile?.handle || item.authorUsername || "").trim();
                                if (!raw) return;
                                const clean = raw.startsWith("@") ? raw : `@${raw}`;
                                router.push(`/${clean}`);
                            }}
                            className="group"
                            aria-label="Open author profile"
                        >
                            <EkariAvatar
                                src={displayAvatar}
                                alt={authorHandle || "Author"}
                                handle={authorHandle}
                                size={56}
                            />
                        </button>

                        {showFollow ? (
                            <button
                                type="button"
                                onClick={() => requireActiveAccount(() => onFollowClick?.())}
                                aria-label="Follow creator"
                                title="Follow"
                                className="absolute left-1/2 top-full z-10 mt-[-10px] grid h-6 w-6 -translate-x-1/2 -translate-y-[30%] place-items-center rounded-full border-2 border-white bg-[#C79257] text-white shadow-md transition hover:scale-105 active:scale-95"
                            >
                                <IoAdd size={16} />
                            </button>
                        ) : null}
                    </div>

                    <DeedActionRailWeb
                        liked={liked}
                        variant="overlay"
                        commented={commented}
                        saved={saved}
                        muted={muted}
                        showMute={showMute}
                        likeCount={likeCount}
                        commentCount={commentCount}
                        shareCount={shareCount}
                        saveCount={saveCount}
                        onToggleMute={onToggleMute}
                        canSupport={canSupport}
                        onToggleLike={() => requireActiveAccount(onToggleLike)}
                        onOpenComments={() => requireActiveAccount(() => onOpenComments?.(item.id))}
                        onShare={() => requireActiveAccount(onShare)}
                        onToggleSave={() => requireActiveAccount(onToggleSave)}
                        onSupportClick={() => requireActiveAccount(() => onSupportClick?.())}
                        onMoreClick={() => { setActionsOpen(true); }}
                    />
                </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
                <div
                    className={cn(
                        "absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-opacity duration-200",
                        mediaReady ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                />

                <div
                    className={cn(
                        "relative",
                        isMobile
                            ? "p-4 pb-16 pr-[72px]"
                            : "p-4 pb-20 pr-[58px] md:pb-10"
                    )}
                >
                    <div className="pointer-events-auto mb-2 lg:mb-0 max-w-[min(560px,calc(100%-24px))] text-white">
                        <div className="mb-2 flex items-center gap-2">
                            <div
                                onClick={() => onViewProfileClick()}
                                className={cn(
                                    "relative shrink-0 overflow-hidden rounded-full bg-gray-200 cursor-pointer"
                                )}
                                role={"button"}
                                tabIndex={0}
                                onKeyDown={(e) => {

                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onViewProfileClick();
                                    }
                                }}
                            >
                                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#C79257] via-transparent to-[#233F39] opacity-70" />

                                <SmartAvatar
                                    src={displayAvatar}
                                    alt={authorHandle || item.authorId || "author"}
                                    size={40}
                                    className="ring-2"
                                />
                            </div>

                            <div
                                onClick={() => onViewProfileClick()}
                                className={cn(
                                    "min-w-0 flex flex-col cursor-pointer"
                                )}
                                role={"button"}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (!onViewProfileClick) return;
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onViewProfileClick();
                                    }
                                }}
                            >
                                <div className="truncate text-sm font-bold text-white/95">
                                    {authorProfile?.handle
                                        ? authorProfile.handle
                                        : item.authorUsername
                                            ? item.authorUsername.startsWith("@")
                                                ? item.authorUsername
                                                : `@${item.authorUsername}`
                                            : (item.authorId ?? "").slice(0, 6)}
                                </div>

                                <AuthorBadgePill badge={(item as any)?.authorBadge} />

                                <div className="flex items-center gap-2 text-[11px] text-white/70">

                                    {timeAgo ? (
                                        <>
                                            <span className="opacity-60">•</span>
                                            <span title={timeTitle || timeAgo} className="opacity-90">
                                                {timeAgo}
                                            </span>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        {(hasCaption || hasTags) ? (
                            <motion.div
                                className="mt-1 w-full"
                                layout
                                transition={{ type: "spring", stiffness: 260, damping: 26 }}
                            >
                                {hasCaption ? (
                                    <div className="relative w-full">
                                        <motion.p
                                            layout
                                            className={cn(
                                                "w-full cursor-pointer text-[14px] leading-5 text-white/95",
                                                captionExpanded ? "" : "line-clamp-2"
                                            )}
                                            onClick={() => setCaptionExpanded((v) => !v)}
                                        >
                                            {caption}
                                        </motion.p>
                                    </div>
                                ) : null}

                                {hasTags ? (
                                    <motion.div
                                        layout
                                        className="mt-2 flex w-full flex-wrap items-center gap-2"
                                    >
                                        {visibleTags.map((tag) => (
                                            <button
                                                key={tag}
                                                type="button"
                                                className="rounded-full border border-white/25 bg-black/25 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-black/60"
                                                onClick={() =>
                                                    router.push(`/search?q=${encodeURIComponent(tag)}`)
                                                }
                                            >
                                                #{tag}
                                            </button>
                                        ))}

                                        {showMoreToggle ? (
                                            <button
                                                type="button"
                                                onClick={() => setCaptionExpanded((v) => !v)}
                                                className="text-[12px] font-semibold text-white/90"
                                            >
                                                {captionExpanded ? "less" : "… more"}
                                            </button>
                                        ) : null}
                                    </motion.div>
                                ) : null}
                            </motion.div>
                        ) : null}

                        {shouldShowSoundRow ? (
                            <div className="mb-1 mt-1 flex items-center gap-2">
                                {isLibrarySound ? (
                                    <div className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full border border-white/25 bg-black/40">
                                        <img
                                            src={soundAvatar}
                                            alt={soundLabel}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : null}

                                <div className="flex min-w-0 items-center gap-2 text-[12px] text-white/85">
                                    <IoMusicalNotesOutline className="flex-shrink-0" size={16} />
                                    <span className="truncate max-w-[220px] sm:max-w-[280px] md:max-w-[420px]">
                                        {soundLabel}
                                    </span>
                                </div>
                            </div>
                        ) : null}

                        {shouldShowPhotoMetaRow ? (
                            <div className="mb-1 mt-1 flex items-center gap-2 text-[12px] text-white/85">
                                <IoImageOutline className="flex-shrink-0" size={16} />
                                <span className="truncate">
                                    {photoCount} photo{photoCount > 1 ? "s" : ""}
                                </span>
                            </div>
                        ) : null}

                    </div>
                </div>

            </div>
            {actionsOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/50" onClick={() => setActionsOpen(false)}>
                    <div
                        className="absolute z-[9999] bottom-0 left-0 right-0 rounded-t-2xl bg-white p-5 text-slate-900 md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-black">Post options</h3>

                        <button
                            type="button"
                            onClick={() => {
                                setActionsOpen(false);
                                setReportOpen(true);
                            }}
                            className="mt-4 w-full rounded-xl border px-4 py-3 text-left font-bold text-red-700"
                        >
                            Report post
                            <div className="text-xs font-normal text-slate-500">
                                Report objectionable or abusive content
                            </div>
                        </button>

                        {!isOwnPost && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setBlockConfirmOpen(true)}
                                className="mt-3 w-full rounded-xl border px-4 py-3 text-left font-bold text-red-700"
                            >
                                Block user
                                <div className="text-xs font-normal text-slate-500">
                                    Hide this user’s content immediately
                                </div>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setActionsOpen(false)}
                            className="mt-4 w-full rounded-xl bg-slate-100 px-4 py-3 font-bold"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {reportOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/50" onClick={() => setReportOpen(false)}>
                    <div
                        className="absolute z-[9999] bottom-0 left-0 right-0 rounded-t-2xl bg-white p-5 text-slate-900 md:left-1/2 md:right-auto md:w-[420px] md:-translate-x-1/2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-black">Report post</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Tell us what is wrong. We review reports within 24 hours.
                        </p>

                        <div className="mt-4 space-y-2">
                            {reportReasons.map((reason) => (
                                <button
                                    key={reason}
                                    type="button"
                                    onClick={() => setReportReason(reason)}
                                    className={[
                                        "w-full rounded-xl border px-4 py-3 text-left text-sm font-bold",
                                        reportReason === reason
                                            ? "border-[#C79257] bg-orange-50"
                                            : "border-slate-200 bg-white",
                                    ].join(" ")}
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>

                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                    setReportOpen(false);
                                    setReportReason("");
                                }}
                                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-bold"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={!reportReason || busy}
                                onClick={submitReport}
                                className="flex-1 rounded-xl bg-[#C79257] px-4 py-3 font-black text-white disabled:opacity-60"
                            >
                                {busy ? "Submitting..." : "Submit report"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {successOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-[380px] rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                            ✓
                        </div>

                        <h3 className="mt-4 text-lg font-black">Report submitted</h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Thank you. Our team will review this report within 24 hours.
                        </p>

                        <button
                            type="button"
                            onClick={() => setSuccessOpen(false)}
                            className="mt-5 w-full rounded-2xl bg-[#233F39] px-4 py-3 font-black text-white"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {blockConfirmOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-[380px] rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-700">
                            !
                        </div>

                        <h3 className="mt-4 text-lg font-black">Block this user?</h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            This user’s content will be removed from your feed immediately.
                        </p>

                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setBlockConfirmOpen(false)}
                                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-800"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                    setBlockConfirmOpen(false);
                                    await blockUser();
                                }}
                                className="flex-1 rounded-2xl bg-red-600 px-4 py-3 font-black text-white disabled:opacity-60"
                            >
                                {busy ? "Blocking..." : "Block"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {suspendedOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4">
                    <div className="w-full max-w-[380px] rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-700">
                            !
                        </div>

                        <h3 className="mt-4 text-lg font-black">Account suspended</h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            {suspendedReason ||
                                "Your account has been suspended due to community guideline violations."}
                        </p>

                        <button
                            type="button"
                            onClick={() => setSuspendedOpen(false)}
                            className="mt-5 w-full rounded-2xl bg-[#233F39] px-4 py-3 font-black text-white"
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}