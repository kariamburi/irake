"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import {
  IoCalendarNumberOutline,
  IoChatbubbleEllipses,
  IoChatbubbleEllipsesOutline,
  IoCheckmarkCircleOutline,
  IoChevronBack,
  IoCloseCircleOutline,
  IoHeart,
  IoMegaphone,
  IoNotificationsOutline,
  IoPeopleOutline,
  IoPersonAdd,
  IoRefreshOutline,
  IoSearchOutline,
  IoShieldCheckmarkOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

export const dynamic = "force-dynamic";

const EKARI = {
  forest: "#173C2E",
  forestSoft: "#214C3A",
  orange: "#c69258",
  canvas: "#F8F7F2",
  paper: "#FBFAF6",
  text: "#0F172A",
  dim: "#64748B",
  border: "#DDD8CC",
};

type TabKey =
  | "all"
  | "activity"
  | "followers"
  | "system";

type Notif = {
  id: string;
  type?:
  | "like"
  | "comment"
  | "follow"
  | "profile_view"
  | "payment_success"
  | "new_deed"
  | "new_event"
  | "new_discussion"
  | "admin_broadcast"
  | "expert_booking_created"
  | "expert_booking_cancelled"
  | "expert_booking_accepted"
  | "expert_booking_declined"
  | "expert_booking_confirmed"
  | "expert_booking_completed"
  | string;

  byUserId?: string;
  handle?: string;
  byName?: string;
  byPhotoURL?: string | null;

  preview?: string | null;
  message?: string;
  title?: string;

  createdAt?: any;
  seen?: boolean;

  deedId?: string;
  eventId?: string;
  discussionId?: string;
  bookingId?: string;
  expertId?: string;
  clientId?: string;
  threadId?: string;
  broadcastId?: string;
  deepLink?: string;

  meta?: {
    kind?: string;
    bookingId?: string;
    expertId?: string;
    clientId?: string;
    [key: string]: any;
  };

  peer?: {
    byName?: string;
    byPhotoURL?: string | null;
    handle?: string;
  };
};

type FollowerRow = {
  userId: string;
  name?: string;
  photoURL?: string | null;
  createdAt?: any;
  handle?: string;
  seen?: boolean;
};

type UnifiedRow =
  | {
    kind: "notification";
    sortKey: number;
    notification: Notif;
  }
  | {
    kind: "follower";
    sortKey: number;
    follower: FollowerRow;
  };

function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(queryStr);
    const onChange = () =>
      setMatches(mq.matches);

    onChange();
    mq.addEventListener?.(
      "change",
      onChange
    );

    return () =>
      mq.removeEventListener?.(
        "change",
        onChange
      );
  }, [queryStr]);

  return matches;
}

function useIsMobile() {
  return useMediaQuery(
    "(max-width: 1023px)"
  );
}

function tsToDate(ts: any): Date {
  if (!ts) return new Date();

  if (
    typeof ts?.toDate === "function"
  ) {
    return ts.toDate();
  }

  if (
    typeof ts?.seconds === "number"
  ) {
    return new Date(
      ts.seconds * 1000
    );
  }

  if (ts instanceof Date) {
    return ts;
  }

  return new Date(ts);
}

function tsToMillis(ts: any) {
  return tsToDate(ts).getTime();
}

function timeAgo(input: any) {
  const d = tsToDate(input).getTime();
  const s = Math.max(
    0,
    Math.floor(
      (Date.now() - d) / 1000
    )
  );

  if (s < 60) return `${s}s`;

  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;

  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;

  return new Date(d).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    }
  );
}

function dayBucket(input: any) {
  const date = tsToDate(input);
  const now = new Date();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();

  const yesterdayStart =
    todayStart - 24 * 60 * 60 * 1000;

  const dateStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();

  if (dateStart >= todayStart) {
    return "Today";
  }

  if (dateStart >= yesterdayStart) {
    return "Yesterday";
  }

  return "Earlier";
}

function getSenderName(n: Notif) {
  if (
    n.type === "admin_broadcast"
  ) {
    return (
      n.byName?.trim() ||
      "ekarihub Team"
    );
  }

  return (
    n.byName?.trim() || "User"
  );
}

function primaryText(n: Notif) {
  if (n.type === "like") {
    return "Liked your deed 👍";
  }

  if (n.type === "comment") {
    return `Commented on your deed: ${n.preview || ""
      }`;
  }

  if (
    n.type === "profile_view"
  ) {
    return "Checked out your profile 👀";
  }

  if (n.type === "follow") {
    return "Started following you 🤝";
  }

  if (n.type === "new_deed") {
    return "Posted a new deed ✨";
  }

  if (n.type === "new_event") {
    return "Created a new event 📅";
  }

  if (
    n.type === "new_discussion"
  ) {
    return "Started a new discussion 💬";
  }

  if (
    n.type ===
    "expert_booking_created"
  ) {
    return (
      n.preview ||
      n.message ||
      "Sent you a new consultation request"
    );
  }

  if (
    n.type ===
    "expert_booking_cancelled"
  ) {
    return (
      n.preview ||
      n.message ||
      "Cancelled the consultation request"
    );
  }

  if (
    n.type ===
    "expert_booking_accepted"
  ) {
    return (
      n.preview ||
      n.message ||
      "Your consultation request was accepted"
    );
  }

  if (
    n.type ===
    "expert_booking_declined"
  ) {
    return (
      n.preview ||
      n.message ||
      "Your consultation request was declined"
    );
  }

  if (
    n.type ===
    "expert_booking_confirmed"
  ) {
    return (
      n.preview ||
      n.message ||
      "Your consultation has been confirmed"
    );
  }

  if (
    n.type ===
    "expert_booking_completed"
  ) {
    return (
      n.preview ||
      n.message ||
      "Your consultation was marked as completed"
    );
  }

  if (
    n.type === "payment_success"
  ) {
    if (
      n.meta?.kind ===
      "expert_consultation"
    ) {
      return (
        n.preview ||
        n.message ||
        "Consultation payment successful ✅"
      );
    }

    return (
      n.preview ||
      n.message ||
      n.title ||
      "Payment successful ✅"
    );
  }

  if (
    n.type ===
    "admin_broadcast"
  ) {
    return (
      n.message ||
      n.preview ||
      n.title ||
      "System notification"
    );
  }

  return (
    n.message ||
    n.preview ||
    n.title ||
    "New activity on ekarihub"
  );
}

