"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

import TikBallsLoader from "@/components/ui/TikBallsLoader";
import {
  IoTimeOutline, IoAnalyticsOutline, IoEyeOutline, IoHeartOutline,
  IoShareOutline, IoBookmarkOutline, IoCheckmarkCircle, IoLockOpenOutline,
  IoChatbubble,
  IoChatbubbleOutline,
} from "react-icons/io5";
import StudioShell from "../../components/StudioShell";
import { DeedDoc } from "@/lib/fire-queries";
import AppShell from "@/app/components/AppShell";

/* ----------------------------- Helpers ---------------------------- */
const nfmt = (n = 0) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    : n >= 1_000 ? `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
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
  const dt = typeof d === "number" ? new Date(d) : (d as Timestamp).toDate?.() ?? new Date();
  return dt.toLocaleDateString();
};

/* ----------------------------- Page ------------------------------- */
export default function AnalyticsPage() {
  const params = useParams<{ id: string }>();
  const deedId = params?.id;

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

    return () => { alive = false; };
  }, [deedId]);

  const poster =
    deed?.media?.[0]?.thumbUrl ||
    (deed as any)?.mediaThumbUrl ||
    "/video-placeholder.jpg";

  // Build header stat tiles from ONLY what exists on deed.stats
  const statTiles = useMemo(() => {
    const s = deed?.stats ?? {};
    const tiles: { key: string; label: string; value: string; icon: React.ReactNode }[] = [];

    if (typeof s.views === "number") {
      tiles.push({ key: "views", label: "Views", value: nfmt(s.views), icon: <IoEyeOutline /> });
    }
    if (typeof s.comments === "number") {
      tiles.push({ key: "comments", label: "Comments", value: nfmt(s.comments), icon: <IoChatbubbleOutline /> });
    }
    if (typeof s.likes === "number") {
      tiles.push({ key: "likes", label: "Likes", value: nfmt(s.likes), icon: <IoHeartOutline /> });
    }
    if (typeof s.shares === "number") {
      tiles.push({ key: "shares", label: "Shares", value: nfmt(s.shares), icon: <IoShareOutline /> });
    }
    if (typeof s.saves === "number") {
      tiles.push({ key: "saves", label: "Saves", value: nfmt(s.saves), icon: <IoBookmarkOutline /> });
    }
    if (typeof s.completions === "number") {
      tiles.push({ key: "completions", label: "Completions", value: nfmt(s.completions), icon: <IoCheckmarkCircle /> });
    }

    // Watch time is shown as KPI below, but include it here too if you want a quick glance:
    // if (typeof s.watchMs === "number") {
    //   tiles.push({ key: "watch", label: "Watch time", value: durHHMMSS((s.watchMs || 0) / 1000), icon: <IoTimeOutline /> });
    // }

    return tiles;
  }, [deed?.stats]);

  return (
    <AppShell>
      <StudioShell>
        {loading ? (
          <div className="p-10">
            <TikBallsLoader />
          </div>
        ) : !deed ? (
          <div className="p-6 text-sm text-slate-600">Deed not found.</div>
        ) : (
          <div className="w-full p-2">
            {/* Title bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IoAnalyticsOutline className="text-slate-600" />
                <h1 className="text-xl font-extrabold text-slate-900">Deed overview</h1>
              </div>
              <div className="text-xs text-slate-500">
                Updated on{" "}
                {new Date((deed as any)?.updatedAt?.toDate?.() ?? (deed as any)?.updatedAt ?? Date.now())
                  .toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" })}
              </div>
            </div>

            {/* Deed header card */}
            <div className="mt-4 rounded-lg border bg-white p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-10 overflow-hidden rounded">
                  <Image src={poster} alt="thumb" fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">
                    {deed?.caption || deed?.text || "Untitled Deed"}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <IoTimeOutline />
                    <span>
                      Posted on {postedDateStr((deed as any)?.createdAt ?? (deed as any)?.createdAtMs)}
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
                    <span className="mx-1">•</span>
                    <Link
                      href={`${deed.authorUsername}/video/${deedId}`}
                      className="font-semibold text-slate-700 underline-offset-2 hover:underline"
                    >
                      Open deed
                    </Link>
                  </div>
                </div>
              </div>

              {/* header quick stats (only those present) */}
              {statTiles.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {statTiles.map((s) => (
                    <div key={s.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        {s.icon}
                        {s.label}
                      </span>
                      <span className="font-bold text-slate-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KPI row — all derived straight from deed fields */}
            <div className="mt-6 grid gap-4 lg:grid-cols-5">
              <Kpi title="Video duration" value={durHHMMSS(Number(deed?.durationSec || deed?.media?.[0]?.durationSec || 0))} />
              <Kpi title="Watch time"
                value={durHHMMSS(Math.floor((deed?.stats?.watchMs || 0) / 1000))} />
              <Kpi title="Country"
                value={deed?.countryTag || deed?.countryCode || "—"} />
              <Kpi title="County" value={deed?.countyTag || "—"} />
              <Kpi title="Type" value={String(deed?.type || deed?.media?.[0]?.mediaType || "—")} />
            </div>

            {/* Tags (if any) */}
            {Array.isArray(deed?.tags) && deed!.tags!.length > 0 && (
              <div className="mt-6 rounded-lg border bg-white p-4">
                <div className="mb-2 text-sm font-bold text-slate-900">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {deed!.tags!.map((t: string) => (
                    <span key={t} className="rounded-full border px-2 py-1 text-xs text-slate-700">#{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="mt-6 flex items-center justify-between">
              <Link href="/studio/deeds" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
                ← Back to deeds
              </Link>

              <Link
                href={`${deed.authorUsername}/video/${deedId}`}
                className="fixed right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-white shadow-lg hover:bg-black md:static md:right-0 md:bottom-0"
                title="Open deed"
              >
                <IoEyeOutline />
                View deed
              </Link>
            </div>
          </div>
        )}
      </StudioShell>
    </AppShell>
  );
}

/* ---------------------------- UI bits ----------------------------- */
function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
