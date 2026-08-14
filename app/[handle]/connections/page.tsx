// app/[handle]/connections/page.tsx
"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  limit,
  startAfter,
  documentId,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { resolveUidByHandle } from "@/lib/fire-queries";
import {
  IoArrowBack,
  IoSearchOutline,
  IoPeopleOutline,
  IoPersonAddOutline,
  IoPeopleCircleOutline,
  IoGitNetworkOutline,
  IoCheckmarkCircleOutline,
  IoChevronForward,
  IoSparklesOutline,
  IoInformationCircleOutline,
} from "react-icons/io5";
import SmartAvatar from "@/app/components/SmartAvatar";

const PAGE_SIZE = 20;

const EKARI = {
  forest: "#173C2E",
  forestSoft: "#214C3A",
  bg: "#F8F7F2",
  paper: "#FBFAF6",
  text: "#111827",
  subtext: "#64748B",
  hair: "#DDD8CC",
  primary: "#F39A22",
};

type TabKey = "following" | "followers" | "partners" | "mutual";

type UserSummary = {
  id: string;
  firstName?: string;
  surname?: string;
  handle?: string;
  photoURL?: string;
};

function formatCount(n?: number) {
  const v = Number(n || 0);
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(v);
}

function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia(queryStr);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [queryStr]);

  return matches;
}

function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}

