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
import AppShell from "@/app/components/AppShell";
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
  handle?: string;
  seen?: boolean;
};

function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

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
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: FollowerRow[] = snap.docs.map((d) => {
          const x = d.data() as any;
          return {
            userId: d.id,
            name: x?.name || "User",
            photoURL: x?.photoURL || null,
            createdAt: x?.createdAt,
            seen: !!x?.seen,
            handle: x?.handle,
          };
        });
        setFollowers(rows);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [uid]);

  // Live “who I follow”
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

  // Mark unseen as seen
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
      await getDocs(collection(db, "users", uid, "followers"));
    } finally {
      setRefreshing(false);
    }
  }, [uid]);

  const onOpenProfile = (handle: string) => {
    // If your handle in db already includes "@", this works.
    // If not, you can wrap: const h = handle.startsWith("@") ? handle : `@${handle}`;
    router.push(`/${handle}`);
  };

  const makeThreadId = (a: string, b: string) => [a, b].sort().join("_");
  const onMessage = (row: FollowerRow) => {
    const peerName = row?.name ?? "";
    const peerPhotoURL = row?.photoURL ?? "";
    const peerHandle = row?.handle ?? "";
    const q = new URLSearchParams({
      peerId: row.userId,
      peerName,
      peerPhotoURL,
      peerHandle,
    });
    if (uid) {
      const threadId = makeThreadId(uid, row.userId);
      router.push(`/bonga/${threadId}?${q.toString()}`);
    }
  };

  const headerRight = useMemo(
    () => (
      <button
        onClick={() => router.push("/search")}
        className="h-10 w-10 rounded-full grid place-items-center hover:bg-black/5 border"
        style={{ borderColor: EKARI.hair }}
        aria-label="Search users"
      >
        <IoSearchOutline size={20} />
      </button>
    ),
    [router]
  );

  return (
    <AppShell>
      {/* Background */}
      <div className="min-h-[100svh] w-full" style={{ backgroundColor: "#fff" }}>
        {/* Centered container on desktop; full-width on mobile */}
        <div className="mx-auto w-full max-w-[880px]">
          {/* Sticky header (mobile+desktop) with safe-area padding */}
          <div
            className={cn(
              "sticky top-0 z-40 w-full border-b backdrop-blur-xl",
              "supports-[backdrop-filter]:backdrop-blur-xl"
            )}
            style={{
              borderColor: EKARI.hair,
              backgroundColor: "rgba(255,255,255,0.92)",
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <div className="h-14 px-3 flex items-center justify-between">
              <button
                onClick={() => router.back()}
                className="h-10 w-10 rounded-full grid place-items-center hover:bg-black/5 border"
                style={{ borderColor: EKARI.hair }}
                aria-label="Back"
              >
                <IoChevronBack size={20} />
              </button>

              <div className="font-black text-slate-900 text-[16px] sm:text-[18px]">
                New followers
              </div>

              {headerRight}
            </div>

            {/* Toolbar */}
            <div className="px-3 pb-3 flex items-center gap-2">
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="text-xs px-3 py-1.5 rounded-full border hover:bg-black/5 disabled:opacity-50"
                style={{ borderColor: EKARI.hair }}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>

              <div className="text-xs" style={{ color: EKARI.dim }}>
                {followers.length} Follower{followers.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {/* Content area */}
          <div
            className={cn(
              "px-0 sm:px-3",
              "pb-6"
            )}
            style={{
              paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
            }}
          >
            {loading ? (
              <div className="py-16 flex items-center justify-center text-slate-500">
                <BouncingBallLoader />
              </div>
            ) : followers.length === 0 ? (
              <div className="px-4 py-12 text-center" style={{ color: EKARI.dim }}>
                No followers yet.
              </div>
            ) : (
              <div className="sm:mt-3 sm:rounded-2xl sm:border sm:shadow-sm overflow-hidden"
                style={{ borderColor: EKARI.hair }}
              >
                <ul className="divide-y" style={{ borderColor: EKARI.hair }}>
                  {followers.map((item) => {
                    const following = isFollowing(item.userId);
                    const isNew = item.seen === false;
                    const isPending = pending.current.has(item.userId);

                    return (
                      <li
                        key={item.userId}
                        className={cn("px-3 py-3", isNew ? "bg-[#FFF7F5]" : "bg-white")}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => (item?.handle ? onOpenProfile(item.handle) : null)}
                            className="shrink-0"
                            aria-label={`Open ${item.name || "user"}'s profile`}
                          >
                            <div className="relative h-[54px] w-[54px] rounded-full overflow-hidden bg-gray-100">
                              <Image
                                src={item.photoURL ? item.photoURL : "/avatar-placeholder.png"}
                                alt={item.name || "User"}
                                fill
                                sizes="54px"
                                className="object-cover"
                              />
                            </div>
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                onClick={() => (item?.handle ? onOpenProfile(item.handle) : null)}
                                className="text-left min-w-0"
                              >
                                <div className="font-extrabold text-[15px] text-slate-900 truncate">
                                  {item.name || "User"}
                                </div>
                                {item.handle ? (
                                  <div className="text-[12px] truncate" style={{ color: EKARI.dim }}>
                                    {item.handle}
                                  </div>
                                ) : null}
                              </button>

                              <div className="shrink-0 text-[12px]" style={{ color: EKARI.dim }}>
                                {timeAgo(item.createdAt)}
                              </div>
                            </div>

                            <div className="mt-0.5 text-[13px]" style={{ color: EKARI.sub }}>
                              Started following you 🤝.
                            </div>
                          </div>

                          {/* Right action */}
                          {following ? (
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              onClick={() => onMessage(item)}
                              className="h-9 px-3 rounded-full border bg-gray-100 text-slate-900 text-[12px] font-extrabold"
                              style={{ borderColor: EKARI.hair }}
                            >
                              Message
                            </motion.button>
                          ) : (
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              onClick={() => followBack(item.userId)}
                              disabled={isPending}
                              className="h-9 px-4 rounded-full text-white text-[12px] font-extrabold disabled:opacity-60"
                              style={{ backgroundColor: EKARI.gold }}
                            >
                              {isPending ? "…" : "Follow"}
                            </motion.button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
