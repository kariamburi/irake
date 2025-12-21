// app/studio/analytics/[id]/page.tsx  (or wherever this file lives)
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
} from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import StudioShell from "../../components/StudioShell";
import { DeedDoc } from "@/lib/fire-queries";
import AppShell from "@/app/components/AppShell";

/** Avoid static optimization since we read client-side */
export const dynamic = "force-dynamic";

/* ---------------- theme ---------------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  sand: "#FFFFFF",
};

/* ---------------- responsive helpers (same style as discussion page) ---------------- */
function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
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

/* ----------------------------- Page ------------------------------- */
export default function AnalyticsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const deedId = params?.id;

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const ringStyle: React.CSSProperties = {
    ["--tw-ring-color" as any]: EKARI.forest,
  };

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
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
    deed?.media?.[0]?.thumbUrl || (deed as any)?.mediaThumbUrl || "/video-placeholder.jpg";

  // Build header stat tiles from ONLY what exists on deed.stats
  const statTiles = useMemo(() => {
    const s = deed?.stats ?? {};
    const tiles: { key: string; label: string; value: string; icon: React.ReactNode }[] = [];

    if (typeof s.views === "number") {
      tiles.push({ key: "views", label: "Views", value: nfmt(s.views), icon: <IoEyeOutline /> });
    }
    if (typeof s.comments === "number") {
      tiles.push({
        key: "comments",
        label: "Comments",
        value: nfmt(s.comments),
        icon: <IoChatbubbleOutline />,
      });
    }
    if (typeof s.likes === "number") {
      tiles.push({ key: "likes", label: "Likes", value: nfmt(s.likes), icon: <IoHeartOutline /> });
    }
    if (typeof s.shares === "number") {
      tiles.push({ key: "shares", label: "Shares", value: nfmt(s.shares), icon: <IoShareOutline /> });
    }
    if (typeof s.saves === "number") {
      tiles.push({
        key: "saves",
        label: "Saves",
        value: nfmt(s.saves),
        icon: <IoBookmarkOutline />,
      });
    }
    if (typeof s.completions === "number") {
      tiles.push({
        key: "completions",
        label: "Completions",
        value: nfmt(s.completions),
        icon: <IoCheckmarkCircle />,
      });
    }
    return tiles;
  }, [deed?.stats]);

  const updatedOn = useMemo(() => {
    const raw = (deed as any)?.updatedAt?.toDate?.() ?? (deed as any)?.updatedAt ?? Date.now();
    return new Date(raw).toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
  }, [deed]);

  const deedPath = useMemo(() => {
    const handlePath = safeUserHandleToPath(deed?.authorUsername || (deed as any)?.authorHandle || "");
    if (!handlePath || !deedId) return "";
    // keep your existing pattern: /@handle/video/:id (you can switch to /deed/:id if that’s your route)
    return `${handlePath}/video/${encodeURIComponent(deedId)}`;
  }, [deed?.authorUsername, deedId]);

  const Header = (
    <div
      className="border-b sticky top-0 z-50 backdrop-blur"
      style={{ backgroundColor: "rgba(255,255,255,0.92)", borderColor: EKARI.hair }}
    >
      <div className={isDesktop ? "h-14 px-4 max-w-[1180px] mx-auto" : "h-14 px-3"}>
        <div className="h-full flex items-center justify-between gap-2">
          <button
            onClick={goBack}
            className="p-2 rounded-xl border transition hover:bg-black/5 focus:outline-none focus:ring-2"
            style={{ borderColor: EKARI.hair, ...ringStyle }}
            aria-label="Go back"
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

          <div className="text-[11px] font-semibold whitespace-nowrap" style={{ color: EKARI.dim }}>
            Updated {updatedOn}
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
          {/* Title bar (inside content, like your other pages) */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <IoAnalyticsOutline className="shrink-0" style={{ color: EKARI.dim }} />
              <h1 className="text-xl font-extrabold truncate" style={{ color: EKARI.text }}>
                Deed overview
              </h1>
            </div>
          </div>

          {/* Deed header card */}
          <div className="mt-4 rounded-2xl border bg-white p-3 sm:p-4" style={{ borderColor: EKARI.hair }}>
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-10 overflow-hidden rounded-lg bg-gray-200 shrink-0">
                <Image src={poster} alt="thumb" fill className="object-cover" sizes="40px" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold" style={{ color: EKARI.text }}>
                  {deed?.caption || deed?.text || "Untitled Deed"}
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs" style={{ color: EKARI.dim }}>
                  <span className="inline-flex items-center gap-1">
                    <IoTimeOutline />
                    Posted {postedDateStr((deed as any)?.createdAt ?? (deed as any)?.createdAtMs)}
                  </span>

                  {deed?.visibility && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="inline-flex items-center gap-1">
                        <IoLockOpenOutline />
                        {deed.visibility}
                      </span>
                    </>
                  )}

                  {deed?.status && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="inline-flex items-center gap-1">
                        <IoCheckmarkCircle />
                        {deed.status}
                      </span>
                    </>
                  )}

                  {!!deedPath && (
                    <>
                      <span className="mx-1">•</span>
                      <Link
                        href={deedPath}
                        className="font-semibold underline-offset-2 hover:underline"
                        style={{ color: EKARI.text }}
                      >
                        Open deed
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* header quick stats (only those present) */}
            {statTiles.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {statTiles.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: EKARI.hair }}
                  >
                    <span className="flex items-center gap-2" style={{ color: EKARI.dim }}>
                      {s.icon}
                      {s.label}
                    </span>
                    <span className="font-bold" style={{ color: EKARI.text }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KPI row — responsive like your studio overview */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi
              title="Video duration"
              value={durHHMMSS(Number(deed?.durationSec || deed?.media?.[0]?.durationSec || 0))}
            />
            <Kpi title="Watch time" value={durHHMMSS(Math.floor((deed?.stats?.watchMs || 0) / 1000))} />
            <Kpi title="Country" value={deed?.countryTag || deed?.countryCode || "—"} />
            <Kpi title="County" value={deed?.countyTag || "—"} />
            <Kpi title="Type" value={String(deed?.type || deed?.media?.[0]?.mediaType || "—")} />
          </div>

          {/* Tags */}
          {Array.isArray(deed?.tags) && deed.tags.length > 0 && (
            <div className="mt-6 rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
              <div className="mb-2 text-sm font-extrabold" style={{ color: EKARI.text }}>
                Tags
              </div>
              <div className="flex flex-wrap gap-2">
                {deed.tags.map((t: string) => (
                  <span
                    key={t}
                    className="rounded-full border px-2 py-1 text-xs"
                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between">
            <Link
              href="/studio/deeds"
              className="text-sm font-semibold underline-offset-4 hover:underline"
              style={{ color: EKARI.text }}
            >
              ← Back to deeds
            </Link>

            {!!deedPath && (
              <Link
                href={deedPath}
                className="fixed right-4 bottom-4 inline-flex items-center gap-2 rounded-full px-4 py-3 text-white shadow-lg md:static md:right-0 md:bottom-0"
                style={{ backgroundColor: EKARI.text }}
                title="Open deed"
              >
                <IoEyeOutline />
                View deed
              </Link>
            )}
          </div>

          {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
        </div>
      )}
    </div>
  );

  // MOBILE: fixed inset, no AppShell/StudioShell chrome (like your discussion mobile)
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: EKARI.sand }}>
        {Header}
        <div className="flex-1 overflow-y-auto overscroll-contain">{Body}</div>
      </div>
    );
  }

  // DESKTOP: AppShell + StudioShell
  return (
    <AppShell>
      <StudioShell>
        <div className="min-h-screen w-full" style={{ backgroundColor: EKARI.sand }}>
          {Header}
          {Body}
        </div>
      </StudioShell>
    </AppShell>
  );
}

/* ---------------------------- UI bits ----------------------------- */
function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
      <div className="text-xs font-medium" style={{ color: EKARI.dim }}>
        {title}
      </div>
      <div className="mt-2 text-2xl font-extrabold" style={{ color: EKARI.text }}>
        {value}
      </div>
    </div>
  );
}
