"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import {
    IoAdd,
    IoCheckmark,
    IoChevronDown,
    IoChevronUp,
} from "react-icons/io5";

import {
    addDoc,
    collection,
    doc,
    serverTimestamp,
    setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import { Deed } from "../data/deedsFeedWeb";
import { DeedActionRailWeb } from "./DeedActionRailWeb";
import { useGlobalMuteWeb } from "../hooks/useGlobalMuteWeb";
import { useDeedEngagementWeb } from "../hooks/useDeedEngagementWeb";
import EkariAvatar from "@/app/components/EkariAvatar";

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
    return typeof value === "string"
        ? value.trim()
        : "";
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

    const { muted, toggleMute } =
        useGlobalMuteWeb();

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
    } = useDeedEngagementWeb(
        safeItemId,
        uid,
    );

    const [followPending] =
        useState(false);

    const [justFollowed] =
        useState(false);

    const [actionsOpen, setActionsOpen] =
        useState(false);

    const [reportOpen, setReportOpen] =
        useState(false);

    const [reportReason, setReportReason] =
        useState("");

    const [busy, setBusy] =
        useState(false);

    const [
        blockConfirmOpen,
        setBlockConfirmOpen,
    ] = useState(false);

    const [
        successOpen,
        setSuccessOpen,
    ] = useState(false);

    const [
        suspendedOpen,
        setSuspendedOpen,
    ] = useState(false);

    const reportReasons = [
        "Spam",
        "Fraud / Scam",
        "Abuse / Harassment",
        "Inappropriate content",
        "Illegal goods or services",
        "Other",
    ];

    if (!item || !safeItemId) {
        return null;
    }

    const isOwnPost =
        !!uid &&
        uid === item.authorId;

    const cleanUid =
        cleanId(uid);

    const cleanAuthorId =
        cleanId(item.authorId);

    const isFollowing =
        !!cleanAuthorId &&
        !!following?.has(cleanAuthorId);

    const canFollow =
        !!cleanUid &&
        !!cleanAuthorId &&
        cleanAuthorId !== cleanUid;

    const showFollowBadge =
        canFollow &&
        !isFollowing &&
        !justFollowed;

    const canSupport =
        !!cleanUid &&
        !!cleanAuthorId &&
        cleanAuthorId !== cleanUid;

    const requireAuth = (
        nextAction: () => void,
    ) => {
        if (!cleanUid) {
            router.push(
                "/getstarted?next=/deeds",
            );

            return;
        }

        nextAction();
    };

    const requireActiveAccount = (
        nextAction: () => void,
    ) => {
        requireAuth(() => {
            if (isSuspended) {
                setSuspendedOpen(true);
                return;
            }

            nextAction();
        });
    };

    const onLikeClick = () =>
        requireActiveAccount(toggleLike);

    const onSaveClick = () =>
        requireActiveAccount(toggleSave);

    const onShareClick = () =>
        requireActiveAccount(async () => {
            await share({
                authorHandle:
                    item.authorUsername ?? null,

                caption:
                    item.text ?? null,
            });
        });

    const handleSupport = () => {
        if (!canSupport) {
            return;
        }

        requireActiveAccount(() => {
            onSupportClick?.(item);
        });
    };

    const requireLogin = () => {
        if (!uid) {
            router.push(
                "/getstarted?next=/deeds",
            );

            return false;
        }

        return true;
    };

    const submitReport = async () => {
        if (!requireLogin()) {
            return;
        }

        if (!reportReason) {
            return;
        }

        setBusy(true);

        try {
            await addDoc(
                collection(db, "reports"),
                {
                    type: "deed",

                    deedId:
                        item.id,

                    reportedUserId:
                        item.authorId,

                    reportedBy:
                        uid,

                    reason:
                        reportReason,

                    status:
                        "open",

                    source:
                        "web_app",

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp(),

                    deedSnapshot: {
                        text:
                            item.text || "",

                        authorUsername:
                            item.authorUsername ||
                            null,

                        mediaType:
                            item.mediaType ||
                            item.type ||
                            null,
                    },
                },
            );

            setReportOpen(false);
            setActionsOpen(false);
            setReportReason("");
            setSuccessOpen(true);
        } finally {
            setBusy(false);
        }
    };

    const blockUser = async () => {
        if (!requireLogin()) {
            return;
        }

        if (
            !item.authorId ||
            isOwnPost
        ) {
            return;
        }

        setBusy(true);

        try {
            const blockId =
                `${uid}_${item.authorId}`;

            await setDoc(
                doc(
                    db,
                    "blocks",
                    blockId,
                ),
                {
                    blockerId:
                        uid,

                    blockedUserId:
                        item.authorId,

                    blockedUserHandle:
                        item.authorUsername ||
                        null,

                    source:
                        "web_app",

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp(),
                },
                {
                    merge: true,
                },
            );

            await addDoc(
                collection(
                    db,
                    "reports",
                ),
                {
                    type:
                        "user_block",

                    deedId:
                        item.id,

                    reportedUserId:
                        item.authorId,

                    reportedBy:
                        uid,

                    reason:
                        "Blocked user from deed menu",

                    status:
                        "open",

                    source:
                        "web_app",

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp(),
                },
            );

            setActionsOpen(false);

            onUserBlocked?.(
                item.authorId,
            );
        } finally {
            setBusy(false);
        }
    };

    const glassNavigationClass = [
        "group grid h-11 w-11 place-items-center",
        "rounded-full border border-white/20",
        "bg-[#173C2E]/90",
        "text-white",
        "backdrop-blur-xl",
        "shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
        "transition-all duration-200 ease-out",
    ].join(" ");

    return (
        <>
            <div className="relative hidden h-full w-full lg:block">
                {/* MAIN ACTION RAIL */}
                <div
                    className="
                        absolute
                        inset-y-0
                        right-0
                        flex
                        w-full
                        flex-col
                        items-center
                        justify-center
                        gap-3
                        py-2
                    "
                >
                    {/* CREATOR AVATAR */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => {
                                const raw = (
                                    item.authorUsername ||
                                    ""
                                ).trim();

                                if (!raw) {
                                    return;
                                }

                                const clean =
                                    raw.startsWith("@")
                                        ? raw
                                        : `@${raw}`;

                                router.push(
                                    `/${clean}`,
                                );
                            }}
                            className="
                relative
                rounded-full
                transition
                hover:scale-[1.06]
                hover:-translate-y-[1px]
                active:scale-[0.97]
              "
                            aria-label="Open author profile"
                        >
                            <div
                                className="
                  rounded-full
                  border-2
                  border-white/90
                  shadow-[0_10px_26px_rgba(0,0,0,.34)]
                "
                            >
                                <EkariAvatar
                                    src={
                                        item.authorPhotoURL
                                    }
                                    alt={
                                        item.authorUsername ||
                                        "Author"
                                    }
                                    handle={
                                        item.authorUsername
                                    }
                                    size={48}
                                />
                            </div>
                        </button>

                        {/* FOLLOW */}
                        {showFollowBadge ? (
                            <button
                                type="button"
                                disabled={
                                    followPending
                                }
                                aria-label="Follow creator"
                                title="Follow"
                                className={[
                                    "absolute",
                                    "left-1/2",
                                    "-bottom-[7px]",
                                    "z-20",

                                    "grid",
                                    "h-5",
                                    "w-5",

                                    "-translate-x-1/2",

                                    "place-items-center",

                                    "rounded-full",

                                    "border-[1.5px]",
                                    "border-white",

                                    "bg-[#F3A526]",

                                    "text-white",

                                    "shadow-md",

                                    "transition-all duration-200 ease-out",

                                    followPending
                                        ? "opacity-60"
                                        : "hover:scale-110 active:scale-95",
                                ].join(" ")}
                            >
                                <IoAdd size={12} />
                            </button>
                        ) : null}

                        {/* FOLLOWING */}
                        {canFollow &&
                            (isFollowing ||
                                justFollowed) ? (
                            <div
                                className="
                  absolute
                  -bottom-[7px]
                  left-1/2
                  z-20
                  grid
                  h-5
                  w-5
                  -translate-x-1/2
                  place-items-center
                  rounded-full
                  border-[1.5px]
                  border-white
                  bg-[#16A34A]
                  text-white
                  shadow-md
                "
                            >
                                <IoCheckmark
                                    size={11}
                                />
                            </div>
                        ) : null}
                    </div>

                    {/* EXTRA SPACE UNDER AVATAR */}
                    <div className="h-1" />

                    {/* ACTIONS */}
                    <DeedActionRailWeb
                        liked={liked}
                        commented={
                            commented
                        }
                        saved={saved}

                        muted={muted}

                        likeCount={
                            likeCount
                        }

                        commentCount={
                            commentedCount
                        }

                        shareCount={
                            totalShares
                        }

                        saveCount={
                            totalBookmarks
                        }

                        onToggleLike={
                            onLikeClick
                        }

                        onOpenComments={() =>
                            requireActiveAccount(
                                () =>
                                    onOpenComments?.(
                                        safeItemId,
                                    ),
                            )
                        }

                        onShare={
                            onShareClick
                        }

                        onToggleSave={
                            onSaveClick
                        }

                        onToggleMute={
                            toggleMute
                        }

                        canSupport={
                            canSupport
                        }

                        onSupportClick={
                            handleSupport
                        }

                        authordeeds={
                            authordeeds
                        }

                        variant="desktop"

                        onMoreClick={() =>
                            setActionsOpen(true)
                        }
                    />
                </div>

                {/* FLOATING DEED NAVIGATION */}
                <div
                    className="
                        pointer-events-none
                        absolute
                        right-[58px]
                        top-1/2
                        z-20
                        -translate-y-1/2
                    "
                >
                    <div
                        className="
                            pointer-events-auto
                            flex
                            flex-col
                            gap-2
                            rounded-[22px]
                            border
                            border-white/10
                            bg-black/20
                            p-1.5
                            shadow-[0_12px_30px_rgba(0,0,0,0.24)]
                            backdrop-blur-md
                        "
                    >
                        <button
                            type="button"
                            onClick={onPrev}
                            disabled={!canGoPrev}
                            aria-label="Previous deed"
                            title="Previous deed"
                            className={[
                                glassNavigationClass,
                                canGoPrev
                                    ? "hover:-translate-y-[1px] hover:scale-[1.06] hover:bg-[#1F4A3B] active:scale-95"
                                    : "cursor-not-allowed opacity-30",
                            ].join(" ")}
                        >
                            <IoChevronUp
                                size={22}
                                className="
                                    transition-transform
                                    duration-200
                                    ease-out
                                    group-hover:-translate-y-[2px]
                                "
                            />
                        </button>

                        <div className="mx-auto h-px w-5 bg-white/10" />

                        <button
                            type="button"
                            onClick={onNext}
                            disabled={!canGoNext}
                            aria-label="Next deed"
                            title="Next deed"
                            className={[
                                glassNavigationClass,
                                canGoNext
                                    ? "hover:translate-y-[1px] hover:scale-[1.06] hover:bg-[#1F4A3B] active:scale-95"
                                    : "cursor-not-allowed opacity-30",
                            ].join(" ")}
                        >
                            <IoChevronDown
                                size={22}
                                className="
                                    transition-transform
                                    duration-200
                                    ease-out
                                    group-hover:translate-y-[2px]
                                "
                            />
                        </button>
                    </div>
                </div>
            </div>

            {/* ============================== */}
            {/* MORE OPTIONS */}
            {/* ============================== */}

            {actionsOpen ? (
                <div
                    className="
            fixed
            inset-0
            z-[9999]
            bg-black/55
            backdrop-blur-[2px]
          "
                    onClick={() =>
                        setActionsOpen(false)
                    }
                >
                    <div
                        className="
              absolute
              left-1/2
              top-1/2
              w-[92vw]
              max-w-[400px]
              -translate-x-1/2
              -translate-y-1/2
              rounded-2xl
              bg-white
              p-5
              text-slate-900
              shadow-2xl
            "
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >
                        <h3 className="text-lg font-black">
                            Post options
                        </h3>

                        <button
                            type="button"
                            onClick={() => {
                                setActionsOpen(
                                    false,
                                );

                                setReportOpen(
                                    true,
                                );
                            }}
                            className="
                mt-4
                w-full
                rounded-xl
                border
                border-slate-200
                px-4
                py-3
                text-left
                font-bold
                text-red-700
              "
                        >
                            Report post

                            <div className="text-xs font-normal text-slate-500">
                                Report objectionable
                                or abusive content
                            </div>
                        </button>

                        {!isOwnPost ? (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    setBlockConfirmOpen(
                                        true,
                                    )
                                }
                                className="
                  mt-3
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  px-4
                  py-3
                  text-left
                  font-bold
                  text-red-700
                "
                            >
                                Block user

                                <div className="text-xs font-normal text-slate-500">
                                    Hide this user&apos;s
                                    content immediately
                                </div>
                            </button>
                        ) : null}

                        <button
                            type="button"
                            onClick={() =>
                                setActionsOpen(false)
                            }
                            className="
                mt-4
                w-full
                rounded-xl
                bg-slate-100
                px-4
                py-3
                font-bold
              "
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : null}

            {/* ============================== */}
            {/* REPORT */}
            {/* ============================== */}

            {reportOpen ? (
                <div
                    className="
            fixed
            inset-0
            z-[9999]
            bg-black/55
          "
                    onClick={() =>
                        setReportOpen(false)
                    }
                >
                    <div
                        className="
              absolute
              left-1/2
              top-1/2
              w-[92vw]
              max-w-[400px]
              -translate-x-1/2
              -translate-y-1/2
              rounded-2xl
              bg-white
              p-5
              text-slate-900
              shadow-2xl
            "
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >
                        <h3 className="text-lg font-black">
                            Report post
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Tell us what is wrong.
                        </p>

                        <div className="mt-4 space-y-2">
                            {reportReasons.map(
                                (reason) => (
                                    <button
                                        key={
                                            reason
                                        }
                                        type="button"
                                        onClick={() =>
                                            setReportReason(
                                                reason,
                                            )
                                        }
                                        className={[
                                            "w-full rounded-xl border px-4 py-2.5 text-left text-sm font-bold",

                                            reportReason ===
                                                reason
                                                ? "border-[#F3A526] bg-orange-50"
                                                : "border-slate-200 bg-white",
                                        ].join(" ")}
                                    >
                                        {reason}
                                    </button>
                                ),
                            )}
                        </div>

                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setReportOpen(
                                        false,
                                    );

                                    setReportReason(
                                        "",
                                    );
                                }}
                                className="
                  flex-1
                  rounded-xl
                  bg-slate-100
                  px-4
                  py-3
                  font-bold
                "
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={
                                    !reportReason ||
                                    busy
                                }
                                onClick={
                                    submitReport
                                }
                                className="
                  flex-1
                  rounded-xl
                  bg-[#F3A526]
                  px-4
                  py-3
                  font-black
                  text-[#173C2E]
                  disabled:opacity-50
                "
                            >
                                {busy
                                    ? "Submitting..."
                                    : "Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* REPORT SUCCESS */}

            {successOpen ? (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 px-4">
                    <div className="w-full max-w-[360px] rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-xl font-black text-emerald-700">
                            ✓
                        </div>

                        <h3 className="mt-4 text-lg font-black">
                            Report submitted
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Thank you. We&apos;ll
                            review the report.
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setSuccessOpen(false)
                            }
                            className="mt-5 w-full rounded-xl bg-[#173C2E] px-4 py-3 font-black text-white"
                        >
                            Done
                        </button>
                    </div>
                </div>
            ) : null}

            {/* BLOCK CONFIRMATION */}

            {blockConfirmOpen ? (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 px-4">
                    <div className="w-full max-w-[360px] rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 font-black text-red-700">
                            !
                        </div>

                        <h3 className="mt-4 text-lg font-black">
                            Block this user?
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            This user&apos;s content
                            will be removed from your
                            feed.
                        </p>

                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setBlockConfirmOpen(
                                        false,
                                    )
                                }
                                className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-black"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                    setBlockConfirmOpen(
                                        false,
                                    );

                                    await blockUser();
                                }}
                                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-black text-white"
                            >
                                {busy
                                    ? "Blocking..."
                                    : "Block"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* SUSPENSION */}

            {suspendedOpen ? (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 px-4">
                    <div className="w-full max-w-[360px] rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 font-black text-red-700">
                            !
                        </div>

                        <h3 className="mt-4 text-lg font-black">
                            Account suspended
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            {suspendedReason ||
                                "Your account has been suspended due to community guideline violations."}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                setSuspendedOpen(false)
                            }
                            className="mt-5 w-full rounded-xl bg-[#173C2E] px-4 py-3 font-black text-white"
                        >
                            OK
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}