"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query, where, deleteDoc, setDoc,
  getDocs, startAfter, updateDoc, serverTimestamp, DocumentData, QueryDocumentSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import {
  IoPlayCircleOutline, IoPricetagOutline, IoCubeOutline, IoTrashOutline, IoTimeOutline,
  IoEyeOffOutline, IoCashOutline, IoCheckmarkDone, IoCalendarClearOutline, IoCalendarOutline,
  IoLocationOutline, IoPeopleOutline, IoHeartOutline, IoChatbubblesOutline,
  IoChatbubbleEllipsesOutline, IoListOutline, IoFilmOutline, IoLockClosedOutline, IoClose
} from "react-icons/io5";
import { DeedDoc, toDeed, resolveUidByHandle } from "@/lib/fire-queries";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import DotsLoader from "../components/DotsLoader";
import { SmartImage } from "../components/SmartImage";
import SmartAvatar from "../components/SmartAvatar";
import { deleteObject, getStorage, listAll, ref as sRef } from "firebase/storage";

const EKARI = { forest: "#233F39", bg: "#ffffff", text: "#111827", subtext: "#6B7280", hair: "#E5E7EB", primary: "#C79257" };
const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

type Profile = {
  id: string;
  handle?: string;
  name?: string;
  bio?: string;
  website?: string;
  phone?: string;
  photoURL?: string;
  followersCount?: number;
  followingCount?: number;
  likesTotal?: number;
};

type MarketType = "product" | "lease" | "service" | "animal" | "crop" | "equipment" | "tree" | string;
type Product = {
  id: string;
  name: string;
  price: number;
  category?: string;
  imageUrl?: string;
  imageUrls?: string[];
  sellerId: string;
  createdAt?: any;
  type?: MarketType;
  unit?: string;
  typicalPackSize?: number | string;
  rate?: string;
  billingUnit?: string;
  nameLower?: string;
  categoryLower?: string;
  status?: "active" | "sold" | "reserved" | "hidden";
  sold?: boolean;
};

type DeedStatus = "ready" | "processing" | "mixing" | "uploading" | "failed" | "deleted";

function nfmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
const KES = (n: number) =>
  "KSh " + (Number.isFinite(n) ? n : 0).toLocaleString("en-KE", { maximumFractionDigits: 0 });

