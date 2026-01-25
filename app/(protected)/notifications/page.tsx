// app/notifications/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import {
  IoChevronForward,
  IoNotificationsOutline,
  IoPeopleOutline,
} from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";

import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { useRouter } from "next/navigation";
import { NotificationItem } from "@/app/components/NotificationItem";

export const dynamic = "force-dynamic";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
};

/* ---------------- responsive helpers ---------------- */
function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
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

/** Safer router.push wrapper */
function pushSafe(router: ReturnType<typeof useRouter>, href?: string) {
  if (!href || typeof href !== "string") return;
  try {
    router.push(href);
  } catch {
    // no-op
  }
}

function hexToRgba(hex: string, alpha: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/* ---------------- premium UI helpers ---------------- */
function PremiumSurface({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl border bg-white/80 backdrop-blur-xl",
        "shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function PremiumIconTile({
  icon,
  variant,
}: {
  icon: React.ReactNode;
  variant: "forest" | "gold";
}) {
  const bg =
    variant === "forest"
      ? "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,0.40))"
      : "linear-gradient(135deg, rgba(199,146,87,1), rgba(35,63,57,0.55))";

  return (
    <span
      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
      style={{ background: bg }}
    >
      {icon}
    </span>
  );
}

/** Small pill counter */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-red-600 text-white text-[11px] font-extrabold px-1 shadow-sm">
      {count > 99 ? "99+" : count}
    </span>
  );
}

