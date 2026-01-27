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
import { app, db } from "@/lib/firebase";
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
  IoStarOutline,
  IoGridOutline,
  IoStorefrontOutline,
  IoShareSocialOutline,
  IoAnalyticsOutline,
} from "react-icons/io5";
import { DeedDoc, toDeed, resolveUidByHandle } from "@/lib/fire-queries";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import DotsLoader from "../components/DotsLoader";
import { SmartImage } from "../components/SmartImage";
import SmartAvatar from "../components/SmartAvatar";
import { deleteObject, getStorage, listAll, ref as sRef } from "firebase/storage";
import SellerReviewsSection from "../components/SellerReviewsSection";
import { ConfirmModal } from "../components/ConfirmModal";
import { getFunctions, httpsCallable } from "firebase/functions";
import OpenInAppBanner from "../components/OpenInAppBanner";

const EKARI = {
  forest: "#233F39",
  bg: "#ffffff",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
  primary: "#C79257",
};
/* ---------- helpers (add near your other helpers) ---------- */
function cleanPhone(p?: string | null) {
  return (p || "").replace(/\s+/g, "").trim();
}
function toWebsiteLink(raw?: string | null) {
  const s = (raw || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function StatPill({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black",
        onClick && "hover:bg-black/[0.02] cursor-pointer"
      )}
      style={{ borderColor: EKARI.hair, color: EKARI.text, background: "white" }}
      title={label}
      type={onClick ? "button" : undefined}
    >
      {icon}
      <span>{value}</span>
      <span className="font-semibold" style={{ color: EKARI.subtext }}>
        {label}
      </span>
    </Comp>
  );
}
// ===============================
// Storefront-style Profile Hero UI
// ===============================

import {
  IoCallOutline,
  IoGlobeOutline,
  IoLogoWhatsapp,
  IoSwapVerticalOutline,
  IoFunnelOutline,
  IoRocketOutline,
  IoSparklesOutline,
} from "react-icons/io5";

function toWhatsAppLink(raw?: string | null) {
  const phone = cleanPhone(raw);
  if (!phone) return null;

  let normalized = phone.replace(/^\+/, "");
  if (normalized.startsWith("0")) normalized = "254" + normalized.slice(1);
  if (!/^\d{10,15}$/.test(normalized)) return null;
  return `https://wa.me/${normalized}`;
}

function IconBtn({
  href,
  onClick,
  icon,
  label,
  target,
}: {
  href?: string | null;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  target?: string;
}) {
  const cls =
    "h-11 w-11 rounded-2xl border grid place-items-center transition hover:bg-black/[0.02]";
  const st = { borderColor: EKARI.hair, background: "white", color: EKARI.text };

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={target ? "noopener noreferrer" : undefined}
        className={cls}
        style={st}
        aria-label={label}
        title={label}
      >
        {icon}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      style={st}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}

function SegmentedTabs({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const Tab = ({
    k,
    label,
    icon,
  }: {
    k: TabKey;
    label: string;
    icon: React.ReactNode;
  }) => {
    const active = value === k;
    return (
      <button
        type="button"
        onClick={() => onChange(k)}
        className={cn(
          "relative flex-1 h-10 rounded-2xl text-xs font-black transition",
          active ? "text-white" : "text-slate-900 hover:bg-black/[0.03]"
        )}
        style={{ backgroundColor: active ? EKARI.forest : "transparent" }}
      >
        <span className="inline-flex items-center gap-2 justify-center w-full">
          <span className="inline-flex items-center gap-1.5">
            {icon}
            {label}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div
      className="w-full rounded-[22px] border bg-white p-1 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
      style={{ borderColor: EKARI.hair }}
    >
      <div className="flex gap-1">
        <Tab k="deeds" label="Deeds" icon={<IoFilmOutline size={14} />} />
        <Tab k="events" label="Events" icon={<IoCalendarOutline size={14} />} />
        <Tab k="discussions" label="Discussions" icon={<IoChatbubblesOutline size={14} />} />
        <Tab k="reviews" label="Reviews" icon={<IoStarOutline size={14} />} />
      </div>
    </div>
  );
}

function SectionHeader({
  tab,
  rightSlot,
  subtitle,
}: {
  tab: TabKey;
  rightSlot?: React.ReactNode;
  subtitle?: string;
}) {
  const tabLabel =
    tab === "deeds"
      ? "Deeds"
      : tab === "events"
        ? "Events"
        : tab === "discussions"
          ? "Discussions"
          : "Reviews";

  return (
    <div className="px-3 md:px-6 mb-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-black" style={{ color: EKARI.text }}>
              {tabLabel}
            </h2>
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black"
              style={{ background: "rgba(35,63,57,0.08)", color: EKARI.forest }}
            >
              <IoFunnelOutline size={13} />
              {tabLabel}
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: EKARI.subtext }}>
            {subtitle ||
              (tab === "deeds"
                ? "Videos and moments from this profile."
                : tab === "events"
                  ? "Upcoming and past events."
                  : tab === "discussions"
                    ? "Questions and conversations."
                    : "Ratings and feedback.")}
          </p>
        </div>

        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </div>
  );
}

