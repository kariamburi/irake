// app/studio/analytics/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

import TikBallsLoader from "@/components/ui/TikBallsLoader";
import {
  IoTimeOutline,
  IoAnalyticsOutline,
  IoEyeOutline,
  IoHeartOutline,
  IoShareOutline,
  IoBookmarkOutline,
  IoCheckmarkCircle,
  IoLockOpenOutline,
  IoChatbubbleOutline,
  IoPlayOutline,
  IoSparklesOutline,
  IoChevronForward,
  IoTrendingUpOutline,
  IoPricetagOutline,
  IoInformationCircleOutline,
} from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import StudioShell from "../../components/StudioShell";
import { DeedDoc } from "@/lib/fire-queries";
import AppShell from "@/app/components/AppShell";
import { motion, AnimatePresence } from "framer-motion";

/** Avoid static optimization since we read client-side */
export const dynamic = "force-dynamic";

/* ---------------- Premium theme ---------------- */
const EKARI = {
  forest: "#173C2E",
  leaf: "#214C3A",
  gold: "#F39A22",
  sand: "#F8F7F2",
  paper: "#FBFAF6",
  hair: "#DDD8CC",
  text: "#0F172A",
  dim: "#64748B",
};

const UI = {
  radius: "18px",
  radiusSm: "14px",
  border: "#DDD8CC",
  card: "#FBFAF6",
  cardSolid: "#FBFAF6",
  soft: "#F3F1EB",
  shadow: "0 16px 38px rgba(15,23,42,0.06)",
  shadow2: "0 10px 28px rgba(15,23,42,0.025)",
  gradient: "#F8F7F2",
};

/* ---------------- responsive helpers ---------------- */
function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
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

/* ----------------------------- Helpers ---------------------------- */
const nfmt = (
  input: number | string | null | undefined = 0
) => {
  const n = Number(input ?? 0);

  if (!Number.isFinite(n)) {
    return "0";
  }

  return n >= 1_000_000
    ? `${(n / 1_000_000)
      .toFixed(1)
      .replace(/\.0$/, "")}M`
    : n >= 1_000
      ? `${(n / 1_000)
        .toFixed(1)
        .replace(/\.0$/, "")}K`
      : `${n}`;
};

