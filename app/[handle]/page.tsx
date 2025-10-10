// app/[handle]/page.tsx
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query, where, deleteDoc, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import { IoPlayCircleOutline } from "react-icons/io5";
import { DeedDoc, toDeed, resolveUidByHandle } from "@/lib/fire-queries";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

/* ---------- theme + utils ---------- */
const EKARI = { bg: "#ffffff", text: "#111827", subtext: "#6B7280", hair: "#E5E7EB", primary: "#C79257" };
const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

type Profile = {
  id: string;
  handle?: string;
  name?: string;
  bio?: string;
  website?: string;
  photoURL?: string;
  followersCount?: number;
  followingCount?: number;
  likesTotal?: number; // optional, if you persist this on user doc
};

function nfmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

/* ---------- hooks ---------- */
function useProfileByUid(uid?: string) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (!uid) { setProfile(null); setLoading(false); return; }
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      const d = snap.exists() ? (snap.data() as any) : null;
      setProfile(d ? {
        id: snap.id,
        handle: d.handle,
        name: d.name,
        bio: d.bio,
        website: d.website,
        photoURL: d.photoURL || d.avatarUrl,
        followersCount: Number(d.followersCount ?? 0),
        followingCount: Number(d.followingCount ?? 0),
        likesTotal: Number(d.likesTotal ?? 0),
      } : null);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);
  return { profile, loading };
}

function useDeedsByAuthor(uid?: string, isOwner?: boolean) {
  const [items, setItems] = React.useState<DeedDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    const qBase = query(
      collection(db, "deeds"),
      where("authorId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(60)
    );
    const unsub = onSnapshot(qBase, (snap) => {
      const raw = snap.docs.map((d) => toDeed(d.data(), d.id));
      setItems(isOwner ? raw : raw.filter((x) => (x.visibility ?? "public") === "public"));
      setLoading(false);
    });
    return () => unsub();
  }, [uid, isOwner]);

  const likesFallback = React.useMemo(
    () => items.reduce((sum, d) => sum + Number(d?.stats?.likes || 0), 0),
    [items]
  );

  return { items, likesFallback, loading };
}

function useFollowingState(viewerUid?: string, targetUid?: string) {
  const [isFollowing, setIsFollowing] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (!viewerUid || !targetUid || viewerUid === targetUid) { setIsFollowing(null); return; }
    const id = `${viewerUid}_${targetUid}`;
    const ref = doc(db, "follows", id);
    const unsub = onSnapshot(ref, (s) => setIsFollowing(s.exists()));
    return () => unsub();
  }, [viewerUid, targetUid]);
  const toggle = async () => {
    if (!viewerUid || !targetUid || viewerUid === targetUid) return;
    const id = `${viewerUid}_${targetUid}`;
    const ref = doc(db, "follows", id);
    const s = await getDoc(ref);
    if (s.exists()) await deleteDoc(ref);
    else await setDoc(ref, { followerId: viewerUid, followingId: targetUid, createdAt: Date.now() });
  };
  return { isFollowing, toggle };
}

