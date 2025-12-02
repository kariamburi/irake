"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  deleteDoc,
  setDoc,
  getDocs,
  startAfter,
  updateDoc,
  serverTimestamp,
  DocumentData,
  QueryDocumentSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import {
  IoPlayCircleOutline,
  IoPricetagOutline,
  IoCubeOutline,
  IoTrashOutline,
  IoTimeOutline,
  IoEyeOffOutline,
  IoCashOutline,
  IoCheckmarkDone,
  IoCalendarClearOutline,
  IoCalendarOutline,
  IoLocationOutline,
  IoPeopleOutline,
  IoHeartOutline,
  IoChatbubblesOutline,
  IoChatbubbleEllipsesOutline,
  IoListOutline,
  IoFilmOutline,
  IoLockClosedOutline,
  IoClose,
  IoPencilOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { DeedDoc, toDeed, resolveUidByHandle } from "@/lib/fire-queries";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import DotsLoader from "../components/DotsLoader";
import { SmartImage } from "../components/SmartImage";
import SmartAvatar from "../components/SmartAvatar";
import { deleteObject, getStorage, listAll, ref as sRef } from "firebase/storage";

const EKARI = {
  forest: "#233F39",
  bg: "#ffffff",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
  primary: "#C79257",
};
const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(" ");
const makeThreadId = (a: string, b: string) => [a, b].sort().join("_");
type VerificationStatus = "none" | "pending" | "approved" | "rejected";
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
  isAdmin?: boolean;   // 👈 add this
  // 👇 NEW
  verificationStatus?: VerificationStatus;
  verificationRoleLabel?: string;
};

type MarketType =
  | "product"
  | "lease"
  | "service"
  | "animal"
  | "crop"
  | "equipment"
  | "tree"
  | string;
type CurrencyCode = "KES" | "USD";

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
  currency?: CurrencyCode;   // 👈 NEW
};

type DeedStatus = "ready" | "processing" | "mixing" | "uploading" | "failed" | "deleted";

function nfmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}
const KES = (n: number) =>
  "KSh " +
  (Number.isFinite(n) ? n : 0).toLocaleString("en-KE", {
    maximumFractionDigits: 0,
  });