function routeForNotification(
  n: Notif
): string | null {
  if (n.deepLink) {
    return n.deepLink;
  }

  const bookingId =
    n.bookingId ||
    n.meta?.bookingId;

  if (
    n.type ===
    "expert_booking_created" ||
    n.type ===
    "expert_booking_cancelled"
  ) {
    return "/account/expert/bookings";
  }

  if (
    n.type ===
    "expert_booking_accepted" ||
    n.type ===
    "expert_booking_declined" ||
    n.type ===
    "expert_booking_confirmed" ||
    n.type ===
    "expert_booking_completed" ||
    (n.type === "payment_success" &&
      n.meta?.kind ===
      "expert_consultation")
  ) {
    return bookingId
      ? `/account/bookings/${encodeURIComponent(
        bookingId
      )}`
      : "/account/bookings";
  }

  if (
    (n.type === "comment" ||
      n.type === "like" ||
      n.type === "new_deed") &&
    n.deedId &&
    n.handle
  ) {
    return `/${encodeURIComponent(
      n.handle.replace(/^@/, "")
    )}/deed/${n.deedId}`;
  }

  if (n.type === "new_event") {
    return n.eventId
      ? `/nexus/events/${n.eventId}`
      : "/nexus/events";
  }

  if (
    n.type === "new_discussion"
  ) {
    return n.discussionId
      ? `/nexus/discussions/${n.discussionId}`
      : "/nexus/discussions";
  }

  return null;
}

function badgeFor(n: Notif) {
  switch (n.type) {
    case "like":
      return {
        icon: IoHeart,
        bg: "#E95269",
      };

    case "comment":
      return {
        icon:
          IoChatbubbleEllipses,
        bg: EKARI.forest,
      };

    case "follow":
      return {
        icon: IoPersonAdd,
        bg: EKARI.orange,
      };

    case "admin_broadcast":
      return {
        icon: IoMegaphone,
        bg: "#7357A5",
      };

    case "expert_booking_created":
      return {
        icon:
          IoCalendarNumberOutline,
        bg: EKARI.orange,
      };

    case "expert_booking_cancelled":
      return {
        icon:
          IoCloseCircleOutline,
        bg: "#B42318",
      };

    case "expert_booking_accepted":
      return {
        icon:
          IoCheckmarkCircleOutline,
        bg: "#2563EB",
      };

    case "expert_booking_declined":
      return {
        icon:
          IoCloseCircleOutline,
        bg: "#DC2626",
      };

    case "expert_booking_confirmed":
    case "expert_booking_completed":
      return {
        icon:
          IoShieldCheckmarkOutline,
        bg: "#15803D",
      };

    case "payment_success":
      return {
        icon:
          IoCheckmarkCircleOutline,
        bg: EKARI.orange,
      };

    default:
      return {
        icon:
          IoNotificationsOutline,
        bg: EKARI.forest,
      };
  }
}

function SmartAvatar({
  src,
  alt,
  size = 46,
  fallback = "/avatar-placeholder.png",
}: {
  src?: string | null;
  alt: string;
  size?: number;
  fallback?: string;
}) {
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState(false);

  const displayed =
    !error && src ? src : fallback;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-slate-100"
      style={{
        width: size,
        height: size,
      }}
    >
      {loading ? (
        <div className="absolute inset-0 grid place-items-center bg-slate-100">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#173C2E]" />
        </div>
      ) : null}

      <Image
        src={displayed}
        alt={alt}
        fill
        sizes={`${size}px`}
        className={clsx(
          "object-cover transition-opacity duration-200",
          loading
            ? "opacity-0"
            : "opacity-100"
        )}
        onLoadingComplete={() =>
          setLoading(false)
        }
        onError={() => {
          setError(true);
          setLoading(false);
        }}
      />
    </div>
  );
}

