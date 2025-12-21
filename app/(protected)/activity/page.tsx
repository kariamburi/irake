// app/activity/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import {
  IoChevronBack,
  IoSearchOutline,
  IoHeart,
  IoChatbubbleEllipses,
  IoPersonAdd,
  IoNotifications,
  IoCheckmarkCircleOutline,
} from "react-icons/io5";
import clsx from "clsx";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

/* ---------------------------- Theme ---------------------------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
  tintNew: "#F9FAFB",
};

/* ---------------------------- Responsive helpers ---------------------------- */
function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(queryStr);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [queryStr]);
  return matches;
}
function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}

/* ---------------------------- Types ---------------------------- */
type Notif = {
  id: string;
  type: "like" | "comment" | "follow" | string;
  byUserId?: string;
  handle?: string;
  byName?: string;
  byPhotoURL?: string | null;
  preview?: string | null;
  createdAt?: any;
  seen?: boolean;
  deedId?: string;
  threadId?: string;
  peer?: {
    byName?: string;
    byPhotoURL?: string | null;
    handle?: string;
  };
};

/* ---------------------------- Utils ---------------------------- */
function tsToDate(ts: any): Date {
  if (!ts) return new Date();
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  return new Date();
}

function timeAgo(input: any) {
  const d = tsToDate(input).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}d`;
  const date = new Date(d);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayBucket(date: Date) {
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 3600 * 1000;
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (t >= startOfToday) return "Today";
  if (t >= startOfYesterday) return "Yesterday";
  return "Earlier";
}

function primaryText(n: Notif) {
  if (n.type === "like") return `Liked your deed 👍`;
  if (n.type === "comment") return `Commented your deed: ${n.preview || ""}`;
  else if (n.type === "profile_view") return `Checked out your profile 👀`;
  if (n.type === "follow") return `Started following you 🤝`;
  return n.byName || "Notification";
}

function badgeFor(n: Notif) {
  switch (n.type) {
    case "like":
      return { icon: IoHeart, bg: "#FF3B5C", color: "#fff", label: "like" };
    case "comment":
      return {
        icon: IoChatbubbleEllipses,
        bg: EKARI.forest,
        color: "#fff",
        label: "comment",
      };
    case "follow":
      return { icon: IoPersonAdd, bg: EKARI.gold, color: "#fff", label: "follow" };
    default:
      return { icon: IoNotifications, bg: EKARI.forest, color: "#fff", label: "notif" };
  }
}

/* ----------------------- Smart Avatar (loader) ----------------------- */
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
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const displayed = !err && (src || fallback) ? src || fallback : fallback;

  return (
    <div
      className="relative overflow-hidden rounded-full bg-gray-100"
      style={{ width: size, height: size }}
      aria-label={alt}
    >
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-gray-100">
          <div
            className="h-5 w-5 rounded-full border-2 animate-spin"
            style={{ borderColor: "#D1D5DB", borderTopColor: EKARI.forest }}
          />
        </div>
      )}
      <Image
        src={displayed}
        alt={alt}
        fill
        sizes={`${size}px`}
        className={clsx(
          "object-cover transition-opacity",
          loading ? "opacity-0" : "opacity-100"
        )}
        onLoadingComplete={() => setLoading(false)}
        onError={() => {
          setErr(true);
          setLoading(false);
        }}
      />
    </div>
  );
}

/* --------------------------- Row component --------------------------- */
function NotifRow({
  n,
  uid,
  onOpenProfile,
  onOpenThread,
  highlight,
}: {
  n: Notif;
  uid?: string | null;
  onOpenProfile: (handle?: string, name?: string, photoURL?: string | null) => void;
  onOpenThread: (n?: any) => void;
  highlight?: boolean;
}) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const router = useRouter();

  // Only check follow state for "follow" notifications with valid byUserId
  useEffect(() => {
    let mounted = true;
    async function check() {
      if (!uid || n.type !== "follow" || !n.byUserId || n.byUserId === uid) {
        if (mounted) setFollowing(null);
        return;
      }
      try {
        const ref = doc(db, "follows", `${uid}_${n.byUserId}`);
        const s = await getDoc(ref);
        if (mounted) setFollowing(s.exists());
      } catch {
        if (mounted) setFollowing(null);
      }
    }
    check();
    return () => {
      mounted = false;
    };
  }, [uid, n.type, n.byUserId]);

  const canFollowBack = n.type === "follow" && n.byUserId && uid && n.byUserId !== uid;

  async function followBack() {
    if (!uid || !n.byUserId || following) return;
    try {
      const ref = doc(db, "follows", `${uid}_${n.byUserId}`);
      const s = await getDoc(ref);
      if (s.exists()) {
        setFollowing(true);
        return;
      }
      await setDoc(ref, {
        followerId: uid,
        followingId: n.byUserId,
        createdAt: serverTimestamp(),
      });
      setFollowing(true);
    } catch {
      // ignore
    }
  }

  const badge = badgeFor(n);
  const AvatarBadgeIcon = badge.icon;

  return (
    <li
      className={clsx(
        "px-3 py-3 transition",
        highlight ? "bg-[#F9FAFB]" : "bg-white",
        "hover:bg-gray-50"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar – ALWAYS go to profile */}
        <button
          type="button"
          onClick={() => onOpenProfile(n.handle, n.byName, n.byPhotoURL)}
          className="relative shrink-0"
          aria-label={`${n.byName || "User"} profile`}
        >
          <div className="relative">
            <SmartAvatar src={n.byPhotoURL} alt={n.byName || "User"} size={46} />
            <span
              className="absolute -right-1 -bottom-1 w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center"
              style={{ backgroundColor: badge.bg }}
              aria-label={badge.label}
              title={badge.label}
            >
              <AvatarBadgeIcon size={10} color={badge.color} />
            </span>
          </div>
        </button>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            {/* Name – ALWAYS go to profile */}
            <button
              type="button"
              onClick={() => onOpenProfile(n.handle, n.byName, n.byPhotoURL)}
              className="text-left group"
            >
              <div
                className={clsx(
                  "font-extrabold text-[15px] truncate",
                  "text-slate-900",
                  "group-hover:underline"
                )}
              >
                {n.byName || "User"}
              </div>
            </button>

            <div className="ml-2 text-[12px] text-slate-500">{timeAgo(n.createdAt)}</div>
          </div>

          {/* Primary text – click → deed (like/comment) or profile */}
          <button
            type="button"
            onClick={() => {
              if ((n.type === "comment" || n.type === "like") && n.deedId && n.handle) {
                router.push(`/${encodeURIComponent(n.handle)}/deed/${n.deedId}`);
              } else {
                onOpenProfile(n.handle, n.byName, n.byPhotoURL);
              }
            }}
            className="mt-0.5 text-[13px] text-slate-600 hover:text-slate-900 hover:underline text-left"
          >
            {primaryText(n)}
          </button>
        </div>

        {/* Right actions */}
        {canFollowBack && following !== null && !following && (
          <button
            onClick={followBack}
            className="h-8 px-3 rounded-full text-white text-[12px] font-extrabold hover:opacity-95"
            style={{ backgroundColor: EKARI.gold }}
          >
            Follow
          </button>
        )}
        {canFollowBack && following === true && (
          <button
            onClick={() => onOpenThread(n)}
            className="h-8 px-3 rounded-full border text-[12px] font-bold hover:bg-gray-100"
            style={{
              backgroundColor: "#FFFFFF",
              borderColor: EKARI.forest,
              color: EKARI.forest,
            }}
          >
            Message
          </button>
        )}

        {/* Unread dot – forest */}
        {n.seen === false && (
          <span className="ml-1 inline-flex items-center justify-center" title="Unread" aria-label="Unread">
            <IoCheckmarkCircleOutline size={16} style={{ color: EKARI.forest }} />
          </span>
        )}
      </div>
    </li>
  );
}

/* --------------------------- Page component --------------------------- */
export default function ActivityPage() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const router = useRouter();

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const goBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Sticky header shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Live notifications (seen + unseen), newest first
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const qAll = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qAll, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Notif[];
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  // Mark any unseen as seen when loaded/displayed
  useEffect(() => {
    if (!uid || items.length === 0) return;
    const unseen = items.filter((n) => n.seen === false);
    if (unseen.length === 0) return;
    (async () => {
      try {
        const b = writeBatch(db);
        unseen.forEach((n) =>
          b.update(doc(db, "users", uid, "notifications", n.id), { seen: true })
        );
        await b.commit();
      } catch {
        // ignore
      }
    })();
  }, [uid, items]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const openProfile = (handle?: string, _name?: string, _photoURL?: string | null) => {
    if (!handle) return;
    router.push(`/${encodeURIComponent(handle)}`);
  };

  const openThread = (row: any) => {
    const peerName = row?.peer?.byName ?? "";
    const peerPhotoURL = row?.peer?.byPhotoURL ?? "";
    const peerHandle = row?.peer?.handle ?? "";
    const q = new URLSearchParams({
      peerId: row?.byUserId || "",
      peerName,
      peerPhotoURL,
      peerHandle,
    });
    router.push(`/bonga/${row?.threadId}?${q.toString()}`);
  };

  // Group notifications by day bucket
  const grouped = useMemo(() => {
    const map = new Map<string, Notif[]>();
    items.forEach((n) => {
      const d = tsToDate(n.createdAt);
      const bucket = dayBucket(d);
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(n);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const order = ["Today", "Yesterday", "Earlier"];
      return order.indexOf(a[0]) - order.indexOf(b[0]);
    });
  }, [items]);

  const totalUnseen = items.filter((n) => n.seen === false).length;

  // ✅ Put your existing inner page JSX into Body
  const Body = (
    <div className={isDesktop ? "min-h-screen w-full bg-white" : "min-h-screen w-full bg-white"}>
      {/* Desktop header row (keep original header for desktop only to avoid double headers) */}
      {isDesktop && (
        <div
          className={clsx(
            "sticky top-0 z-20 h-14 px-3 flex items-center justify-between bg-white border-b",
            scrolled ? "shadow-sm border-gray-200" : "border-gray-100"
          )}
        >
          <button
            onClick={goBack}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Back"
          >
            <IoChevronBack size={22} className="text-slate-900" />
          </button>

          <div className="flex items-center gap-2">
            <div className="font-black text-slate-900 text-[18px]">Activity</div>
            {totalUnseen > 0 && (
              <span
                className="ml-1 inline-flex items-center justify-center h-5 px-2 rounded-full text-[11px] font-extrabold text-white"
                style={{ backgroundColor: EKARI.forest }}
                aria-label={`${totalUnseen} unread`}
              >
                {totalUnseen}
              </span>
            )}
          </div>

          <button
            onClick={() => router.push("/search")}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Search"
          >
            <IoSearchOutline size={18} className="text-slate-900" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <div className="text-xs text-gray-500">
          {items.length} item{items.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-500 gap-3">
          <div className="animate-spin h-6 w-6 border-2 border-emerald-600 border-t-transparent rounded-full" />
          <BouncingBallLoader />
        </div>
      ) : items.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-emerald-50 grid place-items-center">
            <IoNotifications className="text-emerald-700" size={24} />
          </div>
          <div className="font-extrabold text-slate-900">No notifications yet</div>
          <p className="mt-1 text-sm text-slate-500">
            We’ll show likes, comments, and new followers here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {grouped.map(([label, rows]) => (
            <section key={label} className="bg-white">
              {/* For desktop Body (non-fixed wrapper), this can remain sticky below header */}
              <div className="sticky top-[56px] z-10 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
                <div className="px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-gray-500">
                  {label}
                </div>
              </div>

              <ul className="divide-y divide-gray-200">
                {rows.map((n) => (
                  <NotifRow
                    key={n.id}
                    n={n}
                    uid={uid}
                    onOpenProfile={openProfile}
                    onOpenThread={openThread}
                    highlight={n.seen === false}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Mobile safe area spacer */}
      {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}

      <div className="h-6" />
    </div>
  );

  // ✅ Loading wrapper adapted for mobile/desktop
  if (loading) {
    const LoadingBody = (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse" style={{ color: EKARI.gold }}>
          <BouncingBallLoader />
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <div className="fixed inset-0 flex flex-col bg-white">
          <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
            <div
              className="h-14 px-3 flex items-center gap-2"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <button
                onClick={goBack}
                className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
                aria-label="Back"
              >
                <IoChevronBack size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-black" style={{ color: EKARI.text }}>
                  Activity
                </div>
                <div className="truncate text-[11px]" style={{ color: EKARI.dim }}>
                  Notifications
                </div>
              </div>
              <button
                onClick={() => router.push("/search")}
                className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
                aria-label="Search"
              >
                <IoSearchOutline size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">{LoadingBody}</div>
        </div>
      );
    }

    return <AppShell>{LoadingBody}</AppShell>;
  }

  // ✅ MOBILE: fixed inset + sticky header + scroll area (no AppShell)
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col bg-white">
        {/* Sticky top bar */}
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div
            className="h-14 px-3 flex items-center gap-2"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <button
              onClick={goBack}
              className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
              aria-label="Back"
              title="Back"
            >
              <IoChevronBack size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-black" style={{ color: EKARI.text }}>
                Activity
              </div>
              <div className="truncate text-[11px]" style={{ color: EKARI.dim }}>
                {totalUnseen > 0 ? `${totalUnseen} unread` : "Notifications"}
              </div>
            </div>

            <button
              onClick={() => router.push("/search")}
              className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
              aria-label="Search"
              title="Search"
            >
              <IoSearchOutline size={18} />
            </button>
          </div>
        </div>

        {/* Scroll content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* NOTE: Body contains a desktop-only header. On mobile it won't render. */}
          {Body}
        </div>
      </div>
    );
  }

  // ✅ DESKTOP: keep AppShell
  return <AppShell>{Body}</AppShell>;
}