/* ---------- header ---------- */
function Header({
  profile,
  isOwner,
  followState,
  likesValue,
}: {
  profile: Profile;
  isOwner: boolean;
  followState: ReturnType<typeof useFollowingState>;
  likesValue: number;
}) {
  const followers = profile?.followersCount ?? 0;
  const following = profile?.followingCount ?? 0;

  return (
    <header className="px-4 md:px-8 pt-6 pb-4">
      <div className="flex items-start gap-4 md:gap-6">
        <div className="h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden bg-gray-200 shrink-0">
          <Image
            src={profile.photoURL || "/avatar-blank.png"}
            alt={profile.handle || "avatar"}
            width={112}
            height={112}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-extrabold truncate" style={{ color: EKARI.text }}>
              {profile.handle ? `${profile.handle}` : "Profile"}
            </h1>

            {isOwner ? (
              <Link
                href="/profile/edit"
                className="rounded-md border px-3 py-1.5 text-sm font-bold hover:bg-black/5"
                style={{ borderColor: EKARI.hair }}
              >
                Edit profile
              </Link>
            ) : followState.isFollowing === null ? null : (
              <button
                onClick={followState.toggle}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-bold",
                  followState.isFollowing ? "border hover:bg-black/5" : "text-white",
                )}
                style={followState.isFollowing ? { borderColor: EKARI.hair } : { backgroundColor: EKARI.primary }}
              >
                {followState.isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center gap-5 text-sm">
            <Stat label="Following" value={nfmt(following)} />
            <Stat label="Followers" value={nfmt(followers)} />
            <Stat label="Likes" value={nfmt(likesValue)} />
          </div>

          {profile.name && <div className="mt-2 text-sm font-semibold" style={{ color: EKARI.text }}>{profile.name}</div>}
          {profile.bio && <p className="mt-1 text-sm leading-5" style={{ color: EKARI.text }}>{profile.bio}</p>}
          {profile.website && (
            <a href={profile.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline" style={{ color: EKARI.primary }}>
              {profile.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
      </div>

      <div className="mt-6 border-t" style={{ borderColor: EKARI.hair }}>
        <nav className="flex gap-6 text-sm font-bold px-1">
          <span className="py-3 border-b-2" style={{ borderColor: EKARI.text, color: EKARI.text }}>Videos</span>
          <span className="py-3 text-gray-400">Favorites</span>
          <span className="py-3 text-gray-400">Liked</span>
        </nav>
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-extrabold mr-1" style={{ color: EKARI.text }}>{value}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

/* ---------- grid ---------- */
function VideosGrid({ items, handle }: { items: DeedDoc[]; handle: string }) {
  return (
    <div className="px-3 md:px-6 pb-12">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
        {items.map((d) => (
          <VideoTile key={d.id} deed={d} handle={handle} />
        ))}
      </div>
      {items.length === 0 && (
        <div className="py-16 text-center text-sm" style={{ color: EKARI.subtext }}>
          No posts yet.
        </div>
      )}
    </div>
  );
}

function VideoTile({ deed, handle }: { deed: DeedDoc; handle: string }) {
  const poster = deed.mediaThumbUrl || "/video-placeholder.jpg";
  const views = nfmt(deed.stats?.views ?? 0);
  return (
    <Link
      href={`/${encodeURIComponent(handle)}/video/${deed.id}`}
      className="group relative block overflow-hidden rounded-xl bg-black"
      style={{ aspectRatio: "9/12" }}
      prefetch
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt={deed.caption || "video"}
        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        loading="lazy"
      />
      <div className="absolute left-0 right-0 bottom-0 p-2 text-white text-xs bg-gradient-to-t from-black/70 to-black/0">
        <span className="inline-flex items-center gap-1 font-semibold">
          <IoPlayCircleOutline className="opacity-80" />
          {views}
        </span>
      </div>
    </Link>
  );
}

/* ---------- page ---------- */
export default function HandleProfilePage() {
  const { user } = useAuth();
  const params = useParams<{ handle: string }>();

  const raw = params?.handle ?? "";
  const decoded = (() => { try { return decodeURIComponent(raw); } catch { return raw; } })();
  const handleWithAt = decoded.startsWith("@") ? decoded : `@${decoded}`;

  const [uid, setUid] = React.useState<string | null | undefined>(undefined);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!handleWithAt) { setUid(null); return; }
      const res = await resolveUidByHandle(handleWithAt);
      if (!active) return;
      setUid(res?.uid ?? null);
    })();
    return () => { active = false; };
  }, [handleWithAt]);

  const isOwner = !!user?.uid && !!uid && user.uid === uid;
  const { profile, loading: loadingProfile } = useProfileByUid(uid ?? undefined);
  const { items, likesFallback, loading: loadingDeeds } = useDeedsByAuthor(uid ?? undefined, isOwner);
  const followState = useFollowingState(user?.uid, uid ?? undefined);

  const likesValue = profile?.likesTotal ?? likesFallback;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1160px] px-4 md:px-8">
        {/* header */}
        {loadingProfile ? (
          <div className="p-6 animate-pulse">
            <div className="h-8 w-40 bg-gray-200 rounded mb-3" />
            <div className="h-24 w-24 bg-gray-200 rounded-full" />
          </div>
        ) : profile ? (
          <Header profile={profile} isOwner={isOwner} followState={followState} likesValue={likesValue} />
        ) : (
          <div className="p-6 text-sm" style={{ color: EKARI.subtext }}>
            {uid === undefined ? (<><BouncingBallLoader /></>) : "Profile not found."}
          </div>
        )}

        {/* grid */}
        {loadingDeeds ? (
          <div className="px-3 md:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 md:h-56 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <VideosGrid items={items} handle={handleWithAt} />
        )}
      </div>
    </AppShell>
  );
}