/* =========================================================
   Upload gate — blocks the whole page while a new deed
   is not READY or FAILED. Detects via ?deedId= or localStorage.
   (Now only mounted for the owner)
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
        try {
          localStorage.setItem("lastUploadedDeedId", qId);
        } catch { }
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
      if (!s.exists()) {
        setDeed(null);
        return;
      }
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
        try {
          localStorage.removeItem("lastUploadedDeedId");
        } catch { }
      }
      // remove ?deedId from the URL (shallow)
      const url = `/${encodeURIComponent(handle.replace(/^@/, ""))}`;
      router.replace(url);
    }
  }, [deedId, isReady, handle, router]);

  // progress (heuristics with optional deed.progress[0..1])
  const rawP =
    typeof (deed as any)?.progress === "number"
      ? (deed as any).progress
      : status === "uploading"
        ? 0.25
        : status === "mixing"
          ? 0.6
          : status === "processing"
            ? 0.8
            : status === "ready"
              ? 1
              : 0;

  async function deleteMuxIfAny(d?: DeedDoc | null) {
    if (!d?.media) return;
    const muxIds = d.media
      .map((m) => (m as any)?.muxAssetId)
      .filter(Boolean) as string[];
    for (const assetId of muxIds) {
      try {
        await fetch(`/api/mux/delete?assetId=${encodeURIComponent(assetId)}`, {
          method: "DELETE",
        });
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
        try {
          localStorage.removeItem("lastUploadedDeedId");
        } catch { }
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
                    style={{
                      width: `${Math.max(5, Math.min(100, Math.round(rawP * 100)))}%`,
                    }}
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

    return () => {
      unsubA();
      unsubB();
    };
  }, [viewerUid, targetUid]);

  return aFollowsB && bFollowsA;
}

/* ---------- hooks ---------- */
function useProfileByUid(uid?: string) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
      const d = snap.exists() ? (snap.data() as any) : null;
      setProfile(
        d
          ? {
            id: snap.id,
            handle: d.handle,
            name: d.name,
            bio: d.bio,
            website: d.website,
            phone: d.phone,
            photoURL: d.photoURL || d.avatarUrl,
            followersCount: Number(d.followersCount ?? 0),
            followingCount: Number(d.followingCount ?? 0),
            likesTotal: Number(d.likesTotal ?? 0),
            isAdmin: !!d.isAdmin,      // 👈 mirror for UI
            // 👇 NEW: pull verification info
            verificationStatus:
              (d.verification?.status as VerificationStatus) ?? "none",
            verificationRoleLabel:
              d.verification?.roleLabel ||
              d.verification?.primaryRole ||
              d.primaryRoleLabel ||
              undefined,
          }
          : null
      );
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
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    const base = isOwner
      ? query(
        collection(db, "deeds"),
        where("authorId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(60)
      )
      : query(
        collection(db, "deeds"),
        where("authorId", "==", uid),
        where("visibility", "==", "public"),
        where("status", "==", "ready"),
        orderBy("createdAt", "desc"),
        limit(60)
      );

    const unsub = onSnapshot(
      base,
      (snap) => {
        const raw = snap.docs.map((d) => toDeed(d.data(), d.id));

        const filtered = isOwner
          ? raw.filter((d) => d.status !== "deleted")
          : raw; // already public+ready from the query

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
    if (!viewerUid || !targetUid || viewerUid === targetUid) {
      setIsFollowing(null);
      return;
    }
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
    else
      await setDoc(ref, {
        followerId: viewerUid,
        followingId: targetUid,
        createdAt: Date.now(),
      });
  };
  return { isFollowing, toggle };
}
function usePartnerStats(ownerUid?: string, viewerUid?: string) {
  const [partners, setPartners] = React.useState(0);
  const [mutualPartners, setMutualPartners] = React.useState(0);

  React.useEffect(() => {
    if (!ownerUid) {
      setPartners(0);
      setMutualPartners(0);
      return;
    }

    const followsRef = collection(db, "follows");

    let ownerFollowingSet = new Set<string>();
    let ownerFollowersSet = new Set<string>();
    let viewerFollowersSet = new Set<string>();

    const recompute = () => {
      // Owner's mutuals (Partners)
      let p = 0;
      ownerFollowingSet.forEach((id) => {
        if (ownerFollowersSet.has(id)) p++;
      });
      setPartners(p);

      // Mutual Partners between VIEWER and OWNER:
      // people who follow viewer AND follow owner
      if (viewerUid && viewerUid !== ownerUid) {
        let m = 0;
        ownerFollowersSet.forEach((id) => {
          if (viewerFollowersSet.has(id)) m++;
        });
        setMutualPartners(m);
      } else {
        setMutualPartners(0);
      }
    };

    const unsubFollowing = onSnapshot(
      query(followsRef, where("followerId", "==", ownerUid)),
      (snap) => {
        ownerFollowingSet = new Set(
          snap.docs.map((d) => (d.data() as any).followingId as string)
        );
        recompute();
      },
      (err) => console.warn("owner following stats error:", err)
    );

    const unsubFollowers = onSnapshot(
      query(followsRef, where("followingId", "==", ownerUid)),
      (snap) => {
        ownerFollowersSet = new Set(
          snap.docs.map((d) => (d.data() as any).followerId as string)
        );
        recompute();
      },
      (err) => console.warn("owner followers stats error:", err)
    );

    let unsubViewerFollowers: (() => void) | undefined;

    if (viewerUid && viewerUid !== ownerUid) {
      unsubViewerFollowers = onSnapshot(
        query(followsRef, where("followingId", "==", viewerUid)),
        (snap) => {
          viewerFollowersSet = new Set(
            snap.docs.map((d) => (d.data() as any).followerId as string)
          );
          recompute();
        },
        (err) => console.warn("viewer followers stats error:", err)
      );
    }

    return () => {
      try {
        unsubFollowing();
        unsubFollowers();
        if (unsubViewerFollowers) unsubViewerFollowers();
      } catch { }
    };
  }, [ownerUid, viewerUid]);

  return { partners, mutualPartners };
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
  partners,
  mutualPartners,
  viewerUid,
  showAdminBadge,
}: {
  profile: Profile;
  isOwner: boolean;
  followState: ReturnType<typeof useFollowingState>;
  likesValue: number;
  tab: TabKey;
  onTabChange: (k: TabKey) => void;
  hasUser: boolean;
  onRequireAuth: () => boolean;
  canSeeContacts: boolean;
  partners: number;
  mutualPartners: number;
  viewerUid?: string | null;
  showAdminBadge?: boolean;
}) {
  const followers = profile?.followersCount ?? 0;
  const following = profile?.followingCount ?? 0;
  const router = useRouter();
  const handleSlug = React.useMemo(
    () => (profile.handle || "").replace(/^@/, ""),
    [profile.handle]
  );
  const verificationStatus: VerificationStatus =
    (profile.verificationStatus as VerificationStatus) || "none";
  const verificationRoleLabel = profile.verificationRoleLabel;

  const openConnections = (tabKey: "following" | "followers" | "partners" | "mutual") => {
    if (!handleSlug) return;
    router.push(`/${encodeURIComponent(handleSlug)}/connections?tab=${tabKey}`);
  };

  // tabs
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
        className={cn(
          "flex items-center gap-1.5 px-1 pb-2 border-b-2 text-sm font-semibold transition",
          active
            ? "border-slate-900 text-slate-900"
            : "border-transparent text-slate-500 hover:text-slate-800"
        )}
      >
        {icon && <span className={active ? "text-slate-900" : "text-slate-500"}>{icon}</span>}
        <span>{label}</span>
      </button>
    );
  }

  // message click
  const handleMessageClick = () => {
    if (!hasUser || !viewerUid) {
      onRequireAuth?.();
      return;
    }
    if (viewerUid === profile.id) return;

    const peerId = profile.id;
    const peerName = profile.name || profile.handle || "";
    const peerPhotoURL = profile.photoURL || "";
    const peerHandle = profile.handle || "";

    const threadId = makeThreadId(viewerUid, peerId);
    const qs = new URLSearchParams();
    qs.set("peerId", peerId);
    if (peerName) qs.set("peerName", peerName);
    if (peerPhotoURL) qs.set("peerPhotoURL", peerPhotoURL);
    if (peerHandle) qs.set("peerHandle", peerHandle);

    router.push(`/messages/${encodeURIComponent(threadId)}?${qs.toString()}`);
  };

  return (
    <header className="px-4 md:px-8 pt-6 pb-4">
      {/* TOP: avatar + name + actions */}
      <div className="flex items-center justify-centereweeeeeeye8uye7hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhyeyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuiiiio]ow3,eeweebg-blacko-0o/wssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssswwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww22333XDX flex-col gap-4 md:flex-row md:items-start md:gap-6">
        {/* avatar */}
        <div className="shrink-0">
          <div className="p-1 rounded-full bg-gradient-to-tr from-[#C79257] to-[#233F39] shadow-sm">
            <div className="p-1 rounded-full bg-white">
              <div
                className="h-26 w-26 relative rounded-full overflow-hidden"
                style={{ height: 104, width: 104 }}
              >
                <SmartAvatar
                  src={profile.photoURL || "/avatar-blank.png"}
                  alt={profile.handle || "avatar"}
                  size={112}
                  rounded="full"
                />
              </div>
            </div>
          </div>




        </div>

        {/* right side */}
        <div className="min-w-0 lg:mt-5 flex-1 space-y-2">
          {/* first row: name + badges + actions */}
          <div className="flex items-center justify-center flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* name + admin badge */}
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="truncate text-xl md:text-2xl font-black"
                style={{ color: EKARI.text }}
              >
                {profile.handle ? profile.handle : "Profile"}
              </h1>

              {/* admin badge */}
              {profile.isAdmin && (
                showAdminBadge ? (
                  // owner viewing own admin profile → dark "Admin" chip linking to dashboard
                  <Link
                    href="/admin/overview"
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-extrabold text-white shadow-sm hover:bg-slate-800"
                  >
                    <IoShieldCheckmarkOutline size={12} />
                    <span>Admin</span>
                  </Link>
                ) : (
                  // public admin chip
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-800">
                    <IoShieldCheckmarkOutline size={12} />
                    <span>ekari Admin</span>
                  </span>
                )
              )}

              {/* verified badge */}
              {verificationStatus === "approved" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-extrabold text-white shadow-sm">
                  <IoShieldCheckmarkOutline size={12} />
                  <span>
                    Verified
                    {verificationRoleLabel ? ` • ${verificationRoleLabel}` : ""}
                  </span>
                </span>
              )}
            </div>
            {/* actions: owner vs visitor */}
            {isOwner ? (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/${handleSlug}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs md:text-sm font-semibold shadow-sm-sm hover:bg-slate-50"
                  style={{ borderColor: EKARI.hair, color: EKARI.text }}
                >
                  <IoPencilOutline size={15} />
                  <span>Edit profile</span>
                </Link>

                <Link
                  href={`/${handleSlug}/earnings`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3.5 py-1.5 text-xs md:text-sm font-semibold shadow-sm hover:shadow-md"
                  style={{ backgroundColor: EKARI.forest, color: EKARI.bg }}
                >
                  💰
                  <span>Earnings</span>
                </Link>
                {/* 👇 NEW: verification CTA for owner */}
                {verificationStatus === "none" || verificationStatus === "rejected" ? (
                  <Link
                    href="/account/verification" // TODO: point to your actual verification flow route
                    className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs md:text-sm font-semibold shadow-sm hover:bg-emerald-50"
                    style={{ borderColor: EKARI.primary, color: EKARI.primary }}
                  >
                    <IoShieldCheckmarkOutline size={15} />
                    <span>
                      {verificationStatus === "rejected"
                        ? "Re-request verification"
                        : "Request verification"}
                    </span>
                  </Link>
                ) : null}

                {verificationStatus === "pending" && (
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-1.5 text-xs md:text-sm font-semibold text-amber-800 border border-amber-200"
                  >
                    <IoTimeOutline size={15} />
                    <span>Verification pending review</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {/* follow */}
                {!hasUser ? (
                  <button
                    onClick={() => onRequireAuth?.()}
                    className="inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs md:text-sm font-semibold text-white shadow-sm hover:shadow-md"
                    style={{ backgroundColor: EKARI.primary }}
                  >
                    Follow
                  </button>
                ) : followState.isFollowing === null ? null : (
                  <button
                    onClick={followState.toggle}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-xs md:text-sm font-semibold transition",
                      followState.isFollowing
                        ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                        : "bg-emerald-700 text-white shadow-sm hover:shadow-md"
                    )}
                  >
                    {followState.isFollowing ? "Following" : "Follow"}
                  </button>
                )}

                {/* message */}
                <button
                  type="button"
                  onClick={handleMessageClick}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs md:text-sm font-semibold hover:bg-slate-50"
                  style={{ borderColor: EKARI.hair, color: EKARI.text }}
                >
                  <IoChatbubblesOutline size={16} />
                  <span>Message</span>
                </button>
              </div>
            )}
          </div>

          {/* stats row */}
          <div className="mt-1 flex flex-wrap items-center gap-5 text-[13px]">
            <button
              type="button"
              onClick={() => openConnections("following")}
              className="inline-flex items-baseline gap-1 hover:opacity-80"
            >
              <Stat label="Following" value={nfmt(following)} />
            </button>
            <button
              type="button"
              onClick={() => openConnections("followers")}
              className="inline-flex items-baseline gap-1 hover:opacity-80"
            >
              <Stat label="Followers" value={nfmt(followers)} />
            </button>
            <button
              type="button"
              onClick={() => openConnections("partners")}
              className="inline-flex items-baseline gap-1 hover:opacity-80"
            >
              <Stat label="Partners" value={nfmt(partners || 0)} />
            </button>
            <button
              type="button"
              onClick={() => openConnections("mutual")}
              className="inline-flex items-baseline gap-1 hover:opacity-80"
            >
              <Stat label="Mutual Partners" value={nfmt(mutualPartners || 0)} />
            </button>
          </div>

          {/* name + bio */}
          {profile.name && (
            <div className="mt-1 text-sm font-semibold" style={{ color: EKARI.text }}>
              {profile.name}
            </div>
          )}
          {profile.bio && (
            <p className="mt-0.5 text-sm leading-5 text-slate-800">
              {profile.bio}
            </p>
          )}

          {/* contacts */}
          {canSeeContacts && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              {profile.phone && (
                <a
                  href={`tel:${profile.phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs md:text-sm font-semibold hover:bg-slate-50"
                  style={{ borderColor: EKARI.hair, color: EKARI.text }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="opacity-80"
                    aria-hidden
                  >
                    <path
                      fill="currentColor"
                      d="M6.6 10.8c1.2 2.3 3.1 4.2 5.4 5.4l1.8-1.8c.3-.3.7-.4 1.1-.3c1.2.4 2.6.6 4 .6c.6 0 1 .4 1 .9V21c0 .6-.4 1-1 1C10.4 22 2 13.6 2 3c0-.6.4-1 1-1h4.5c.5 0 .9.4.9 1c0 1.4.2 2.8.6 4c.1.4 0 .8-.3 1.1L6.6 10.8z"
                    />
                  </svg>
                  <span>{profile.phone}</span>
                </a>
              )}

              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs md:text-sm font-semibold hover:bg-slate-50"
                  style={{ borderColor: EKARI.hair, color: EKARI.primary }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    className="opacity-80"
                    aria-hidden
                  >
                    <path
                      fill="currentColor"
                      d="M14 3h7v7h-2V6.4l-8.3 8.3l-1.4-1.4L17.6 5H14V3ZM5 5h6v2H7v10h10v-4h2v6H5V5Z"
                    />
                  </svg>
                  <span>{profile.website.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="mt-6 border-t" style={{ borderColor: EKARI.hair }}>
        <nav className="flex flex-wrap gap-6 px-1 pt-3 text-sm font-bold">
          <TabBtn k="deeds" label="Deeds" icon={<IoFilmOutline size={16} />} />
          <TabBtn k="listings" label="Listings" icon={<IoListOutline size={16} />} />
          <TabBtn k="events" label="Events" icon={<IoCalendarOutline size={16} />} />
          <TabBtn
            k="discussions"
            label="Discussions"
            icon={<IoChatbubblesOutline size={16} />}
          />
        </nav>
      </div>
    </header>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-extrabold mr-1" style={{ color: EKARI.text }}>
        {value}
      </span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}

/* ---------- grids ---------- */
function VideosGrid({
  items,
  handle,
  isOwner,
}: {
  items: DeedDoc[];
  handle: string;
  isOwner: boolean;
}) {
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

function VideoTile({
  deed,
  handle,
  isOwner,
}: {
  deed: DeedDoc;
  handle: string;
  isOwner: boolean;
}) {
  const poster =
    deed.media?.find((m) => m.thumbUrl)?.thumbUrl ||
    deed.mediaThumbUrl ||
    deed.media?.[0]?.thumbUrl ||
    "/video-placeholder.jpg";

  const views = nfmt(deed.stats?.views ?? 0);
  const [imgLoading, setImgLoading] = React.useState(true);
  const ready = (deed.status as DeedStatus) === "ready";
  const href = `/${encodeURIComponent(handle)}/deed/${deed.id}`;

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
            style={{
              borderColor: "#D1D5DB",
              borderTopColor: EKARI.forest,
            }}
            aria-hidden
          />
        </div>
      )}

      <Image
        src={poster}
        alt={deed.caption || "video"}
        fill
        className={`h-full w-full object-cover transition-transform ${imgLoading ? "opacity-0" : "group-hover:scale-[1.02] opacity-100"
          }`}
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

/* ---------- Listings: show to everyone, owner controls only ---------- */
function OwnerListingsGrid({ uid, isOwner }: { uid: string; isOwner: boolean }) {
  const router = useRouter();
  const [items, setItems] = React.useState<Product[]>([]);
  const [paging, setPaging] = React.useState(false);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const lastDocRef = React.useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  React.useEffect(() => {
    if (!uid) return;

    const base = isOwner
      ? query(
        collection(db, "marketListings"),
        where("sellerId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(24)
      )
      : query(
        collection(db, "marketListings"),
        where("sellerId", "==", uid),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(24)
      );

    const unsub = onSnapshot(
      base,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        setTotal(snap.size);
        setLoading(false);
      },
      (err) => console.warn("Listings listener error:", err)
    );
    return () => unsub();
  }, [uid, isOwner]);

  const loadMore = async () => {
    if (paging || !lastDocRef.current) return;
    setPaging(true);
    try {
      const base = isOwner
        ? query(
          collection(db, "marketListings"),
          where("sellerId", "==", uid),
          orderBy("createdAt", "desc"),
          startAfter(lastDocRef.current),
          limit(24)
        )
        : query(
          collection(db, "marketListings"),
          where("sellerId", "==", uid),
          where("status", "==", "active"),
          orderBy("createdAt", "desc"),
          startAfter(lastDocRef.current),
          limit(24)
        );

      const snap = await getDocs(base);
      if (!snap.empty) {
        setItems((prev) => [
          ...prev,
          ...snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })),
        ]);
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
    if (!isOwner) return; // guests can't change status
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

  const formatMoney = (n: number, currency: CurrencyCode = "KES") => {
    const safe = Number.isFinite(n) ? n : 0;

    try {
      return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(safe);
    } catch {
      // Fallback if currency/Intl fails
      const prefix = currency === "USD" ? "$" : "KSh ";
      return prefix + safe.toLocaleString("en-KE", { maximumFractionDigits: 0 });
    }
  };
  async function deleteFolderRecursively(folderRef: ReturnType<typeof sRef>) {
    const { items, prefixes } = await listAll(folderRef);
    await Promise.all(
      items.map(async (it) => {
        try {
          await deleteObject(it);
        } catch (e) {
          console.warn("Could not delete file:", it.fullPath, e);
        }
      })
    );
    await Promise.all(prefixes.map((p) => deleteFolderRecursively(p)));
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
    if (!isOwner) return; // safety
    const ok = window.confirm(
      "Delete this listing? This will also remove its images."
    );
    if (!ok) return;

    const storage = getStorage();
    const parentPath = `marketListings/${p.id}`;
    const imagesFolder = sRef(storage, `products/${p.sellerId}/${p.id}/images`);

    try {
      try {
        await deleteFolderRecursively(imagesFolder);
      } catch (e) {
        console.warn("Images cleanup issue:", e);
      }
      await deleteSubcollection(parentPath, "reviews");
      await deleteDoc(doc(db, parentPath));
      alert("Listing deleted.");
    } catch (e: any) {
      alert(`Failed to delete: ${e?.message || "Unknown error"}`);
    }
  };

  const statusColor = (p: Product) =>
    p.status === "sold"
      ? "bg-red-600"
      : p.status === "reserved"
        ? "bg-yellow-500"
        : p.status === "hidden"
          ? "bg-gray-500"
          : "bg-emerald-600";

  if (loading)
    return (
      <div className="px-3 md:px-6 pb-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 md:h-56 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );

  if (items.length === 0)
    return (
      <div className="py-16 text-center text-sm text-gray-400">
        No listings yet.
      </div>
    );

  return (
    <div className="px-3 md:px-6 pb-12">
      <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-700">
        <IoCubeOutline className="text-emerald-700" />
        <span>
          {total} listing{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((p) => {
          const cover = p.imageUrl || p.imageUrls?.[0];
          const numericRate = Number(String(p.rate ?? "").replace(/[^\d.]/g, ""));
          const currency: CurrencyCode = p.currency || "KES"; // default to KES
          const priceText =
            p.type === "lease" || p.type === "service"
              ? `${Number.isFinite(numericRate) && numericRate > 0
                ? formatMoney(numericRate, currency)
                : "—"
              }${p.billingUnit ? ` / ${p.billingUnit}` : ""}`
              : formatMoney(Number(p.price || 0), currency);



          const statusLabel = (p.status || (p.sold ? "sold" : "active")).replace(
            /^\w/,
            (c) => c.toUpperCase()
          );

          return (
            <div
              key={p.id}
              className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition"
            >
              <div
                onClick={() => router.push(`/market/${p.id}`)}
                className="relative block aspect-[4/3] bg-gray-100 cursor-pointer"
              >
                <SmartImage
                  src={cover || ""}
                  alt={p.name || "Listing"}
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 33vw"
                  fallbackSrc=""
                  emptyFallback={
                    <div className="absolute inset-0 grid place-items-center text-gray-400 text-sm bg-gray-50">
                      No image
                    </div>
                  }
                />
                <div
                  className={`absolute left-2 top-2 ${statusColor(
                    p
                  )} text-white text-[11px] font-black h-6 px-2 rounded-full flex items-center gap-1`}
                >
                  <IoCheckmarkDone size={12} />
                  {statusLabel}
                </div>
              </div>

              <div className="p-3">
                <div className="text-[13px] font-extrabold text-gray-900 line-clamp-2">
                  {p.name || "Untitled"}
                </div>
                <div className="text-emerald-700 font-black">{priceText}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!!p.category && (
                    <span className="inline-flex items-center gap-1 border border-gray-200 rounded-full px-2.5 py-1 text-[12px] font-bold">
                      <IoPricetagOutline className="text-emerald-700" size={14} />
                      {p.category}
                    </span>
                  )}
                </div>

                {/* Owner-only control buttons */}
                {isOwner && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.status !== "active" && (
                      <button
                        onClick={() => updateStatus(p, "active")}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-700 text-white text-xs font-bold hover:opacity-90"
                      >
                        <IoCheckmarkDone /> Activate
                      </button>
                    )}
                    {p.status !== "sold" && (
                      <button
                        onClick={() => updateStatus(p, "sold")}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-600 text-white text-xs font-bold hover:opacity-90"
                      >
                        <IoCashOutline /> Sold
                      </button>
                    )}
                    {p.status !== "reserved" && (
                      <button
                        onClick={() => updateStatus(p, "reserved")}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500 text-white text-xs font-bold hover:opacity-90"
                      >
                        <IoTimeOutline /> Reserve
                      </button>
                    )}
                    {p.status !== "hidden" && (
                      <button
                        onClick={() => updateStatus(p, "hidden")}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-600 text-white text-xs font-bold hover:opacity-90"
                      >
                        <IoEyeOffOutline /> Hide
                      </button>
                    )}
                    <button
                      onClick={() => removeListing(p)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-600 text-white text-xs font-bold hover:opacity-90"
                    >
                      <IoTrashOutline /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid place-items-center">
        {lastDocRef.current ? (
          <button
            onClick={loadMore}
            disabled={paging}
            className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-black hover:opacity-90 disabled:opacity-60"
          >
            {paging ? <BouncingBallLoader /> : "Load more"}
          </button>
        ) : (
          <div className="text-gray-400 text-sm mt-4">End of results</div>
        )}
      </div>
    </div>
  );
}

/* ---------- Events (owner vs guests) ---------- */
type EventDoc = {
  id: string;
  title?: string;
  dateISO?: string;
  organizerId?: string;
  location?: string;
  status?: string; // optional
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

function ProfileEvents({ uid, isOwner }: { uid: string; isOwner: boolean }) {
  const router = useRouter();
  const [events, setEvents] = React.useState<EventDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!uid) return;
    const qRef = query(
      collection(db, "events"),
      where("organizerId", "==", uid),
      orderBy("dateISO", "desc")
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const raw = snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as DocumentData) } as EventDoc)
        );
        // Owner: see all; Guest: only active/visible events
        const filtered = isOwner
          ? raw
          : raw.filter((e) => (e.status ?? "active") === "active");
        setEvents(filtered);
        setLoading(false);
      },
      (err) => {
        console.warn("ProfileEvents listener error:", err?.message || err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, isOwner]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  async function deleteFolderRecursively(folderRef: ReturnType<typeof sRef>) {
    const { items, prefixes } = await listAll(folderRef);
    await Promise.all(
      items.map(async (it) => {
        try {
          await deleteObject(it);
        } catch (e) {
          console.warn("Could not delete file:", it.fullPath, e);
        }
      })
    );
    await Promise.all(prefixes.map((p) => deleteFolderRecursively(p)));
  }

  const removeEvent = async (e: EventDoc) => {
    if (!isOwner) return; // extra safety
    const ok = window.confirm(
      "Delete this event? This will also remove its images."
    );
    if (!ok) return;

    const storage = getStorage();
    const organizer = e.organizerId || uid;
    const folderRef = sRef(storage, `events/${organizer}/${e.id}`);
    const parentPath = `events/${e.id}`;

    try {
      try {
        await deleteFolderRecursively(folderRef);
      } catch (err) {
        console.warn("Event images cleanup issue (continuing):", err);
      }
      await deleteDoc(doc(db, parentPath));
      setEvents((prev) => prev.filter((x) => x.id !== e.id));
      alert("Event deleted.");
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || "Unknown error"}`);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <BouncingBallLoader />
      </div>
    );
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
        <span>
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto text-xs font-bold text-emerald-700 hover:underline disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Reload"}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {events.map((e) => {
          const likes = e?.stats?.likes ?? 0;
          const rsvps = e?.stats?.rsvps ?? 0;

          return (
            <div
              key={e.id}
              className="border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition p-4 flex flex-col gap-2"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => router.push(`/events/${e.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-700 shrink-0">
                      <IoTimeOutline size={18} color="#fff" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-extrabold text-gray-900 truncate">
                        {e.title || "Untitled event"}
                      </div>
                      <div className="text-[13px] text-gray-500 flex flex-wrap items-center gap-1">
                        <span>{fmtDate(e.dateISO)}</span>
                        {e.location && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <IoLocationOutline size={12} />
                              {e.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {isOwner && (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      removeEvent(e);
                    }}
                    className="h-9 w-9 grid place-items-center rounded-lg bg-rose-50 border border-rose-200"
                    aria-label="Delete event"
                    title="Delete"
                  >
                    <IoTrashOutline className="text-rose-600" size={18} />
                  </button>
                )}
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

/* ---------- Discussions (owner vs guests) ---------- */
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

function ProfileDiscussions({ uid, isOwner }: { uid: string; isOwner: boolean }) {
  const router = useRouter();
  const [items, setItems] = React.useState<DiscussionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!uid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const qRef = query(
      collection(db, "discussions"),
      where("authorId", "==", uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      qRef,
      // you can drop includeMetadataChanges unless you *really* need it
      (snap) => {
        const rows = snap.docs.map(
          (d) =>
          ({
            id: d.id,
            ...(d.data() as DocumentData),
            _pending: d.metadata.hasPendingWrites,
          } as DiscussionRow)
        );

        const filtered = isOwner ? rows : rows.filter((r) => r.published ?? true);
        setItems(filtered);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.warn("ProfileDiscussions listener error:", err?.message || err);
        setItems([]);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsub();
    // reattach whenever uid or reloadToken changes
  }, [uid, isOwner, reloadToken]);

  const handleRefresh = () => {
    setRefreshing(true);
    // bump token to re-run the effect & re-create listener cleanly
    setReloadToken((x) => x + 1);
  };

  const togglePublish = async (row: DiscussionRow) => {
    if (!isOwner) return;
    const current = row.published ?? true;
    const next = !current;
    setItems((prev) =>
      prev.map((i) =>
        i.id === row.id ? { ...i, published: next, _pending: true } : i
      )
    );
    try {
      setBusyId(row.id);
      await updateDoc(doc(db, "discussions", row.id), { published: next });
    } catch (e: any) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === row.id ? { ...i, published: current, _pending: false } : i
        )
      );
      alert(e?.message || "Failed to update discussion.");
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async (row: DiscussionRow) => {
    if (!isOwner) return;
    const ok = window.confirm("Delete this discussion? This cannot be undone.");
    if (!ok) return;
    try {
      setBusyId(row.id);
      await deleteDoc(doc(db, "discussions", row.id));
    } catch (e: any) {
      alert(e?.message || "Delete failed. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <BouncingBallLoader />
      </div>
    );

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
        <div className="text-sm font-semibold text-gray-700">
          {items.length} discussion{items.length === 1 ? "" : "s"}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="ml-auto text-xs font-bold text-emerald-700 hover:underline disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Reload"}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => {
          const isPublished = item.published ?? true;
          const statusTxt = isPublished ? "Published" : "Unpublished";
          const statusCls = isPublished
            ? "bg-emerald-50 text-emerald-800"
            : "bg-gray-100 text-gray-700";

          return (
            <div
              key={item.id}
              className="border border-gray-200 rounded-xl bg-white shadow-sm p-4"
            >
              <button
                onClick={() => router.push(`/discussions/${item.id}`)}
                className="block w-full text-left"
              >
                <div className="font-extrabold text-gray-900 text-[15px] leading-5 line-clamp-2">
                  {item.title || "Untitled discussion"}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px]">
                  {!!item.createdAt && (
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <IoTimeOutline size={14} />
                      {dateText(item.createdAt)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-gray-500">
                    <IoChatbubbleEllipsesOutline size={14} />
                    {(item.repliesCount ?? 0).toString()} answers
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${statusCls}`}
                  >
                    {statusTxt}
                  </span>
                  {item._pending && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800">
                      Syncing…
                    </span>
                  )}
                </div>
              </button>

              {isOwner && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => togglePublish(item)}
                    disabled={busyId === item.id}
                    className={`h-9 px-3 rounded-full text-white text-xs font-extrabold transition
                      ${isPublished ? "bg-amber-600" : "bg-emerald-700"} hover:opacity-90 disabled:opacity-60`}
                  >
                    {busyId === item.id
                      ? "Working…"
                      : isPublished
                        ? "Unpublish"
                        : "Publish"}
                  </button>

                  <button
                    onClick={() => confirmDelete(item)}
                    disabled={busyId === item.id}
                    className="h-9 w-10 grid place-items-center rounded-lg bg-rose-50 border border-rose-200 disabled:opacity-60"
                  >
                    {busyId === item.id ? (
                      <span className="text-rose-600 text-xs font-bold">…</span>
                    ) : (
                      <IoTrashOutline className="text-rose-600" size={18} />
                    )}
                  </button>
                </div>
              )}
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
  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();
  const handleWithAt = decoded.startsWith("@") ? decoded : `@${decoded}`;

  const [uid, setUid] = React.useState<string | null | undefined>(undefined);
  const [tab, setTab] = React.useState<TabKey>("deeds");
  const [viewerIsAdmin, setViewerIsAdmin] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;

    async function checkAdminClaim() {
      if (!user) {
        if (!cancelled) setViewerIsAdmin(false);
        return;
      }
      try {
        const tokenResult = await user.getIdTokenResult();
        const isAdmin = !!(tokenResult.claims as any)?.admin;
        if (!cancelled) setViewerIsAdmin(isAdmin);
      } catch (err) {
        console.warn("Failed to read admin claim:", err);
        if (!cancelled) setViewerIsAdmin(false);
      }
    }

    checkAdminClaim();
    return () => {
      cancelled = true;
    };
  }, [user]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!handleWithAt) {
        setUid(null);
        return;
      }
      const res = await resolveUidByHandle(handleWithAt);
      if (!active) return;
      setUid(res?.uid ?? null);
    })();
    return () => {
      active = false;
    };
  }, [handleWithAt]);

  const isOwner = !!user?.uid && !!uid && user.uid === uid;
  const { profile, loading: loadingProfile } = useProfileByUid(uid ?? undefined);
  const { items, likesFallback, loading: loadingDeeds } = useDeedsByAuthor(
    uid ?? undefined,
    isOwner
  );
  const followState = useFollowingState(user?.uid, uid ?? undefined);

  const likesValue = profile?.likesTotal ?? likesFallback;

  const mutual = useMutualFollow(user?.uid, uid ?? undefined);
  const canSeeContacts = isOwner || (!!user && mutual);
  const { partners, mutualPartners } = usePartnerStats(uid ?? undefined, user?.uid);

  const requireAuth = React.useCallback(() => {
    if (user) return true;
    try {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      router.push(`/login?next=${encodeURIComponent(next)}`);
    } catch {
      router.push("/login");
    }
    return false;
  }, [user, router]);

  return (
    <AppShell>
      {/* Processing Gate now ONLY blocks for profile owner */}
      {isOwner && <DeedProcessingGate authorUid={uid ?? null} handle={handleWithAt} />}

      <div className="min-h-screen mx-auto w-full max-w-[1160px] px-4 md:px-8">
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
            canSeeContacts={canSeeContacts}
            partners={partners}
            mutualPartners={mutualPartners}
            viewerUid={user?.uid || null}   // 👈 pass viewer uid
            showAdminBadge={viewerIsAdmin && isOwner}
          />
        ) : (
          <div
            className="flex p-6 items-center justify-center h-screen w-full text-sm"
            style={{ color: EKARI.subtext }}
          >
            {uid === undefined ? <BouncingBallLoader /> : "Profile not found."}
          </div>
        )}

        {/* tab content */}
        {tab === "deeds" &&
          (loadingDeeds ? (
            <div className="px-3 md:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 md:h-56 rounded-xl bg-gray-100 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <VideosGrid items={items} handle={handleWithAt} isOwner={isOwner} />
          ))}

        {tab === "listings" && uid && (
          <OwnerListingsGrid uid={uid} isOwner={isOwner} />
        )}

        {tab === "events" && uid && (
          <ProfileEvents uid={uid} isOwner={isOwner} />
        )}

        {tab === "discussions" && uid && (
          <ProfileDiscussions uid={uid} isOwner={isOwner} />
        )}
      </div>
    </AppShell>
  );
}