const durHHMMSS = (sec = 0) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(ss)}`;
};

const postedDateStr = (d?: Timestamp | number) => {
  if (!d) return "—";
  const dt =
    typeof d === "number" ? new Date(d) : (d as Timestamp).toDate?.() ?? new Date();
  return dt.toLocaleDateString();
};

function safeUserHandleToPath(handleMaybe?: string | null) {
  const h = String(handleMaybe || "").trim();
  if (!h) return "";
  const withAt = h.startsWith("@") ? h : `@${h}`;
  return `/${encodeURIComponent(withAt)}`;
}

/* ---------------- UI primitives ---------------- */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
  solid?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={[
        "overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]",
        "shadow-[0_10px_28px_rgba(15,23,42,0.025)]",
        className,
      ].join(" ")}
    >
      {children}
    </motion.div>
  );
}

function Chip({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black",
        active
          ? "border-[#F3D7B2] bg-[#FFF4E3] text-[#9A5A08]"
          : "border-[#D9D3C7] bg-[#F3F1EB] text-slate-500",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function StatPill({
  icon,
  value,
  title,
}: {
  icon: React.ReactNode;
  value: number;
  title: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[#D9D3C7] bg-[#F3F1EB] px-2.5 py-1 text-[9px] font-black text-slate-600"
      title={title}
    >
      <span className="text-[#F39A22]">
        {icon}
      </span>
      {nfmt(value)}
    </span>
  );
}

function PremiumButton({
  href,
  onClick,
  children,
  variant = "primary",
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const classes = [
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-[10px] font-black transition",
    variant === "primary"
      ? "bg-[#F39A22] text-white hover:-translate-y-0.5 hover:bg-[#E98C12]"
      : "border border-[#D9D3C7] bg-white text-[#173C2E] hover:bg-[#EEF3EE]",
    className,
  ].join(" ");

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={classes}
    >
      {children}
    </button>
  );
}

function Kpi({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="rounded-[16px] border border-[#E4DED2] bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
            {title}
          </div>

          <div className="mt-1 truncate text-[20px] font-black tracking-[-0.03em] text-[#173C2E]">
            {value}
          </div>
        </div>

        {icon ? (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
            {icon}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function SafePoster({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const hasImage =
    !!src?.trim() && !failed;

  return (
    <div className="relative h-[128px] w-[92px] shrink-0 overflow-hidden rounded-[14px] border border-[#DDD8CC] bg-[#E8ECE8] sm:h-[150px] sm:w-[106px]">
      {hasImage ? (
        <Image
          src={src || ""}
          alt={alt}
          fill
          sizes="106px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-[#173C2E]">
          <IoPlayOutline size={25} />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
    </div>
  );
}

function RailStat({
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
          {nfmt(value)}
        </span>
      </div>

      <div className="mt-2 text-[8px] font-black uppercase tracking-[0.07em] text-slate-400">
        {label}
      </div>
    </div>
  );
}

/* ----------------------------- Page ------------------------------- */
export default function AnalyticsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deedId = params?.id;

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const goBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/studio/deeds");
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [deed, setDeed] = useState<any | null>(null);

  useEffect(() => {
    if (!deedId) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const dref = doc(db, "deeds", deedId);
        const dsnap = await getDoc(dref);
        const deedDoc = dsnap.exists()
          ? ({ id: dsnap.id, ...(dsnap.data() as any) } as DeedDoc)
          : null;
        if (!alive) return;
        setDeed(deedDoc);
      } catch (e) {
        console.error("[analytics-lite] load error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [deedId]);

  const poster =
    deed?.media?.[0]?.thumbUrl ||
    (deed as any)?.mediaThumbUrl ||
    "/video-placeholder.jpg";

  const statTiles = useMemo(() => {
    const s = deed?.stats ?? {};
    const tiles: { key: string; label: string; value: number; icon: React.ReactNode }[] = [];

    const maybePush = (
      key: string,
      label: string,
      raw: unknown,
      icon: React.ReactNode
    ) => {
      const value = Number(raw ?? 0);

      if (Number.isFinite(value)) {
        tiles.push({
          key,
          label,
          value,
          icon,
        });
      }
    };

    maybePush("views", "Views", s.views, <IoEyeOutline />);
    maybePush("comments", "Comments", s.comments, <IoChatbubbleOutline />);
    maybePush("likes", "Likes", s.likes, <IoHeartOutline />);
    maybePush("shares", "Shares", s.shares, <IoShareOutline />);
    maybePush("saves", "Saves", s.saves, <IoBookmarkOutline />);
    maybePush("completions", "Completions", s.completions, <IoCheckmarkCircle />);

    return tiles;
  }, [deed?.stats]);

  const updatedOn = useMemo(() => {
    const raw =
      (deed as any)?.updatedAt?.toDate?.() ??
      (deed as any)?.updatedAt ??
      Date.now();
    return new Date(raw).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [deed]);

  const deedPath = useMemo(() => {
    const handlePath = safeUserHandleToPath(
      deed?.authorUsername || (deed as any)?.authorHandle || ""
    );
    if (!handlePath || !deedId) return "";
    return `${handlePath}/deed/${encodeURIComponent(deedId)}`;
  }, [deed?.authorUsername, deedId]);

  const captionText = deed?.caption || deed?.text || "Untitled Deed";
  const createdAtRaw = (deed as any)?.createdAt ?? (deed as any)?.createdAtMs;
  const durationSec = Number(deed?.durationSec || deed?.media?.[0]?.durationSec || 0);

  /* ---------------- Header ---------------- */
  const Header = (
    <motion.header
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="relative overflow-hidden bg-[#173C2E] text-white"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
        }}
      />

      <div className={isDesktop ? "mx-auto max-w-[1180px] px-4 sm:px-5 md:px-6" : "px-3"}>
        <div className="relative flex min-h-[96px] items-center gap-3 py-4">
          <button
            type="button"
            onClick={goBack}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
              Deed studio
            </div>

            <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-[22px] font-black tracking-[-0.03em] sm:text-[25px]">
                  Deed analytics
                </h1>

                <p className="mt-1 text-[10px] font-medium text-white/50 sm:text-[11px]">
                  Review the performance and details of this individual deed.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Chip>
                  Updated {updatedOn}
                </Chip>

                {!!deedPath ? (
                  <PremiumButton
                    href={deedPath}
                    variant="primary"
                  >
                    <IoEyeOutline size={14} />
                    Open deed
                  </PremiumButton>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );

  const Body = (
    <div className={isDesktop ? "mx-auto max-w-[1180px] px-4 pb-10 pt-4 sm:px-5 md:px-6" : "px-3 pb-10 pt-3"}>
      {loading ? (
        <div className="grid min-h-[360px] place-items-center">
          <div className="text-center">
            <TikBallsLoader />

            <p className="mt-3 text-[10px] font-semibold text-slate-400">
              Loading deed analytics…
            </p>
          </div>
        </div>
      ) : !deed ? (
        <div className="grid min-h-[360px] place-items-center">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
              <IoAnalyticsOutline size={23} />
            </div>

            <div className="mt-4 text-[15px] font-black text-slate-800">
              Deed not found
            </div>

            <p className="mt-1 text-[10px] font-medium text-slate-400">
              This deed may have been removed or is no longer available.
            </p>

            <PremiumButton
              href="/studio/deeds"
              variant="ghost"
              className="mt-4"
            >
              Back to deeds
            </PremiumButton>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px] xl:items-start">
          <section className="min-w-0 space-y-4">
            {/* Deed summary */}
            <Card>
              <div className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <SafePoster
                    src={poster}
                    alt={captionText}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase tracking-[0.09em] text-[#F39A22]">
                      Deed overview
                    </div>

                    <h2 className="mt-1 line-clamp-3 text-[16px] font-black leading-6 text-slate-900 sm:text-[18px]">
                      {captionText}
                    </h2>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Chip>
                        <IoTimeOutline size={11} />
                        Posted {postedDateStr(createdAtRaw)}
                      </Chip>

                      {deed?.visibility ? (
                        <Chip>
                          <IoLockOpenOutline size={11} />
                          {String(deed.visibility)}
                        </Chip>
                      ) : null}

                      {deed?.status ? (
                        <Chip active>
                          <IoCheckmarkCircle size={11} />
                          {String(deed.status)}
                        </Chip>
                      ) : null}
                    </div>

                    {statTiles.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {statTiles.slice(0, 6).map((stat) => (
                          <StatPill
                            key={stat.key}
                            icon={stat.icon}
                            value={Number(stat.value || 0)}
                            title={stat.label}
                          />
                        ))}
                      </div>
                    ) : null}

                    {!!deedPath ? (
                      <Link
                        href={deedPath}
                        className="mt-3 inline-flex items-center gap-1 text-[10px] font-black text-[#173C2E] hover:underline"
                      >
                        View public deed
                        <IoChevronForward size={12} />
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>

            {/* Main performance metrics */}
            {statTiles.length > 0 ? (
              <Card>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                        Performance
                      </div>

                      <h2 className="mt-1 text-[15px] font-black text-slate-900">
                        Engagement metrics
                      </h2>
                    </div>

                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF4E3] text-[#F39A22]">
                      <IoTrendingUpOutline size={16} />
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {statTiles.map((stat) => (
                      <motion.div
                        key={stat.key}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16 }}
                        className="rounded-[14px] border border-[#E4DED2] bg-white px-3 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#F39A22]">
                            {stat.icon}
                          </span>

                          <span className="text-[17px] font-black tracking-[-0.03em] text-[#173C2E]">
                            {nfmt(stat.value)}
                          </span>
                        </div>

                        <div className="mt-2 text-[8px] font-black uppercase tracking-[0.07em] text-slate-400">
                          {stat.label}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : null}

            {/* Technical/content KPIs */}
            <Card>
              <div className="p-4 sm:p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                  Content details
                </div>

                <h2 className="mt-1 text-[15px] font-black text-slate-900">
                  Media performance
                </h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Kpi
                    title="Video duration"
                    value={durHHMMSS(durationSec)}
                    icon={<IoPlayOutline size={16} />}
                  />

                  <Kpi
                    title="Watch time"
                    value={durHHMMSS(
                      Math.floor(
                        Number(
                          deed?.stats?.watchMs ?? 0
                        ) / 1000
                      )
                    )}
                    icon={<IoTimeOutline size={16} />}
                  />

                  <Kpi
                    title="Type"
                    value={String(
                      deed?.type ||
                      deed?.media?.[0]?.mediaType ||
                      "—"
                    )}
                    icon={<IoAnalyticsOutline size={16} />}
                  />
                </div>
              </div>
            </Card>

            {/* Tags */}
            {Array.isArray(deed?.tags) &&
              deed.tags.length > 0 ? (
              <Card>
                <div className="p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                      <IoPricetagOutline size={16} />
                    </span>

                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                        Discovery
                      </div>

                      <h2 className="mt-0.5 text-[13px] font-black text-slate-900">
                        Tags
                      </h2>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {deed.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[#D9D3C7] bg-[#F3F1EB] px-2.5 py-1 text-[9px] font-black text-[#173C2E]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            ) : null}

            {/* Bottom actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/studio/deeds"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
              >
                ← Back to deeds
              </Link>

              {!!deedPath ? (
                <PremiumButton
                  href={deedPath}
                  variant="primary"
                >
                  <IoEyeOutline size={14} />
                  View deed
                </PremiumButton>
              ) : null}
            </div>
          </section>

          {/* Right rail */}
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
                Performance snapshot
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <RailStat
                  label="Views"
                  value={Number(
                    deed?.stats?.views ?? 0
                  )}
                  icon={<IoEyeOutline size={14} />}
                />

                <RailStat
                  label="Likes"
                  value={Number(
                    deed?.stats?.likes ?? 0
                  )}
                  icon={<IoHeartOutline size={14} />}
                />

                <RailStat
                  label="Comments"
                  value={Number(
                    deed?.stats?.comments ?? 0
                  )}
                  icon={<IoChatbubbleOutline size={14} />}
                />

                <RailStat
                  label="Shares"
                  value={Number(
                    deed?.stats?.shares ?? 0
                  )}
                  icon={<IoShareOutline size={14} />}
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
                    Performance tip
                  </div>

                  <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
                    Compare views with likes, comments and shares to understand whether reach is translating into engagement.
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
                    Deed state
                  </div>

                  <div className="mt-2 space-y-1.5 text-[10px] font-semibold text-slate-500">
                    <div className="flex items-center justify-between gap-2">
                      <span>Visibility</span>
                      <span className="font-black text-slate-700">
                        {String(
                          deed?.visibility || "—"
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span>Status</span>
                      <span className="font-black text-slate-700">
                        {String(
                          deed?.status || "—"
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span>Updated</span>
                      <span className="font-black text-slate-700">
                        {updatedOn}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <Link
              href="/studio/deeds"
              className="flex h-11 w-full items-center justify-between rounded-[16px] border border-[#DDD8CC] bg-[#FBFAF6] px-4 text-[10px] font-black text-[#173C2E] shadow-[0_10px_28px_rgba(15,23,42,0.025)] transition hover:bg-[#EEF3EE]"
            >
              Manage deeds
              <IoChevronForward size={14} />
            </Link>
          </motion.aside>
        </div>
      )}

      {isMobile ? (
        <div
          style={{
            height:
              "env(safe-area-inset-bottom)",
          }}
        />
      ) : null}
    </div>
  );

  // MOBILE
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex min-h-0 flex-col overflow-hidden bg-[#F8F7F2]">
        {Header}

        <div
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
          style={{
            WebkitOverflowScrolling:
              "touch",
            touchAction: "pan-y",
          }}
        >
          {Body}
        </div>
      </div>
    );
  }

  // DESKTOP
  return (
    <AppShell>
      <div
        className="h-full overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#F8F7F2]"
        style={{
          WebkitOverflowScrolling:
            "touch",
          touchAction: "pan-y",
        }}
      >
        <StudioShell
          title="Analytics"
          ctaHref="/studio/upload"
          ctaLabel="Upload"
        >
          {Header}
          {Body}
        </StudioShell>
      </div>
    </AppShell>
  );
}