type Notif = {
  id: string;
  type?:
  | "like"
  | "comment"
  | "follow"
  | "profile_view"
  | "payment_success"
  | string;
  byName?: string;
  title?: string;
  preview?: string;
  createdAt?: any;
  seen?: boolean;
  meta?: Record<string, any>;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const router = useRouter();

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const ringStyle: React.CSSProperties = {
    ["--tw-ring-color" as any]: EKARI.forest,
  };

  const premiumBg = useMemo<React.CSSProperties>(
    () => ({
      background:
        "radial-gradient(900px circle at 10% 0%, rgba(199,146,87,0.22), rgba(255,255,255,0) 55%), radial-gradient(900px circle at 90% 20%, rgba(35,63,57,0.16), rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,1))",
    }),
    []
  );

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  const [followersCount, setFollowersCount] = useState(0);
  const [followersPreview, setFollowersPreview] = useState<string>("");

  // exclude "follow" so we don't duplicate (followers card covers it)
  const [notifCount, setNotifCount] = useState(0);
  const [notifPreview, setNotifPreview] = useState<string>("");

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [myHandle, setMyHandle] = useState<string>("");

  // load my handle (for NotificationItem routing)
  useEffect(() => {
    if (!uid) return;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        const data = snap.exists() ? (snap.data() as any) : null;
        const h =
          (data?.handle as string | undefined) ||
          (data?.username as string | undefined) ||
          "";
        if (!cancelled) setMyHandle(h);
      } catch {
        if (!cancelled) setMyHandle("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // live counts + previews
  useEffect(() => {
    if (!uid) return;

    const fq = query(
      collection(db, "users", uid, "followers"),
      where("seen", "==", false)
    );
    const u1 = onSnapshot(fq, (snap) => setFollowersCount(snap.size));

    const fLatestQ = query(
      collection(db, "users", uid, "followers"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const u2 = onSnapshot(fLatestQ, (snap) => {
      const it = snap.docs[0]?.data() as any;
      setFollowersPreview(it?.name ? `${it.name} started following you 🤝` : "");
    });

    const nq = query(
      collection(db, "users", uid, "notifications"),
      where("seen", "==", false)
    );
    const u3 = onSnapshot(nq, (snap) => {
      const c = snap.docs.filter((d) => (d.data() as any)?.type !== "follow")
        .length;
      setNotifCount(c);
    });

    const nLatestQ = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const u4 = onSnapshot(nLatestQ, (snap) => {
      const docs = snap.docs.map((d) => d.data() as any);
      const n = docs.find((x) => x?.type !== "follow");
      if (!n) return setNotifPreview("");

      if (n.type === "like")
        setNotifPreview(`${n.byName || "Someone"} liked your deed 👍`);
      else if (n.type === "comment")
        setNotifPreview(`${n.byName || "Someone"} commented: ${n.preview || ""}`);
      else if (n.type === "profile_view")
        setNotifPreview(`${n.byName || "Someone"} checked out your profile 👀`);
      else if (n.type === "payment_success")
        setNotifPreview(n.preview || n.title || "Payment successful ✅");
      else setNotifPreview(n.title || "New activity on ekarihub 🔔");
    });

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [uid]);

  // full list (exclude follow)
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const qy = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(qy, (snap) => {
      const arr: Notif[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((n) => n.type !== "follow");
      setItems(arr);
      setLoading(false);
    });

    return () => unsub();
  }, [uid]);

  const Header = (
    <div
      className={clsx("sticky top-0 z-50")}
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(199,146,87,0.18)",
      }}
    >
      <div className={clsx(isDesktop ? "px-4 max-w-[1180px] mx-auto" : "px-3")}>
        <div className="h-[72px] flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            className="h-11 w-11 rounded-2xl border bg-white/80 backdrop-blur-xl shadow-sm grid place-items-center transition hover:bg-white focus:outline-none focus:ring-2 active:scale-[0.98]"
            style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
            aria-label="Go back"
          >
            <ArrowLeft size={18} style={{ color: EKARI.text }} />
          </button>

          <div className="flex-1 min-w-0">
            <div
              className="font-black text-[18px] leading-none truncate"
              style={{ color: EKARI.text }}
            >
              Notifications
            </div>
            <div className="text-[12px] mt-1 font-semibold" style={{ color: EKARI.dim }}>
              {notifCount + followersCount > 0
                ? `${notifCount + followersCount} new`
                : "You’re all caught up"}
            </div>
          </div>

          <div
            className="h-11 px-4 rounded-full border bg-white/80 backdrop-blur-xl shadow-sm flex items-center gap-2"
            style={{ borderColor: "rgba(199,146,87,0.22)" }}
            aria-label="Unread summary"
          >
            <span
              className="h-8 w-8 rounded-2xl grid place-items-center border"
              style={{
                borderColor: "rgba(199,146,87,0.18)",
                background: "linear-gradient(135deg, rgba(199,146,87,0.14), rgba(35,63,57,0.06))",
              }}
            >
              <IoNotificationsOutline size={16} style={{ color: EKARI.forest }} />
            </span>
            <div className="text-[12px] font-extrabold" style={{ color: EKARI.text }}>
              {notifCount + followersCount > 99 ? "99+" : notifCount + followersCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const TopCards = (
    <div className={clsx(isDesktop ? "px-4 pt-4 max-w-[1180px] mx-auto" : "px-3 pt-3")}>
      <div className={clsx(isDesktop ? "grid grid-cols-2 gap-4" : "space-y-3")}>
        <motion.button
          whileTap={{ scale: 0.985 }}
          className="w-full text-left"
          onClick={() => pushSafe(router, "/followers")}
        >
          <PremiumSurface
            className="px-4 py-4 transition hover:shadow-[0_22px_70px_rgba(15,23,42,0.12)]"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <div className="flex items-center gap-3">
              <PremiumIconTile icon={<IoPeopleOutline size={18} />} variant="forest" />
              <div className="flex-1 min-w-0">
                <div className="font-black text-[15px]" style={{ color: EKARI.text }}>
                  New followers
                </div>
                {followersPreview ? (
                  <div className="text-[13px] truncate font-semibold" style={{ color: EKARI.sub }}>
                    {followersPreview}
                  </div>
                ) : (
                  <div className="text-[13px] font-semibold" style={{ color: EKARI.dim }}>
                    No new followers
                  </div>
                )}
              </div>
              <CountBadge count={followersCount} />
              <span
                className="h-10 w-10 rounded-2xl grid place-items-center border bg-white/70"
                style={{ borderColor: "rgba(199,146,87,0.18)" }}
              >
                <IoChevronForward style={{ color: EKARI.dim }} />
              </span>
            </div>
          </PremiumSurface>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.985 }}
          className="w-full text-left"
          onClick={() => pushSafe(router, "/activity")}
        >
          <PremiumSurface
            className="px-4 py-4 transition hover:shadow-[0_22px_70px_rgba(15,23,42,0.12)]"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <div className="flex items-center gap-3">
              <PremiumIconTile icon={<IoNotificationsOutline size={18} />} variant="gold" />
              <div className="flex-1 min-w-0">
                <div className="font-black text-[15px]" style={{ color: EKARI.text }}>
                  Activity
                </div>
                {notifPreview ? (
                  <div className="text-[13px] truncate font-semibold" style={{ color: EKARI.sub }}>
                    {notifPreview}
                  </div>
                ) : (
                  <div className="text-[13px] font-semibold" style={{ color: EKARI.dim }}>
                    No new activity
                  </div>
                )}
              </div>
              <CountBadge count={notifCount} />
              <span
                className="h-10 w-10 rounded-2xl grid place-items-center border bg-white/70"
                style={{ borderColor: "rgba(199,146,87,0.18)" }}
              >
                <IoChevronForward style={{ color: EKARI.dim }} />
              </span>
            </div>
          </PremiumSurface>
        </motion.button>
      </div>

      {/* subtle divider */}
      <div className="mt-4 h-px" style={{ backgroundColor: "rgba(199,146,87,0.16)" }} />
    </div>
  );

  const List = (
    <div className={clsx(isDesktop ? "max-w-[1180px] mx-auto" : "")}>
      {loading ? (
        <div className="py-12 flex items-center justify-center" style={{ color: EKARI.dim }}>
          <BouncingBallLoader />
        </div>
      ) : items.length === 0 ? (
        <div className={clsx(isDesktop ? "px-4 py-16" : "px-6 py-16", "text-center")}>
          <PremiumSurface
            className="mx-auto max-w-[520px] px-6 py-8"
            style={{
              borderColor: "rgba(199,146,87,0.22)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <div
              className="mx-auto h-14 w-14 rounded-3xl grid place-items-center mb-3 border"
              style={{
                borderColor: "rgba(199,146,87,0.20)",
                background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
              }}
            >
              <IoNotificationsOutline size={24} style={{ color: EKARI.forest }} />
            </div>
            <div className="text-[16px] font-black" style={{ color: EKARI.text }}>
              You’re all caught up
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: EKARI.dim }}>
              New likes, comments, and follows will show up here.
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[12px] font-semibold" style={{ color: EKARI.sub }}>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: hexToRgba(EKARI.gold, 0.8) }}
              />
              Real-time updates enabled
            </div>
          </PremiumSurface>
        </div>
      ) : (
        <div className={clsx(isDesktop ? "px-4 py-5" : "px-3 py-4")}>
          <PremiumSurface
            className="p-2"
            style={{
              borderColor: "rgba(199,146,87,0.20)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
            }}
          >
            <ul className="space-y-2">
              {items.map((n) => (
                <li key={n.id}>
                  {/* keep your NotificationItem exactly the same */}
                  <NotificationItem
                    n={n}
                    handle={myHandle}
                    onOpen={(href) => pushSafe(router, href)}
                  />
                </li>
              ))}
              {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
            </ul>
          </PremiumSurface>

          {/* small footer note */}
          <div className="mt-3 text-[12px] font-semibold text-center" style={{ color: EKARI.dim }}>
            Tip: Tap a notification to open the related deed / profile / activity.
          </div>
        </div>
      )}
    </div>
  );

  // If not signed in
  if (!uid) {
    const Empty = (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={premiumBg}>
        <PremiumSurface
          className="max-w-[520px] w-full px-6 py-8"
          style={{
            borderColor: "rgba(199,146,87,0.22)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.72))",
          }}
        >
          <div
            className="mx-auto h-14 w-14 rounded-3xl grid place-items-center mb-3 border"
            style={{
              borderColor: "rgba(199,146,87,0.20)",
              background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
            }}
          >
            <IoNotificationsOutline size={24} style={{ color: EKARI.forest }} />
          </div>

          <div className="text-lg font-black" style={{ color: EKARI.text }}>
            Sign in to view notifications
          </div>
          <div className="text-sm mt-1 font-semibold" style={{ color: EKARI.dim }}>
            Likes, comments, and follows will appear here.
          </div>

          <div className="mt-5 text-[12px] font-semibold" style={{ color: EKARI.sub }}>
            Secure • Real-time • Personal
          </div>
        </PremiumSurface>
      </div>
    );

    return isMobile ? (
      <div className="fixed inset-0 flex flex-col" style={premiumBg}>
        {Header}
        <div className="flex-1 overflow-y-auto">{Empty}</div>
      </div>
    ) : (
      <AppShell>
        <div className="min-h-screen" style={premiumBg}>
          {Header}
          {Empty}
        </div>
      </AppShell>
    );
  }

  const Content = (
    <>
      {TopCards}
      <div className={clsx(isDesktop ? "mt-2" : "mt-1")}>{List}</div>
    </>
  );

  // MOBILE: fixed inset, NO bottom tabs
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={premiumBg}>
        {Header}
        <div className="flex-1 overflow-y-auto overscroll-contain">{Content}</div>
      </div>
    );
  }

  // DESKTOP: AppShell + max width
  return (
    <AppShell>
      <div className="min-h-screen w-full" style={premiumBg}>
        {Header}
        {Content}
      </div>
    </AppShell>
  );
}