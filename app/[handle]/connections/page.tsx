// app/[handle]/connections/page.tsx
"use client";

import React from "react";
import Image from "next/image";
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { resolveUidByHandle } from "@/lib/fire-queries";
import { IoArrowBack, IoSearchOutline } from "react-icons/io5";

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

export default function HandleConnectionsPage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

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
  const [search, setSearch] = React.useState("");

  // keep tab in sync with query (?tab=...)
  React.useEffect(() => {
    const t = (searchParams?.get("tab") || "followers") as TabKey;
    if (["following", "followers", "partners", "mutual"].includes(t)) {
      setTab(t);
    }
  }, [searchParams]);

  // resolve owner uid from handle
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

  const viewerUid = user?.uid;

  const fetchUserDocs = React.useCallback(
    async (ids: string[]): Promise<Record<string, UserSummary>> => {
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
    },
    []
  );

  // main loader
  React.useEffect(() => {
    if (!ownerUid) {
      if (ownerUid === null) setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const followsRef = collection(db, "follows");

        // owner following & followers
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
        const ownerFollowersSet = new Set(ownerFollowerIds);

        // partners: owner ↔ user mutual
        const partnersIds: string[] = [];
        ownerFollowingSet.forEach((id) => {
          if (ownerFollowersSet.has(id)) partnersIds.push(id);
        });

        // viewer relations
        let viewerFollowingIds: string[] = [];
        let viewerFollowerIds: string[] = [];
        if (viewerUid) {
          const [viewerFollowingSnap, viewerFollowersSnap] = await Promise.all([
            getDocs(query(followsRef, where("followerId", "==", viewerUid))),
            getDocs(query(followsRef, where("followingId", "==", viewerUid))),
          ]);
          viewerFollowingIds = viewerFollowingSnap.docs.map(
            (d) => (d.data() as any).followingId as string
          );
          viewerFollowerIds = viewerFollowersSnap.docs.map(
            (d) => (d.data() as any).followerId as string
          );
        }

        const viewerFollowersSetLocal = new Set(viewerFollowerIds);
        const viewerFollowingSetLocal = new Set(viewerFollowingIds);

        setViewerFollowersSet(viewerFollowersSetLocal);
        setViewerFollowingSet(viewerFollowingSetLocal);

        // mutual partners: people who follow viewer AND owner
        const mutualIds: string[] = [];
        if (viewerUid && viewerUid !== ownerUid) {
          ownerFollowersSet.forEach((id) => {
            if (viewerFollowersSetLocal.has(id)) mutualIds.push(id);
          });
        }

        const allIds = [
          ...ownerFollowingIds,
          ...ownerFollowerIds,
          ...partnersIds,
          ...mutualIds,
        ];
        const userMap = await fetchUserDocs(allIds);

        setFollowing(ownerFollowingIds.map((id) => userMap[id] || { id }));
        setFollowers(ownerFollowerIds.map((id) => userMap[id] || { id }));
        setPartners(partnersIds.map((id) => userMap[id] || { id }));
        setMutualPartners(mutualIds.map((id) => userMap[id] || { id }));
      } catch (e) {
        console.warn("OwnerConnections web load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [ownerUid, viewerUid, fetchUserDocs]);

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
      const handle = (u.handle ?? "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [tab, following, followers, partners, mutualPartners, search]);

  const onToggleFollow = async (userId: string) => {
    if (!viewerUid) {
      // redirect to login, keep return path
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

  const followingCount = following.length;
  const followersCount = followers.length;
  const partnersCount = partners.length;
  const mutualCount = mutualPartners.length;

  const goBackToProfile = () => {
    router.push(`/${encodeURIComponent(handleSlug)}`);
  };

  return (
    <AppShell>
      <div
        className="mx-auto min-h-screen w-full px-3 md:px-4 pt-3 pb-6"
        style={{ backgroundColor: EKARI.bg }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={goBackToProfile}
            className="h-9 w-9 grid place-items-center rounded-full border bg-white hover:bg-black/5"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
          >
            <IoArrowBack size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <div
              className="text-sm font-semibold truncate"
              style={{ color: EKARI.subtext }}
            >
              @{handleSlug}
            </div>
            <div
              className="text-base font-extrabold"
              style={{ color: EKARI.text }}
            >
              Connections
            </div>
          </div>
          <div className="w-9" />
        </div>

        {/* Tabs: Following / Followers / Partners / Mutual */}
        <div
          className="flex border-b text-sm font-semibold"
          style={{ borderColor: EKARI.hair }}
        >
          <Tab
            label={`Following ${formatCount(followingCount)}`}
            active={tab === "following"}
            onClick={() =>
              router.push(`/${encodeURIComponent(handleSlug)}/connections?tab=following`)
            }
          />
          <Tab
            label={`Followers ${formatCount(followersCount)}`}
            active={tab === "followers"}
            onClick={() =>
              router.push(`/${encodeURIComponent(handleSlug)}/connections?tab=followers`)
            }
          />
          <Tab
            label={`Partners ${formatCount(partnersCount)}`}
            active={tab === "partners"}
            onClick={() =>
              router.push(`/${encodeURIComponent(handleSlug)}/connections?tab=partners`)
            }
          />
          <Tab
            label={`Mutual Partners ${formatCount(mutualCount)}`}
            active={tab === "mutual"}
            onClick={() =>
              router.push(`/${encodeURIComponent(handleSlug)}/connections?tab=mutual`)
            }
          />
        </div>

        {/* Search bar */}
        <div
          className="mt-3 mb-2 flex items-center gap-2 rounded-xl px-3 py-2 border"
          style={{ backgroundColor: "#F9FAFB", borderColor: EKARI.hair }}
        >
          <IoSearchOutline size={18} style={{ color: EKARI.subtext }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: EKARI.text }}
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <BouncingBallLoader />
          </div>
        ) : currentList.length === 0 ? (
          <div
            className="py-16 text-center text-sm"
            style={{ color: EKARI.subtext }}
          >
            No users to show.
          </div>
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: EKARI.hair }}
          >
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
          </div>
        )}
      </div>
    </AppShell>
  );
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
          <Image
            src={user.photoURL || "/avatar-blank.png"}
            alt={fullName}
            fill
            className="object-cover"
          />
        </div>
        <div className="min-w-0">
          <div
            className="text-sm font-semibold truncate"
            style={{ color: EKARI.text }}
          >
            {fullName}
          </div>
          {!!handle && (
            <div
              className="text-xs truncate"
              style={{ color: EKARI.subtext }}
            >
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