function DeleteModal({
  open,
  deleting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] grid place-items-center bg-black/40 px-4 backdrop-blur-[2px]"
    >
      <motion.div
        initial={{
          opacity: 0,
          y: 8,
          scale: 0.98,
        }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
        }}
        exit={{
          opacity: 0,
          y: 6,
          scale: 0.98,
        }}
        className="w-full max-w-sm rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-5 shadow-2xl"
      >
        <div className="text-[17px] font-black text-slate-900">
          Delete notification?
        </div>

        <p className="mt-2 text-[13px] font-medium leading-5 text-slate-500">
          This notification will be removed from your notification center.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="h-10 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[12px] font-black text-slate-600"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="h-10 rounded-xl bg-red-600 px-4 text-[12px] font-black text-white disabled:opacity-60"
          >
            {deleting
              ? "Deleting…"
              : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NotificationRow({
  n,
  uid,
  onOpenProfile,
  onOpenThread,
  onDelete,
}: {
  n: Notif;
  uid?: string | null;
  onOpenProfile: (
    handle?: string,
    name?: string,
    photoURL?: string | null
  ) => void;
  onOpenThread: (n: Notif) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();

  const [following, setFollowing] =
    useState<boolean | null>(null);

  const [expanded, setExpanded] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      if (
        !uid ||
        n.type !== "follow" ||
        !n.byUserId ||
        n.byUserId === uid
      ) {
        if (mounted) {
          setFollowing(null);
        }
        return;
      }

      try {
        const ref = doc(
          db,
          "follows",
          `${uid}_${n.byUserId}`
        );

        const snap =
          await getDoc(ref);

        if (mounted) {
          setFollowing(
            snap.exists()
          );
        }
      } catch {
        if (mounted) {
          setFollowing(null);
        }
      }
    }

    void check();

    return () => {
      mounted = false;
    };
  }, [
    uid,
    n.type,
    n.byUserId,
  ]);

  async function followBack() {
    if (
      !uid ||
      !n.byUserId ||
      following
    ) {
      return;
    }

    await setDoc(
      doc(
        db,
        "follows",
        `${uid}_${n.byUserId}`
      ),
      {
        followerId: uid,
        followingId: n.byUserId,
        createdAt:
          serverTimestamp(),
      },
      { merge: true }
    );

    setFollowing(true);
  }

  const senderName =
    getSenderName(n);

  const badge = badgeFor(n);
  const BadgeIcon = badge.icon;

  const fullText =
    primaryText(n).trim();

  const isLongBroadcast =
    n.type ===
    "admin_broadcast" &&
    fullText.length > 220;

  const visibleText =
    isLongBroadcast && !expanded
      ? `${fullText
        .slice(0, 220)
        .trimEnd()}...`
      : fullText;

  const canFollowBack =
    n.type === "follow" &&
    !!n.byUserId &&
    !!uid &&
    n.byUserId !== uid;

  const openRelated = () => {
    const href =
      routeForNotification(n);

    if (href) {
      router.push(href);
      return;
    }

    if (
      n.byUserId !== "system"
    ) {
      onOpenProfile(
        n.handle,
        n.byName,
        n.byPhotoURL
      );
    }
  };

  return (
    <motion.li
      layout
      initial={{
        opacity: 0,
        y: 4,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
      }}
      transition={{
        duration: 0.18,
      }}
      className={clsx(
        "group relative flex gap-3 px-3 py-3 transition-colors duration-200 sm:px-4",
        n.seen === false
          ? "bg-[#EEF3EE]"
          : "bg-[#FBFAF6] hover:bg-white"
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (
            n.type ===
            "admin_broadcast" ||
            n.byUserId === "system"
          ) {
            return;
          }

          onOpenProfile(
            n.handle,
            n.byName,
            n.byPhotoURL
          );
        }}
        className="relative shrink-0 self-start"
      >
        <SmartAvatar
          src={
            n.type ===
              "admin_broadcast"
              ? n.byPhotoURL ||
              "/ekarihub-favicon-logo-green.png"
              : n.byPhotoURL
          }
          alt={senderName}
          size={46}
        />

        <span
          className="absolute -bottom-1 -right-1 grid h-[19px] w-[19px] place-items-center rounded-full border-2 border-[#FBFAF6] text-white"
          style={{
            backgroundColor:
              badge.bg,
          }}
        >
          <BadgeIcon size={10} />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                if (
                  n.type ===
                  "admin_broadcast" ||
                  n.byUserId ===
                  "system"
                ) {
                  return;
                }

                onOpenProfile(
                  n.handle,
                  n.byName,
                  n.byPhotoURL
                );
              }}
              className="max-w-full truncate text-left text-[13px] font-black text-slate-900 hover:underline"
            >
              {senderName}
            </button>

            {n.type ===
              "admin_broadcast" ? (
              <div className="mt-0.5 text-[12px] font-medium leading-5 text-slate-600">
                {visibleText}

                {isLongBroadcast ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded(
                        (v) => !v
                      )
                    }
                    className="ml-1 font-black text-[#173C2E] hover:underline"
                  >
                    {expanded
                      ? "Read less"
                      : "Read more"}
                  </button>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={
                  openRelated
                }
                className="mt-0.5 block max-w-full text-left text-[12px] font-medium leading-5 text-slate-500 hover:text-slate-800"
              >
                {fullText}
              </button>
            )}
          </div>

          <span className="shrink-0 text-[10px] font-semibold text-slate-400">
            {timeAgo(
              n.createdAt
            )}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {canFollowBack &&
            following === false ? (
            <motion.button
              whileTap={{
                scale: 0.97,
              }}
              type="button"
              onClick={() =>
                void followBack()
              }
              className="h-8 rounded-full bg-[#173C2E] px-3 text-[10px] font-black text-white"
            >
              Follow back
            </motion.button>
          ) : null}

          {canFollowBack &&
            following === true ? (
            <motion.button
              whileTap={{
                scale: 0.97,
              }}
              type="button"
              onClick={() =>
                onOpenThread(n)
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-slate-600"
            >
              <IoChatbubbleEllipsesOutline
                size={13}
              />
              Message
            </motion.button>
          ) : null}
        </div>
      </div>

      {n.seen === false ? (
        <span
          className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#c69258]"
          aria-label="Unread"
        />
      ) : null}

      <button
        type="button"
        onClick={() =>
          onDelete(n.id)
        }
        className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full text-slate-300 opacity-100 transition hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100"
        title="Delete notification"
      >
        <IoTrashOutline
          size={14}
        />
      </button>
    </motion.li>
  );
}

