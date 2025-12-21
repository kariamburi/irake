// app/notifications/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
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

/** Small pill counter */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full bg-red-600 text-white text-[11px] font-extrabold px-1">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const router = useRouter();

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const ringStyle: React.CSSProperties = {
    ["--tw-ring-color" as any]: EKARI.forest,
  };

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
      else setNotifPreview(n.title || "New activity on Ekarihub 🔔");
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
      className={clsx("border-b sticky top-0 z-50 backdrop-blur")}
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        borderColor: EKARI.hair,
      }}
    >
      <div
        className={clsx(
          isDesktop ? "h-14 px-4 max-w-[1180px] mx-auto" : "h-14 px-3"
        )}
      >
        <div className="h-full flex items-center justify-between gap-2">
          <button
            onClick={goBack}
            className="p-2 rounded-xl border transition hover:bg-black/5 focus:outline-none focus:ring-2"
            style={{ borderColor: EKARI.hair, ...ringStyle }}
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
            {isMobile && (
              <div className="text-[11px] mt-0.5" style={{ color: EKARI.dim }}>
                {notifCount + followersCount > 0
                  ? `${notifCount + followersCount} new`
                  : "You’re all caught up"}
              </div>
            )}
          </div>

          <div className="w-10" />
        </div>
      </div>
    </div>
  );

  const TopCards = (
    <div className={clsx(isDesktop ? "px-4 pt-4 max-w-[1180px] mx-auto" : "px-3 pt-3")}>
      <div className={clsx(isDesktop ? "grid grid-cols-2 gap-3" : "space-y-3")}>
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full bg-white rounded-2xl border px-3 py-3 flex items-center gap-3 shadow-sm hover:shadow transition"
          style={{ borderColor: EKARI.hair }}
          onClick={() => pushSafe(router, "/followers")}
        >
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: EKARI.forest }}
          >
            <IoPeopleOutline />
          </span>
          <div className="flex-1 text-left min-w-0">
            <div className="font-extrabold text-[15px]" style={{ color: EKARI.text }}>
              New followers
            </div>
            {followersPreview ? (
              <div className="text-[13px] truncate" style={{ color: EKARI.sub }}>
                {followersPreview}
              </div>
            ) : (
              <div className="text-[13px]" style={{ color: "#94A3B8" }}>
                No new followers
              </div>
            )}
          </div>
          <CountBadge count={followersCount} />
          <IoChevronForward className="ml-2" style={{ color: "#94A3B8" }} />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full bg-white rounded-2xl border px-3 py-3 flex items-center gap-3 shadow-sm hover:shadow transition"
          style={{ borderColor: EKARI.hair }}
          onClick={() => pushSafe(router, "/activity")}
        >
          <span
            className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: EKARI.gold }}
          >
            <IoNotificationsOutline />
          </span>
          <div className="flex-1 text-left min-w-0">
            <div className="font-extrabold text-[15px]" style={{ color: EKARI.text }}>
              Activity
            </div>
            {notifPreview ? (
              <div className="text-[13px] truncate" style={{ color: EKARI.sub }}>
                {notifPreview}
              </div>
            ) : (
              <div className="text-[13px]" style={{ color: "#94A3B8" }}>
                No new activity
              </div>
            )}
          </div>
          <CountBadge count={notifCount} />
          <IoChevronForward className="ml-2" style={{ color: "#94A3B8" }} />
        </motion.button>
      </div>
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
          <div
            className="mx-auto h-12 w-12 rounded-full grid place-items-center mb-3"
            style={{ backgroundColor: hexToRgba(EKARI.forest, 0.06) }}
          >
            <IoNotificationsOutline size={22} style={{ color: EKARI.forest }} />
          </div>
          <div className="text-[15px] font-extrabold" style={{ color: EKARI.text }}>
            You’re all caught up
          </div>
          <div className="mt-1 text-sm" style={{ color: EKARI.dim }}>
            New likes, comments, and follows will show up here.
          </div>
        </div>
      ) : (
        <ul className={clsx(isDesktop ? "px-4 py-4" : "px-3 py-4", "space-y-2")}>
          {items.map((n) => (
            <NotificationItem
              key={n.id}
              n={n}
              handle={myHandle}
              onOpen={(href) => pushSafe(router, href)}
            />
          ))}
          {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
        </ul>
      )}
    </div>
  );

  // If not signed in
  if (!uid) {
    const Empty = (
      <div className="min-h-screen flex items-center justify-center px-6 text-center" style={{ backgroundColor: EKARI.sand }}>
        <div>
          <div className="text-lg font-extrabold" style={{ color: EKARI.text }}>
            Sign in to view notifications
          </div>
          <div className="text-sm mt-1" style={{ color: EKARI.dim }}>
            Likes, comments, and follows will appear here.
          </div>
        </div>
      </div>
    );

    return isMobile ? (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: EKARI.sand }}>
        {Header}
        <div className="flex-1 overflow-y-auto">{Empty}</div>
      </div>
    ) : (
      <AppShell>
        {Header}
        {Empty}
      </AppShell>
    );
  }

  const Content = (
    <>
      {TopCards}
      <div className={clsx(isDesktop ? "mt-2" : "mt-1")}>{List}</div>
    </>
  );

  // MOBILE: fixed inset like /bonga, NO bottom tabs
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: EKARI.sand }}>
        {Header}
        <div className="flex-1 overflow-y-auto overscroll-contain">{Content}</div>
      </div>
    );
  }

  // DESKTOP: AppShell + max width like /bonga desktop
  return (
    <AppShell>
      <div className="min-h-screen w-full" style={{ backgroundColor: EKARI.sand }}>
        {Header}
        {Content}
      </div>
    </AppShell>
  );
}
