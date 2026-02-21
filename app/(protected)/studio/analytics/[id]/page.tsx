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
} from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import StudioShell from "../../components/StudioShell";
import { DeedDoc } from "@/lib/fire-queries";
import AppShell from "@/app/components/AppShell";

/** Avoid static optimization since we read client-side */
export const dynamic = "force-dynamic";

/* ---------------- Premium theme ---------------- */
const EKARI = {
  forest: "#233F39",
  leaf: "#1F3A34",
  gold: "#C79257",
  sand: "#FFFFFF",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
};

const UI = {
  radius: "24px",
  radiusSm: "16px",
  border: "rgba(15,23,42,0.08)",
  card: "rgba(255,255,255,0.86)",
  cardSolid: "#FFFFFF",
  soft: "rgba(15,23,42,0.03)",
  shadow: "0 18px 50px -28px rgba(16,24,40,0.35)",
  shadow2: "0 10px 30px -18px rgba(16,24,40,0.25)",
  gradient:
    "radial-gradient(900px 500px at 15% -10%, rgba(199,146,87,0.18), transparent 55%), radial-gradient(900px 500px at 85% 0%, rgba(35,63,57,0.14), transparent 55%), linear-gradient(180deg, #ffffff 0%, #fbfbfd 70%, #f7f8fb 100%)",
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
const nfmt = (n = 0) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
      : `${n}`;

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

/* ---------------- Premium UI primitives ---------------- */
function Card({
  children,
  className = "",
  solid,
}: {
  children: React.ReactNode;
  className?: string;
  solid?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        borderRadius: UI.radius,
        border: `1px solid ${UI.border}`,
        background: solid ? UI.cardSolid : UI.card,
        boxShadow: UI.shadow2,
        backdropFilter: "blur(14px)",
      }}
    >
      {children}
    </div>
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
      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold"
      style={{
        borderRadius: "999px",
        border: `1px solid ${active ? "rgba(199,146,87,0.45)" : UI.border}`,
        background: active ? "rgba(199,146,87,0.10)" : UI.soft,
        color: active ? EKARI.text : EKARI.dim,
      }}
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-extrabold"
      style={{
        borderRadius: "999px",
        border: `1px solid ${UI.border}`,
        background: "rgba(255,255,255,0.75)",
        color: EKARI.text,
      }}
      title={title}
    >
      <span style={{ color: EKARI.dim }}>{icon}</span>
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
  const base =
    "inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-extrabold transition active:scale-[0.99] focus:outline-none";
  const style: React.CSSProperties =
    variant === "primary"
      ? {
        color: "white",
        borderRadius: UI.radiusSm,
        background: `linear-gradient(135deg, ${EKARI.gold} 0%, #e1b27a 45%, ${EKARI.forest} 140%)`,
        boxShadow: "0 16px 40px -24px rgba(199,146,87,0.55)",
      }
      : {
        color: EKARI.text,
        borderRadius: UI.radiusSm,
        border: `1px solid ${UI.border}`,
        background: "rgba(255,255,255,0.72)",
        boxShadow: UI.shadow2,
      };

  if (href) {
    return (
      <Link href={href} className={`${base} ${className}`} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={`${base} ${className}`} style={style}>
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
    <div
      className="p-4"
      style={{
        borderRadius: UI.radius,
        border: `1px solid ${UI.border}`,
        background: "rgba(255,255,255,0.82)",
        boxShadow: "0 10px 30px -22px rgba(16,24,40,0.20)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: EKARI.dim }}>
            {title}
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight truncate" style={{ color: EKARI.text }}>
            {value}
          </div>
        </div>
        {icon ? (
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
            style={{
              border: `1px solid ${UI.border}`,
              background: "rgba(35,63,57,0.06)",
              color: EKARI.forest,
            }}
          >
            {icon}
          </div>
        ) : null}
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

    if (typeof s.views === "number") tiles.push({ key: "views", label: "Views", value: s.views, icon: <IoEyeOutline /> });
    if (typeof s.comments === "number") tiles.push({ key: "comments", label: "Comments", value: s.comments, icon: <IoChatbubbleOutline /> });
    if (typeof s.likes === "number") tiles.push({ key: "likes", label: "Likes", value: s.likes, icon: <IoHeartOutline /> });
    if (typeof s.shares === "number") tiles.push({ key: "shares", label: "Shares", value: s.shares, icon: <IoShareOutline /> });
    if (typeof s.saves === "number") tiles.push({ key: "saves", label: "Saves", value: s.saves, icon: <IoBookmarkOutline /> });
    if (typeof s.completions === "number") tiles.push({ key: "completions", label: "Completions", value: s.completions, icon: <IoCheckmarkCircle /> });

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

  /* ---------------- Premium Header ---------------- */
  const Header = (
    <div
      className="sticky top-0 z-50 backdrop-blur-xl"
      style={{
        background: "rgba(255,255,255,0.75)",
        borderBottom: `1px solid ${UI.border}`,
        boxShadow: "0 8px 30px -22px rgba(16,24,40,0.35)",
      }}
    >
      <div className={isDesktop ? "h-14 px-4 max-w-[1180px] mx-auto" : "h-14 px-3"}>
        <div className="h-full flex items-center justify-between gap-2">
          <button
            onClick={goBack}
            className="h-10 w-10 rounded-full grid place-items-center transition active:scale-[0.98]"
            style={{
              background: "rgba(255,255,255,0.75)",
              border: `1px solid ${UI.border}`,
              boxShadow: "0 10px 24px -18px rgba(16,24,40,0.35)",
            }}
            aria-label="Go back"
            title="Back"
          >
            <ArrowLeft size={18} style={{ color: EKARI.text }} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-black text-[18px] leading-none truncate" style={{ color: EKARI.text }}>
              Analytics
            </div>
            <div className="text-[11px] mt-0.5 truncate" style={{ color: EKARI.dim }}>
              Deed overview
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <Chip>Updated {updatedOn}</Chip>
            {!!deedPath && (
              <PremiumButton href={deedPath} variant="ghost">
                <IoEyeOutline /> Open
              </PremiumButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const Body = (
    <div className={isDesktop ? "max-w-[1180px] mx-auto px-4 pb-10" : "px-3 pb-10"}>
      {loading ? (
        <div className={isDesktop ? "py-16" : "py-10"}>
          <TikBallsLoader />
        </div>
      ) : !deed ? (
        <div className="py-10 text-sm" style={{ color: EKARI.dim }}>
          Deed not found.
        </div>
      ) : (
        <div className="w-full">
          {/* Title row */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <IoAnalyticsOutline className="shrink-0" style={{ color: EKARI.dim }} />
              <h1 className="text-xl font-black truncate" style={{ color: EKARI.text }}>
                Deed overview
              </h1>
            </div>
            <div className="sm:hidden">
              <Chip>Updated {updatedOn}</Chip>
            </div>
          </div>

          {/* Hero card */}
          <Card className="mt-4" solid>
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <div
                  className="relative h-20 w-14 sm:h-24 sm:w-16 overflow-hidden shrink-0"
                  style={{
                    borderRadius: UI.radiusSm,
                    border: `1px solid ${UI.border}`,
                    background: "rgba(15,23,42,0.04)",
                    boxShadow: "0 14px 34px -26px rgba(16,24,40,0.35)",
                  }}
                >
                  <Image src={poster} alt="thumb" fill className="object-cover" sizes="64px" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm sm:text-base font-black" style={{ color: EKARI.text }}>
                    {captionText}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: EKARI.dim }}>
                    <span className="inline-flex items-center gap-1">
                      <IoTimeOutline />
                      Posted {postedDateStr(createdAtRaw)}
                    </span>

                    {deed?.visibility ? (
                      <span className="inline-flex items-center gap-1">
                        <IoLockOpenOutline />
                        {String(deed.visibility)}
                      </span>
                    ) : null}

                    {deed?.status ? (
                      <span className="inline-flex items-center gap-1">
                        <IoCheckmarkCircle />
                        {String(deed.status)}
                      </span>
                    ) : null}

                    {!!deedPath ? (
                      <Link
                        href={deedPath}
                        className="font-extrabold underline-offset-2 hover:underline"
                        style={{ color: EKARI.text }}
                      >
                        Open deed
                      </Link>
                    ) : null}
                  </div>

                  {/* Quick pills */}
                  {statTiles.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {statTiles.slice(0, 6).map((s) => (
                        <StatPill key={s.key} icon={s.icon} value={s.value} title={s.label} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Stat grid */}
              {statTiles.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {statTiles.map((s) => (
                    <div
                      key={s.key}
                      className="p-3"
                      style={{
                        borderRadius: UI.radius,
                        border: `1px solid ${UI.border}`,
                        background: "rgba(255,255,255,0.78)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-xs font-extrabold" style={{ color: EKARI.dim }}>
                          <span style={{ color: EKARI.forest }}>{s.icon}</span>
                          {s.label}
                        </div>
                        <div className="text-sm font-black" style={{ color: EKARI.text }}>
                          {nfmt(s.value)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* KPI row */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi
              title="Video duration"
              value={durHHMMSS(durationSec)}
              icon={<IoPlayOutline />}
            />
            <Kpi
              title="Watch time"
              value={durHHMMSS(Math.floor(((deed?.stats?.watchMs as number) || 0) / 1000))}
              icon={<IoTimeOutline />}
            />
            {/**    <Kpi
              title="Country"
              value={String(deed?.countryTag || deed?.countryCode || "—")}
            />
            <Kpi
              title="County"
              value={String(deed?.countyTag || "—")}
            />*/}
            <Kpi
              title="Type"
              value={String(deed?.type || deed?.media?.[0]?.mediaType || "—")}
            />
          </div>

          {/* Tags */}
          {Array.isArray(deed?.tags) && deed.tags.length > 0 && (
            <Card className="mt-6" solid>
              <div className="p-4 sm:p-5">
                <div className="mb-3 text-sm font-black" style={{ color: EKARI.text }}>
                  Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {deed.tags.map((t: string) => (
                    <span
                      key={t}
                      className="px-2.5 py-1 text-xs font-extrabold"
                      style={{
                        borderRadius: "999px",
                        border: `1px solid ${UI.border}`,
                        background: "rgba(35,63,57,0.06)",
                        color: EKARI.text,
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between">
            <Link
              href="/studio/deeds"
              className="text-sm font-extrabold underline-offset-4 hover:underline"
              style={{ color: EKARI.text }}
            >
              ← Back to deeds
            </Link>

            {!!deedPath && (
              <div className="flex items-center gap-2">
                <PremiumButton href={deedPath} variant="primary">
                  <IoEyeOutline /> View deed
                </PremiumButton>
              </div>
            )}
          </div>

          {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
        </div>
      )}
    </div>
  );

  // MOBILE: fixed inset
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ background: UI.gradient }}>
        {Header}
        <div className="flex-1 overflow-y-auto overscroll-contain">{Body}</div>
      </div>
    );
  }

  // DESKTOP: AppShell + StudioShell
  return (
    <AppShell>
      <div style={{ background: UI.gradient, minHeight: "100dvh" }}>
        <StudioShell>
          {Header}
          {Body}
        </StudioShell>
      </div>
    </AppShell>
  );
}