function FollowerItem({
  row,
  uid,
  isFollowing,
  pending,
  onFollow,
  onMessage,
  onOpenProfile,
}: {
  row: FollowerRow;
  uid: string;
  isFollowing: boolean;
  pending: boolean;
  onFollow: (
    userId: string
  ) => void;
  onMessage: (
    row: FollowerRow
  ) => void;
  onOpenProfile: (
    handle?: string,
    name?: string,
    photoURL?: string | null
  ) => void;
}) {
  return (
    <motion.li
      layout
      initial={{
        opacity: 0,
        y: 4,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.18,
      }}
      className={clsx(
        "relative flex items-center gap-3 px-3 py-3 transition-colors sm:px-4",
        row.seen === false
          ? "bg-[#EEF3EE]"
          : "bg-[#FBFAF6] hover:bg-white"
      )}
    >
      <button
        type="button"
        onClick={() =>
          onOpenProfile(
            row.handle,
            row.name,
            row.photoURL
          )
        }
        className="relative shrink-0"
      >
        <SmartAvatar
          src={row.photoURL}
          alt={
            row.name || "User"
          }
          size={46}
        />

        <span className="absolute -bottom-1 -right-1 grid h-[19px] w-[19px] place-items-center rounded-full border-2 border-[#FBFAF6] bg-[#c69258] text-white">
          <IoPersonAdd
            size={10}
          />
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() =>
                onOpenProfile(
                  row.handle,
                  row.name,
                  row.photoURL
                )
              }
              className="block max-w-full truncate text-left text-[13px] font-black text-slate-900 hover:underline"
            >
              {row.name ||
                "User"}
            </button>

            <p className="mt-0.5 text-[12px] font-medium text-slate-500">
              Started following you 🤝
            </p>

            {row.handle ? (
              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                {row.handle}
              </p>
            ) : null}
          </div>

          <span className="shrink-0 text-[10px] font-semibold text-slate-400">
            {timeAgo(
              row.createdAt
            )}
          </span>
        </div>
      </div>

      {isFollowing ? (
        <motion.button
          whileTap={{
            scale: 0.97,
          }}
          type="button"
          onClick={() =>
            onMessage(row)
          }
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-slate-600"
        >
          <IoChatbubbleEllipsesOutline
            size={13}
          />
          <span className="hidden sm:inline">
            Message
          </span>
        </motion.button>
      ) : (
        <motion.button
          whileTap={{
            scale: 0.97,
          }}
          type="button"
          disabled={
            pending ||
            row.userId === uid
          }
          onClick={() =>
            onFollow(
              row.userId
            )
          }
          className="h-8 shrink-0 rounded-full bg-[#173C2E] px-3 text-[10px] font-black text-white disabled:opacity-50"
        >
          {pending
            ? "…"
            : "Follow back"}
        </motion.button>
      )}

      {row.seen === false ? (
        <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#c69258]" />
      ) : null}
    </motion.li>
  );
}

