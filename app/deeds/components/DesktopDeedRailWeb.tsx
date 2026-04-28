"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { IoAdd, IoCheckmark, IoChevronDown, IoChevronUp } from "react-icons/io5";

import { Deed } from "../data/deedsFeedWeb";
import { DeedActionRailWeb } from "./DeedActionRailWeb";
import { useGlobalMuteWeb } from "../hooks/useGlobalMuteWeb";
import { useDeedEngagementWeb } from "../hooks/useDeedEngagementWeb";
import EkariAvatar from "@/app/components/EkariAvatar";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Props = {
    item?: Deed | null;
    uid?: string | null;
    following?: Set<string>;
    commented?: boolean;
    onOpenComments?: (deedId: string) => void;
    onPrev?: () => void;
    onNext?: () => void;
    canGoPrev?: boolean;
    canGoNext?: boolean;
    onSupportClick?: (deed: Deed) => void;
    onUserBlocked?: (authorId: string) => void;
    isSuspended?: boolean;
    suspendedReason?: string | null;
    authordeeds?: boolean;
};

function cleanId(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

export function DesktopDeedRailWeb({
    item,
    uid,
    following,
    commented = false,
    onOpenComments,
    onPrev,
    onNext,
    canGoPrev = false,
    canGoNext = false,
    onSupportClick,
    onUserBlocked,
    isSuspended,
    suspendedReason,
    authordeeds,
}: Props) {
    const router = useRouter();
    const { muted, toggleMute } = useGlobalMuteWeb();

    const safeItemId = cleanId(item?.id);

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
    } = useDeedEngagementWeb(safeItemId, uid);

    const [followPending] = useState(false);
    const [justFollowed] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [hiddenBecauseBlocked, setHiddenBecauseBlocked] = useState(false);
    const [successOpen, setSuccessOpen] = useState(false);
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
    const [suspendedOpen, setSuspendedOpen] = useState(false);

    const reportReasons = [
        "Spam",
        "Fraud / Scam",
        "Abuse / Harassment",
        "Inappropriate content",
        "Illegal goods or services",
        "Other",
    ];


    if (!item || !safeItemId) return null;
    const isOwnPost = !!uid && uid === item.authorId;
    const isPhoto = item.type === "photo";
    const cleanUid = cleanId(uid);
    const cleanAuthorId = cleanId(item.authorId);

    const isFollowing = !!cleanAuthorId && !!following?.has(cleanAuthorId);

    const canFollow =
        !!cleanUid &&
        !!cleanAuthorId &&
        cleanAuthorId !== cleanUid;

    const showFollowBadge = canFollow && !isFollowing && !justFollowed;

    const canSupport =
        !!cleanUid &&
        !!cleanAuthorId &&
        cleanAuthorId !== cleanUid;



    const requireAuth = (nextAction: () => void) => {
        if (!cleanUid) {
            router.push("/getstarted?next=/deeds");
            return;
        }
        nextAction();
    };
    const requireActiveAccount = (nextAction: () => void) => {
        requireAuth(() => {
            if (isSuspended) {

                setSuspendedOpen(true);
                return;
            }

            nextAction();
        });
    };
    const onLikeClick = () => requireActiveAccount(toggleLike);
    const onSaveClick = () => requireActiveAccount(toggleSave);

    const onShareClick = () =>
        requireActiveAccount(async () => {
            await share({
                authorHandle: item.authorUsername ?? null,
                caption: item.text ?? null,
            });
        });

    const handleSupport = () => {
        if (!canSupport) return;

        requireActiveAccount(() => {
            onSupportClick?.(item);
        });
    };
    const requireLogin = () => {
        if (!uid) {
            router.push("/getstarted?next=/deeds");
            return false;
        }
        return true;
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
        <div className="hidden h-full flex-col items-center justify-center gap-5 lg:flex">
            <button
                type="button"
                onClick={onPrev}
                disabled={!canGoPrev}
                aria-label="Previous deed"
                className={[
                    "grid h-14 w-14 place-items-center rounded-full border transition",
                    canGoPrev
                        ? "bg-white/85 text-[#233F39] shadow-sm hover:bg-white"
                        : "cursor-not-allowed bg-white/50 text-gray-300",
                ].join(" ")}
            >
                <IoChevronUp size={28} />
            </button>

            <div className="flex flex-col items-center gap-3">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => {
                            const raw = (item.authorUsername || "").trim();
                            if (!raw) return;
                            const clean = raw.startsWith("@") ? raw : `@${raw}`;
                            router.push(`/${clean}`);
                        }}
                        className="group"
                        aria-label="Open author profile"
                    >

                        <EkariAvatar
                            src={item.authorPhotoURL}
                            alt={item.authorUsername || "Author"}
                            handle={item.authorUsername}
                            size={56}
                        />
                    </button>

                    {showFollowBadge ? (
                        <button
                            type="button"
                            disabled={followPending}
                            aria-label="Follow creator"
                            title="Follow"
                            className={[
                                "absolute left-1/2 top-full z-10 mt-[-10px] grid h-6 w-6 -translate-x-1/2 -translate-y-[30%] place-items-center rounded-full",
                                "border-2 border-white bg-[#C79257] text-white shadow-md transition",
                                followPending ? "opacity-70" : "hover:scale-105 active:scale-95",
                            ].join(" ")}
                        >
                            <IoAdd size={16} />
                        </button>
                    ) : null}

                    {canFollow && (isFollowing || justFollowed) ? (
                        <div
                            className="absolute left-1/2 top-full z-10 mt-[-10px] grid h-6 w-6 -translate-x-1/2 -translate-y-[30%] place-items-center rounded-full border-2 border-white bg-[#16A34A] text-white shadow-md"
                            aria-label="Following"
                            title="Following"
                        >
                            <IoCheckmark size={14} />
                        </div>
                    ) : null}
                </div>

                <DeedActionRailWeb
                    liked={liked}
                    variant="desktop"
                    commented={commented}
                    saved={saved}
                    muted={muted}
                    showMute={!isPhoto}
                    likeCount={likeCount}
                    commentCount={commentedCount}
                    shareCount={totalShares}
                    saveCount={totalBookmarks}
                    onToggleLike={onLikeClick}
                    onOpenComments={() =>
                        requireActiveAccount(() => onOpenComments?.(safeItemId))
                    }
                    onShare={onShareClick}
                    onToggleSave={onSaveClick}
                    onToggleMute={toggleMute}
                    canSupport={canSupport}
                    onSupportClick={handleSupport}
                    authordeeds={authordeeds}
                    onMoreClick={() => setActionsOpen(true)}
                />
            </div>

            <button
                type="button"
                onClick={onNext}
                disabled={!canGoNext}
                aria-label="Next deed"
                className={[
                    "grid h-14 w-14 place-items-center rounded-full border transition",
                    canGoNext
                        ? "bg-white/85 text-[#233F39] shadow-sm hover:bg-white"
                        : "cursor-not-allowed bg-white/50 text-gray-300",
                ].join(" ")}
            >
                <IoChevronDown size={28} />
            </button>
            {actionsOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/50" onClick={() => setActionsOpen(false)}>
                    <div
                        className="absolute left-1/2 top-1/2 w-[92vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl"
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
                        className="absolute left-1/2 top-1/2 w-[92vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 text-slate-900 shadow-2xl"
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
        </div>
    );
}