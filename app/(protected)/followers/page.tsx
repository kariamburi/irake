// app/followers/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "../components/AppShell";
import { IoChevronBack, IoSearchOutline } from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
  tintNew: "#FFF7F5",
};

type FollowerRow = {
  userId: string;
  name?: string;
  photoURL?: string | null;
  createdAt?: any;
  seen?: boolean;
};

function timeAgo(ts: any) {
  if (!ts) return "";
  const d =
    typeof ts?.toDate === "function"
      ? ts.toDate()
      : ts?.seconds
        ? new Date(ts.seconds * 1000)
        : new Date(ts);
  const diff = Math.max(0, Date.now() - d.getTime());
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const dd = Math.floor(h / 24);
  if (s < 45) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (dd <= 7) return `${dd}d ago`;
  const mon = d.toLocaleString(undefined, { month: "short" });
  return `${mon} ${d.getDate()}`;
}

export default function FollowersPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState<FollowerRow[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef<Set<string>>(new Set()); // per-user debounce

  // Live followers (owner-only collection)
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const qy = query(
      collection(db, "users", uid, "followers"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(qy, (snap) => {
      const rows: FollowerRow[] = snap.docs.map((d) => {
        const x = d.data() as any;
        return {
          userId: d.id,
          name: x?.name || "User",
          photoURL: x?.photoURL || null,
          createdAt: x?.createdAt,
          seen: !!x?.seen,
        };
      });
      setFollowers(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  // Live “who I follow” via top-level follows (followerId == uid)
  useEffect(() => {
    if (!uid) return;
    const qy = query(collection(db, "follows"), where("followerId", "==", uid));
    const unsub = onSnapshot(qy, (snap) => {
      const next = new Set<string>();
      snap.forEach((d) => {
        const followingId = (d.data() as any)?.followingId;
        if (typeof followingId === "string") next.add(followingId);
      });
      setFollowingSet(next);
    });
    return () => unsub();
  }, [uid]);

  // When page opens / updates, mark unseen as seen
  useEffect(() => {
    if (!uid) return;
    const unseen = followers.filter((f) => f.seen === false);
    if (!unseen.length) return;
    (async () => {
      try {
        const batch = writeBatch(db);
        unseen.forEach((f) =>
          batch.set(
            doc(db, "users", uid, "followers", f.userId),
            { seen: true },
            { merge: true }
          )
        );
        await batch.commit();
      } catch {
        // ignore
      }
    })();
  }, [uid, followers]);

  const isFollowing = useCallback(
    (theirId: string) => followingSet.has(theirId),
    [followingSet]
  );

  const followBack = async (theirId: string) => {
    if (!uid || uid === theirId || isFollowing(theirId)) return;
    if (pending.current.has(theirId)) return;
    pending.current.add(theirId);
    const pairId = `${uid}_${theirId}`;
    try {
      await setDoc(
        doc(db, "follows", pairId),
        { followerId: uid, followingId: theirId, createdAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("followBack error", e);
    } finally {
      pending.current.delete(theirId);
    }
  };

  const onRefresh = useCallback(async () => {
    if (!uid) return;
    setRefreshing(true);
    try {
      // Light nudge
      await getDocs(collection(db, "users", uid, "followers"));
    } finally {
      setRefreshing(false);
    }
  }, [uid]);

  const onOpenProfile = (theirId: string) => {
    // Adjust if your profile route differs
    router.push(`/u/${theirId}`);
  };

  const onMessage = (theirId: string) => {
    // Adjust if your chat route differs
    router.push(`/inbox?peerId=${encodeURIComponent(theirId)}`);
  };

  const headerRight = useMemo(
    () => (
      <button
        onClick={() => router.push("/search")}
        className="p-2 rounded-full hover:bg-gray-100"
        aria-label="Search users"
      >
        <IoSearchOutline size={20} />
      </button>
    ),
    [router]
  );

  return (
    <AppShell>
      <div className="min-h-screen w-full bg-white">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 px-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100"
            aria-label="Back"
          >
            <IoChevronBack size={20} />
          </button>
          <div className="font-black text-slate-900 text-[18px]">
            New Partners
          </div>
          {headerRight}
        </div>

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
            {followers.length} Partner{followers.length === 1 ? "" : "s"}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-16 flex items-center justify-center text-slate-500">
            <div className="animate-spin h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full" />
            <span className="ml-2"><BouncingBallLoader /></span>
          </div>
        ) : followers.length === 0 ? (
          <div className="px-4 py-12 text-center text-slate-500">
            No Partners yet.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {followers.map((item) => {
              const following = isFollowing(item.userId);
              const isNew = item.seen === false;
              const isPending = pending.current.has(item.userId);

              return (
                <li
                  key={item.userId}
                  className={`px-3 py-3 ${isNew ? "bg-[#FFF7F5]" : "bg-white"}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onOpenProfile(item.userId)}
                      className="shrink-0"
                      aria-label={`Open ${item.name || "user"}'s profile`}
                    >
                      <div className="relative h-[54px] w-[54px] rounded-full overflow-hidden bg-gray-100">
                        <Image
                          src={
                            item.photoURL
                              ? item.photoURL
                              : "/avatar-placeholder.png"
                          }
                          alt={item.name || "User"}
                          fill
                          sizes="54px"
                          className="object-cover"
                        />
                      </div>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onOpenProfile(item.userId)}
                          className="text-left"
                        >
                          <div className="font-extrabold text-[15px] text-slate-900 truncate">
                            {item.name || "User"}
                          </div>
                        </button>
                        <div className="ml-2 text-[12px] text-slate-500">
                          {timeAgo(item.createdAt)}
                        </div>
                      </div>
                      <div className="text-[13px] text-slate-600">
                        partnered with you 🤝.
                      </div>
                    </div>

                    {/* Right action */}
                    {following ? (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onMessage(item.userId)}
                        className="h-8 px-3 rounded-full border border-gray-200 bg-gray-100 text-slate-900 text-[12px] font-bold"
                      >
                        Message
                      </motion.button>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => followBack(item.userId)}
                        disabled={isPending}
                        className="h-8 px-4 rounded-full bg-[#C79257] text-white text-[12px] font-extrabold disabled:opacity-60"
                      >
                        Partner
                      </motion.button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer spacer */}
        <div className="h-6" />
      </div>
    </AppShell>
  );
}