function ProfileHeroStorefront({
  profile,
  loading,
  isOwner,
  followState,
  hasUser,
  onRequireAuth,
  canSeeContacts,
  partners,
  mutualPartners,
  likesValue,
  onMessage,
  onShare,
  reviewsSummary,
  showAdminBadge,
}: {
  profile: Profile;
  loading: boolean;
  isOwner: boolean;
  followState: ReturnType<typeof useFollowingState>;
  hasUser: boolean;
  onRequireAuth: () => boolean;
  canSeeContacts: boolean;
  partners: number;
  mutualPartners: number;
  likesValue: number;
  onMessage: () => void;
  onShare: () => void;
  reviewsSummary?: { rating: number; count: number };
  showAdminBadge?: boolean;
}) {
  const verificationStatus: VerificationStatus =
    (profile.verificationStatus as VerificationStatus) || "none";
  const verificationType: VerificationType =
    (profile.verificationType as VerificationType) || "individual";

  const showVerified = verificationStatus === "approved";
  const isPremium = !!profile.storefrontEnabled;

  const phone = cleanPhone(profile.phone || null);
  const website = toWebsiteLink(profile.website || null);
  const whatsapp = toWhatsAppLink(profile?.phone || profile.phone || null);
  const handleSlug = React.useMemo(
    () => (profile.handle || "").replace(/^@/, ""),
    [profile.handle]
  );
  const heroBg =
    "radial-gradient(900px circle at 10% 10%, rgba(199,146,87,0.90), transparent 45%), linear-gradient(135deg, rgba(35,63,57,0.80), rgba(35,63,57,1))";
  const verificationOrgName = profile.verificationOrganizationName;

  const reviewsText =
    reviewsSummary && reviewsSummary.count > 0
      ? `${reviewsSummary.rating.toFixed(1)} (${reviewsSummary.count})`
      : "—";

  return (
    <section className="mb-4">
      <div className="max-w-5xl mx-auto px-0 lg:px-4">
        <div
          className="relative overflow-hidden rounded-[0px] lg:rounded-[28px] border bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
          style={{ borderColor: EKARI.hair }}
        >
          {/* Cover */}
          <div className="relative h-[190px] md:h-[210px]" style={{ background: heroBg }}>
            <div className="absolute inset-0 bg-black/0" />

            <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
              {showVerified && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.18)",
                    color: "white",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <IoShieldCheckmarkOutline size={14} /> Verified
                </span>
              )}

              {isPremium && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black"
                  style={{
                    background: "rgba(199,146,87,0.22)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.25)",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <IoSparklesOutline size={14} /> Premium
                </span>
              )}

              {profile.isAdmin && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black border"
                  style={{
                    borderColor: "rgba(255,255,255,0.35)",
                    background: "rgba(255,255,255,0.18)",
                    color: "white",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <IoShieldCheckmarkOutline size={14} /> Admin
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="relative px-4 pb-4 md:px-6 md:pb-6">
            <div className="-mt-8 md:-mt-12 flex flex-col sm:flex-row sm:items-end gap-3 md:gap-4">
              <div
                className="relative h-24 w-24 rounded-3xl overflow-hidden border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)]"
                style={{ borderColor: EKARI.hair }}
              >
                <SmartAvatar
                  src={profile.photoURL || "/avatar-placeholder.png"}
                  alt={profile.handle || "avatar"}
                  size={96}
                //rounded="full"
                />

              </div>

              <div className="min-w-0 pt-1 flex-1 pb-1">
                <h1 className="text-[12px] md:text-xs font-bold" style={{ color: EKARI.text }}>
                  {loading ? "Loading…" : profile.name || profile.handle || "Profile"}
                </h1>

                <div className="flex flex-block items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-bold" style={{ color: EKARI.subtext }}>
                    {profile.handle || "@user"}
                  </span>


                </div>
              </div>

              {/* Desktop actions */}
              <div className="hidden md:flex items-center gap-2  pb-1">
                {isOwner ? (
                  <Link
                    href={`/${(profile.handle || "@user").replace(/^@/, "")}/edit`}
                    className="h-9 px-5 rounded-2xl font-black text-sm border hover:bg-black/[0.02] inline-flex items-center gap-2"
                    style={{ borderColor: EKARI.hair, background: "white", color: EKARI.text }}
                  >
                    <IoPencilOutline size={16} />
                    Edit
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => (hasUser ? followState.toggle() : onRequireAuth())}
                    className={cn(
                      "h-9 px-5 rounded-2xl font-black text-sm transition",
                      followState.isFollowing ? "border bg-white hover:bg-black/[0.02]" : "text-white"
                    )}
                    style={
                      followState.isFollowing
                        ? { borderColor: EKARI.hair, color: EKARI.text }
                        : { backgroundColor: EKARI.primary, color: "white" }
                    }
                    disabled={followState.isFollowing === null}
                    title={followState.isFollowing ? "Unfollow" : "Follow"}
                  >
                    {followState.isFollowing ? "Following" : "Follow"}
                  </button>
                )}

                <button
                  onClick={onMessage}
                  className="h-9 px-5 rounded-2xl font-black text-sm text-white inline-flex items-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: EKARI.forest }}
                  disabled={isOwner}
                  type="button"
                >
                  <IoChatbubbleEllipsesOutline size={18} />
                  Message
                </button>
                {/* visit store */}
                {profile.storefrontEnabled && (
                  <Link
                    href={`/store/${profile.id}?src=profile`}
                    className="h-9 px-4 rounded-xl font-black text-white inline-flex items-center gap-2"
                    style={{ backgroundColor: EKARI.primary }}
                  >
                    <IoStorefrontOutline size={16} />
                    Store
                  </Link>
                )}
                <IconBtn onClick={onShare} icon={<IoShareSocialOutline size={16} />} label="Share" />
              </div>
            </div>
            <div className="mt-3">
              {profile.bio ? (
                <div
                  className="relative flex flex-col rounded-xl border p-3 shadow"
                  style={{ borderColor: EKARI.hair }}
                >
                  {/* light-hand vertical gradient border (3px) */}
                  <div
                    className="pointer-events-none absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
                    style={{
                      background: `linear-gradient(180deg, ${EKARI.forest} 0%, ${EKARI.primary} 100%)`,
                      opacity: 0.85,
                    }}
                  />

                  <span className="text-xs pl-2" style={{ color: EKARI.subtext }}>
                    • {profile.bio}
                  </span>
                </div>
              ) : null}
            </div>

            {/* stats row */}
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div className="flex flex-wrap gap-2">
                <StatPill icon={<IoPeopleOutline size={13} />} label="Followers" value={nfmt(Number(profile.followersCount || 0))} />
                <StatPill icon={<IoListOutline size={13} />} label="Following" value={nfmt(Number(profile.followingCount || 0))} />
                <StatPill icon={<IoChatbubbleEllipsesOutline size={13} />} label="Partners" value={nfmt(partners || 0)} />
                <StatPill icon={<IoChatbubblesOutline size={13} />} label="Mutual" value={nfmt(mutualPartners || 0)} />
                <StatPill icon={<IoHeartOutline size={13} />} label="Likes" value={nfmt(Number(likesValue || 0))} />
                <StatPill icon={<IoStarOutline size={13} />} label="Rating" value={reviewsText} />
              </div>

              {/* contacts */}
              <div className="flex items-center gap-2">
                {canSeeContacts && phone && (
                  <IconBtn href={`tel:${phone}`} icon={<IoCallOutline size={18} />} label="Call" />
                )}
                {canSeeContacts && whatsapp && (
                  <IconBtn href={whatsapp} icon={<IoLogoWhatsapp size={18} />} label="WhatsApp" target="_blank" />
                )}
                {canSeeContacts && website && (
                  <IconBtn href={website} icon={<IoGlobeOutline size={18} />} label="Website" target="_blank" />
                )}
              </div>
            </div>

            {/* Mobile action bar */}
            <div className="mt-4 md:hidden">
              <div
                className="rounded-3xl border p-3 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                style={{ borderColor: EKARI.hair }}
              >
                <div className="grid grid-cols-4 gap-2">
                  {isOwner ? (
                    <Link
                      href={`/${(profile.handle || "@user").replace(/^@/, "")}/edit`}
                      className="col-span-2 h-11 rounded-2xl font-black border text-sm inline-flex items-center justify-center gap-2"
                      style={{ borderColor: EKARI.hair, background: "white", color: EKARI.text }}
                    >
                      <IoPencilOutline size={16} />
                      Edit
                    </Link>
                  ) : (
                    <button
                      onClick={() => (hasUser ? followState.toggle() : onRequireAuth())}
                      className={cn(
                        "col-span-2 h-11 rounded-2xl font-black text-sm transition",
                        followState.isFollowing ? "border bg-white hover:bg-black/[0.02]" : "text-white"
                      )}
                      style={
                        followState.isFollowing
                          ? { borderColor: EKARI.hair, color: EKARI.text }
                          : { backgroundColor: EKARI.primary, color: "white" }
                      }
                      disabled={followState.isFollowing === null}
                      type="button"
                    >
                      {followState.isFollowing ? "Following" : "Follow"}
                    </button>
                  )}

                  <button
                    onClick={onShare}
                    className="h-11 rounded-2xl border grid place-items-center hover:bg-black/[0.02]"
                    style={{ borderColor: EKARI.hair, background: "white", color: EKARI.text }}
                    aria-label="Share"
                    title="Share"
                    type="button"
                  >
                    <IoShareSocialOutline size={18} />
                  </button>

                  <button
                    onClick={onMessage}
                    className="h-11 rounded-2xl font-black text-sm text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
                    style={{ backgroundColor: EKARI.forest }}
                    disabled={isOwner}
                    type="button"
                  >
                    <IoChatbubbleEllipsesOutline size={18} />
                  </button>

                </div>
              </div>
            </div>

            {/* tiny footer */}
            <div className="mt-4 flex items-center justify-between text-[11px]" style={{ color: EKARI.subtext }}>
              <span>
                Powered by <span className="font-black" style={{ color: EKARI.text }}>ekarihub</span>
              </span>
              {isOwner && (<>
                <Link
                  href={`/${handleSlug}/earnings`}
                  className="h-10 px-4 rounded-xl font-black inline-flex items-center gap-1 border hover:bg-black/[0.02]"
                  style={{ color: EKARI.text }}
                >
                  💰 Earnings
                </Link>
                <Link href="/seller/dashboard?tab=packages" className="h-10 px-4 rounded-xl font-black inline-flex items-center gap-1 border hover:bg-black/[0.02]" style={{ color: EKARI.text }}>
                  <IoGridOutline size={16} /> Seller dashboard
                </Link>


              </>)}
              {showAdminBadge && isOwner && (
                <Link href="/admin/overview" className="h-10 px-4 rounded-xl font-black inline-flex items-center gap-1 border hover:bg-black/[0.02]" style={{ color: EKARI.text }}>
                  <IoAnalyticsOutline size={16} />
                  Admin dashboard
                </Link>
              )}

              {(verificationStatus === "none" || verificationStatus === "rejected") && isOwner && (
                <Link
                  href="/account/verification"
                  className="h-10 px-4 rounded-xl font-black inline-flex items-center gap-2 border hover:bg-black/[0.02]"
                  style={{ borderColor: `${EKARI.primary}55`, color: EKARI.primary, background: "white" }}
                >
                  <IoShieldCheckmarkOutline size={16} />
                  {verificationStatus === "rejected" ? "Re-request" : "Verify"}
                </Link>
              )}

              {verificationStatus === "pending" && isOwner && (
                <button
                  type="button"
                  disabled
                  className="h-10 px-4 rounded-xl font-black inline-flex items-center gap-2 border"
                  style={{
                    borderColor: EKARI.hair,
                    color: "#92400E",
                    background: "#FFFBEB",
                  }}
                >
                  <IoTimeOutline size={16} />
                  Pending
                </button>
              )}

              {!isOwner && (<><div className="font-semibold flex gap-2 items-center">
                {verificationType === "business" ? "Business" : verificationType === "company" ? "Company" : "Individual"}
                {(verificationType === "business" || verificationType === "company") && verificationOrgName && (<span className="gap-2 font-bold">{verificationOrgName}</span>)}
              </div></>)}

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(" ");
const makeThreadId = (a: string, b: string) => [a, b].sort().join("_");
type VerificationStatus = "none" | "pending" | "approved" | "rejected";
// 👇 add this
type VerificationType = "individual" | "business" | "company";
type Profile = {
  id: string;
  handle?: string;
  name?: string;
  bio?: string;
  roles?: string[];
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
  // ⭐ NEW
  verificationType?: VerificationType;
  verificationOrganizationName?: string;
  // ⭐ optional seller review stats
  sellerReviewAvg?: number;
  sellerReviewCount?: number;
  storefrontEnabled?: boolean;   // 👈 add this
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
  sellerId?: string;

  // ✅ embed seller summary in listing
  seller?: {
    id?: string;
    verified?: boolean;
    name?: string;
    handle?: string | null;
    photoURL?: string | null;
  };
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

  // NEW: local modals
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [errorModal, setErrorModal] = React.useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

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


  async function performHardDelete() {
    if (!deedId || !deed) return;
    try {
      setBusyDelete(true);
      const fn = httpsCallable(getFunctions(app), "deleteDeedCascade");
      await fn({ deedId: deedId });

      // await Promise.allSettled([deleteMuxIfAny(deed), deleteStorageIfAny(deed)]);
      //await deleteDoc(doc(db, "deeds", deedId));
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("lastUploadedDeedId");
        } catch { }
      }
      const url = `/${encodeURIComponent(handle.replace(/^@/, ""))}`;
      router.replace(url);
    } catch (e: any) {
      console.error(e);
      setErrorModal({
        open: true,
        title: "Delete failed",
        message: e?.message || "We couldn't delete this failed upload. Please try again.",
      });
    } finally {
      setBusyDelete(false);
    }
  }

  if (!deedId || (!isBlocking && !isFailed)) return null;

  return (
    <>
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
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={busyDelete}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busyDelete ? "Deleting…" : "Delete failed upload"}
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

      {/* Confirm delete failed upload */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete failed upload?"
        message="This will permanently delete the failed upload and any associated files. This cannot be undone."
        confirmText="Yes, delete it"
        cancelText="No, keep it"
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          void performHardDelete();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Error modal */}
      <ConfirmModal
        open={errorModal.open}
        title={errorModal.title || "Something went wrong"}
        message={errorModal.message}
        confirmText="Close"
        cancelText={undefined}
        onConfirm={() => setErrorModal((s) => ({ ...s, open: false }))}
        onCancel={() => setErrorModal((s) => ({ ...s, open: false }))}
      />
    </>
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
            name: d.firstName + " " + d.surname,
            bio: d.bio,
            website: d.website,
            phone: d.phone,
            roles: d.roles,
            photoURL: d.photoURL || d.avatarUrl,
            followersCount: Number(d.followersCount ?? 0),
            followingCount: Number(d.followingCount ?? 0),
            likesTotal: Number(d.likesTotal ?? 0),
            isAdmin: !!d.isAdmin,      // 👈 mirror for UI
            storefrontEnabled: !!d.storefrontEnabled,
            // 👇 NEW: pull verification info
            verificationStatus:
              (d.verification?.status as VerificationStatus) ?? "none",
            verificationRoleLabel:
              d.verification?.roleLabel ||
              d.verification?.primaryRole ||
              d.primaryRoleLabel ||
              undefined,
            // ⭐ NEW: type + org name
            verificationType:
              (d.verification?.verificationType as VerificationType) ??
              "individual",
            verificationOrganizationName:
              d.verification?.organizationName || undefined,

            // ⭐ NEW: seller review stats (optional)
            sellerReviewAvg:
              typeof d.sellerReviewStats?.avgRating === "number"
                ? d.sellerReviewStats.avgRating
                : undefined,
            sellerReviewCount:
              typeof d.sellerReviewStats?.reviewsCount === "number"
                ? d.sellerReviewStats.reviewsCount
                : undefined,
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
type TabKey = "deeds" | "events" | "discussions" | "reviews";

/* ---------- grids ---------- */
/* ---------- helpers for fast thumb loading ---------- */
// 1x1 tiny blur placeholder (neutral gray)
const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function useInViewOnce<T extends HTMLElement>(rootMargin = "600px") {
  const ref = React.useRef<T | null>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          obs.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}

/* ---------- grids ---------- */
function VideosGrid({
  items,
  handle,
  isOwner,
  loading,
  showEmpty,
}: {
  items: DeedDoc[];
  handle: string;
  isOwner: boolean;
  loading: boolean;
  showEmpty: boolean;
}) {
  return (
    <div className="px-3 md:px-6 pb-12">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
        {items.map((d, idx) => (
          <VideoTile
            key={d.id}
            deed={d}
            handle={handle}
            isOwner={isOwner}
            index={idx}
          />
        ))}
      </div>

      {showEmpty && !loading && items.length === 0 && (
        <div className="py-16 text-center text-sm" style={{ color: EKARI.subtext }}>
          No deeds yet
        </div>
      )}
    </div>
  );
}

function VideoTile({
  deed,
  handle,
  isOwner,
  index,
}: {
  deed: DeedDoc;
  handle: string;
  isOwner: boolean;
  index: number;
}) {
  // Prefer the smallest preview first if you have it in your schema.
  // If you don’t, this still works (it just may use the same thumb for both).
  const posterTiny =
    (deed.media as any)?.find?.((m: any) => m.tinyThumbUrl)?.tinyThumbUrl ||
    (deed.media as any)?.find?.((m: any) => m.smallThumbUrl)?.smallThumbUrl ||
    deed.media?.find((m) => (m as any)?.thumbUrl)?.thumbUrl ||
    deed.mediaThumbUrl ||
    deed.media?.[0]?.thumbUrl ||
    "/video-placeholder.jpg";

  // “Full” thumb (still a thumb, not the original video/image)
  const poster =
    deed.media?.find((m) => (m as any)?.thumbUrl)?.thumbUrl ||
    deed.mediaThumbUrl ||
    deed.media?.[0]?.thumbUrl ||
    posterTiny ||
    "/video-placeholder.jpg";

  const views = nfmt(deed.stats?.views ?? 0);
  const ready = (deed.status as DeedStatus) === "ready";
  const href = `/${encodeURIComponent(handle)}/deed/${deed.id}`;

  // Load only when near viewport
  const { ref, inView } = useInViewOnce<HTMLDivElement>("700px");

  // Above-the-fold: prioritize the first few tiles
  const eager = index < 4; // first row-ish
  const fetchPriority = index < 2 ? "high" : "auto";

  // two-stage loading state (tiny first, then full)
  const [tinyLoaded, setTinyLoaded] = React.useState(false);
  const [fullLoaded, setFullLoaded] = React.useState(false);

  const Card = (
    <div
      ref={ref}
      className={cn(
        "group relative block overflow-hidden rounded-xl",
        ready ? "bg-black" : "bg-slate-200"
      )}
      style={{ aspectRatio: "9/12" }}
      aria-disabled={!ready}
    >
      {/* Skeleton while nothing has painted yet */}
      {!tinyLoaded && (
        <div className="absolute inset-0 grid place-items-center bg-gray-100">
          <div
            className="h-8 w-8 rounded-full border-2 animate-spin"
            style={{ borderColor: "#D1D5DB", borderTopColor: EKARI.forest }}
            aria-hidden
          />
        </div>
      )}

      {/* Tiny preview: paints quickly */}
      {inView && (
        <Image
          src={posterTiny}
          alt={deed.caption || "deed"}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={cn(
            "object-cover",
            "transition-opacity duration-300",
            tinyLoaded ? "opacity-100" : "opacity-0"
          )}
          quality={35}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          priority={eager}
          // @ts-ignore - supported in modern Next, safe to include
          fetchPriority={fetchPriority}
          onLoadingComplete={() => setTinyLoaded(true)}
        />
      )}

      {/* Full thumb: fades in on top */}
      {inView && (
        <Image
          src={poster}
          alt={deed.caption || "deed"}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={cn(
            "object-cover",
            "transition-opacity duration-300",
            fullLoaded ? "opacity-100" : "opacity-0",
            "group-hover:scale-[1.02] transition-transform"
          )}
          quality={60}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          priority={eager}
          // @ts-ignore
          fetchPriority={fetchPriority}
          onLoadingComplete={() => setFullLoaded(true)}
        />
      )}

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

  if (!ready) return <div>{Card}</div>;

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

  // NEW: confirm + info modals
  const [confirmDelete, setConfirmDelete] = React.useState<{
    open: boolean;
    product: Product | null;
  }>({ open: false, product: null });

  const [infoModal, setInfoModal] = React.useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

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
      console.error(e);
      setInfoModal({
        open: true,
        title: "Update failed",
        message:
          e?.message ||
          "We couldn't update the listing status. Please try again in a moment.",
      });
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

  // ACTUAL deletion (no confirm here)
  const performRemoveListing = async (p: Product) => {
    if (!isOwner) return; // safety
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
      setItems((prev) => prev.filter((x) => x.id !== p.id));
      setInfoModal({
        open: true,
        title: "Listing deleted",
        message: "The listing and its images were removed successfully.",
      });
    } catch (e: any) {
      console.error(e);
      setInfoModal({
        open: true,
        title: "Delete failed",
        message:
          e?.message || "We couldn't delete this listing. Please try again later.",
      });
    }
  };

  const removeListing = (p: Product) => {
    if (!isOwner) return; // safety
    setConfirmDelete({ open: true, product: p });
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
      const prefix = currency === "USD" ? "$" : "KSh ";
      return prefix + safe.toLocaleString("en-KE", { maximumFractionDigits: 0 });
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
    <>
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
            const numericRate = Number(
              String(p.rate ?? "").replace(/[^\d.]/g, "")
            );
            const currency: CurrencyCode = p.currency || "KES";
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

      {/* Confirm delete listing */}
      <ConfirmModal
        open={confirmDelete.open}
        title="Delete this listing?"
        message="This will permanently remove the listing, its images and reviews. This action cannot be undone."
        confirmText="Yes, delete it"
        cancelText="No, keep listing"
        onConfirm={() => {
          const p = confirmDelete.product;
          setConfirmDelete({ open: false, product: null });
          if (p) void performRemoveListing(p);
        }}
        onCancel={() => setConfirmDelete({ open: false, product: null })}
      />

      {/* Info / error modal */}
      <ConfirmModal
        open={infoModal.open}
        title={infoModal.title || "Notice"}
        message={infoModal.message}
        confirmText="Close"
        cancelText={undefined}
        onConfirm={() => setInfoModal((s) => ({ ...s, open: false }))}
        onCancel={() => setInfoModal((s) => ({ ...s, open: false }))}
      />
    </>
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

  const [confirmDelete, setConfirmDelete] = React.useState<{
    open: boolean;
    event: EventDoc | null;
  }>({ open: false, event: null });

  const [infoModal, setInfoModal] = React.useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

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

  const performRemoveEvent = async (e: EventDoc) => {
    if (!isOwner) return;
    const storage = getStorage();
    const organizer = e.organizerId || uid;
    const folderRef = sRef(storage, `event/${organizer}/${e.id}`);
    const parentPath = `event/${e.id}`;

    try {
      try {
        await deleteFolderRecursively(folderRef);
      } catch (err) {
        console.warn("Event images cleanup issue (continuing):", err);
      }
      await deleteDoc(doc(db, parentPath));
      setEvents((prev) => prev.filter((x) => x.id !== e.id));
      setInfoModal({
        open: true,
        title: "Event deleted",
        message: "The event and its media were removed successfully.",
      });
    } catch (err: any) {
      console.error(err);
      setInfoModal({
        open: true,
        title: "Delete failed",
        message:
          err?.message || "We couldn't delete this event. Please try again later.",
      });
    }
  };

  const requestRemoveEvent = (e: EventDoc) => {
    if (!isOwner) return;
    setConfirmDelete({ open: true, event: e });
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
    <>
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
                    onClick={() => router.push(`/nexus/event/${e.id}`)}
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
                        requestRemoveEvent(e);
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

      {/* Confirm delete event */}
      <ConfirmModal
        open={confirmDelete.open}
        title="Delete this event?"
        message="This will permanently remove the event and its images. Guests will no longer be able to view it."
        confirmText="Yes, delete event"
        cancelText="No, keep event"
        onConfirm={() => {
          const e = confirmDelete.event;
          setConfirmDelete({ open: false, event: null });
          if (e) void performRemoveEvent(e);
        }}
        onCancel={() => setConfirmDelete({ open: false, event: null })}
      />

      {/* Info / error modal */}
      <ConfirmModal
        open={infoModal.open}
        title={infoModal.title || "Notice"}
        message={infoModal.message}
        confirmText="Close"
        cancelText={undefined}
        onConfirm={() => setInfoModal((s) => ({ ...s, open: false }))}
        onCancel={() => setInfoModal((s) => ({ ...s, open: false }))}
      />
    </>
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

  // NEW
  const [confirmDelete, setConfirmDelete] = React.useState<{
    open: boolean;
    row: DiscussionRow | null;
  }>({ open: false, row: null });

  const [infoModal, setInfoModal] = React.useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });

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
  }, [uid, isOwner, reloadToken]);

  const handleRefresh = () => {
    setRefreshing(true);
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
      console.error(e);
      setItems((prev) =>
        prev.map((i) =>
          i.id === row.id ? { ...i, published: current, _pending: false } : i
        )
      );
      setInfoModal({
        open: true,
        title: "Update failed",
        message:
          e?.message ||
          "We couldn't update the publication status of this discussion.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const performDeleteDiscussion = async (row: DiscussionRow) => {
    if (!isOwner) return;
    try {
      setBusyId(row.id);
      await deleteDoc(doc(db, "discussions", row.id));
      setInfoModal({
        open: true,
        title: "Discussion deleted",
        message: "The discussion was deleted successfully.",
      });
    } catch (e: any) {
      console.error(e);
      setInfoModal({
        open: true,
        title: "Delete failed",
        message:
          e?.message || "We couldn't delete this discussion. Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const requestDeleteDiscussion = (row: DiscussionRow) => {
    if (!isOwner) return;
    setConfirmDelete({ open: true, row });
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
    <>
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
                  onClick={() => router.push(`/nexus/discussion/${item.id}`)}
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
                      onClick={() => requestDeleteDiscussion(item)}
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

      {/* Confirm delete */}
      <ConfirmModal
        open={confirmDelete.open}
        title="Delete this discussion?"
        message="This will permanently remove the discussion and its answers. This action cannot be undone."
        confirmText="Yes, delete discussion"
        cancelText="No, keep it"
        onConfirm={() => {
          const row = confirmDelete.row;
          setConfirmDelete({ open: false, row: null });
          if (row) void performDeleteDiscussion(row);
        }}
        onCancel={() => setConfirmDelete({ open: false, row: null })}
      />

      {/* Info / error modal */}
      <ConfirmModal
        open={infoModal.open}
        title={infoModal.title || "Notice"}
        message={infoModal.message}
        confirmText="Close"
        cancelText={undefined}
        onConfirm={() => setInfoModal((s) => ({ ...s, open: false }))}
        onCancel={() => setInfoModal((s) => ({ ...s, open: false }))}
      />
    </>
  );
}


/* ---------- page ---------- */
// ✅ Adaptation: mobile = fixed inset (no AppShell / no bottom tabs), desktop = AppShell
// Drop these helpers near the TOP of the file (same file).
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
function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}

/* -------------------------------------------------------
   Replace ONLY the HandleProfilePage() return part with this
-------------------------------------------------------- */

export default function HandleProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams<{ handle: string }>();

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const goBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

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
      } catch {
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

  const reviewsSummary =
    profile &&
      typeof profile.sellerReviewAvg === "number" &&
      (profile.sellerReviewCount ?? 0) > 0
      ? { rating: profile.sellerReviewAvg, count: profile.sellerReviewCount as number }
      : undefined;

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


  const cleanHandle = decoded.startsWith("@") ? decoded : `@${decoded}`;
  const webUrl = `https://ekarihub.com/${cleanHandle}`;

  // ✅ safer: no triple slash, plus explicit path
  const appUrl = `ekarihub://profile/${encodeURIComponent(cleanHandle)}`;
  const showDeedsEmpty =
    !loadingProfile && !!profile && uid !== undefined; // ✅ profile is visible now
  // ---- shared content (header + tab body) ----
  const Body = (
    <>
      <OpenInAppBanner
        webUrl={webUrl}
        appUrl={appUrl}
        title="Open this profile in ekarihub"
        subtitle="Faster loading, messaging, and full features."
        playStoreUrl="https://play.google.com/store/apps/details?id=com.ekarihub.app"
        appStoreUrl="https://apps.apple.com"
      />

      {isOwner && <DeedProcessingGate authorUid={uid ?? null} handle={handleWithAt} />}

      {/* container: desktop has max width, mobile full width */}
      <div className={isDesktop ? "min-h-screen mx-auto w-full max-w-[1160px] px-4 md:px-8" : "min-h-screen w-full"}>
        {/* header with tabs */}
        {loadingProfile ? (
          <div className="p-6 animate-pulse">
            <div className="h-8 w-40 bg-gray-200 rounded mb-3" />
            <div className="h-24 w-24 bg-gray-200 rounded-full" />
          </div>
        ) : profile ? (
          <>
            <ProfileHeroStorefront
              profile={profile}
              loading={false}
              isOwner={isOwner}
              followState={followState}
              hasUser={!!user}
              onRequireAuth={requireAuth}
              canSeeContacts={canSeeContacts}
              partners={partners}
              mutualPartners={mutualPartners}
              likesValue={likesValue}
              onMessage={() => {
                // reuse your existing message logic from old header:
                if (!user?.uid) return requireAuth();

                const peerId = profile.id;
                if (user.uid === peerId) return;

                const peerName = profile.name || profile.handle || "";
                const peerPhotoURL = profile.photoURL || "";
                const peerHandle = profile.handle || "";

                const threadId = makeThreadId(user.uid, peerId);
                const qs = new URLSearchParams();
                qs.set("peerId", peerId);
                if (peerName) qs.set("peerName", peerName);
                if (peerPhotoURL) qs.set("peerPhotoURL", peerPhotoURL);
                if (peerHandle) qs.set("peerHandle", peerHandle);

                router.push(`/bonga/${encodeURIComponent(threadId)}?${qs.toString()}`);
              }}
              onShare={async () => {
                try {
                  const origin =
                    typeof window !== "undefined" ? window.location.origin : "https://ekarihub.com";
                  const url = `${origin}/${encodeURIComponent((profile.handle || "@user").replace(/^@/, ""))}`;
                  const title = `${profile.handle || "Profile"} on ekarihub`;
                  const text = `Check out ${profile.handle || "this profile"} on ekarihub`;

                  if (typeof navigator !== "undefined" && (navigator as any).share) {
                    await (navigator as any).share({ title, text, url });
                    return;
                  }
                  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(url);
                    window.alert("Profile link copied!");
                    return;
                  }
                  window.prompt("Copy profile link:", url);
                } catch (e) {
                  console.error("Share failed:", e);
                }
              }}
              reviewsSummary={reviewsSummary}
              showAdminBadge={viewerIsAdmin && isOwner}
            />

            <div className="max-w-5xl mx-auto px-4 -mt-2 md:-mt-3 mb-5">
              <SegmentedTabs value={tab} onChange={setTab} />
            </div>

            <SectionHeader tab={tab} />
          </>
        ) : (
          <div
            className="flex p-6 items-center justify-center h-[60vh] w-full text-sm"
            style={{ color: EKARI.subtext }}
          >
            {uid === undefined ? <BouncingBallLoader /> : "Profile not found."}
          </div>
        )}


        {/* tab content */}
        {tab === "deeds" &&
          (loadingDeeds || loadingProfile || uid === undefined ? (
            <div className="px-3 md:px-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-48 md:h-56 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <VideosGrid
              items={items}
              handle={handleWithAt}
              isOwner={isOwner}
              loading={loadingDeeds}
              showEmpty={showDeedsEmpty} // ✅ NEW
            />
          ))}


        {tab === "events" && uid && <ProfileEvents uid={uid} isOwner={isOwner} />}

        {tab === "discussions" && uid && <ProfileDiscussions uid={uid} isOwner={isOwner} />}

        {tab === "reviews" && uid && (
          <div className="px-3 md:px-6 pb-12">
            <SellerReviewsSection sellerId={profile?.id ?? ""} />
          </div>
        )}

        {/* mobile safe-area bottom spacer */}
        {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
      </div>
    </>
  );

  // ---- MOBILE: fixed inset, sticky header w/ back button ----
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col bg-white">
        {/* Sticky top bar */}
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div
            className="h-14 px-3 flex items-center gap-2"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <button
              onClick={goBack}
              className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
              aria-label="Back"
              title="Back"
            >
              {/* you already import IoArrowBack elsewhere in your project, but not in this file;
                  simplest: re-use an existing icon from your imports or add IoArrowBack import. */}
              <span className="text-[18px] font-black" style={{ color: EKARI.text }}>
                ←
              </span>
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-black" style={{ color: EKARI.text }}>
                {handleWithAt}
              </div>
              <div className="truncate text-[11px]" style={{ color: EKARI.subtext }}>
                Profile
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">{Body}</div>
      </div>
    );
  }

  // ---- DESKTOP: keep AppShell ----
  return (
    <AppShell>
      <div className="min-h-screen w-full bg-white">{Body}</div>
    </AppShell>
  );
}

