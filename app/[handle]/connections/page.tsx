// app/[handle]/connections/page.tsx
"use client";

import React from "react";
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
import { IoArrowBack, IoSearchOutline } from "react-icons/io5";
import SmartAvatar from "@/app/components/SmartAvatar";

const PAGE_SIZE = 20;

const EKARI = {
  forest: "#233F39",
  bg: "#ffffff",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
  primary: "#C79257",
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
  const TabsBar = (
    <div className="flex border-b text-sm font-semibold" style={{ borderColor: EKARI.hair }}>
      <Tab
        label={`Following ${formatCount(tabCounts.following)}`}
        active={tab === "following"}
        onClick={() => goToTab("following")}
      />

      <Tab
        label={`Followers ${formatCount(tabCounts.followers)}`}
        active={tab === "followers"}
        onClick={() => goToTab("followers")}
      />

      <Tab
        label={`Partners ${formatCount(tabCounts.partners)}`}
        active={tab === "partners"}
        onClick={() => goToTab("partners")}
      />

      <Tab
        label={`Mutual ${formatCount(tabCounts.mutual)}`}
        active={tab === "mutual"}
        onClick={() => goToTab("mutual")}
      />
    </div>
  );
  const Body = (
    <div className="mx-auto min-h-screen w-full px-3 md:px-4 pt-3 pb-6" style={{ backgroundColor: EKARI.bg }}>
      {!isMobile && (
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={goBackToProfile}
            className="h-9 w-9 grid place-items-center rounded-full border bg-white hover:bg-black/5"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            aria-label="Back"
          >
            <IoArrowBack size={20} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: EKARI.subtext }}>
              {handleSlug}
            </div>
            <div className="text-base font-extrabold" style={{ color: EKARI.text }}>
              Connections
            </div>
          </div>

          <div className="w-9" />
        </div>
      )}

      {!isMobile && TabsBar}

      <div
        className="mt-3 mb-2 flex items-center gap-2 rounded-xl px-3 py-2 border"
        style={{ backgroundColor: "#F9FAFB", borderColor: EKARI.hair }}
      >
        <IoSearchOutline size={18} style={{ color: EKARI.subtext }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search loaded connections"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: EKARI.text }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <BouncingBallLoader />
        </div>
      ) : currentList.length === 0 ? (
        <div className="py-16 text-center text-sm" style={{ color: EKARI.subtext }}>
          No users to show.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: EKARI.hair }}>
          {currentList.map((u) => (
            <Row
              key={u.id}
              user={u}
              viewerUid={viewerUid}
              viewerFollowingSet={viewerFollowingSet}
              viewerFollowersSet={viewerFollowersSet}
              onToggleFollow={onToggleFollow}
            />
          ))}

          <div ref={observerRef} className="py-6 flex justify-center">
            {loadingMore && <BouncingBallLoader />}
            {!hasMore && !loadingMore && (
              <span className="text-xs" style={{ color: EKARI.subtext }}>
                No more users
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col bg-white">
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="h-14 px-3 flex items-center gap-2" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <button
              onClick={goBackSmart}
              className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
              aria-label="Back"
            >
              <IoArrowBack size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-black" style={{ color: EKARI.text }}>
                Connections
              </div>
              <div className="truncate text-[11px]" style={{ color: EKARI.subtext }}>
                {ownerUsername || handleWithAt}
              </div>
            </div>

            <button
              onClick={goBackToProfile}
              className="h-10 px-3 rounded-full border border-gray-200 text-xs font-bold"
            >
              Profile
            </button>
          </div>

          <div className="px-2">{TabsBar}</div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">{Body}</div>

        <div style={{ height: "env(safe-area-inset-bottom)" }} />
      </div>
    );
  }

  return <AppShell>{Body}</AppShell>;
}

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-2 pb-2 pt-1 text-center"
      style={{
        color: active ? EKARI.text : EKARI.subtext,
        borderBottomWidth: active ? 2 : 0,
        borderColor: active ? EKARI.forest : "transparent",
      }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function Row({
  user,
  viewerUid,
  viewerFollowingSet,
  viewerFollowersSet,
  onToggleFollow,
}: {
  user: UserSummary;
  viewerUid?: string;
  viewerFollowingSet: Set<string>;
  viewerFollowersSet: Set<string>;
  onToggleFollow: (id: string) => void;
}) {
  const router = useRouter();

  const fullName =
    [user.firstName, user.surname].filter(Boolean).join(" ") || "ekarihub user";

  const handle = user.handle || "";
  const id = user.id;

  const isFriend = viewerFollowingSet.has(id) && viewerFollowersSet.has(id);
  const viewerFollows = viewerFollowingSet.has(id);
  const followsViewer = viewerFollowersSet.has(id);

  let pillLabel = "";

  if (!viewerUid || viewerUid === id) {
    pillLabel = "";
  } else if (isFriend) {
    pillLabel = "Partners";
  } else if (followsViewer && !viewerFollows) {
    pillLabel = "Follow back";
  } else if (viewerFollows) {
    pillLabel = "Following";
  } else {
    pillLabel = "Follow";
  }

  const handleSlug = handle.replace(/^@/, "");

  return (
    <div className="flex items-center px-1 py-2">
      <button
        className="flex flex-1 items-center gap-3 text-left"
        onClick={() => {
          if (handleSlug) router.push(`/${encodeURIComponent(handleSlug)}`);
        }}
      >
        <div
          className="relative h-11 w-11 rounded-full overflow-hidden"
          style={{ backgroundColor: EKARI.hair }}
        >
          <SmartAvatar src={user.photoURL} alt={fullName || "User"} size={46} />
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: EKARI.text }}>
            {fullName}
          </div>

          {!!handle && (
            <div className="text-xs truncate" style={{ color: EKARI.subtext }}>
              {handle}
            </div>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2">
        {!!pillLabel && viewerUid !== id && (
          <button
            onClick={() => onToggleFollow(id)}
            className="min-w-[96px] rounded-full px-4 py-1.5 text-xs font-semibold"
            style={
              pillLabel === "Partners" || pillLabel === "Following"
                ? {
                  backgroundColor: "#F9FAFB",
                  color: EKARI.text,
                  borderWidth: 1,
                  borderColor: EKARI.hair,
                }
                : {
                  backgroundColor: EKARI.primary,
                  color: "#FFFFFF",
                }
            }
          >
            {pillLabel}
          </button>
        )}
      </div>
    </div>
  );
}