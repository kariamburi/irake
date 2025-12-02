"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  collection,
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
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { useRouter } from "next/navigation";
import { NotificationItem } from "@/app/components/NotificationItem";

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
  type?: "like" | "comment" | "follow" | string;
  byName?: string;
  title?: string;
  preview?: string;
  createdAt?: any;
  seen?: boolean;
  // deepLink?: string;
  // byHandle?: string;
  // byId?: string;
  // deedId?: string;
  // listingId?: string;
};

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  return null;
}

function shortTime(ts: any) {
  const d = tsToDate(ts);
  if (!d) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${m} ${ampm}`;
  }
  const mon = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  return `${mon} ${day}`;
}

function buildPreview(n: Notif) {
  if (n.type === "like") return `${n.byName || "Someone"} liked your post.`;
  if (n.type === "comment")
    return `${n.byName || "Someone"} commented: ${n.preview || ""}`;
  if (n.type === "follow") return `${n.byName || "Someone"} started following you.`;
  return n.title || "New activity.";
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

/** Compute where to navigate for a given notification */
function routeForNotification(n: Notif): string | undefined {
  const anyN = n as any;

  if (anyN.deepLink && typeof anyN.deepLink === "string") {
    return anyN.deepLink;
  }

  if (n.type === "follow") {
    if (anyN.byHandle) return `/${anyN.byHandle}`;
    //if (anyN.byId) return `/u/${anyN.byId}`;
    return "/followers";
  }

  if (n.type === "comment" || n.type === "like") {
    alert(anyN.byHandle)
    if (anyN.deedId) return `${anyN.byHandle}/deed/${anyN.deedId}`;
    if (anyN.listingId) return `/market/${anyN.listingId}`;
    return "/activity";
  }

  return "/activity";
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

  const [followersCount, setFollowersCount] = useState(0);
  const [followersPreview, setFollowersPreview] = useState<string>("");

  // These two exclude "follow" so we don't duplicate the card below
  const [notifCount, setNotifCount] = useState(0);
  const [notifPreview, setNotifPreview] = useState<string>("");

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  // live counts + previews
  useEffect(() => {
    if (!uid) return;

    // unseen followers
    const fq = query(collection(db, "users", uid, "followers"), where("seen", "==", false));
    const u1 = onSnapshot(fq, (snap) => setFollowersCount(snap.size));

    // latest follower preview
    const fLatestQ = query(
      collection(db, "users", uid, "followers"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const u2 = onSnapshot(fLatestQ, (snap) => {
      const it = snap.docs[0]?.data() as any;
      setFollowersPreview(it?.name ? `${it.name} started following you 🤝` : "");
    });

    // unseen notifications (exclude 'follow')
    const nq = query(collection(db, "users", uid, "notifications"), where("seen", "==", false));
    const u3 = onSnapshot(nq, (snap) => {
      const c = snap.docs.filter((d) => (d.data() as any)?.type !== "follow").length;
      setNotifCount(c);
    });

    // latest notification preview (skip 'follow')
    const nLatestQ = query(
      collection(db, "users", uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(10) // take a few and pick first non-follow
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
      else if (n.type === "follow")
        setNotifPreview("");
      else setNotifPreview(n.title || "New activity on Ekarihub 🔔");
    });

    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [uid]);

  // full list of notifications (exclude 'follow' so it's not duplicated)
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
        .filter((n) => n.type !== "follow"); // <- hide follow here
      setItems(arr);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return (
    <AppShell>
      <div className="min-h-screen w-full bg-white">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 px-4 flex items-center">
          <div className="font-black text-slate-900 text-[18px]">Notifications</div>
        </div>

        {/* Top sections */}
        <div className="border-b border-gray-200 p-3 space-y-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-3 shadow-sm hover:shadow transition"
            onClick={() => pushSafe(router, "/followers")}
          >
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: EKARI.forest }}
            >
              <IoPeopleOutline />
            </span>
            <div className="flex-1 text-left">
              <div className="font-extrabold text-[15px] text-slate-900">New followers</div>
              {followersPreview ? (
                <div className="text-[13px] text-slate-600 truncate">{followersPreview}</div>
              ) : (
                <div className="text-[13px] text-slate-400">No new followers</div>
              )}
            </div>
            <CountBadge count={followersCount} />
            <IoChevronForward className="text-slate-400 ml-2" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            className="w-full bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-3 shadow-sm hover:shadow transition"
            onClick={() => pushSafe(router, "/activity")}
          >
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: EKARI.gold }}
            >
              <IoNotificationsOutline />
            </span>
            <div className="flex-1 text-left">
              <div className="font-extrabold text-[15px] text-slate-900">Activity</div>
              {notifPreview ? (
                <div className="text-[13px] text-slate-600 truncate">{notifPreview}</div>
              ) : (
                <div className="text-[13px] text-slate-400">No new activity</div>
              )}
            </div>
            <CountBadge count={notifCount} />
            <IoChevronForward className="text-slate-400 ml-2" />
          </motion.button>
        </div>

        {/* List of notifications */}
        {loading ? (
          <div className="py-12 flex items-center justify-center text-slate-500">
            <BouncingBallLoader />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div
              className="mx-auto h-12 w-12 rounded-full grid place-items-center mb-3"
              style={{ backgroundColor: hexToRgba(EKARI.forest, 0.06) }} // ~6% tint
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
          <ul className="px-3 py-4 space-y-2">
            {items.map((n) => (
              <NotificationItem key={n.id} n={n} onOpen={(href) => pushSafe(router, href)} />
            ))}
          </ul>

        )}
      </div>
    </AppShell>
  );
}