export default function HandleConnectionsPage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [tabCounts, setTabCounts] = React.useState({
    following: 0,
    followers: 0,
    partners: 0,
    mutual: 0,
  });
  const rawHandle = params?.handle ?? "";
  const decoded = (() => {
    try {
      return decodeURIComponent(rawHandle);
    } catch {
      return rawHandle;
    }
  })();

  const handleSlug = decoded.replace(/^@/, "");
  const handleWithAt = decoded.startsWith("@") ? decoded : `@${decoded}`;

  const [ownerUid, setOwnerUid] = React.useState<string | null | undefined>(undefined);
  const [ownerUsername, setOwnerUsername] = React.useState<string>(handleWithAt);

  const [tab, setTab] = React.useState<TabKey>(() => {
    const t = (searchParams?.get("tab") || "followers") as TabKey;
    return ["following", "followers", "partners", "mutual"].includes(t) ? t : "followers";
  });

  const [following, setFollowing] = React.useState<UserSummary[]>([]);
  const [followers, setFollowers] = React.useState<UserSummary[]>([]);
  const [partners, setPartners] = React.useState<UserSummary[]>([]);
  const [mutualPartners, setMutualPartners] = React.useState<UserSummary[]>([]);

  const [viewerFollowingSet, setViewerFollowingSet] = React.useState<Set<string>>(new Set());
  const [viewerFollowersSet, setViewerFollowersSet] = React.useState<Set<string>>(new Set());

  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [lastDoc, setLastDoc] = React.useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [search, setSearch] = React.useState("");
  const observerRef = React.useRef<HTMLDivElement | null>(null);
  const fetchingRef = React.useRef(false);
  const viewerFollowersRef = React.useRef<Set<string>>(new Set());

  const viewerUid = user?.uid;
  const loadTabCounts = React.useCallback(async () => {
    if (!ownerUid) return;

    const followsRef = collection(db, "follows");

    const [followingSnap, followersSnap] = await Promise.all([
      getDocs(query(followsRef, where("followerId", "==", ownerUid))),
      getDocs(query(followsRef, where("followingId", "==", ownerUid))),
    ]);

    const ownerFollowingIds = followingSnap.docs.map(
      (d) => (d.data() as any).followingId as string
    );

    const ownerFollowerIds = followersSnap.docs.map(
      (d) => (d.data() as any).followerId as string
    );

    const ownerFollowingSet = new Set(ownerFollowingIds);
    const ownerFollowerSet = new Set(ownerFollowerIds);

    let partnersCount = 0;

    ownerFollowingSet.forEach((id) => {
      if (ownerFollowerSet.has(id)) partnersCount++;
    });

    let mutualCount = 0;

    if (viewerUid && viewerUid !== ownerUid) {
      const viewerFollowersSnap = await getDocs(
        query(followsRef, where("followingId", "==", viewerUid))
      );

      const viewerFollowersSet = new Set(
        viewerFollowersSnap.docs.map(
          (d) => (d.data() as any).followerId as string
        )
      );

      ownerFollowerSet.forEach((id) => {
        if (viewerFollowersSet.has(id)) mutualCount++;
      });
    }

    setTabCounts({
      following: ownerFollowingIds.length,
      followers: ownerFollowerIds.length,
      partners: partnersCount,
      mutual: mutualCount,
    });
  }, [ownerUid, viewerUid]);
  React.useEffect(() => {
    const t = (searchParams?.get("tab") || "followers") as TabKey;
    if (["following", "followers", "partners", "mutual"].includes(t)) {
      if (t !== tab) {
        setLoading(true);
        setTab(t);
      }
    }
  }, [searchParams]);
  React.useEffect(() => {
    if (!ownerUid) return;

    loadTabCounts();
  }, [ownerUid, viewerUid, loadTabCounts]);
  React.useEffect(() => {
    let active = true;

    (async () => {
      const res: any = await resolveUidByHandle(handleWithAt);
      if (!active) return;

      setOwnerUid(res?.uid ?? null);
      if (res?.handle) setOwnerUsername(res.handle);
    })();

    return () => {
      active = false;
    };
  }, [handleWithAt]);

  const fetchUserDocs = React.useCallback(async (ids: string[]) => {
    const map: Record<string, UserSummary> = {};
    const unique = Array.from(new Set(ids)).filter(Boolean);

    await Promise.all(
      unique.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "users", id));
          if (snap.exists()) {
            const d = snap.data() as any;
            map[id] = {
              id,
              firstName: d.firstName,
              surname: d.surname,
              handle: d.handle,
              photoURL: d.photoURL || d.avatarUrl,
            };
          } else {
            map[id] = { id };
          }
        } catch {
          map[id] = { id };
        }
      })
    );

    return map;
  }, []);

  const loadViewerRelations = React.useCallback(async () => {
    if (!viewerUid) {
      const empty = new Set<string>();
      viewerFollowersRef.current = empty;
      setViewerFollowingSet(new Set());
      setViewerFollowersSet(empty);
      return;
    }

    const followsRef = collection(db, "follows");

    const [viewerFollowingSnap, viewerFollowersSnap] = await Promise.all([
      getDocs(query(followsRef, where("followerId", "==", viewerUid))),
      getDocs(query(followsRef, where("followingId", "==", viewerUid))),
    ]);

    setViewerFollowingSet(
      new Set(viewerFollowingSnap.docs.map((d) => (d.data() as any).followingId as string))
    );

    const nextViewerFollowersSet = new Set(
      viewerFollowersSnap.docs.map(
        (d) => (d.data() as any).followerId as string
      )
    );

    viewerFollowersRef.current = nextViewerFollowersSet;
    setViewerFollowersSet(nextViewerFollowersSet);
  }, [viewerUid]);

  const resetTabData = React.useCallback(() => {
    setFollowing([]);
    setFollowers([]);
    setPartners([]);
    setMutualPartners([]);
    setLastDoc(null);
    setHasMore(true);
  }, []);

  const loadConnections = React.useCallback(
    async (reset = false) => {
      if (!ownerUid || fetchingRef.current) return;

      fetchingRef.current = true;

      try {
        if (reset) {
          setLoading(true);
          resetTabData();
        } else {
          setLoadingMore(true);
        }

        const followsRef = collection(db, "follows");

        /*
         * `sourceCursor` tracks the last scanned follow document.
         *
         * Following and followers are unfiltered, so one Firestore page gives
         * one visible page.
         *
         * Partners and mutual are filtered tabs. A source page may contain
         * fewer than PAGE_SIZE matches, so we keep scanning source pages until
         * we collect PAGE_SIZE matching users or reach the end.
         */
        let sourceCursor = reset ? null : lastDoc;
        let reachedEnd = false;

        const collectedIds: string[] = [];
        const seenIds = new Set<string>();

        while (collectedIds.length < PAGE_SIZE && !reachedEnd) {
          const constraints: any[] = [
            tab === "following"
              ? where("followerId", "==", ownerUid)
              : where("followingId", "==", ownerUid),
            orderBy(documentId()),
          ];

          if (sourceCursor) {
            constraints.push(startAfter(sourceCursor));
          }

          constraints.push(limit(PAGE_SIZE));

          const snap = await getDocs(
            query(followsRef, ...constraints)
          );

          if (snap.empty) {
            reachedEnd = true;
            break;
          }

          sourceCursor = snap.docs[snap.docs.length - 1];

          if (snap.docs.length < PAGE_SIZE) {
            reachedEnd = true;
          }

          const rawIds = snap.docs
            .map((d) => {
              const data = d.data() as any;
              return tab === "following"
                ? data.followingId
                : data.followerId;
            })
            .filter(Boolean) as string[];

          let matchedIds = rawIds;

          if (tab === "partners") {
            const checks = await Promise.all(
              rawIds.map(async (id) => {
                const relId = `${id}_${ownerUid}`;
                const relSnap = await getDoc(
                  doc(db, "follows", relId)
                );

                return relSnap.exists() ? id : null;
              })
            );

            matchedIds = checks.filter(Boolean) as string[];
          }

          if (tab === "mutual") {
            if (!viewerUid || viewerUid === ownerUid) {
              matchedIds = [];
              reachedEnd = true;
            } else {
              const currentViewerFollowersSet =
                viewerFollowersRef.current;

              matchedIds = rawIds.filter((id) =>
                currentViewerFollowersSet.has(id)
              );
            }
          }

          for (const id of matchedIds) {
            if (!seenIds.has(id)) {
              seenIds.add(id);
              collectedIds.push(id);
            }

            if (collectedIds.length >= PAGE_SIZE) break;
          }

          // Unfiltered tabs need only one source page per visible page.
          if (tab === "following" || tab === "followers") {
            break;
          }
        }

        const userMap = await fetchUserDocs(collectedIds);
        const users = collectedIds.map(
          (id) => userMap[id] || { id }
        );

        if (tab === "following") {
          setFollowing((prev) =>
            reset ? users : [...prev, ...users]
          );
        } else if (tab === "followers") {
          setFollowers((prev) =>
            reset ? users : [...prev, ...users]
          );
        } else if (tab === "partners") {
          setPartners((prev) =>
            reset ? users : [...prev, ...users]
          );
        } else {
          setMutualPartners((prev) =>
            reset ? users : [...prev, ...users]
          );
        }

        setLastDoc(sourceCursor);
        setHasMore(!reachedEnd);
      } catch (e) {
        console.warn("Connections infinite load error:", e);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        fetchingRef.current = false;
      }
    },
    [
      ownerUid,
      tab,
      lastDoc,
      viewerUid,
      fetchUserDocs,
      resetTabData,
    ]
  );

  React.useEffect(() => {
    if (ownerUid === null) {
      setLoading(false);
      return;
    }

    if (!ownerUid) return;

    (async () => {
      await loadViewerRelations();
      await loadConnections(true);
    })();
  }, [ownerUid, viewerUid, tab]);

  React.useEffect(() => {
    if (!hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadConnections(false);
        }
      },
      { threshold: 0.4 }
    );

    const el = observerRef.current;
    if (el) observer.observe(el);

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadConnections]);

  const currentList = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    const base =
      tab === "following"
        ? following
        : tab === "followers"
          ? followers
          : tab === "partners"
            ? partners
            : mutualPartners;

    if (!q) return base;

    return base.filter((u) => {
      const name = `${u.firstName ?? ""} ${u.surname ?? ""}`.toLowerCase();
      const h = (u.handle ?? "").toLowerCase();
      return name.includes(q) || h.includes(q);
    });
  }, [tab, following, followers, partners, mutualPartners, search]);

  const onToggleFollow = async (userId: string) => {
    if (!viewerUid) {
      const next = `/${encodeURIComponent(handleSlug)}/connections?tab=${tab}`;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (userId === viewerUid) return;

    const relId = `${viewerUid}_${userId}`;
    const relRef = doc(db, "follows", relId);
    const snap = await getDoc(relRef);

    if (snap.exists()) {
      await deleteDoc(relRef);
      setViewerFollowingSet((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    } else {
      await setDoc(
        relRef,
        {
          followerId: viewerUid,
          followingId: userId,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      setViewerFollowingSet((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    }
  };

  const goBackToProfile = () => {
    router.push(`/${encodeURIComponent(handleSlug)}`);
  };

  const goBackSmart = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else goBackToProfile();
  };
  const goToTab = (nextTab: TabKey) => {
    if (nextTab === tab) return;

    setLoading(true);
    setLoadingMore(false);
    setHasMore(true);
    setSearch("");

    router.push(
      `/${encodeURIComponent(handleSlug)}/connections?tab=${nextTab}`
    );
  };
  const tabItems: Array<{
    key: TabKey;
    label: string;
    count: number;
    icon: React.ReactNode;
  }> = [
      {
        key: "following",
        label: "Following",
        count: tabCounts.following,
        icon: <IoPersonAddOutline size={14} />,
      },
      {
        key: "followers",
        label: "Followers",
        count: tabCounts.followers,
        icon: <IoPeopleOutline size={14} />,
      },
      {
        key: "partners",
        label: "Partners",
        count: tabCounts.partners,
        icon: <IoPeopleCircleOutline size={14} />,
      },
      {
        key: "mutual",
        label: "Mutual",
        count: tabCounts.mutual,
        icon: <IoGitNetworkOutline size={14} />,
      },
    ];

  const TabsBar = (
    <div className="border-b border-[#DDD8CC] bg-[#FBFAF6]">
      <div className="mx-auto flex max-w-[1120px] items-center gap-1 overflow-x-auto px-3 no-scrollbar sm:px-4 md:px-6">
        {tabItems.map((item) => {
          const active = tab === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => goToTab(item.key)}
              className={[
                "relative inline-flex h-12 shrink-0 items-center gap-2 px-3",
                "text-[11px] font-black transition-colors duration-200",
                active
                  ? "text-[#173C2E]"
                  : "text-slate-400 hover:text-slate-700",
              ].join(" ")}
            >
              {item.icon}

              <span>{item.label}</span>

              <span
                className={[
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9px]",
                  active
                    ? "bg-[#F39A22] text-white"
                    : "bg-[#EFECE5] text-slate-500",
                ].join(" ")}
              >
                {formatCount(item.count)}
              </span>

              {active ? (
                <motion.span
                  layoutId="connections-tab-indicator"
                  className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-[#173C2E]"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const activeTabMeta =
    tabItems.find((item) => item.key === tab) ||
    tabItems[1];

  const Header = (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.24,
        ease: "easeOut",
      }}
      className="relative shrink-0 overflow-hidden bg-[#173C2E] text-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
        }}
      />

      <div className="relative mx-auto max-w-[1120px] px-4 py-5 md:px-6 md:py-6">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={goBackSmart}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
            aria-label="Back"
          >
            <IoArrowBack size={19} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
              ekarihub community
            </div>

            <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                  Connections
                </h1>

                <p className="mt-1 truncate text-[11px] font-medium text-white/50 md:text-[12px]">
                  {ownerUsername || handleWithAt}
                </p>
              </div>

              <button
                type="button"
                onClick={goBackToProfile}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-[10px] font-black text-white transition hover:bg-white/[0.11]"
              >
                View profile
                <IoChevronForward size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );

  const ConnectionList = (
    <motion.section
      key={tab}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_10px_28px_rgba(15,23,42,0.025)]"
    >
      <div className="border-b border-[#E4DED2] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                {activeTabMeta.icon}
              </span>

              <div>
                <h2 className="text-[14px] font-black text-slate-900">
                  {activeTabMeta.label}
                </h2>

                <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
                  {formatCount(activeTabMeta.count)} connection
                  {activeTabMeta.count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-[#F8F7F2] px-3 transition focus-within:border-[#173C2E]/45 focus-within:bg-white">
          <IoSearchOutline
            size={16}
            className="shrink-0 text-slate-400"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={`Search ${activeTabMeta.label.toLowerCase()}`}
            className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
          />

          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="rounded-lg px-2 py-1 text-[9px] font-black text-slate-400 transition hover:bg-white hover:text-slate-700"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-[320px] place-items-center">
          <div className="text-center">
            <BouncingBallLoader />
            <p className="mt-3 text-[10px] font-semibold text-slate-400">
              Loading {activeTabMeta.label.toLowerCase()}…
            </p>
          </div>
        </div>
      ) : currentList.length === 0 ? (
        <EmptyConnections
          tab={tab}
          searching={Boolean(search.trim())}
        />
      ) : (
        <div>
          <AnimatePresence initial={false}>
            {currentList.map((connection) => (
              <Row
                key={connection.id}
                user={connection}
                tab={tab}
                ownerUid={ownerUid}
                viewerUid={viewerUid}
                viewerFollowingSet={viewerFollowingSet}
                viewerFollowersSet={viewerFollowersSet}
                onToggleFollow={onToggleFollow}
              />
            ))}
          </AnimatePresence>

          <div
            ref={observerRef}
            className="flex min-h-[68px] items-center justify-center border-t border-[#EAE6DD] px-4"
          >
            {loadingMore ? (
              <BouncingBallLoader />
            ) : !hasMore ? (
              <span className="text-[9px] font-semibold text-slate-400">
                You’ve reached the end
              </span>
            ) : (
              <span className="text-[9px] font-semibold text-slate-300">
                Scroll for more
              </span>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );

  const RightRail = (
    <motion.aside
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.24,
        delay: 0.04,
        ease: "easeOut",
      }}
      className="hidden space-y-3 xl:sticky xl:top-4 xl:block"
    >
      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
          Connection overview
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MiniStat
            label="Followers"
            value={tabCounts.followers}
            icon={<IoPeopleOutline size={14} />}
          />

          <MiniStat
            label="Following"
            value={tabCounts.following}
            icon={<IoPersonAddOutline size={14} />}
          />

          <MiniStat
            label="Partners"
            value={tabCounts.partners}
            icon={<IoPeopleCircleOutline size={14} />}
          />

          <MiniStat
            label="Mutual"
            value={tabCounts.mutual}
            icon={<IoGitNetworkOutline size={14} />}
          />
        </div>
      </section>

      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF4E3] text-[#F39A22]">
            <IoSparklesOutline size={17} />
          </span>

          <div>
            <div className="text-[12px] font-black text-slate-800">
              Partners
            </div>

            <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
              Partners are people who follow each other. It’s a quick way to identify stronger two-way connections.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
            <IoInformationCircleOutline size={17} />
          </span>

          <div>
            <div className="text-[12px] font-black text-slate-800">
              Mutual connections
            </div>

            <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
              Mutual shows this profile’s followers who also follow you. It’s available when you’re signed in and viewing another profile.
            </p>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={goBackToProfile}
        className="flex h-11 w-full items-center justify-between rounded-[16px] border border-[#DDD8CC] bg-[#FBFAF6] px-4 text-[10px] font-black text-[#173C2E] shadow-[0_10px_28px_rgba(15,23,42,0.025)] transition hover:bg-[#EEF3EE]"
      >
        Back to profile
        <IoChevronForward size={14} />
      </button>
    </motion.aside>
  );

  const Page = (
    <div className="h-full min-h-0 overflow-y-auto bg-[#F8F7F2]">
      {Header}
      {TabsBar}

      <main className="min-h-0 flex-1">
        <div className="mx-auto grid max-w-[1120px] gap-5 px-3 py-4 sm:px-4 md:px-6 md:py-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
          <div className="min-w-0">
            {ConnectionList}
          </div>

          {RightRail}
        </div>

        {isMobile ? (
          <div
            style={{
              height: "env(safe-area-inset-bottom)",
            }}
          />
        ) : null}
      </main>
    </div>
  );
  const PageMobile = (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#F8F7F2]">
      {Header}
      {TabsBar}

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#F8F7F2] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto grid max-w-[1120px] gap-5 px-3 py-4 sm:px-4 md:px-6 md:py-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
          <div className="min-w-0">
            {ConnectionList}
          </div>

          {RightRail}
        </div>

        {isMobile ? (
          <div
            style={{
              height: "env(safe-area-inset-bottom)",
            }}
          />
        ) : null}
      </main>
    </div>
  );

  if (ownerUid === null) {
    const Missing = (
      <div className="grid min-h-[100svh] place-items-center bg-[#F8F7F2] px-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] p-7 text-center shadow-[0_12px_30px_rgba(15,23,42,0.04)]"
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
            <IoPeopleOutline size={24} />
          </div>

          <h2 className="mt-4 text-[17px] font-black text-slate-900">
            Profile not found
          </h2>

          <p className="mt-2 text-[11px] font-medium leading-5 text-slate-500">
            We couldn’t find the connections for {handleWithAt}.
          </p>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-5 h-10 rounded-xl bg-[#173C2E] px-5 text-[10px] font-black text-white transition hover:bg-[#214C3A]"
          >
            Go home
          </button>
        </motion.div>
      </div>
    );

    return isMobile ? (
      Missing
    ) : (
      <AppShell>{Missing}</AppShell>
    );
  }

  return isMobile ? (
    <div className="fixed inset-0">
      {PageMobile}
    </div>
  ) : (
    <AppShell>
      {Page}
    </AppShell>
  );
}

function Row({
  user,
  tab,
  ownerUid,
  viewerUid,
  viewerFollowingSet,
  viewerFollowersSet,
  onToggleFollow,
}: {
  user: UserSummary;
  tab: TabKey;
  ownerUid?: string | null;
  viewerUid?: string;
  viewerFollowingSet: Set<string>;
  viewerFollowersSet: Set<string>;
  onToggleFollow: (id: string) => void;
}) {
  const router = useRouter();

  const fullName =
    [user.firstName, user.surname]
      .filter(Boolean)
      .join(" ") ||
    "ekarihub user";

  const handle =
    user.handle || "";

  const id = user.id;

  const isFriend =
    viewerFollowingSet.has(id) &&
    viewerFollowersSet.has(id);

  const viewerFollows =
    viewerFollowingSet.has(id);

  const followsViewer =
    viewerFollowersSet.has(id);

  const viewingOwnConnections =
    !!viewerUid &&
    viewerUid === ownerUid;

  const isOwnPartnersTab =
    tab === "partners" &&
    viewingOwnConnections;

  let pillLabel = "";

  if (
    !viewerUid ||
    viewerUid === id
  ) {
    pillLabel = "";
  } else if (
    isOwnPartnersTab ||
    isFriend
  ) {
    pillLabel = "Partners";
  } else if (
    followsViewer &&
    !viewerFollows
  ) {
    pillLabel = "Follow back";
  } else if (
    viewerFollows
  ) {
    pillLabel = "Following";
  } else {
    pillLabel = "Follow";
  }

  const handleSlug =
    handle.replace(/^@/, "");

  const interactive =
    pillLabel &&
    pillLabel !== "Partners";

  return (
    <motion.div
      layout
      initial={{
        opacity: 0,
        y: 3,
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
      className="flex items-center gap-3 border-b border-[#EAE6DD] px-4 py-3.5 last:border-b-0 sm:px-5"
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        onClick={() => {
          if (handleSlug) {
            router.push(
              `/${encodeURIComponent(
                handleSlug
              )}`
            );
          }
        }}
      >
        <div className="relative shrink-0">
          <SmartAvatar
            src={user.photoURL}
            alt={
              fullName ||
              "User"
            }
            size={48}
          />

          {isFriend ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[#FBFAF6] bg-[#173C2E] text-white"
              title="Partner"
            >
              <IoCheckmarkCircleOutline
                size={11}
              />
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="truncate text-[12px] font-black text-slate-800 sm:text-[13px]">
            {fullName}
          </div>

          {handle ? (
            <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
              {handle.startsWith("@")
                ? handle
                : `@${handle}`}
            </div>
          ) : (
            <div className="mt-0.5 text-[10px] font-semibold text-slate-300">
              ekarihub member
            </div>
          )}
        </div>
      </button>

      {pillLabel &&
        viewerUid !== id ? (
        pillLabel ===
          "Partners" ? (
          <span className="inline-flex min-w-[88px] items-center justify-center gap-1.5 rounded-xl border border-[#D9D3C7] bg-[#F3F1EB] px-3 py-2 text-[9px] font-black text-[#173C2E]">
            <IoPeopleCircleOutline
              size={12}
            />
            Partners
          </span>
        ) : (
          <motion.button
            whileTap={{
              scale: 0.97,
            }}
            type="button"
            onClick={() =>
              onToggleFollow(id)
            }
            className={[
              "min-w-[88px] rounded-xl px-3 py-2 text-[9px] font-black transition",
              pillLabel ===
                "Following"
                ? "border border-[#D9D3C7] bg-white text-slate-600 hover:bg-[#F3F1EB]"
                : "bg-[#F39A22] text-white hover:-translate-y-0.5 hover:bg-[#E98C12]",
            ].join(" ")}
          >
            {pillLabel}
          </motion.button>
        )
      ) : null}
    </motion.div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[#F3F1EB] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[#F39A22]">
          {icon}
        </span>

        <span className="text-[18px] font-black tracking-[-0.03em] text-[#173C2E]">
          {formatCount(value)}
        </span>
      </div>

      <div className="mt-2 text-[8px] font-black uppercase tracking-[0.07em] text-slate-400">
        {label}
      </div>
    </div>
  );
}

function EmptyConnections({
  tab,
  searching,
}: {
  tab: TabKey;
  searching: boolean;
}) {
  const meta: Record<
    TabKey,
    {
      icon: React.ReactNode;
      title: string;
      text: string;
    }
  > = {
    following: {
      icon: (
        <IoPersonAddOutline
          size={24}
        />
      ),
      title: searching
        ? "No matching people"
        : "Not following anyone yet",
      text: searching
        ? "Try another name or handle."
        : "People this profile follows will appear here.",
    },
    followers: {
      icon: (
        <IoPeopleOutline
          size={24}
        />
      ),
      title: searching
        ? "No matching followers"
        : "No followers yet",
      text: searching
        ? "Try another name or handle."
        : "Followers of this profile will appear here.",
    },
    partners: {
      icon: (
        <IoPeopleCircleOutline
          size={24}
        />
      ),
      title: searching
        ? "No matching partners"
        : "No partners yet",
      text: searching
        ? "Try another name or handle."
        : "Partners are people who follow each other.",
    },
    mutual: {
      icon: (
        <IoGitNetworkOutline
          size={24}
        />
      ),
      title: searching
        ? "No matching mutual connections"
        : "No mutual connections",
      text: searching
        ? "Try another name or handle."
        : "Mutual connections shared with you will appear here.",
    },
  };

  const item = meta[tab];

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 4,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="grid min-h-[320px] place-items-center px-5 text-center"
    >
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
          {item.icon}
        </div>

        <h3 className="mt-4 text-[14px] font-black text-slate-800">
          {item.title}
        </h3>

        <p className="mx-auto mt-1 max-w-sm text-[10px] font-medium leading-4 text-slate-400">
          {item.text}
        </p>
      </div>
    </motion.div>
  );
}