/* =========================================================
   Upload gate — blocks the whole page while a new deed
   is not READY or FAILED. Detects via ?deedId= or localStorage.
========================================================= */
function DeedProcessingGate({
  authorUid,
  handle,
}: {
  authorUid: string | null;
  handle: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [deedId, setDeedId] = React.useState<string | null>(null);
  const [deed, setDeed] = React.useState<DeedDoc | null>(null);
  const [busyDelete, setBusyDelete] = React.useState(false);

  // resolve deedId from query, else localStorage
  React.useEffect(() => {
    const qId = search?.get?.("deedId");
    if (qId) {
      setDeedId(qId);
      if (typeof window !== "undefined") {
        try { localStorage.setItem("lastUploadedDeedId", qId); } catch { }
      }
      return;
    }
    if (typeof window !== "undefined") {
      try {
        const ls = localStorage.getItem("lastUploadedDeedId");
        if (ls) setDeedId(ls);
      } catch { }
    }
  }, [search]);

  // subscribe to deed status
  React.useEffect(() => {
    if (!deedId) return;
    const ref = doc(db, "deeds", deedId);
    const unsub = onSnapshot(ref, (s) => {
      if (!s.exists()) { setDeed(null); return; }
      setDeed(toDeed(s.data(), s.id));
    });
    return () => unsub();
  }, [deedId]);

  // compute gating
  const status = (deed?.status as DeedStatus) || "ready";
  const isBlocking =
    Boolean(deedId) &&
    (status === "uploading" || status === "processing" || status === "mixing");

  const isFailed = Boolean(deedId) && status === "failed";
  const isReady = Boolean(deedId) && status === "ready";

  // when it becomes ready, clear localStorage + drop query param
  React.useEffect(() => {
    if (!deedId) return;
    if (isReady) {
      if (typeof window !== "undefined") {
        try { localStorage.removeItem("lastUploadedDeedId"); } catch { }
      }
      // remove ?deedId from the URL (shallow)
      const url = `/${encodeURIComponent(handle.replace(/^@/, ""))}`;
      router.replace(url);
    }
  }, [deedId, isReady, handle, router]);

  // progress (heuristics with optional deed.progress[0..1])
  const rawP =
    typeof (deed as any)?.progress === "number" ? (deed as any).progress :
      status === "uploading" ? 0.25 :
        status === "mixing" ? 0.6 :
          status === "processing" ? 0.8 :
            status === "ready" ? 1 : 0;

  async function deleteMuxIfAny(d?: DeedDoc | null) {
    if (!d?.media) return;
    const muxIds = d.media.map((m) => (m as any)?.muxAssetId).filter(Boolean) as string[];
    for (const assetId of muxIds) {
      try {
        await fetch(`/api/mux/delete?assetId=${encodeURIComponent(assetId)}`, { method: "DELETE" });
      } catch { }
    }
  }

  async function deleteStorageIfAny(d?: DeedDoc | null) {
    try {
      if (!d?.authorId || !d?.id) return;
      const storage = getStorage();
      const folder = sRef(storage, `deeds/${d.authorId}/${d.id}`);
      async function deleteFolder(r: ReturnType<typeof sRef>) {
        const { items, prefixes } = await listAll(r);
        await Promise.all(items.map((it) => deleteObject(it).catch(() => { })));
        await Promise.all(prefixes.map((p) => deleteFolder(p)));
      }
      await deleteFolder(folder);
    } catch { }
  }

  async function hardDeleteFailed() {
    if (!deedId || !deed) return;
    const ok = window.confirm("Delete failed upload?");
    if (!ok) return;
    try {
      setBusyDelete(true);
      await Promise.allSettled([deleteMuxIfAny(deed), deleteStorageIfAny(deed)]);
      await deleteDoc(doc(db, "deeds", deedId));
      if (typeof window !== "undefined") {
        try { localStorage.removeItem("lastUploadedDeedId"); } catch { }
      }
      // back to profile clean
      const url = `/${encodeURIComponent(handle.replace(/^@/, ""))}`;
      router.replace(url);
    } catch (e: any) {
      alert(e?.message || "Delete failed. Try again.");
    } finally {
      setBusyDelete(false);
    }
  }

  if (!deedId || (!isBlocking && !isFailed)) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop blocks all interaction */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Panel */}
      <div className="absolute left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-full bg-emerald-700 text-white">
            {isFailed ? <IoClose size={18} /> : <DotsLoader />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-extrabold text-slate-900">
              {isFailed ? "Upload failed" : "Processing your deed"}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {isFailed
                ? "We couldn't finish preparing your video. You can delete it and try again."
                : "We’re mixing and preparing your video. This can take a short moment. You’ll be able to preview and share once it’s ready."}
            </div>

            {!isFailed && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[12px] font-semibold text-slate-600">
                  <span>Status: {status}</span>
                  <span>{Math.round(rawP * 100)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full border border-slate-200">
                  <div
                    className="h-full bg-emerald-600 transition-[width] duration-500"
                    style={{ width: `${Math.max(5, Math.min(100, Math.round(rawP * 100)))}%` }}
                  />
                </div>
              </div>
            )}

            {isFailed && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={hardDeleteFailed}
                  disabled={busyDelete}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {busyDelete ? "Deleting…" : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Note: While processing, profile actions are disabled.
        </div>
      </div>
    </div>
  );
}
function useMutualFollow(viewerUid?: string, targetUid?: string) {
  const [aFollowsB, setAFollowsB] = React.useState(false);
  const [bFollowsA, setBFollowsA] = React.useState(false);

  React.useEffect(() => {
    setAFollowsB(false);
    setBFollowsA(false);
    if (!viewerUid || !targetUid || viewerUid === targetUid) return;

    const refA = doc(db, "follows", `${viewerUid}_${targetUid}`); // viewer → profile
    const refB = doc(db, "follows", `${targetUid}_${viewerUid}`); // profile → viewer

    const unsubA = onSnapshot(refA, (s) => setAFollowsB(s.exists()));
    const unsubB = onSnapshot(refB, (s) => setBFollowsA(s.exists()));

    return () => { unsubA(); unsubB(); };
  }, [viewerUid, targetUid]);

  return aFollowsB && bFollowsA;
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
        phone: d.phone,            // ← ADD THIS
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

    const base = query(
      collection(db, "deeds"),
      where("authorId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(60)
    );

    const unsub = onSnapshot(
      base,
      (snap) => {
        const raw = snap.docs.map((d) => toDeed(d.data(), d.id));

        const filtered = isOwner
          ? raw.filter((d) => d.status !== "deleted")
          : raw.filter((d) => d.status === "ready" && (d.visibility || "public") === "public");

        setItems(filtered);
        setLoading(false);
      },
      (err) => {
        console.warn("deeds listener error:", err?.message || err);
        setItems([]);
        setLoading(false);
      }
    );

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

/* ---------- header (with tabs) ---------- */
type TabKey = "deeds" | "listings" | "events" | "discussions";

function Header({
  profile,
  isOwner,
  followState,
  likesValue,
  tab,
  onTabChange,
  hasUser,
  onRequireAuth,
  canSeeContacts,
}: {
  profile: Profile;
  isOwner: boolean;
  followState: ReturnType<typeof useFollowingState>;
  likesValue: number;
  tab: TabKey;
  onTabChange: (k: TabKey) => void;
  hasUser: boolean;
  onRequireAuth: () => boolean;
  canSeeContacts: boolean;  // ← ADD THIS
}) {
  const followers = profile?.followersCount ?? 0;
  const following = profile?.followingCount ?? 0;

  function TabBtn({
    k,
    label,
    icon,
  }: {
    k: TabKey;
    label: string;
    icon?: React.ReactNode;
  }) {
    const active = tab === k;
    return (
      <button
        onClick={() => onTabChange(k)}
        className={`flex items-center gap-1.5 px-1 pb-2 border-b-2 transition ${active
          ? "border-black text-black"
          : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
      >
        <span className={active ? "text-black" : "text-gray-500"}>{icon}</span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <header className="px-4 md:px-8 pt-6 pb-4">
      <div className="flex items-start gap-4 md:gap-6">
        <div className="h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden bg-gray-200 shrink-0 relative">
          <SmartAvatar
            src={profile.photoURL || "/avatar-blank.png"}
            alt={profile.handle || "avatar"}
            size={112}
            rounded="full"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl md:text-2xl font-extrabold truncate" style={{ color: EKARI.text }}>
              {profile.handle ? `${profile.handle}` : "Profile"}
            </h1>

            {isOwner ? (
              <Link
                href={`/${profile.handle}/edit`}
                className="rounded-md border px-3 py-1.5 text-sm font-bold hover:bg-black/5"
                style={{ borderColor: EKARI.hair }}
              >
                Edit profile
              </Link>
            ) : (
              <>
                {!hasUser ? (
                  <button
                    onClick={() => onRequireAuth?.()}
                    className="rounded-md px-3 py-1.5 text-sm font-bold text-white"
                    style={{ backgroundColor: EKARI.primary }}
                  >
                    Partner
                  </button>
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
              </>
            )}
          </div>

          <div className="mt-2 flex items-center gap-5 text-sm">
            <Stat label="Partnered" value={nfmt(following)} />
            <Stat label="Partners" value={nfmt(followers)} />
            <Stat label="Likes" value={nfmt(likesValue)} />
          </div>

          {profile.name && <div className="mt-2 text-sm font-semibold" style={{ color: EKARI.text }}>{profile.name}</div>}
          {profile.bio && <p className="mt-1 text-sm leading-5" style={{ color: EKARI.text }}>{profile.bio}</p>}
          {/* Contacts (owner or mutual followers only) */}
          {canSeeContacts && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {profile.phone && (
                <a
                  href={`tel:${profile.phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-bold hover:bg-black/5"
                  style={{ borderColor: EKARI.hair, color: EKARI.text }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80" aria-hidden>
                    <path fill="currentColor" d="M6.6 10.8c1.2 2.3 3.1 4.2 5.4 5.4l1.8-1.8c.3-.3.7-.4 1.1-.3c1.2.4 2.6.6 4 .6c.6 0 1 .4 1 .9V21c0 .6-.4 1-1 1C10.4 22 2 13.6 2 3c0-.6.4-1 1-1h4.5c.5 0 .9.4.9 1c0 1.4.2 2.8.6 4c.1.4 0 .8-.3 1.1L6.6 10.8z" />
                  </svg>
                  <span>{profile.phone}</span>
                </a>
              )}

              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-bold hover:bg-black/5"
                  style={{ borderColor: EKARI.hair, color: EKARI.primary }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80" aria-hidden>
                    <path fill="currentColor" d="M14 3h7v7h-2V6.4l-8.3 8.3l-1.4-1.4L17.6 5H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z" />
                  </svg>
                  <span>{profile.website.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 border-t" style={{ borderColor: EKARI.hair }}>
        <nav className="flex flex-wrap gap-6 text-sm font-bold px-1 pt-3">
          <TabBtn k="deeds" label="Deeds" icon={<IoFilmOutline size={16} />} />
          {isOwner && <TabBtn k="listings" label="My Listings" icon={<IoListOutline size={16} />} />}
          {isOwner && <TabBtn k="events" label="My Events" icon={<IoCalendarOutline size={16} />} />}
          {isOwner && <TabBtn k="discussions" label="My Discussions" icon={<IoChatbubblesOutline size={16} />} />}
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

/* ---------- grids ---------- */
function VideosGrid({ items, handle, isOwner }: { items: DeedDoc[]; handle: string; isOwner: boolean }) {
  return (
    <div className="px-3 md:px-6 pb-12">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
        {items.map((d) => (
          <VideoTile key={d.id} deed={d} handle={handle} isOwner={isOwner} />
        ))}
      </div>
      {items.length === 0 && (
        <div className="py-16 text-center text-sm" style={{ color: EKARI.subtext }}>
          No deeds yet.
        </div>
      )}
    </div>
  );
}

function VideoTile({ deed, handle, isOwner }: { deed: DeedDoc; handle: string; isOwner: boolean }) {
  const poster =
    deed.media?.find((m) => m.thumbUrl)?.thumbUrl ||
    deed.mediaThumbUrl ||
    deed.media?.[0]?.thumbUrl ||
    "/video-placeholder.jpg";

  const views = nfmt(deed.stats?.views ?? 0);
  const [imgLoading, setImgLoading] = React.useState(true);
  const ready = (deed.status as DeedStatus) === "ready";
  const href = `/${encodeURIComponent(handle)}/video/${deed.id}`;

  const Card = (
    <div
      className={cn(
        "group relative block overflow-hidden rounded-xl",
        ready ? "bg-black" : "bg-slate-200"
      )}
      style={{ aspectRatio: "9/12" }}
      aria-disabled={!ready}
    >
      {imgLoading && (
        <div className="absolute inset-0 grid place-items-center bg-gray-100">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#D1D5DB", borderTopColor: EKARI.forest }}
            aria-hidden
          />
        </div>
      )}

      <Image
        src={poster}
        alt={deed.caption || "video"}
        fill
        className={`h-full w-full object-cover transition-transform ${imgLoading ? "opacity-0" : "group-hover:scale-[1.02] opacity-100"}`}
        sizes="100vw"
        priority={false}
        onLoadingComplete={() => setImgLoading(false)}
      />

      {!ready && <div className="absolute inset-0 bg-black/40" />}

      <div className="absolute left-0 right-0 bottom-0 p-2 text-white text-xs bg-gradient-to-t from-black/70 to-black/0">
        <span className="inline-flex items-center gap-1 font-semibold">
          <IoPlayCircleOutline className="opacity-80" /> {views}
        </span>
      </div>

      {!ready && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-black/5">
            <IoLockClosedOutline />
            {deed.status}
          </span>
        </div>
      )}
    </div>
  );

  if (!ready) {
    // Non-ready tiles are not clickable for anyone (owners can still see them).
    return <div>{Card}</div>;
  }

  return (
    <Link href={href} className="block" prefetch aria-label="Open video">
      {Card}
    </Link>
  );
}

/* ---------- owner tabs: Listings ---------- */
function OwnerListingsGrid({ uid }: { uid: string }) {
  const router = useRouter();
  const [items, setItems] = React.useState<Product[]>([]);
  const [paging, setPaging] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const lastDocRef = React.useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  React.useEffect(() => {
    if (!uid) return;
    const qRef = query(
      collection(db, "marketListings"),
      where("sellerId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(24)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        setTotal(snap.size);
        setLoading(false);
      },
      (err) => console.warn("Listings listener error:", err)
    );
    return () => unsub();
  }, [uid]);

  const loadMore = async () => {
    if (paging || !lastDocRef.current) return;
    setPaging(true);
    try {
      const qRef = query(
        collection(db, "marketListings"),
        where("sellerId", "==", uid),
        orderBy("createdAt", "desc"),
        startAfter(lastDocRef.current),
        limit(24)
      );
      const snap = await getDocs(qRef);
      if (!snap.empty) {
        setItems((prev) => [...prev, ...snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))]);
        lastDocRef.current = snap.docs[snap.docs.length - 1];
      } else {
        lastDocRef.current = null;
      }
    } catch (e) {
      console.error("Pagination error:", e);
    } finally {
      setPaging(false);
    }
  };

  const updateStatus = async (p: Product, status: Product["status"]) => {
    try {
      await updateDoc(doc(db, "marketListings", p.id), {
        status,
        sold: status === "sold",
        updatedAt: serverTimestamp(),
      });
    } catch (e: any) {
      alert(`Failed to update: ${e?.message || "Unknown error"}`);
    }
  };

  async function deleteFolderRecursively(folderRef: ReturnType<typeof sRef>) {
    const { items, prefixes } = await listAll(folderRef);
    await Promise.all(items.map(async (it) => {
      try { await deleteObject(it); } catch (e) { console.warn("Could not delete file:", it.fullPath, e); }
    }));
    await Promise.all(prefixes.map((pfx) => deleteFolderRecursively(pfx)));
  }
  async function deleteSubcollection(parentPath: string, subcol: string) {
    const snap = await getDocs(collection(db, `${parentPath}/${subcol}`));
    if (snap.empty) return;
    const docs = snap.docs;
    const chunkSize = 450;
    for (let i = 0; i < docs.length; i += chunkSize) {
      const batch = writeBatch(db);
      for (const d of docs.slice(i, i + chunkSize)) batch.delete(d.ref);
      await batch.commit();
    }
  }
  const removeListing = async (p: Product) => {
    const ok = window.confirm("Delete this listing? This will also remove its images.");
    if (!ok) return;

    const storage = getStorage();
    const parentPath = `marketListings/${p.id}`;
    const imagesFolder = sRef(storage, `products/${p.sellerId}/${p.id}/images`);

    try {
      try { await deleteFolderRecursively(imagesFolder); } catch (e) { console.warn("Images cleanup issue:", e); }
      await deleteSubcollection(parentPath, "reviews");
      await deleteDoc(doc(db, parentPath));
      alert("Listing deleted.");
    } catch (e: any) {
      alert(`Failed to delete: ${e?.message || "Unknown error"}`);
    }
  };

  const statusColor = (p: Product) =>
    p.status === "sold" ? "bg-red-600" :
      p.status === "reserved" ? "bg-yellow-500" :
        p.status === "hidden" ? "bg-gray-500" : "bg-emerald-600";

  if (loading)
    return (
      <div className="px-3 md:px-6 pb-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 md:h-56 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );

  if (items.length === 0)
    return <div className="py-16 text-center text-sm text-gray-400">No listings yet.</div>;

  return (
    <div className="px-3 md:px-6 pb-12">
      <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-700">
        <IoCubeOutline className="text-emerald-700" />
        <span>{total} listing{total === 1 ? "" : "s"}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((p) => {
          const cover = p.imageUrl || p.imageUrls?.[0];
          const numericRate = Number(String(p.rate ?? "").replace(/[^\d.]/g, ""));
          const priceText =
            p.type === "lease" || p.type === "service"
              ? `${Number.isFinite(numericRate) && numericRate > 0 ? KES(numericRate) : "—"}${p.billingUnit ? ` / ${p.billingUnit}` : ""}`
              : KES(Number(p.price || 0));
          const statusLabel = (p.status || (p.sold ? "sold" : "active")).replace(/^\w/, (c) => c.toUpperCase());

          return (
            <div key={p.id} className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition">
              <div onClick={() => router.push(`/market/${p.id}`)} className="relative block aspect-[4/3] bg-gray-100 cursor-pointer">
                <SmartImage
                  src={cover || ""}
                  alt={p.name || "Listing"}
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 33vw"
                  fallbackSrc=""
                  emptyFallback={<div className="absolute inset-0 grid place-items-center text-gray-400 text-sm bg-gray-50">No image</div>}
                />
                <div className={`absolute left-2 top-2 ${statusColor(p)} text-white text-[11px] font-black h-6 px-2 rounded-full flex items-center gap-1`}>
                  <IoCheckmarkDone size={12} />
                  {statusLabel}
                </div>
              </div>

              <div className="p-3">
                <div className="text-[13px] font-extrabold text-gray-900 line-clamp-2">{p.name || "Untitled"}</div>
                <div className="text-emerald-700 font-black">{priceText}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!!p.category && (
                    <span className="inline-flex items-center gap-1 border border-gray-200 rounded-full px-2.5 py-1 text-[12px] font-bold">
                      <IoPricetagOutline className="text-emerald-700" size={14} />
                      {p.category}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {p.status !== "active" && (
                    <button onClick={() => updateStatus(p, "active")} className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-700 text-white text-xs font-bold hover:opacity-90">
                      <IoCheckmarkDone /> Activate
                    </button>
                  )}
                  {p.status !== "sold" && (
                    <button onClick={() => updateStatus(p, "sold")} className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-600 text-white text-xs font-bold hover:opacity-90">
                      <IoCashOutline /> Sold
                    </button>
                  )}
                  {p.status !== "reserved" && (
                    <button onClick={() => updateStatus(p, "reserved")} className="flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500 text-white text-xs font-bold hover:opacity-90">
                      <IoTimeOutline /> Reserve
                    </button>
                  )}
                  {p.status !== "hidden" && (
                    <button onClick={() => updateStatus(p, "hidden")} className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-600 text-white text-xs font-bold hover:opacity-90">
                      <IoEyeOffOutline /> Hide
                    </button>
                  )}
                  <button onClick={() => removeListing(p)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-600 text-white text-xs font-bold hover:opacity-90">
                    <IoTrashOutline /> Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid place-items-center">
        {lastDocRef.current ? (
          <button onClick={loadMore} disabled={paging} className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-black hover:opacity-90 disabled:opacity-60">
            {paging ? <BouncingBallLoader /> : "Load more"}
          </button>
        ) : (
          <div className="text-gray-400 text-sm mt-4">End of results</div>
        )}
      </div>
    </div>
  );
}

type EventDoc = {
  id: string;
  title?: string;
  dateISO?: string;
  organizerId?: string;
  location?: string;
  stats?: { likes?: number; rsvps?: number };
} & DocumentData;

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- owner tabs: Events ---------- */
function OwnerEvents({ uid }: { uid: string }) {
  const router = useRouter();
  const [events, setEvents] = React.useState<EventDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!uid) return;
    const qRef = query(collection(db, "events"), where("organizerId", "==", uid), orderBy("dateISO", "desc"));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) })) as EventDoc[]);
        setLoading(false);
      },
      (err) => { console.warn("OwnerEvents listener error:", err?.message || err); setLoading(false); }
    );
    return () => unsub();
  }, [uid]);

  const handleRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 800); };

  async function deleteFolderRecursively(folderRef: ReturnType<typeof sRef>) {
    const { items, prefixes } = await listAll(folderRef);
    await Promise.all(items.map(async (it) => { try { await deleteObject(it); } catch (e) { console.warn("Could not delete file:", it.fullPath, e); } }));
    await Promise.all(prefixes.map((p) => deleteFolderRecursively(p)));
  }

  const removeEvent = async (e: EventDoc) => {
    const ok = window.confirm("Delete this event? This will also remove its images.");
    if (!ok) return;

    const storage = getStorage();
    const organizer = e.organizerId || uid;
    const folderRef = sRef(storage, `events/${organizer}/${e.id}`);
    const parentPath = `events/${e.id}`;

    try {
      try { await deleteFolderRecursively(folderRef); } catch (err) { console.warn("Event images cleanup issue (continuing):", err); }
      await deleteDoc(doc(db, parentPath));
      setEvents((prev) => prev.filter((x) => x.id !== e.id));
      alert("Event deleted.");
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || "Unknown error"}`);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><BouncingBallLoader /></div>;
  if (events.length === 0)
    return (
      <div className="px-3 md:px-6 pb-12 text-center text-sm text-gray-500">
        <div className="flex flex-col items-center gap-2 py-16">
          <IoCalendarClearOutline size={30} className="text-gray-400" />
          <p>No events yet.</p>
        </div>
      </div>
    );

  return (
    <div className="px-3 md:px-6 pb-12">
      <div className="flex items-center gap-2 mb-5 text-sm font-semibold text-gray-700">
        <IoCalendarOutline className="text-emerald-700" />
        <span>{events.length} event{events.length === 1 ? "" : "s"}</span>
        <button onClick={handleRefresh} disabled={refreshing} className="ml-auto text-xs font-bold text-emerald-700 hover:underline disabled:opacity-50">
          {refreshing ? "Refreshing..." : "Reload"}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {events.map((e) => {
          const likes = e?.stats?.likes ?? 0;
          const rsvps = e?.stats?.rsvps ?? 0;

          return (
            <div key={e.id} className="border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition p-4 flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <button onClick={() => router.push(`/events/${e.id}`)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-700 shrink-0">
                      <IoTimeOutline size={18} color="#fff" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-extrabold text-gray-900 truncate">{e.title || "Untitled event"}</div>
                      <div className="text-[13px] text-gray-500 flex flex-wrap items-center gap-1">
                        <span>{fmtDate(e.dateISO)}</span>
                        {e.location && (<><span>•</span><span className="inline-flex items-center gap-1"><IoLocationOutline size={12} />{e.location}</span></>)}
                      </div>
                    </div>
                  </div>
                </button>

                <button onClick={(ev) => { ev.stopPropagation(); removeEvent(e); }} className="h-9 w-9 grid place-items-center rounded-lg bg-rose-50 border border-rose-200" aria-label="Delete event" title="Delete">
                  <IoTrashOutline className="text-rose-600" size={18} />
                </button>
              </div>

              <div className="flex gap-3 mt-2">
                <div className="flex items-center gap-1 border border-gray-200 rounded-full px-2.5 py-1 text-xs font-bold">
                  <IoHeartOutline className="text-emerald-700" size={14} />
                  {likes}
                </div>
                <div className="flex items-center gap-1 border border-gray-200 rounded-full px-2.5 py-1 text-xs font-bold">
                  <IoPeopleOutline className="text-emerald-700" size={14} />
                  {rsvps}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type DiscussionRow = {
  id: string;
  title?: string;
  createdAt?: any;
  repliesCount?: number;
  published?: boolean;
  _pending?: boolean;
} & DocumentData;

function dateText(ts: any) {
  if (!ts) return "";
  if (typeof ts === "string") return ts;
  if (ts?.toDate) {
    const d = ts.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.toLocaleDateString() : "";
  }
  return "";
}

function OwnerDiscussions({ uid }: { uid: string }) {
  const router = useRouter();
  const [items, setItems] = React.useState<DiscussionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const attachListener = React.useCallback(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const qRef = query(collection(db, "discussions"), where("authorId", "==", uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qRef,
      { includeMetadataChanges: true },
      (snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id, ...(d.data() as DocumentData), _pending: d.metadata.hasPendingWrites,
        })) as DiscussionRow[];
        setItems(rows); setLoading(false);
      },
      (err) => { console.warn("OwnerDiscussions listener error:", err?.message || err); setLoading(false); }
    );
    return unsub;
  }, [uid]);

  React.useEffect(() => {
    const unsub = attachListener();
    return () => { try { (unsub as unknown as () => void)?.(); } catch { } };
  }, [attachListener]);

  const handleRefresh = () => {
    setRefreshing(true);
    const unsub = attachListener();
    setTimeout(() => { setRefreshing(false); try { (unsub as unknown as () => void)?.(); } catch { } }, 500);
  };

  const togglePublish = async (row: DiscussionRow) => {
    const current = row.published ?? true;
    const next = !current;
    setItems((prev) => prev.map((i) => (i.id === row.id ? { ...i, published: next, _pending: true } : i)));
    try { setBusyId(row.id); await updateDoc(doc(db, "discussions", row.id), { published: next }); }
    catch (e: any) {
      setItems((prev) => prev.map((i) => (i.id === row.id ? { ...i, published: current, _pending: false } : i)));
      alert(e?.message || "Failed to update discussion.");
    } finally { setBusyId(null); }
  };

  const confirmDelete = async (row: DiscussionRow) => {
    const ok = window.confirm("Delete this discussion? This cannot be undone.");
    if (!ok) return;
    try { setBusyId(row.id); await deleteDoc(doc(db, "discussions", row.id)); }
    catch (e: any) { alert(e?.message || "Delete failed. Try again."); }
    finally { setBusyId(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><BouncingBallLoader /></div>;
  if (items.length === 0)
    return (
      <div className="px-3 md:px-6 pb-12">
        <div className="py-16 text-center text-sm" style={{ color: EKARI.text }}>
          <IoChatbubblesOutline size={28} className="mx-auto mb-2 text-gray-400" />
          No discussions yet.
        </div>
      </div>
    );

  return (
    <div className="px-3 md:px-6 pb-12">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-sm font-semibold text-gray-700">{items.length} discussion{items.length === 1 ? "" : "s"}</div>
        <button onClick={handleRefresh} disabled={refreshing} className="ml-auto text-xs font-bold text-emerald-700 hover:underline disabled:opacity-60">
          {refreshing ? "Refreshing..." : "Reload"}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const isPublished = item.published ?? true;
          const statusTxt = isPublished ? "Published" : "Unpublished";
          const statusCls = isPublished ? "bg-emerald-50 text-emerald-800" : "bg-gray-100 text-gray-700";

          return (
            <div key={item.id} className="border border-gray-200 rounded-xl bg-white shadow-sm p-4">
              <button onClick={() => router.push(`/discussions/${item.id}`)} className="block w-full text-left">
                <div className="font-extrabold text-gray-900 text-[15px] leading-5 line-clamp-2">{item.title || "Untitled discussion"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
                  {!!item.createdAt && (<span className="inline-flex items-center gap-1 text-gray-500"><IoTimeOutline size={14} />{dateText(item.createdAt)}</span>)}
                  <span className="inline-flex items-center gap-1 text-gray-500"><IoChatbubbleEllipsesOutline size={14} />{(item.repliesCount ?? 0).toString()} answers</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${statusCls}`}>{statusTxt}</span>
                  {item._pending && (<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800">Syncing…</span>)}
                </div>
              </button>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => togglePublish(item)}
                  disabled={busyId === item.id}
                  className={`h-9 px-3 rounded-full text-white text-xs font-extrabold transition
                    ${isPublished ? "bg-amber-600 hover:opacity-90" : "bg-emerald-700 hover:opacity-90"} disabled:opacity-60`}
                  aria-label={isPublished ? "Unpublish discussion" : "Publish discussion"}
                >
                  {busyId === item.id ? "Working…" : isPublished ? "Unpublish" : "Publish"}
                </button>

                <button
                  onClick={() => confirmDelete(item)}
                  disabled={busyId === item.id}
                  className="h-9 w-10 grid place-items-center rounded-lg bg-rose-50 border border-rose-200 disabled:opacity-60"
                  aria-label="Delete discussion"
                >
                  {busyId === item.id ? (
                    <span className="text-rose-600 text-xs font-bold">…</span>
                  ) : (
                    <IoTrashOutline className="text-rose-600" size={18} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- page ---------- */
export default function HandleProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ handle: string }>();

  const raw = params?.handle ?? "";
  const decoded = (() => { try { return decodeURIComponent(raw); } catch { return raw; } })();
  const handleWithAt = decoded.startsWith("@") ? decoded : `@${decoded}`;

  const [uid, setUid] = React.useState<string | null | undefined>(undefined);
  const [tab, setTab] = React.useState<TabKey>("deeds");

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

  const mutual = useMutualFollow(user?.uid, uid ?? undefined);
  const canSeeContacts = isOwner || (!!user && mutual);



  const requireAuth = React.useCallback(() => {
    if (user) return true;
    try {
      const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      router.push(`/login?next=${encodeURIComponent(next)}`);
    } catch {
      router.push("/login");
    }
    return false;
  }, [user, router]);

  return (
    <AppShell>
      {/* Processing Gate blocks the whole page when needed */}
      <DeedProcessingGate authorUid={uid ?? null} handle={handleWithAt} />

      <div className="mx-auto w-full max-w-[1160px] px-4 md:px-8">
        {/* header with tabs */}
        {loadingProfile ? (
          <div className="p-6 animate-pulse">
            <div className="h-8 w-40 bg-gray-200 rounded mb-3" />
            <div className="h-24 w-24 bg-gray-200 rounded-full" />
          </div>
        ) : profile ? (
          <Header
            profile={profile}
            isOwner={isOwner}
            followState={followState}
            likesValue={likesValue}
            tab={tab}
            onTabChange={setTab}
            hasUser={!!user}
            onRequireAuth={requireAuth}
            canSeeContacts={canSeeContacts}   // ← ADD THIS
          />
        ) : (
          <div className="flex p-6 items-center justify-center h-screen w-full text-sm" style={{ color: EKARI.subtext }}>
            {uid === undefined ? (<><BouncingBallLoader /></>) : "Profile not found."}
          </div>
        )}

        {/* tab content */}
        {tab === "deeds" && (
          loadingDeeds ? (
            <div className="px-3 md:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-48 md:h-56 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <VideosGrid items={items} handle={handleWithAt} isOwner={isOwner} />
          )
        )}

        {isOwner && tab === "listings" && uid && <OwnerListingsGrid uid={uid} />}
        {isOwner && tab === "events" && uid && <OwnerEvents uid={uid} />}
        {isOwner && tab === "discussions" && uid && <OwnerDiscussions uid={uid} />}
      </div>
    </AppShell>
  );
}