function EmptyState({
  tab,
}: {
  tab: TabKey;
}) {
  const message =
    tab === "followers"
      ? "New followers will appear here."
      : tab === "system"
        ? "System announcements and important notices will appear here."
        : tab === "activity"
          ? "Likes, comments, bookings and other activity will appear here."
          : "You’re all caught up.";

  return (
    <div className="grid min-h-[360px] place-items-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
          <IoNotificationsOutline
            size={24}
          />
        </div>

        <h3 className="mt-4 text-[15px] font-black text-slate-900">
          Nothing here yet
        </h3>

        <p className="mt-1 text-[12px] font-medium leading-5 text-slate-400">
          {message}
        </p>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const uid =
    user?.uid ?? null;

  const router = useRouter();
  const searchParams =
    useSearchParams();

  const isMobile =
    useIsMobile();

  const rawTab =
    searchParams.get("tab");

  const activeTab: TabKey =
    rawTab === "activity" ||
      rawTab === "followers" ||
      rawTab === "system"
      ? rawTab
      : "all";

  const [notifications, setNotifications] =
    useState<Notif[]>([]);

  const [followers, setFollowers] =
    useState<FollowerRow[]>([]);

  const [followingSet, setFollowingSet] =
    useState<Set<string>>(
      new Set()
    );

  const [notificationsLoading, setNotificationsLoading] =
    useState(true);

  const [followersLoading, setFollowersLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  const [pendingDeleteId, setPendingDeleteId] =
    useState<
      string | null
    >(null);

  const [deleting, setDeleting] =
    useState(false);

  const pendingFollow =
    useRef<Set<string>>(
      new Set()
    );

  /*
   * Used only for the automatic "mark as read when this route opens"
   * behaviour. It prevents every Firestore snapshot update from causing
   * another write.
   */
  const autoMarkedReadUidRef =
    useRef<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }

    setNotificationsLoading(true);

    const qy = query(
      collection(
        db,
        "users",
        uid,
        "notifications"
      ),
      orderBy(
        "createdAt",
        "desc"
      )
    );

    return onSnapshot(
      qy,
      (snapshot) => {
        setNotifications(
          snapshot.docs.map(
            (d) => ({
              id: d.id,
              ...(d.data() as any),
            })
          )
        );

        setNotificationsLoading(
          false
        );
      },
      (error) => {
        console.error(
          "Notification listener error:",
          error
        );
        setNotificationsLoading(
          false
        );
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setFollowers([]);
      setFollowersLoading(false);
      return;
    }

    setFollowersLoading(true);

    const qy = query(
      collection(
        db,
        "users",
        uid,
        "followers"
      ),
      orderBy(
        "createdAt",
        "desc"
      )
    );

    return onSnapshot(
      qy,
      (snapshot) => {
        setFollowers(
          snapshot.docs.map(
            (d) => {
              const data =
                d.data() as any;

              return {
                userId: d.id,
                name:
                  data?.name ||
                  "User",
                photoURL:
                  data?.photoURL ||
                  null,
                createdAt:
                  data?.createdAt,
                handle:
                  data?.handle,
                seen:
                  !!data?.seen,
              };
            }
          )
        );

        setFollowersLoading(
          false
        );
      },
      () =>
        setFollowersLoading(
          false
        )
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const qy = query(
      collection(
        db,
        "follows"
      ),
      where(
        "followerId",
        "==",
        uid
      )
    );

    return onSnapshot(
      qy,
      (snapshot) => {
        const next =
          new Set<string>();

        snapshot.forEach(
          (d) => {
            const data =
              d.data() as any;

            if (
              data?.followerId ===
              uid &&
              typeof data?.followingId ===
              "string"
            ) {
              next.add(
                data.followingId
              );
            }
          }
        );

        setFollowingSet(
          next
        );
      }
    );
  }, [uid]);

  const unreadNotifications =
    notifications.filter(
      (n) =>
        n.seen === false &&
        n.type !== "follow"
    ).length;

  const unreadFollowers =
    followers.filter(
      (f) =>
        f.seen === false
    ).length;

  const systemUnread =
    notifications.filter(
      (n) =>
        n.seen === false &&
        n.type ===
        "admin_broadcast"
    ).length;

  const totalUnread =
    unreadNotifications +
    unreadFollowers;

  const nonFollowNotifications =
    useMemo(
      () =>
        notifications.filter(
          (n) =>
            n.type !== "follow"
        ),
      [notifications]
    );

  const activityNotifications =
    useMemo(
      () =>
        nonFollowNotifications.filter(
          (n) =>
            n.type !==
            "admin_broadcast"
        ),
      [nonFollowNotifications]
    );

  const systemNotifications =
    useMemo(
      () =>
        nonFollowNotifications.filter(
          (n) =>
            n.type ===
            "admin_broadcast"
        ),
      [nonFollowNotifications]
    );

  const normalizedSearch =
    search.trim().toLowerCase();

  const matchesSearchNotification =
    useCallback(
      (n: Notif) => {
        if (
          !normalizedSearch
        ) {
          return true;
        }

        return [
          getSenderName(n),
          primaryText(n),
          n.type || "",
          n.title || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(
            normalizedSearch
          );
      },
      [normalizedSearch]
    );

  const matchesSearchFollower =
    useCallback(
      (f: FollowerRow) => {
        if (
          !normalizedSearch
        ) {
          return true;
        }

        return [
          f.name || "",
          f.handle || "",
          "follower follow",
        ]
          .join(" ")
          .toLowerCase()
          .includes(
            normalizedSearch
          );
      },
      [normalizedSearch]
    );

  const filteredActivity =
    useMemo(
      () =>
        activityNotifications.filter(
          matchesSearchNotification
        ),
      [
        activityNotifications,
        matchesSearchNotification,
      ]
    );

  const filteredSystem =
    useMemo(
      () =>
        systemNotifications.filter(
          matchesSearchNotification
        ),
      [
        systemNotifications,
        matchesSearchNotification,
      ]
    );

  const filteredFollowers =
    useMemo(
      () =>
        followers.filter(
          matchesSearchFollower
        ),
      [
        followers,
        matchesSearchFollower,
      ]
    );

  const allRows =
    useMemo<UnifiedRow[]>(
      () => [
        ...nonFollowNotifications
          .filter(
            matchesSearchNotification
          )
          .map((notification) => ({
            kind:
              "notification" as const,
            sortKey:
              tsToMillis(
                notification.createdAt
              ),
            notification,
          })),

        ...followers
          .filter(
            matchesSearchFollower
          )
          .map((follower) => ({
            kind:
              "follower" as const,
            sortKey:
              tsToMillis(
                follower.createdAt
              ),
            follower,
          })),
      ].sort(
        (a, b) =>
          b.sortKey -
          a.sortKey
      ),
      [
        nonFollowNotifications,
        followers,
        matchesSearchNotification,
        matchesSearchFollower,
      ]
    );

  const visibleRows =
    useMemo(() => {
      if (
        activeTab ===
        "activity"
      ) {
        return filteredActivity.map(
          (notification) =>
            ({
              kind:
                "notification",
              sortKey:
                tsToMillis(
                  notification.createdAt
                ),
              notification,
            }) as UnifiedRow
        );
      }

      if (
        activeTab ===
        "system"
      ) {
        return filteredSystem.map(
          (notification) =>
            ({
              kind:
                "notification",
              sortKey:
                tsToMillis(
                  notification.createdAt
                ),
              notification,
            }) as UnifiedRow
        );
      }

      if (
        activeTab ===
        "followers"
      ) {
        return filteredFollowers.map(
          (follower) =>
            ({
              kind:
                "follower",
              sortKey:
                tsToMillis(
                  follower.createdAt
                ),
              follower,
            }) as UnifiedRow
        );
      }

      return allRows;
    }, [
      activeTab,
      filteredActivity,
      filteredSystem,
      filteredFollowers,
      allRows,
    ]);

  const grouped =
    useMemo(() => {
      const map =
        new Map<
          string,
          UnifiedRow[]
        >();

      visibleRows.forEach(
        (row) => {
          const createdAt =
            row.kind ===
              "notification"
              ? row.notification
                .createdAt
              : row.follower
                .createdAt;

          const bucket =
            dayBucket(
              createdAt
            );

          if (
            !map.has(bucket)
          ) {
            map.set(
              bucket,
              []
            );
          }

          map.get(bucket)!.push(
            row
          );
        }
      );

      const order = [
        "Today",
        "Yesterday",
        "Earlier",
      ];

      return Array.from(
        map.entries()
      ).sort(
        (a, b) =>
          order.indexOf(
            a[0]
          ) -
          order.indexOf(
            b[0]
          )
      );
    }, [visibleRows]);

  const setTab =
    useCallback(
      (tab: TabKey) => {
        const params =
          new URLSearchParams(
            searchParams.toString()
          );

        if (
          tab === "all"
        ) {
          params.delete(
            "tab"
          );
        } else {
          params.set(
            "tab",
            tab
          );
        }

        const qs =
          params.toString();

        router.replace(
          qs
            ? `/notifications?${qs}`
            : "/notifications",
          {
            scroll: false,
          }
        );
      },
      [
        router,
        searchParams,
      ]
    );

  const markAllRead =
    useCallback(async () => {
      if (!uid) return;

      const unreadN =
        notifications.filter(
          (n) =>
            n.seen === false
        );

      const unreadF =
        followers.filter(
          (f) =>
            f.seen === false
        );

      if (
        unreadN.length === 0 &&
        unreadF.length === 0
      ) {
        return;
      }

      const batch =
        writeBatch(db);

      unreadN.forEach(
        (n) => {
          batch.set(
            doc(
              db,
              "users",
              uid,
              "notifications",
              n.id
            ),
            {
              seen: true,
            },
            {
              merge: true,
            }
          );
        }
      );

      unreadF.forEach(
        (f) => {
          batch.set(
            doc(
              db,
              "users",
              uid,
              "followers",
              f.userId
            ),
            {
              seen: true,
            },
            {
              merge: true,
            }
          );
        }
      );

      await batch.commit();
    }, [
      uid,
      notifications,
      followers,
    ]);

  /*
   * Automatically clear the Notifications badge when /notifications
   * has been opened and both initial Firestore listeners have loaded.
   *
   * useInboxTotalsWeb is already listening to these same documents with
   * seen == false. As soon as this batch changes seen to true, the sidebar
   * badge updates to zero automatically.
   */
  useEffect(() => {
    if (!uid) {
      autoMarkedReadUidRef.current =
        null;
      return;
    }

    /*
     * Do not run while either collection is still loading. Waiting for both
     * avoids treating empty pre-load arrays as if there were nothing to read.
     */
    if (
      notificationsLoading ||
      followersLoading
    ) {
      return;
    }

    /*
     * Run once for this mounted page/user. New notifications that arrive
     * after the page is already open remain new until the user opens the
     * route again or presses "Mark all read".
     */
    if (
      autoMarkedReadUidRef.current ===
      uid
    ) {
      return;
    }

    autoMarkedReadUidRef.current =
      uid;

    void markAllRead().catch(
      (error) => {
        console.error(
          "AUTO_MARK_NOTIFICATIONS_READ_FAILED",
          error
        );

        /*
         * If the write fails, allow another attempt on the next relevant
         * render/snapshot update.
         */
        autoMarkedReadUidRef.current =
          null;
      }
    );
  }, [
    uid,
    notificationsLoading,
    followersLoading,
    markAllRead,
  ]);

  const onRefresh =
    useCallback(() => {
      setRefreshing(true);

      window.setTimeout(
        () =>
          setRefreshing(
            false
          ),
        600
      );
    }, []);

  const openProfile =
    useCallback(
      (
        handle?: string
      ) => {
        if (!handle) return;

        router.push(
          `/${encodeURIComponent(
            handle.replace(
              /^@/,
              ""
            )
          )}`
        );
      },
      [router]
    );

  const makeThreadId = (
    a: string,
    b: string
  ) =>
    [a, b]
      .sort()
      .join("_");

  const openFollowerThread =
    useCallback(
      (
        row: FollowerRow
      ) => {
        if (!uid) return;

        const threadId =
          makeThreadId(
            uid,
            row.userId
          );

        const q =
          new URLSearchParams({
            thread: threadId,
            peerId:
              row.userId,
            peerName:
              row.name || "",
            peerPhotoURL:
              row.photoURL ||
              "",
            peerHandle:
              row.handle || "",
          });

        router.push(
          `/bonga?${q.toString()}`
        );
      },
      [router, uid]
    );

  const openNotificationThread =
    useCallback(
      (n: Notif) => {
        if (!uid) return;

        const peerId =
          n.byUserId || "";

        if (!peerId) return;

        const threadId =
          n.threadId ||
          makeThreadId(
            uid,
            peerId
          );

        const q =
          new URLSearchParams({
            thread: threadId,
            peerId,
            peerName:
              n.peer?.byName ||
              n.byName ||
              "",
            peerPhotoURL:
              n.peer
                ?.byPhotoURL ||
              n.byPhotoURL ||
              "",
            peerHandle:
              n.peer?.handle ||
              n.handle ||
              "",
          });

        router.push(
          `/bonga?${q.toString()}`
        );
      },
      [router, uid]
    );

  const followBack =
    useCallback(
      async (
        theirId: string
      ) => {
        if (
          !uid ||
          uid === theirId ||
          followingSet.has(
            theirId
          ) ||
          pendingFollow.current.has(
            theirId
          )
        ) {
          return;
        }

        pendingFollow.current.add(
          theirId
        );

        try {
          await setDoc(
            doc(
              db,
              "follows",
              `${uid}_${theirId}`
            ),
            {
              followerId:
                uid,
              followingId:
                theirId,
              createdAt:
                serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        } finally {
          pendingFollow.current.delete(
            theirId
          );
        }
      },
      [
        uid,
        followingSet,
      ]
    );

  const confirmDelete =
    useCallback(async () => {
      if (
        !uid ||
        !pendingDeleteId
      ) {
        return;
      }

      try {
        setDeleting(true);

        await deleteDoc(
          doc(
            db,
            "users",
            uid,
            "notifications",
            pendingDeleteId
          )
        );

        setPendingDeleteId(
          null
        );
      } finally {
        setDeleting(false);
      }
    }, [
      uid,
      pendingDeleteId,
    ]);

  const loading =
    activeTab ===
      "followers"
      ? followersLoading
      : activeTab === "all"
        ? notificationsLoading ||
        followersLoading
        : notificationsLoading;

  const tabs: Array<{
    key: TabKey;
    label: string;
    count: number;
  }> = [
      {
        key: "all",
        label: "All",
        count:
          totalUnread,
      },
      {
        key: "activity",
        label: "Activity",
        count:
          unreadNotifications -
          systemUnread,
      },
      {
        key: "followers",
        label: "Followers",
        count:
          unreadFollowers,
      },
      {
        key: "system",
        label: "System",
        count:
          systemUnread,
      },
    ];

  const Header = (
    <>
      <div className="relative shrink-0 overflow-hidden bg-[#173C2E] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
          }}
        />

        <div className="relative mx-auto max-w-[1040px] px-4 pb-4 pt-4 md:pb-5 md:pt-5">
          <div className="flex items-start gap-3">
            {isMobile ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.history
                      .length > 1
                  ) {
                    router.back();
                  } else {
                    router.push(
                      "/deeds"
                    );
                  }
                }}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white"
                aria-label="Back"
              >
                <IoChevronBack
                  size={18}
                />
              </button>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#c69258]">
                ekarihub updates
              </div>

              <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                    Notifications
                  </h1>

                  <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-white/50 md:text-[12px]">
                    Stay up to date with activity, followers, bookings and important ekarihub notices.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void markAllRead()
                    }
                    disabled={
                      totalUnread ===
                      0
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.07] px-3 text-[10px] font-black text-white transition hover:bg-white/[0.12] disabled:opacity-40"
                  >
                    <IoCheckmarkCircleOutline
                      size={14}
                    />
                    Mark all read
                  </button>

                  <button
                    type="button"
                    onClick={
                      onRefresh
                    }
                    className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white transition hover:bg-white/[0.12]"
                    title="Refresh"
                  >
                    <motion.span
                      animate={
                        refreshing
                          ? {
                            rotate:
                              360,
                          }
                          : {
                            rotate:
                              0,
                          }
                      }
                      transition={{
                        duration:
                          0.6,
                        ease: "linear",
                      }}
                    >
                      <IoRefreshOutline
                        size={15}
                      />
                    </motion.span>
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-white/45">
                <span className="rounded-full bg-white/[0.07] px-2.5 py-1">
                  {totalUnread} unread
                </span>

                <span>
                  {
                    notifications.length
                  } activity
                </span>

                <span>
                  {
                    followers.length
                  } followers
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-[#DDD8CC] bg-[#FBFAF6]">
        <div className="mx-auto max-w-[1040px]">
          <div className="flex items-center gap-1 overflow-x-auto px-3 no-scrollbar sm:px-4">
            {tabs.map(
              (tab) => {
                const active =
                  activeTab ===
                  tab.key;

                return (
                  <button
                    key={
                      tab.key
                    }
                    type="button"
                    onClick={() =>
                      setTab(
                        tab.key
                      )
                    }
                    className={clsx(
                      "relative inline-flex h-12 shrink-0 items-center gap-1.5 px-3 text-[11px] font-black transition-colors",
                      active
                        ? "text-[#173C2E]"
                        : "text-slate-400 hover:text-slate-700"
                    )}
                  >
                    {
                      tab.label
                    }

                    {tab.count >
                      0 ? (
                      <span
                        className={clsx(
                          "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px]",
                          active
                            ? "bg-[#c69258] text-white"
                            : "bg-[#EFECE5] text-slate-500"
                        )}
                      >
                        {tab.count >
                          99
                          ? "99+"
                          : tab.count}
                      </span>
                    ) : null}

                    {active ? (
                      <motion.span
                        layoutId="notification-tab-indicator"
                        className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#173C2E]"
                        transition={{
                          type: "spring",
                          stiffness:
                            420,
                          damping:
                            34,
                        }}
                      />
                    ) : null}
                  </button>
                );
              }
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-[#E4DED2] bg-[#F8F7F2]">
        <div className="mx-auto max-w-[1040px] px-3 py-3 sm:px-4">
          <div className="relative">
            <IoSearchOutline
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search notifications..."
              className="h-10 w-full rounded-[14px] border border-[#D9D3C7] bg-[#FBFAF6] pl-10 pr-4 text-[12px] font-semibold text-slate-700 outline-none transition focus:border-[#173C2E]/45 focus:ring-2 focus:ring-[#173C2E]/5"
            />
          </div>
        </div>
      </div>
    </>
  );

  const Content = (
    <div className="mx-auto w-full max-w-[1040px] px-0 pb-8 sm:px-4 sm:pt-4">
      {loading ? (
        <div className="grid min-h-[420px] place-items-center">
          <BouncingBallLoader />
        </div>
      ) : visibleRows.length ===
        0 ? (
        <EmptyState
          tab={activeTab}
        />
      ) : (
        <AnimatePresence
          mode="popLayout"
        >
          <motion.div
            key={activeTab}
            initial={{
              opacity: 0,
              y: 4,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -3,
            }}
            transition={{
              duration: 0.16,
            }}
            className="overflow-hidden border-y border-[#DDD8CC] bg-[#FBFAF6] sm:rounded-[18px] sm:border sm:shadow-[0_10px_28px_rgba(15,23,42,0.035)]"
          >
            {grouped.map(
              ([
                bucket,
                rows,
              ]) => (
                <section
                  key={
                    bucket
                  }
                >
                  <div className="border-b border-[#E7E1D5] bg-[#F4F2ED] px-3 py-2 sm:px-4">
                    <h2 className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
                      {bucket}
                    </h2>
                  </div>

                  <ul className="divide-y divide-[#E7E1D5]">
                    <AnimatePresence
                      initial={
                        false
                      }
                    >
                      {rows.map(
                        (row) => {
                          if (
                            row.kind ===
                            "notification"
                          ) {
                            return (
                              <NotificationRow
                                key={`n-${row.notification.id}`}
                                n={
                                  row.notification
                                }
                                uid={
                                  uid
                                }
                                onOpenProfile={(
                                  handle
                                ) =>
                                  openProfile(
                                    handle
                                  )
                                }
                                onOpenThread={
                                  openNotificationThread
                                }
                                onDelete={
                                  setPendingDeleteId
                                }
                              />
                            );
                          }

                          return (
                            <FollowerItem
                              key={`f-${row.follower.userId}`}
                              row={
                                row.follower
                              }
                              uid={
                                uid ||
                                ""
                              }
                              isFollowing={followingSet.has(
                                row
                                  .follower
                                  .userId
                              )}
                              pending={pendingFollow.current.has(
                                row
                                  .follower
                                  .userId
                              )}
                              onFollow={(
                                id
                              ) =>
                                void followBack(
                                  id
                                )
                              }
                              onMessage={
                                openFollowerThread
                              }
                              onOpenProfile={(
                                handle
                              ) =>
                                openProfile(
                                  handle
                                )
                              }
                            />
                          );
                        }
                      )}
                    </AnimatePresence>
                  </ul>
                </section>
              )
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );

  if (!uid) {
    const SignedOut = (
      <div className="grid min-h-[480px] place-items-center px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
            <IoNotificationsOutline
              size={24}
            />
          </div>

          <h2 className="mt-4 text-[16px] font-black text-slate-900">
            Sign in to view notifications
          </h2>

          <p className="mt-1 text-[12px] font-medium leading-5 text-slate-400">
            Likes, comments, followers, bookings and important updates will appear here.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/getstarted?next=/notifications"
              )
            }
            className="mt-5 h-10 rounded-xl bg-[#173C2E] px-4 text-[11px] font-black text-white"
          >
            Continue
          </button>
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">
          {Header}

          <main className="min-h-0 flex-1 overflow-y-auto">
            {SignedOut}
          </main>
        </div>
      );
    }

    return (
      <AppShell>
        <main className="h-full min-h-0 overflow-y-auto bg-[#F8F7F2]">
          {Header}
          {SignedOut}
        </main>
      </AppShell>
    );
  }

  const Page = (
    <>
      {Header}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#F8F7F2] [-webkit-overflow-scrolling:touch]">
        {Content}
      </main>

      <AnimatePresence>
        {pendingDeleteId ? (
          <DeleteModal
            open
            deleting={
              deleting
            }
            onCancel={() =>
              setPendingDeleteId(
                null
              )
            }
            onConfirm={() =>
              void confirmDelete()
            }
          />
        ) : null}
      </AnimatePresence>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">
        {Page}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#F8F7F2]">
        {Page}
      </div>
    </AppShell>
  );
}