"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  IoBookmarkOutline,
  IoArrowBack,
  IoRepeatOutline,
  IoStar,
  IoStarHalf,
  IoInformationCircleOutline,
  IoNavigateOutline,
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
  forest: "#173C2E",
  forestSoft: "#214C3A",
  bg: "#F8F7F2",
  paper: "#FBFAF6",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#DDD8CC",
  primary: "#F39A22",
  green: "#16A34A",
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
      className={[
        "inline-flex items-baseline gap-1.5",
        "text-left transition-all duration-200",
        onClick ? "hover:-translate-y-0.5 hover:text-[#173C2E]" : "",
      ].join(" ")}
      title={label}
      type={onClick ? "button" : undefined}
    >
      <span className="hidden text-[#F39A22] sm:inline-flex">{icon}</span>

      <span className="text-[17px] font-black leading-none text-slate-900">
        {value}
      </span>

      <span className="text-[12px] font-semibold text-slate-400">
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
} from "react-icons/io5";
import LargeAvatar from "../components/LargeAvatar";
import { repostDeed } from "@/lib/repostDeed";

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
  const cls = [
    "grid h-10 w-10 place-items-center rounded-full",
    "border border-[#D9D3C7] bg-[#FBFAF6] text-slate-600",
    "shadow-[0_6px_16px_rgba(15,23,42,0.04)]",
    "transition-all duration-200 ease-out",
    "hover:-translate-y-0.5 hover:border-[#F39A22]/55 hover:bg-[#FFF9F0] hover:text-[#173C2E]",
    "active:translate-y-0 active:scale-95",
  ].join(" ");

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={target ? "noopener noreferrer" : undefined}
        className={cls}
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
  const tabs: Array<{
    key: TabKey;
    label: string;
    icon: React.ReactNode;
  }> = [
      {
        key: "deeds",
        label: "Deeds",
        icon: <IoFilmOutline size={15} />,
      },
      {
        key: "events",
        label: "Events",
        icon: <IoCalendarOutline size={15} />,
      },
      {
        key: "discussions",
        label: "Discussions",
        icon: <IoChatbubblesOutline size={15} />,
      },
      {
        key: "reviews",
        label: "Reviews",
        icon: <IoStarOutline size={15} />,
      },
    ];

  return (
    <div className="border-b border-[#DDD8CC] bg-[#FBFAF6]">
      <div className="mx-auto flex max-w-[1040px] items-center gap-2 overflow-x-auto px-4 no-scrollbar">
        {tabs.map((tab) => {
          const active = value === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={[
                "relative inline-flex h-12 shrink-0 items-center gap-2 px-3",
                "text-[12px] font-black transition-colors duration-200",
                active
                  ? "text-[#173C2E]"
                  : "text-slate-400 hover:text-slate-700",
              ].join(" ")}
            >
              {tab.icon}
              {tab.label}

              {active ? (
                <motion.span
                  layoutId="profile-tab-indicator"
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

  const defaultSubtitle =
    tab === "deeds"
      ? "Videos and moments from this profile."
      : tab === "events"
        ? "Upcoming and past events."
        : tab === "discussions"
          ? "Questions and conversations."
          : "Ratings and feedback.";

  return (
    <div className="mx-auto mb-3 flex max-w-[1040px] items-center justify-between gap-3 px-4 pt-3">
      <div className="flex min-w-0 items-center gap-2">
        <IoFunnelOutline size={14} className="text-slate-400" />

        <h2 className="text-[13px] font-black text-slate-700">
          {tabLabel}
        </h2>

        <span className="rounded-full bg-[#EFECE5] px-2 py-0.5 text-[9px] font-bold text-slate-500">
          {tabLabel}
        </span>
      </div>

      <p className="hidden truncate text-[10px] font-medium text-slate-400 sm:block">
        {subtitle || defaultSubtitle}
      </p>

      {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
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
  myBookingsBadge,
  expertBookingsBadge,
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
  myBookingsBadge: number;
  expertBookingsBadge: number;
}) {
  const verificationStatus: VerificationStatus =
    (profile.verificationStatus as VerificationStatus) || "none";

  const verificationType: VerificationType =
    (profile.verificationType as VerificationType) || "individual";

  const isPremium =
    profile.storefrontUntil && profile.storefrontUntil > Date.now();

  const router = useRouter();

  const phone = cleanPhone(profile.phone || null);
  const website = toWebsiteLink(profile.website || null);
  const whatsapp = toWhatsAppLink(profile?.phone || profile.phone || null);

  const handleSlug = React.useMemo(
    () => (profile.handle || "").replace(/^@/, ""),
    [profile.handle]
  );

  const openConnections = (
    tabKey: "following" | "followers" | "partners" | "mutual"
  ) => {
    if (!handleSlug) return;

    router.push(
      `/${encodeURIComponent(handleSlug)}/connections?tab=${tabKey}`
    );
  };

  const verificationOrgName =
    profile.verificationOrganizationName;

  const reviewsText =
    reviewsSummary && reviewsSummary.count > 0
      ? `${reviewsSummary.rating.toFixed(1)} (${reviewsSummary.count})`
      : "—";

  const verificationLabel =
    verificationStatus === "approved"
      ? `Verified ${verificationType}`
      : verificationStatus === "pending" ||
        verificationStatus === "payment_pending"
        ? "Verification pending"
        : null;

  const storefrontExpired =
    !!profile.storefrontUntil &&
    profile.storefrontUntil <= Date.now();

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="bg-[#FBFAF6]"
    >
      {/* COVER */}
      <div
        className="relative h-[120px] overflow-hidden bg-[#173C2E] md:h-[138px]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(23,60,46,1), rgba(21,69,49,.96))",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
          }}
        />

        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/[0.025]" />

        {/* desktop primary actions live in cover */}
        <div className="absolute right-4 top-4 hidden items-center gap-2 md:flex lg:right-6">
          {isOwner ? (
            <Link
              href={
                profile.isSuspended
                  ? ""
                  : `/${(profile.handle || "@user").replace(/^@/, "")}/edit`
              }
              className={[
                "inline-flex h-10 items-center gap-2 rounded-xl px-4",
                "border border-white/15 bg-[#FBFAF6] text-[12px] font-black text-slate-800",
                "shadow-[0_8px_20px_rgba(0,0,0,0.10)]",
                "transition-all duration-200",
                "hover:-translate-y-0.5 hover:bg-white",
                profile.isSuspended ? "pointer-events-none opacity-60" : "",
              ].join(" ")}
            >
              <IoPencilOutline size={16} />
              Edit
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (profile.isSuspended) return;
                hasUser
                  ? followState.toggle()
                  : onRequireAuth();
              }}
              className={[
                "h-10 rounded-xl px-4 text-[12px] font-black",
                "transition-all duration-200",
                followState.isFollowing
                  ? "border border-white/20 bg-white/10 text-white hover:bg-white/15"
                  : "bg-[#F39A22] text-white hover:-translate-y-0.5 hover:bg-[#E98C12]",
              ].join(" ")}
              disabled={followState.isFollowing === null}
            >
              {followState.isFollowing
                ? "Following"
                : "Follow"}
            </button>
          )}

          <button
            type="button"
            onClick={onMessage}
            disabled={isOwner || profile.isSuspended}
            className={[
              "inline-flex h-10 items-center gap-2 rounded-xl px-4",
              "bg-[#F39A22] text-[12px] font-black text-white",
              "transition-all duration-200",
              "hover:-translate-y-0.5 hover:bg-[#E98C12]",
              "disabled:cursor-not-allowed disabled:opacity-45",
            ].join(" ")}
          >
            <IoChatbubbleEllipsesOutline size={17} />
            Message
          </button>

          <button
            type="button"
            onClick={() =>
              profile.isSuspended ? null : onShare()
            }
            className={[
              "grid h-10 w-10 place-items-center rounded-full",
              "border border-white/15 bg-[#FBFAF6] text-slate-700",
              "transition-all duration-200",
              "hover:-translate-y-0.5 hover:bg-white",
            ].join(" ")}
            aria-label="Share"
            title="Share"
          >
            <IoShareSocialOutline size={17} />
          </button>
        </div>
      </div>

      {/* PROFILE MAIN */}
      <div className="mx-auto max-w-[1040px] px-4">
        <div className="relative pb-4">
          <div className="-mt-[48px] flex flex-col gap-3 md:-mt-[58px] md:flex-row md:items-end md:gap-4">
            <div className="relative shrink-0 self-start">
              <div
                className={[
                  "relative grid h-[104px] w-[104px] place-items-center overflow-hidden rounded-full",
                  "border-[5px] border-[#FBFAF6] bg-[#173C2E]",
                  "shadow-[0_14px_34px_rgba(15,23,42,0.12)]",
                ].join(" ")}
              >
                <LargeAvatar
                  src={profile.photoURL || "/avatar-placeholder.png"}
                  alt={profile.handle || "avatar"}
                  size={104}
                />
              </div>

              {verificationStatus === "approved" ? (
                <span className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full border-[3px] border-[#FBFAF6] bg-[#173C2E] text-white">
                  <IoCheckmarkDone size={15} />
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 pb-1 md:pt-[55px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="truncate text-[25px] font-black tracking-[-0.035em] text-slate-900">
                    {loading
                      ? "Loading…"
                      : profile.name ||
                      profile.handle ||
                      "Profile"}
                  </h1>

                  <div className="mt-0.5 truncate text-[13px] font-bold text-slate-400">
                    {profile.handle || "@user"}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {verificationLabel ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF4E7] px-2.5 py-1 text-[10px] font-black text-[#3E6F28]">
                        <IoShieldCheckmarkOutline size={13} />
                        {verificationLabel}
                      </span>
                    ) : null}

                    {showAdminBadge && isOwner ? (
                      <span className="rounded-full bg-[#E9EEFF] px-2.5 py-1 text-[10px] font-black text-[#214E87]">
                        Admin
                      </span>
                    ) : null}

                    {isOwner && storefrontExpired ? (
                      <Link
                        href="/seller/dashboard?tab=packages"
                        className="rounded-full bg-[#FDECEC] px-2.5 py-1 text-[10px] font-black text-[#B3312C]"
                      >
                        Storefront expired
                      </Link>
                    ) : null}

                    {isPremium && !profile.isSuspended ? (
                      <Link
                        href={`/store/${profile.id}?src=profile`}
                        className="inline-flex items-center gap-1 rounded-full bg-[#EAF4E7] px-2.5 py-1 text-[10px] font-black text-[#3E6F28]"
                      >
                        <IoStorefrontOutline size={12} />
                        Store
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="hidden shrink-0 items-center gap-2 md:flex">
                  {canSeeContacts && phone ? (
                    <IconBtn
                      href={`tel:${phone}`}
                      icon={<IoCallOutline size={17} />}
                      label="Call"
                    />
                  ) : null}

                  {canSeeContacts && whatsapp ? (
                    <IconBtn
                      href={whatsapp}
                      icon={<IoLogoWhatsapp size={17} />}
                      label="WhatsApp"
                      target="_blank"
                    />
                  ) : null}

                  {canSeeContacts && website ? (
                    <IconBtn
                      href={website}
                      icon={<IoGlobeOutline size={17} />}
                      label="Website"
                      target="_blank"
                    />
                  ) : null}
                </div>
              </div>

              {profile.bio ? (
                <p className="mt-2 max-w-3xl text-[13px] font-medium leading-5 text-slate-600">
                  {profile.bio}
                </p>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                {website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-[360px] items-center gap-1.5 truncate text-[11px] font-bold text-[#173C2E] underline decoration-[#173C2E]/25 underline-offset-2"
                  >
                    <IoGlobeOutline size={13} />
                    {profile.website}
                  </a>
                ) : null}

                {canSeeContacts && phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#173C2E]"
                  >
                    <IoCallOutline size={13} />
                    {phone}
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {profile.isSuspended ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-800">
              <div className="font-black">
                Account suspended
              </div>
              <div className="mt-1">
                This profile has been suspended for violating
                ekarihub community guidelines.
              </div>
            </div>
          ) : null}

          {/* MOBILE ACTIONS */}
          <div className="mt-4 grid grid-cols-[1fr_1fr_44px] gap-2 md:hidden">
            {isOwner ? (
              <Link
                href={`/${(profile.handle || "@user").replace(/^@/, "")}/edit`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9D3C7] bg-white text-[12px] font-black text-slate-700"
              >
                <IoPencilOutline size={16} />
                Edit
              </Link>
            ) : (
              <button
                onClick={() => {
                  if (profile.isSuspended) return;
                  hasUser
                    ? followState.toggle()
                    : onRequireAuth();
                }}
                className={[
                  "h-11 rounded-xl text-[12px] font-black",
                  followState.isFollowing
                    ? "border border-[#D9D3C7] bg-white text-slate-700"
                    : "bg-[#173C2E] text-white",
                ].join(" ")}
                type="button"
              >
                {followState.isFollowing
                  ? "Following"
                  : "Follow"}
              </button>
            )}

            <button
              onClick={() =>
                profile.isSuspended ? null : onMessage()
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F39A22] text-[12px] font-black text-white disabled:opacity-50"
              disabled={isOwner || profile.isSuspended}
              type="button"
            >
              <IoChatbubbleEllipsesOutline size={17} />
              Message
            </button>

            <button
              type="button"
              onClick={() =>
                profile.isSuspended ? null : onShare()
              }
              className="grid h-11 w-11 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-700"
              aria-label="Share"
            >
              <IoShareSocialOutline size={17} />
            </button>
          </div>
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="border-y border-[#DDD8CC] bg-[#FBFAF6]">
        <div className="mx-auto flex max-w-[1040px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <StatPill
              icon={<IoPeopleOutline size={13} />}
              label="Followers"
              value={nfmt(Number(profile.followersCount || 0))}
              onClick={() =>
                profile.isSuspended
                  ? null
                  : openConnections("followers")
              }
            />

            <StatPill
              icon={<IoListOutline size={13} />}
              label="Following"
              value={nfmt(Number(profile.followingCount || 0))}
              onClick={() =>
                profile.isSuspended
                  ? null
                  : openConnections("following")
              }
            />

            <StatPill
              icon={<IoChatbubbleEllipsesOutline size={13} />}
              label="Partners"
              value={nfmt(partners || 0)}
              onClick={() =>
                profile.isSuspended
                  ? null
                  : openConnections("partners")
              }
            />

            <StatPill
              icon={<IoChatbubblesOutline size={13} />}
              label="Mutual"
              value={nfmt(mutualPartners || 0)}
              onClick={() =>
                profile.isSuspended
                  ? null
                  : openConnections("mutual")
              }
            />

            <StatPill
              icon={<IoHeartOutline size={13} />}
              label="Likes"
              value={nfmt(Number(likesValue || 0))}
            />
          </div>

          <div className="inline-flex items-center gap-1 rounded-full border border-[#F39A22]/35 bg-[#FFF8ED] px-3 py-1.5 text-[11px] font-black text-[#8A5109]">
            <IoStarOutline size={14} className="text-[#F39A22]" />
            {reviewsText} Rating
          </div>
        </div>
      </div>

      {/* OWNER SHORTCUTS */}
      {isOwner ? (
        <div className="border-b border-[#DDD8CC] bg-[#FBFAF6]">
          <div className="mx-auto flex max-w-[1040px] gap-2 overflow-x-auto px-4 py-2.5 no-scrollbar">
            <Link
              href={`/${handleSlug}/earnings`}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-slate-600 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0]"
            >
              <IoCashOutline size={14} className="text-[#F39A22]" />
              Earnings
            </Link>

            <Link
              href="/seller/dashboard?tab=packages"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-slate-600 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0]"
            >
              <IoGridOutline size={14} className="text-[#F39A22]" />
              Seller dashboard
            </Link>

            <Link
              href={`/store/${profile.id}?src=mystore`}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-slate-600 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0]"
            >
              <IoListOutline size={14} className="text-[#F39A22]" />
              My listings
            </Link>

            {/**  <Link
              href="/nexus/events/saved"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-slate-600 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0]"
            >
              <IoBookmarkOutline size={14} className="text-[#F39A22]" />
              Saved events
            </Link>*/}

            {showAdminBadge ? (
              <Link
                href="/admin/overview"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-slate-600 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0]"
              >
                <IoAnalyticsOutline size={14} className="text-[#F39A22]" />
                Admin dashboard
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}

function ProfessionalAccountSection({
  profile,
  isOwner,
  hasPublishedExpertProfile,
  myBookingsBadge,
  expertBookingsBadge,
}: {
  profile: Profile;
  isOwner: boolean;
  hasPublishedExpertProfile: boolean;
  myBookingsBadge: number;
  expertBookingsBadge: number;
}) {
  const verificationStatus: VerificationStatus =
    profile.verificationStatus || "none";

  const isVerified =
    verificationStatus === "approved";

  const isVerificationPending =
    verificationStatus === "pending" ||
    verificationStatus === "payment_pending";

  const isRejected =
    verificationStatus === "rejected";

  if (!isOwner && !hasPublishedExpertProfile) {
    return null;
  }

  const accountType =
    profile.verificationType === "business"
      ? "Business"
      : profile.verificationType === "company"
        ? "Company"
        : "Individual";

  const badgeLabel = isVerified
    ? `Verified ${accountType.toLowerCase()}`
    : isVerificationPending
      ? "Verification pending"
      : "Unverified expert";

  const professionalLabel =
    profile.verificationOrganizationName ||
    profile.verificationRoleLabel ||
    (hasPublishedExpertProfile
      ? "Ekari Expert"
      : "Create your expert profile");

  const storefrontExpired =
    !!profile.storefrontUntil &&
    profile.storefrontUntil <= Date.now();

  const description = isVerified
    ? "Identity and professional credentials have been reviewed by ekarihub."
    : isVerificationPending
      ? "This expert profile can remain active while the verification request is being reviewed."
      : isRejected
        ? "This expert profile is active, but the previous verification request was not approved."
        : hasPublishedExpertProfile
          ? "This expert has not yet completed ekarihub verification. Review their experience, ratings and consultation terms before booking."
          : "Create an expert profile to publish your services and receive consultation requests. Verification is optional.";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        delay: 0.04,
        ease: "easeOut",
      }}
      className="bg-[#F3F1EB] px-4 py-4"
    >
      <div className="mx-auto max-w-[1040px]">
        <div
          className={[
            "rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]",
            "px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.035)]",
          ].join(" ")}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={[
                  "grid h-12 w-12 shrink-0 place-items-center rounded-full",
                  isVerified
                    ? "bg-[#E8ECE8] text-[#173C2E]"
                    : isVerificationPending
                      ? "bg-[#FFF4E3] text-[#B66A0C]"
                      : "bg-slate-100 text-slate-500",
                ].join(" ")}
              >
                {isVerified ? (
                  <IoShieldCheckmarkOutline size={23} />
                ) : isVerificationPending ? (
                  <IoTimeOutline size={22} />
                ) : (
                  <IoInformationCircleOutline size={22} />
                )}
              </div>

              <div className="min-w-0">
                <h2 className="text-[15px] font-black text-slate-900">
                  {hasPublishedExpertProfile
                    ? "Professional account"
                    : "Become an ekari Expert"}
                </h2>

                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  {hasPublishedExpertProfile
                    ? "Expert profile · Farmer specialist"
                    : "Professional services on ekarihub"}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black",
                      isVerified
                        ? "bg-[#EAF4E7] text-[#3E6F28]"
                        : isVerificationPending
                          ? "bg-[#FFF4E3] text-[#9A5A08]"
                          : "bg-slate-100 text-slate-600",
                    ].join(" ")}
                  >
                    {isVerified ? (
                      <IoShieldCheckmarkOutline size={12} />
                    ) : null}
                    {badgeLabel}
                  </span>

                  {isOwner && profile.isAdmin ? (
                    <span className="rounded-full bg-[#E9EEFF] px-2.5 py-1 text-[10px] font-black text-[#214E87]">
                      Admin
                    </span>
                  ) : null}

                  {isOwner && storefrontExpired ? (
                    <Link
                      href="/seller/dashboard?tab=packages"
                      className="rounded-full bg-[#FDECEC] px-2.5 py-1 text-[10px] font-black text-[#B3312C]"
                    >
                      Storefront expired
                    </Link>
                  ) : null}
                </div>

                <p className="mt-3 text-[12px] font-bold text-slate-600">
                  {professionalLabel}
                </p>

                <p className="mt-1 max-w-3xl text-[11px] font-medium leading-5 text-slate-500">
                  {description}
                  {isVerified &&
                    isOwner &&
                    !hasPublishedExpertProfile
                    ? " Complete your expert settings to start receiving consultation requests."
                    : ""}
                </p>
              </div>
            </div>

            {isOwner ? (
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Link
                  href="/account/expert"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#173C2E] px-4 text-[11px] font-black text-white transition hover:-translate-y-0.5 hover:bg-[#214C3A]"
                >
                  <IoPencilOutline size={14} />
                  {hasPublishedExpertProfile
                    ? "Expert settings"
                    : "Create expert profile"}
                </Link>

                {hasPublishedExpertProfile ? (
                  <Link
                    href="/account/expert/bookings"
                    className="relative inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[11px] font-black text-slate-600 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0]"
                  >
                    <IoCalendarOutline size={14} />
                    Expert bookings

                    {expertBookingsBadge > 0 ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#F39A22] px-1 text-[9px] text-white">
                        {expertBookingsBadge > 99
                          ? "99+"
                          : expertBookingsBadge}
                      </span>
                    ) : null}
                  </Link>
                ) : null}

                <Link
                  href="/account/bookings"
                  className="relative inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[11px] font-black text-slate-600 transition hover:border-[#F39A22]/50 hover:bg-[#FFF9F0]"
                >
                  <IoListOutline size={14} />
                  My bookings

                  {myBookingsBadge > 0 ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#F39A22] px-1 text-[9px] text-white">
                      {myBookingsBadge > 99
                        ? "99+"
                        : myBookingsBadge}
                    </span>
                  ) : null}
                </Link>

                <Link
                  href="/account/verification"
                  className={[
                    "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4",
                    "text-[11px] font-black transition",
                    isVerified
                      ? "border-[#D9D3C7] bg-white text-slate-600 hover:bg-[#FFF9F0]"
                      : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                  ].join(" ")}
                >
                  {isVerificationPending ? (
                    <IoTimeOutline size={14} />
                  ) : (
                    <IoShieldCheckmarkOutline size={14} />
                  )}

                  {isVerified
                    ? "Verification"
                    : isVerificationPending
                      ? "Verification status"
                      : isRejected
                        ? "Verify again"
                        : "Get verified"}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(" ");
const makeThreadId = (a: string, b: string) => [a, b].sort().join("_");
type VerificationStatus =
  | "none"
  | "payment_pending"
  | "pending"
  | "approved"
  | "rejected";
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
  storefrontUntil?: number | null;
  isSuspended?: boolean;
  suspendedReason?: string | null;
  suspendedAt?: any;
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
      const storefrontUntilMs =
        d.storefrontUntil?.toMillis?.() ??
        (d.storefrontUntil?.seconds ? d.storefrontUntil.seconds * 1000 : null);

      const storefrontEnabled =
        storefrontUntilMs && storefrontUntilMs > Date.now();
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
            storefrontEnabled: !!storefrontEnabled,
            storefrontUntil: storefrontUntilMs,
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
            isSuspended: d?.isSuspended === true,
            suspendedReason: d?.suspendedReason ?? null,
            suspendedAt: d?.suspendedAt ?? null,

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
      await setDoc(
        ref,
        {
          followerId: viewerUid,
          followingId: targetUid,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
  }
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
  ownerUid,
  viewerUid,
  loading,
  showEmpty,
}: {
  items: DeedDoc[];
  handle: string;
  isOwner: boolean;
  ownerUid?: string | null;
  viewerUid?: string | null;
  loading: boolean;
  showEmpty: boolean;
}) {
  const [repostTarget, setRepostTarget] =
    React.useState<DeedDoc | null>(null);

  const [repostingId, setRepostingId] =
    React.useState<string | null>(null);

  const [infoModal, setInfoModal] = React.useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "",
    message: "",
  });

  const performRepost = React.useCallback(async () => {
    const deed = repostTarget;
    setRepostTarget(null);

    if (!deed?.id) return;

    if (!viewerUid) {
      setInfoModal({
        open: true,
        title: "Sign in required",
        message: "Please sign in before reposting a deed.",
      });
      return;
    }

    if (!isOwner || viewerUid !== ownerUid) {
      setInfoModal({
        open: true,
        title: "Not allowed",
        message: "You can only repost your own deed.",
      });
      return;
    }

    try {
      setRepostingId(deed.id);

      await repostDeed(deed.id, viewerUid);

      setInfoModal({
        open: true,
        title: "Deed reposted",
        message:
          "Your deed has been moved to the top of the recent feed.",
      });
    } catch (error: any) {
      console.error("PROFILE_REPOST_FAILED", {
        deedId: deed.id,
        error,
      });

      setInfoModal({
        open: true,
        title: "Repost failed",
        message:
          error?.message ||
          "Could not repost this deed. Please try again.",
      });
    } finally {
      setRepostingId(null);
    }
  }, [
    repostTarget,
    viewerUid,
    ownerUid,
    isOwner,
  ]);

  return (
    <>
      <div className="px-3 md:px-6 pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
          {items.map((deed, index) => (
            <VideoTile
              key={deed.id}
              deed={deed}
              handle={handle}
              isOwner={isOwner}
              index={index}
              reposting={repostingId === deed.id}
              onRepost={() => {
                if (!isOwner) return;
                setRepostTarget(deed);
              }}
            />
          ))}
        </div>

        {showEmpty && !loading && items.length === 0 && (
          <div
            className="py-16 text-center text-sm"
            style={{ color: EKARI.subtext }}
          >
            No deeds yet
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!repostTarget}
        title="Repost this deed?"
        message="This deed will move to the top of your profile and recent deed feeds. Likes, comments and views will remain unchanged."
        confirmText="Repost deed"
        cancelText="Cancel"
        onConfirm={() => {
          void performRepost();
        }}
        onCancel={() => setRepostTarget(null)}
      />

      <ConfirmModal
        open={infoModal.open}
        title={infoModal.title || "Notice"}
        message={infoModal.message}
        confirmText="Close"
        cancelText={undefined}
        onConfirm={() =>
          setInfoModal((previous) => ({
            ...previous,
            open: false,
          }))
        }
        onCancel={() =>
          setInfoModal((previous) => ({
            ...previous,
            open: false,
          }))
        }
      />
    </>
  );
}


function VideoTile({
  deed,
  handle,
  isOwner,
  index,
  reposting,
  onRepost,
}: {
  deed: DeedDoc;
  handle: string;
  isOwner: boolean;
  index: number;
  reposting: boolean;
  onRepost: () => void;
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
    <div className="relative">
      <Link
        href={href}
        className="block"
        prefetch
        aria-label="Open deed"
      >
        {Card}
      </Link>

      {isOwner && (
        <button
          type="button"
          disabled={reposting}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            if (reposting) return;
            onRepost();
          }}
          className={[
            "absolute right-2 top-2 z-20",
            "inline-flex h-9 items-center gap-1.5 rounded-full",
            "border border-white/20 bg-black/65 px-3",
            "text-[11px] font-black text-white backdrop-blur-md",
            "shadow-[0_8px_24px_rgba(0,0,0,0.35)]",
            "transition hover:bg-black/80 active:scale-[0.97]",
            "disabled:cursor-not-allowed disabled:opacity-60",
          ].join(" ")}
          aria-label="Repost deed"
          title="Repost deed"
        >
          {reposting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <IoRepeatOutline size={15} />
          )}

          <span>
            {reposting ? "Reposting" : "Repost"}
          </span>
        </button>
      )}
    </div>
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
                    onClick={() => router.push(`/nexus/events/${e.id}`)}
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
                  onClick={() => router.push(`/nexus/discussions/${item.id}`)}
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




type ExpertCurrency =
  | "KES"
  | "USD";

type ExpertFeeType =
  | "fixed"
  | "starting_from"
  | "free";

type ExpertConsultationMethod =
  | "phone"
  | "whatsapp"
  | "video"
  | "chat"
  | "physical";

type ExpertCoordinates = {
  latitude: number;
  longitude: number;
  geohash?: string | null;
};

type ExpertPlace = {
  placeId: string | null;
  label: string;

  countryCode: string;
  country: string;

  region: string;
  city: string;
  locality: string;

  coordinates:
  | ExpertCoordinates
  | null;

  timezone: string | null;
};

type ExpertServiceArea = {
  id: string;

  type:
  | "country"
  | "region"
  | "city"
  | "radius";

  label: string;

  placeId: string | null;

  countryCode: string;
  country: string;

  region: string;
  city: string;

  center:
  | ExpertCoordinates
  | null;

  radiusKm: number | null;
};

type ExpertServiceCoverage = {
  offersOnlineServices: boolean;
  offersPhysicalVisits: boolean;

  onlineCoverage:
  | "local"
  | "country"
  | "worldwide";

  serviceAreas: ExpertServiceArea[];
};

type ExpertVerificationStatus =
  | "none"
  | "payment_pending"
  | "pending"
  | "approved"
  | "rejected"
  | "expired";
type PublicExpertProfile = {
  uid: string;

  handle?: string;
  displayName?: string;
  name?: string;
  photoURL?: string;

  headline?: string;
  expertBio?: string;

  verificationStatus?:
  ExpertVerificationStatus;

  verified?: boolean;

  verificationRole?: string;
  verificationRoleLabel?: string;

  verificationType?:
  | "individual"
  | "business"
  | "company";

  organizationName?: string;

  specialties?: string[];

  /**
   * Temporary compatibility field for
   * profiles published before global
   * service coverage was introduced.
   */
  countiesServed?: string[];

  languages?: string[];

  consultationMethods?:
  ExpertConsultationMethod[];

  primaryLocation?: ExpertPlace;

  serviceCoverage?:
  ExpertServiceCoverage;

  pricing?: {
    currency?: ExpertCurrency;

    consultationFee?: number;

    physicalVisitFeeFrom?:
    number | null;

    feeType?:
    ExpertFeeType;

    consultationDurationMinutes?:
    number;
  };

  terms?: {
    summary?: string;

    cancellationNoticeHours?:
    number;

    cancellationPolicy?: string;

    allowsRescheduling?:
    boolean;

    paymentRequiredBeforeBooking?:
    boolean;
  };

  rating?: {
    average?: number;
    count?: number;
  };

  completedConsultations?: number;

  acceptingBookings?: boolean;

  status?: string;
  isDiscoverable?: boolean;
};
function expertSafeNumber(
  value: unknown
): number | null {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function normalizeExpertStrings(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Map(
      value
        .map((item) =>
          String(item || "").trim()
        )
        .filter(Boolean)
        .map((item) => [
          item.toLowerCase(),
          item,
        ])
    ).values()
  );
}

function normalizeExpertPlace(
  value: unknown
): ExpertPlace {
  const location =
    value &&
      typeof value === "object"
      ? (value as Record<
        string,
        any
      >)
      : {};

  const legacyTown =
    String(
      location.town || ""
    ).trim();

  const legacyCounty =
    String(
      location.county || ""
    ).trim();

  const latitude =
    expertSafeNumber(
      location.coordinates
        ?.latitude
    ) ??
    expertSafeNumber(
      location.latitude
    );

  const longitude =
    expertSafeNumber(
      location.coordinates
        ?.longitude
    ) ??
    expertSafeNumber(
      location.longitude
    );

  const city =
    String(
      location.city ||
      legacyTown ||
      ""
    ).trim();

  const region =
    String(
      location.region ||
      legacyCounty ||
      ""
    ).trim();

  const country =
    String(
      location.country ||
      (legacyCounty
        ? "Kenya"
        : "")
    ).trim();

  return {
    placeId:
      String(
        location.placeId ||
        ""
      ) || null,

    label:
      String(
        location.label ||
        [
          city,
          region,
          country,
        ]
          .filter(Boolean)
          .join(", ")
      ).trim(),

    countryCode:
      String(
        location.countryCode ||
        (legacyCounty
          ? "KE"
          : "")
      )
        .trim()
        .toUpperCase(),

    country,
    region,
    city,

    locality: String(
      location.locality ||
      ""
    ).trim(),

    coordinates:
      latitude !== null &&
        longitude !== null
        ? {
          latitude,
          longitude,

          geohash:
            location.coordinates
              ?.geohash ||
            location.geohash ||
            null,
        }
        : null,

    timezone:
      String(
        location.timezone ||
        (legacyCounty
          ? "Africa/Nairobi"
          : "")
      ) || null,
  };
}

function normalizeServiceCoverage(
  value: unknown,
  primaryLocation: ExpertPlace,
  legacyCounties: string[]
): ExpertServiceCoverage {
  const coverage =
    value &&
      typeof value === "object"
      ? (value as Record<
        string,
        any
      >)
      : {};

  const serviceAreas =
    Array.isArray(
      coverage.serviceAreas
    )
      ? coverage.serviceAreas
        .map(
          (
            area: any,
            index: number
          ): ExpertServiceArea | null => {
            if (
              !area ||
              typeof area !==
              "object"
            ) {
              return null;
            }

            const type =
              area.type ===
                "country" ||
                area.type ===
                "region" ||
                area.type ===
                "city" ||
                area.type ===
                "radius"
                ? area.type
                : "region";

            const centerLatitude =
              expertSafeNumber(
                area.center
                  ?.latitude
              );

            const centerLongitude =
              expertSafeNumber(
                area.center
                  ?.longitude
              );

            return {
              id:
                String(
                  area.id ||
                  `area-${index}`
                ),

              type,

              label:
                String(
                  area.label ||
                  ""
                ).trim(),

              placeId:
                String(
                  area.placeId ||
                  ""
                ) || null,

              countryCode:
                String(
                  area.countryCode ||
                  ""
                )
                  .trim()
                  .toUpperCase(),

              country:
                String(
                  area.country ||
                  ""
                ).trim(),

              region:
                String(
                  area.region ||
                  ""
                ).trim(),

              city:
                String(
                  area.city ||
                  ""
                ).trim(),

              center:
                centerLatitude !==
                  null &&
                  centerLongitude !==
                  null
                  ? {
                    latitude:
                      centerLatitude,

                    longitude:
                      centerLongitude,

                    geohash:
                      area.center
                        ?.geohash ||
                      null,
                  }
                  : null,

              radiusKm:
                expertSafeNumber(
                  area.radiusKm
                ),
            };
          }
        )
        .filter(
          (
            area
          ): area is ExpertServiceArea =>
            area !== null
        )
      : [];

  const migratedAreas =
    serviceAreas.length > 0
      ? serviceAreas
      : legacyCounties.map(
        (
          county,
          index
        ): ExpertServiceArea => ({
          id:
            `legacy-county-${index}`,

          type: "region",

          label:
            `${county}, Kenya`,

          placeId: null,

          countryCode: "KE",
          country: "Kenya",

          region: county,
          city: "",

          center: null,

          radiusKm: null,
        })
      );

  const onlineCoverage =
    coverage.onlineCoverage ===
      "local" ||
      coverage.onlineCoverage ===
      "country" ||
      coverage.onlineCoverage ===
      "worldwide"
      ? coverage.onlineCoverage
      : "worldwide";

  return {
    offersOnlineServices:
      coverage
        .offersOnlineServices !==
      false,

    offersPhysicalVisits:
      coverage
        .offersPhysicalVisits ===
      true ||
      migratedAreas.length > 0,

    onlineCoverage,

    serviceAreas:
      migratedAreas,
  };
}
function usePublicExpertProfile(
  uid?: string
) {
  const [expert, setExpert] =
    React.useState<
      PublicExpertProfile | null
    >(null);

  const [loading, setLoading] =
    React.useState(true);

  React.useEffect(() => {
    if (!uid) {
      setExpert(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe =
      onSnapshot(
        doc(
          db,
          "publicExperts",
          uid
        ),
        (snapshot) => {
          if (!snapshot.exists()) {
            setExpert(null);
            setLoading(false);
            return;
          }

          const data =
            snapshot.data() as Record<
              string,
              any
            >;

          if (
            data.status !==
            "active" ||
            data.isDiscoverable !==
            true
          ) {
            setExpert(null);
            setLoading(false);
            return;
          }

          const primaryLocation =
            normalizeExpertPlace(
              data.primaryLocation
            );

          const countiesServed =
            normalizeExpertStrings(
              data.countiesServed
            );

          const serviceCoverage =
            normalizeServiceCoverage(
              data.serviceCoverage,
              primaryLocation,
              countiesServed
            );

          const allowedMethods:
            ExpertConsultationMethod[] =
            [
              "phone",
              "whatsapp",
              "video",
              "chat",
              "physical",
            ];

          const consultationMethods =
            normalizeExpertStrings(
              data.consultationMethods
            ).filter(
              (
                method
              ): method is ExpertConsultationMethod =>
                allowedMethods.includes(
                  method as ExpertConsultationMethod
                )
            );

          const verificationStatus:
            ExpertVerificationStatus =
            data.verificationStatus ===
              "payment_pending" ||
              data.verificationStatus ===
              "pending" ||
              data.verificationStatus ===
              "approved" ||
              data.verificationStatus ===
              "rejected" ||
              data.verificationStatus ===
              "expired"
              ? data.verificationStatus
              : data.verified === true
                ? "approved"
                : "none";

          const feeType:
            ExpertFeeType =
            data.pricing
              ?.feeType ===
              "starting_from" ||
              data.pricing
                ?.feeType ===
              "free"
              ? data.pricing
                .feeType
              : "fixed";

          const currency:
            ExpertCurrency =
            data.pricing
              ?.currency ===
              "USD"
              ? "USD"
              : "KES";

          setExpert({
            ...data,

            uid:
              data.uid ||
              snapshot.id,

            verificationStatus,

            verified:
              verificationStatus ===
              "approved",

            verificationType:
              data.verificationType ===
                "business" ||
                data.verificationType ===
                "company"
                ? data.verificationType
                : "individual",

            specialties:
              normalizeExpertStrings(
                data.specialties
              ),

            countiesServed,

            languages:
              normalizeExpertStrings(
                data.languages
              ),

            consultationMethods,

            primaryLocation,

            serviceCoverage,

            pricing: {
              currency,

              consultationFee:
                Number(
                  data.pricing
                    ?.consultationFee ||
                  0
                ),

              physicalVisitFeeFrom:
                expertSafeNumber(
                  data.pricing
                    ?.physicalVisitFeeFrom
                ),

              feeType,

              consultationDurationMinutes:
                Number(
                  data.pricing
                    ?.consultationDurationMinutes ||
                  0
                ),
            },

            terms: {
              summary:
                String(
                  data.terms
                    ?.summary ||
                  ""
                ),

              cancellationNoticeHours:
                Number(
                  data.terms
                    ?.cancellationNoticeHours ||
                  0
                ),

              cancellationPolicy:
                String(
                  data.terms
                    ?.cancellationPolicy ||
                  ""
                ),

              allowsRescheduling:
                data.terms
                  ?.allowsRescheduling !==
                false,

              paymentRequiredBeforeBooking:
                data.terms
                  ?.paymentRequiredBeforeBooking !==
                false,
            },

            rating: {
              average:
                Number(
                  data.rating
                    ?.average ||
                  0
                ),

              count:
                Number(
                  data.rating
                    ?.count ||
                  0
                ),
            },

            completedConsultations:
              Number(
                data.completedConsultations ||
                0
              ),
          });

          setLoading(false);
        },
        (error) => {
          console.warn(
            "public expert listener error:",
            error?.message ||
            error
          );

          setExpert(null);
          setLoading(false);
        }
      );

    return () =>
      unsubscribe();
  }, [uid]);

  return {
    expert,
    loading,
  };
}

function expertMethodLabel(
  method: string
) {
  if (method === "whatsapp") {
    return "WhatsApp";
  }

  if (method === "video") {
    return "Video consultation";
  }

  if (method === "physical") {
    return "Physical visit";
  }

  if (method === "phone") {
    return "Phone call";
  }

  if (method === "chat") {
    return "Ekarihub chat";
  }

  return method
    .replace(/[_-]+/g, " ")
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}
function formatExpertMoney(
  amount: number,
  currency:
    ExpertCurrency = "KES"
) {
  const value =
    Number(amount || 0);

  try {
    return new Intl.NumberFormat(
      currency === "KES"
        ? "en-KE"
        : "en-US",
      {
        style: "currency",
        currency,

        maximumFractionDigits:
          currency === "KES"
            ? 0
            : 2,
      }
    ).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}
function ExpertRatingDisplay({
  average,
  count,
  light = false,
}: {
  average: number;
  count: number;
  light?: boolean;
}) {
  const safeAverage = Math.max(
    0,
    Math.min(5, Number(average) || 0)
  );

  const safeCount = Math.max(
    0,
    Math.floor(Number(count) || 0)
  );

  const filledStarClass = light
    ? "text-amber-300"
    : "text-amber-400";

  const emptyStarClass = light
    ? "text-white/35"
    : "text-slate-300";

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
      aria-label={
        safeCount > 0
          ? `${safeAverage.toFixed(1)} out of 5 stars from ${safeCount} reviews`
          : "No reviews yet"
      }
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map(
          (_, index) => {
            const starNumber = index + 1;

            if (safeAverage >= starNumber) {
              return (
                <IoStar
                  key={index}
                  size={15}
                  className={filledStarClass}
                />
              );
            }

            if (
              safeAverage >=
              starNumber - 0.5
            ) {
              return (
                <IoStarHalf
                  key={index}
                  size={15}
                  className={filledStarClass}
                />
              );
            }

            return (
              <IoStarOutline
                key={index}
                size={15}
                className={emptyStarClass}
              />
            );
          }
        )}
      </div>

      {safeCount > 0 ? (
        <>
          <span
            className={
              light
                ? "text-sm font-black text-white"
                : "text-sm font-black text-slate-900"
            }
          >
            {safeAverage.toFixed(1)}
          </span>

          <span
            className={
              light
                ? "text-[11px] font-bold text-white/70"
                : "text-[11px] font-semibold text-slate-500"
            }
          >
            ({safeCount}{" "}
            {safeCount === 1
              ? "review"
              : "reviews"}
            )
          </span>
        </>
      ) : (
        <span
          className={
            light
              ? "text-xs font-bold text-white/70"
              : "text-xs font-bold text-slate-500"
          }
        >
          New
        </span>
      )}
    </div>
  );
}
function ExpertPublicSection({
  expert,
  profile,
  isOwner,
  onBook,
}: {
  expert: PublicExpertProfile;
  profile: Profile;
  isOwner: boolean;
  onBook: () => void;
}) {
  const feeType =
    expert.pricing?.feeType ||
    "fixed";

  const currency: ExpertCurrency =
    expert.pricing?.currency ===
      "USD"
      ? "USD"
      : "KES";

  const consultationFee =
    Number(
      expert.pricing
        ?.consultationFee || 0
    );

  const physicalVisitFee =
    expert.pricing
      ?.physicalVisitFeeFrom != null
      ? Number(
        expert.pricing
          .physicalVisitFeeFrom
      )
      : null;

  const feeText =
    feeType === "free"
      ? "Free consultation"
      : feeType ===
        "starting_from"
        ? `From ${formatExpertMoney(
          consultationFee,
          currency
        )}`
        : formatExpertMoney(
          consultationFee,
          currency
        );

  const locationText =
    expert.primaryLocation
      ?.label ||
    [
      expert.primaryLocation?.city,
      expert.primaryLocation?.region,
      expert.primaryLocation?.country,
    ]
      .filter(Boolean)
      .join(", ");

  const onlineCoverageLabel =
    expert.serviceCoverage
      ?.onlineCoverage ===
      "worldwide"
      ? "Worldwide online"
      : expert.serviceCoverage
        ?.onlineCoverage ===
        "country"
        ? expert.primaryLocation
          ?.country
          ? `Online across ${expert.primaryLocation.country}`
          : "Online nationwide"
        : "Online near location";

  const serviceAreaLabels =
    Array.from(
      new Set(
        (
          expert.serviceCoverage
            ?.serviceAreas || []
        )
          .map((area) =>
            String(
              area.label || ""
            ).trim()
          )
          .filter(Boolean)
      )
    );

  const physicalServiceText =
    serviceAreaLabels.join(", ");

  const ratingAverage =
    Number(
      profile.sellerReviewAvg ??
      expert.rating?.average ??
      0
    );

  const ratingCount =
    Number(
      profile.sellerReviewCount ??
      expert.rating?.count ??
      0
    );

  const completedConsultations =
    Number(
      expert.completedConsultations ||
      0
    );

  const consultationDuration =
    Number(
      expert.pricing
        ?.consultationDurationMinutes ||
      0
    );

  const verificationLabel =
    expert.verified
      ? "Verified expert"
      : "Unverified expert";

  const methodCount =
    expert.consultationMethods
      ?.length || 0;

  return (
    <section className="mx-auto mb-5 max-w-5xl px-3 md:px-4">
      <div
        className="overflow-hidden rounded-[24px] border bg-white shadow-[0_14px_44px_rgba(15,23,42,0.06)]"
        style={{
          borderColor: EKARI.hair,
        }}
      >
        {/* Compact expert header */}
        <div
          className="border-b px-4 py-4 md:px-6 md:py-5"
          style={{
            borderColor:
              EKARI.hair,
            backgroundColor:
              "#FFFFFF",
          }}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black",
                    expert.verified
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-600",
                  ].join(" ")}
                >
                  {expert.verified ? (
                    <IoShieldCheckmarkOutline
                      size={13}
                    />
                  ) : (
                    <IoInformationCircleOutline
                      size={13}
                    />
                  )}

                  {verificationLabel}
                </span>

                {expert.acceptingBookings !==
                  false ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black"
                    style={{
                      color:
                        EKARI.forest,
                      backgroundColor:
                        "rgba(35,63,57,0.09)",
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor:
                          EKARI.green,
                      }}
                    />

                    Accepting clients
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
                    Not accepting clients
                  </span>
                )}

                {expert.serviceCoverage
                  ?.offersOnlineServices ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                    <IoGlobeOutline
                      size={13}
                    />

                    {onlineCoverageLabel}
                  </span>
                ) : null}

                {expert.serviceCoverage
                  ?.offersPhysicalVisits ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">
                    <IoLocationOutline
                      size={13}
                    />

                    Physical visits
                  </span>
                ) : null}
              </div>

              <h2
                className="mt-3 text-xl font-black leading-tight md:text-2xl"
                style={{
                  color: EKARI.text,
                }}
              >
                {expert.headline ||
                  expert.verificationRoleLabel ||
                  expert.verificationRole ||
                  "Agricultural professional"}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
                {locationText ? (
                  <span
                    className="inline-flex min-w-0 items-center gap-1.5"
                    style={{
                      color:
                        EKARI.subtext,
                    }}
                  >
                    <IoLocationOutline
                      className="shrink-0"
                      size={15}
                    />

                    <span className="truncate">
                      {locationText}
                    </span>
                  </span>
                ) : null}

                {physicalServiceText ? (
                  <span
                    className="inline-flex min-w-0 items-center gap-1.5"
                    style={{
                      color:
                        EKARI.subtext,
                    }}
                    title={
                      physicalServiceText
                    }
                  >
                    <IoNavigateOutline
                      className="shrink-0"
                      size={15}
                    />

                    <span className="truncate">
                      Serves{" "}
                      {
                        physicalServiceText
                      }
                    </span>
                  </span>
                ) : null}

                {methodCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5"
                    style={{
                      color:
                        EKARI.subtext,
                    }}
                  >
                    <IoChatbubblesOutline
                      size={15}
                    />

                    {methodCount} consultation{" "}
                    {methodCount === 1
                      ? "method"
                      : "methods"}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Compact summary statistics */}
            <div className="grid grid-cols-3 gap-2 sm:min-w-[370px]">
              <div
                className="rounded-2xl border px-3 py-3 text-center"
                style={{
                  borderColor:
                    EKARI.hair,
                  backgroundColor:
                    "#F8FAFC",
                }}
              >
                <ExpertRatingDisplay
                  average={
                    ratingAverage
                  }
                  count={ratingCount}
                />

                <div
                  className="mt-1 text-[10px] font-bold"
                  style={{
                    color:
                      EKARI.subtext,
                  }}
                >
                  Rating
                </div>
              </div>

              <div
                className="rounded-2xl border px-3 py-3 text-center"
                style={{
                  borderColor:
                    EKARI.hair,
                  backgroundColor:
                    "#F8FAFC",
                }}
              >
                <div
                  className="text-base font-black"
                  style={{
                    color:
                      EKARI.text,
                  }}
                >
                  {completedConsultations.toLocaleString(
                    "en-KE"
                  )}
                </div>

                <div
                  className="mt-1 text-[10px] font-bold"
                  style={{
                    color:
                      EKARI.subtext,
                  }}
                >
                  Consultations
                </div>
              </div>

              <div
                className="rounded-2xl border px-3 py-3 text-center"
                style={{
                  borderColor:
                    EKARI.hair,
                  backgroundColor:
                    "rgba(199,146,87,0.08)",
                }}
              >
                <div
                  className="truncate text-sm font-black"
                  style={{
                    color:
                      EKARI.text,
                  }}
                  title={feeText}
                >
                  {feeText}
                </div>

                <div
                  className="mt-1 text-[10px] font-bold"
                  style={{
                    color:
                      EKARI.subtext,
                  }}
                >
                  Standard fee
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main expert details */}
        <div className="grid gap-5 p-4 md:grid-cols-[minmax(0,1fr)_285px] md:p-6">
          <div className="min-w-0 space-y-5">
            {expert.expertBio ? (
              <div>
                <h3
                  className="text-sm font-black"
                  style={{
                    color: EKARI.text,
                  }}
                >
                  About this expert
                </h3>

                <p
                  className="mt-2 whitespace-pre-line text-sm leading-6"
                  style={{
                    color:
                      EKARI.subtext,
                  }}
                >
                  {expert.expertBio}
                </p>
              </div>
            ) : null}

            {expert.specialties &&
              expert.specialties.length >
              0 ? (
              <div>
                <h3
                  className="text-sm font-black"
                  style={{
                    color: EKARI.text,
                  }}
                >
                  Areas of expertise
                </h3>

                <div className="mt-2 flex flex-wrap gap-2">
                  {expert.specialties.map(
                    (specialty) => (
                      <span
                        key={
                          specialty
                        }
                        className="rounded-full border px-3 py-1.5 text-xs font-bold"
                        style={{
                          borderColor:
                            "rgba(35,63,57,0.18)",
                          backgroundColor:
                            "rgba(35,63,57,0.06)",
                          color:
                            EKARI.forest,
                        }}
                      >
                        {specialty}
                      </span>
                    )
                  )}
                </div>
              </div>
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              {expert
                .consultationMethods &&
                expert
                  .consultationMethods
                  .length > 0 ? (
                <div>
                  <h3
                    className="text-sm font-black"
                    style={{
                      color:
                        EKARI.text,
                    }}
                  >
                    Consultation methods
                  </h3>

                  <div className="mt-2 grid gap-2">
                    {expert.consultationMethods.map(
                      (method) => (
                        <div
                          key={
                            method
                          }
                          className="flex items-center gap-2 text-sm font-semibold"
                          style={{
                            color:
                              EKARI.subtext,
                          }}
                        >
                          <IoCheckmarkDone
                            size={16}
                            color={
                              EKARI.green
                            }
                          />

                          {expertMethodLabel(
                            method
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : null}

              {expert.languages &&
                expert.languages.length >
                0 ? (
                <div>
                  <h3
                    className="text-sm font-black"
                    style={{
                      color:
                        EKARI.text,
                    }}
                  >
                    Languages
                  </h3>

                  <p
                    className="mt-2 text-sm leading-6"
                    style={{
                      color:
                        EKARI.subtext,
                    }}
                  >
                    {expert.languages.join(
                      ", "
                    )}
                  </p>
                </div>
              ) : null}
            </div>

            {physicalServiceText ? (
              <div>
                <h3
                  className="text-sm font-black"
                  style={{
                    color: EKARI.text,
                  }}
                >
                  Physical service area
                </h3>

                <p
                  className="mt-2 text-sm leading-6"
                  style={{
                    color:
                      EKARI.subtext,
                  }}
                >
                  {physicalServiceText}
                </p>
              </div>
            ) : expert.countiesServed &&
              expert.countiesServed
                .length > 0 ? (
              <div>
                <h3
                  className="text-sm font-black"
                  style={{
                    color: EKARI.text,
                  }}
                >
                  Service areas
                </h3>

                <p
                  className="mt-2 text-sm leading-6"
                  style={{
                    color:
                      EKARI.subtext,
                  }}
                >
                  {expert.countiesServed.join(
                    ", "
                  )}
                </p>
              </div>
            ) : null}

            {expert.terms?.summary ? (
              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor:
                    EKARI.hair,
                  backgroundColor:
                    "#F8FAFC",
                }}
              >
                <h3
                  className="text-sm font-black"
                  style={{
                    color: EKARI.text,
                  }}
                >
                  Consultation terms
                </h3>

                <p
                  className="mt-2 whitespace-pre-line text-sm leading-6"
                  style={{
                    color:
                      EKARI.subtext,
                  }}
                >
                  {expert.terms.summary}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-600">
                  {expert.terms
                    .cancellationNoticeHours ? (
                    <span>
                      Cancellation notice:{" "}
                      {
                        expert.terms
                          .cancellationNoticeHours
                      }{" "}
                      hours
                    </span>
                  ) : null}

                  {expert.terms
                    .allowsRescheduling ? (
                    <span>
                      Rescheduling allowed
                    </span>
                  ) : null}

                  {expert.terms
                    .paymentRequiredBeforeBooking ? (
                    <span>
                      Payment before
                      confirmation
                    </span>
                  ) : null}
                </div>

                {expert.terms
                  .cancellationPolicy ? (
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {
                      expert.terms
                        .cancellationPolicy
                    }
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Booking card */}
          <aside>
            <div
              className="sticky top-20 rounded-[22px] border p-4"
              style={{
                borderColor:
                  EKARI.hair,
                backgroundColor:
                  "#FFFFFF",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color:
                        EKARI.primary,
                    }}
                  >
                    Consultation
                  </p>

                  <div
                    className="mt-1 text-xl font-black"
                    style={{
                      color: EKARI.text,
                    }}
                  >
                    {feeText}
                  </div>
                </div>

                {consultationDuration >
                  0 ? (
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-black"
                    style={{
                      color:
                        EKARI.forest,
                      backgroundColor:
                        "rgba(35,63,57,0.08)",
                    }}
                  >
                    {
                      consultationDuration
                    }{" "}
                    min
                  </span>
                ) : null}
              </div>

              {physicalVisitFee !==
                null ? (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5 text-xs"
                  style={{
                    backgroundColor:
                      "rgba(199,146,87,0.10)",
                    color:
                      EKARI.text,
                  }}
                >
                  Physical visits from{" "}
                  <strong>
                    {formatExpertMoney(
                      physicalVisitFee,
                      currency
                    )}
                  </strong>
                </div>
              ) : null}

              <button
                type="button"
                onClick={onBook}
                disabled={
                  isOwner ||
                  expert.acceptingBookings ===
                  false
                }
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  backgroundColor:
                    EKARI.forest,
                }}
              >
                <IoCalendarClearOutline
                  size={17}
                />

                {isOwner
                  ? "Your expert profile"
                  : expert.acceptingBookings ===
                    false
                    ? "Not accepting clients"
                    : "Book consultation"}
              </button>

              {!isOwner &&
                expert.acceptingBookings !==
                false ? (
                <p
                  className="mt-3 text-center text-[10px] leading-4"
                  style={{
                    color:
                      EKARI.subtext,
                  }}
                >
                  Select a method, date
                  and time, then send
                  your request.
                </p>
              ) : null}

              {isOwner ? (
                <Link
                  href="/account/expert"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-xl border px-4 py-2.5 text-xs font-black"
                  style={{
                    borderColor:
                      EKARI.hair,
                    color:
                      EKARI.forest,
                  }}
                >
                  Manage expert profile
                </Link>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </section>
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
  const [myBookingsBadge, setMyBookingsBadge] =
    React.useState(0);

  const [expertBookingsBadge, setExpertBookingsBadge] =
    React.useState(0);
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
  const { expert: publicExpert, loading: loadingExpert } =
    usePublicExpertProfile(uid ?? undefined);

  const shouldHidePublicContent = profile?.isSuspended === true && !isOwner;

  const { items, likesFallback, loading: loadingDeeds } = useDeedsByAuthor(shouldHidePublicContent ? undefined :
    uid ?? undefined,
    isOwner
  );
  const followState = useFollowingState(user?.uid, uid ?? undefined);
  const likesValue = profile?.likesTotal ?? likesFallback;

  const mutual = useMutualFollow(user?.uid, uid ?? undefined);
  const canSeeContacts = isOwner || (!!user && mutual);
  const { partners, mutualPartners } = usePartnerStats(uid ?? undefined, user?.uid);
  React.useEffect(() => {
    if (!user?.uid || !isOwner) {
      setMyBookingsBadge(0);
      setExpertBookingsBadge(0);
      return;
    }

    const clientUnreadQuery = query(
      collection(db, "expertBookings"),
      where("clientId", "==", user.uid),
      where("clientUnread", "==", true)
    );

    const expertUnreadQuery = query(
      collection(db, "expertBookings"),
      where("expertId", "==", user.uid),
      where("expertUnread", "==", true)
    );

    const unsubscribeClient = onSnapshot(
      clientUnreadQuery,
      (snapshot) => {
        setMyBookingsBadge(snapshot.size);
      },
      (error) => {
        console.error(
          "CLIENT_BOOKINGS_BADGE_FAILED",
          error
        );

        setMyBookingsBadge(0);
      }
    );

    const unsubscribeExpert = onSnapshot(
      expertUnreadQuery,
      (snapshot) => {
        setExpertBookingsBadge(snapshot.size);
      },
      (error) => {
        console.error(
          "EXPERT_BOOKINGS_BADGE_FAILED",
          error
        );

        setExpertBookingsBadge(0);
      }
    );

    return () => {
      unsubscribeClient();
      unsubscribeExpert();
    };
  }, [user?.uid, isOwner]);
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
      <div className="min-h-screen w-full bg-[#F8F7F2]">
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
              myBookingsBadge={myBookingsBadge}
              expertBookingsBadge={expertBookingsBadge}
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

            <ProfessionalAccountSection
              profile={profile}
              isOwner={isOwner}
              myBookingsBadge={myBookingsBadge}
              expertBookingsBadge={expertBookingsBadge}
              hasPublishedExpertProfile={!!publicExpert}
            />

            {loadingExpert ? (
              <div className="mx-auto mb-6 max-w-5xl px-3 md:px-4">
                <div
                  className="animate-pulse rounded-[28px] border bg-white p-6"
                  style={{ borderColor: EKARI.hair }}
                >
                  <div className="h-5 w-40 rounded bg-slate-200" />
                  <div className="mt-4 h-8 w-3/4 rounded bg-slate-100" />
                  <div className="mt-5 h-24 rounded-2xl bg-slate-100" />
                </div>
              </div>
            ) : publicExpert ? (
              <ExpertPublicSection
                expert={publicExpert}
                profile={profile}
                isOwner={isOwner}
                onBook={() => {
                  if (!user?.uid) {
                    requireAuth();
                    return;
                  }

                  if (user.uid === profile.id) return;

                  router.push(
                    `/book-expert/${encodeURIComponent(
                      publicExpert.uid || profile.id
                    )}`
                  );
                }}
              />
            ) : null}

            {profile?.isSuspended && !isOwner ? (
              <div className="mx-auto max-w-[1040px] px-4 py-12 text-center text-sm text-slate-500">
                This account is currently suspended. Content is not available.
              </div>
            ) : (
              <>
                <SegmentedTabs value={tab} onChange={setTab} />
                <SectionHeader tab={tab} />
              </>
            )}
          </>
        ) : (
          <div
            className="flex p-6 items-center justify-center h-[60vh] w-full text-sm"
            style={{ color: EKARI.subtext }}
          >
            {uid === undefined ? <BouncingBallLoader /> : <BouncingBallLoader />}
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

            <>
              {profile?.isSuspended && !isOwner ? (
                <div className="px-3 md:px-6 py-16 text-center text-sm text-slate-500">
                  This account is currently suspended. Deeds are not available.
                </div>
              ) : (
                <VideosGrid
                  items={items}
                  handle={handleWithAt}
                  isOwner={isOwner}
                  loading={loadingDeeds}
                  showEmpty={showDeedsEmpty} // ✅ NEW
                />
              )}
            </>
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
  // ---- MOBILE: fixed viewport with independent profile scrolling ----
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">

        {/* Fixed top bar */}
        <div className="relative z-50 shrink-0 border-b border-white/10 bg-[#173C2E]/95 backdrop-blur-xl">
          <div
            className="flex h-14 items-center gap-2 px-3"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <button
              onClick={goBack}
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-white transition active:scale-95"
              aria-label="Back"
              title="Back"
            >
              <IoArrowBack size={20} color="#FFFFFF" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-black text-white">
                {handleWithAt}
              </div>

              <div className="truncate text-[11px] text-white/45">
                Profile
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>

        {/* SCROLLABLE PROFILE CONTENT */}
        <main
          className="
          min-h-0
          flex-1
          overflow-x-hidden
          overflow-y-auto
          overscroll-y-contain
          scroll-smooth
          [-webkit-overflow-scrolling:touch]
        "
        >
          {Body}

          {/* iPhone / mobile bottom safe area */}
          <div
            className="shrink-0"
            style={{
              height: "max(16px, env(safe-area-inset-bottom))",
            }}
          />
        </main>
      </div>
    );
  }


  // ---- DESKTOP ----
  return (
    <AppShell>
      <main
        className="
        h-full
        min-h-0
        w-full
        overflow-x-hidden
        overflow-y-auto
        scroll-smooth
        bg-[#F8F7F2]
      "
      >
        {Body}
      </main>
    </AppShell>
  );
}