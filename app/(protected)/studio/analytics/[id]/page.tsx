// app/(protected)/studio/analytics/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  doc, getDoc, collection, getDocs, orderBy, limit, query, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import TikBallsLoader from "@/components/ui/TikBallsLoader";
import {
  IoTimeOutline, IoAnalyticsOutline, IoEyeOutline, IoHeartOutline,
  IoChatbubbleEllipsesOutline, IoShareOutline, IoBookmarkOutline,
} from "react-icons/io5";
import StudioShell from "../../components/StudioShell";
import { DeedDoc } from "@/lib/fire-queries";

/* ----------------------------- Types ------------------------------ */
type DeedStats = { views?: number; likes?: number; comments?: number; shares?: number; saves?: number };
type AnalyticsSummary = {
  updatedAt?: number;
  totalViews?: number;
  totalPlayTimeSec?: number;
  avgWatchSec?: number;
  watchedFullPct?: number;
  newFollowers?: number;
  traffic?: {
    forYou?: number;
    search?: number;
    profile?: number;
    other?: number;
    sound?: number;
    following?: number;
  };
  retention?: { mostDropoffAtSec?: number };
};

type DailyRow = {
  date: string;
  views?: number;
  playTimeSec?: number;
  avgWatchSec?: number;
  watchedFullPct?: number;
  newFollowers?: number;
};

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

const pct = (x?: number) => {
  const v = Math.max(0, Math.min(100, Number.isFinite(x as number) ? (x as number) : 0));
  return `${v.toFixed(1).replace(/\.0$/, "")}%`;
};

/* ----------------------------- Page ------------------------------- */
export default function AnalyticsPage({
  params,
}: {
  params: { id: string }; // ✅ Fix: folder is [id], not { deedId: ... }
}) {
  const deedId = params.id;

  const [loading, setLoading] = useState(true);
  const [deed, setDeed] = useState<DeedDoc | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);

  // load once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // Deed
        const dref = doc(db, "deeds", deedId);
        const dsnap = await getDoc(dref);
        const deedDoc = dsnap.exists()
          ? ({ id: dsnap.id, ...(dsnap.data() as any) } as DeedDoc)
          : null;

        // Summary analytics (soft schema)
        const sref = doc(db, "deeds", deedId, "analytics", "summary");
        const ssnap = await getDoc(sref);
        const summaryDoc = ssnap.exists() ? (ssnap.data() as AnalyticsSummary) : null;

        // Daily rows
        const qDaily = query(
          collection(db, "deeds", deedId, "analyticsDaily"),
          orderBy("date", "desc"),
          limit(30)
        );
        const dsnaps = await getDocs(qDaily);
        const dailyRows: DailyRow[] = dsnaps.docs.map((x) => ({ ...(x.data() as any) }));

        if (!alive) return;
        setDeed(deedDoc);
        setSummary(summaryDoc);
        setDaily(dailyRows.reverse());
      } catch (e) {
        console.error("[analytics] load error:", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [deedId]);

  // fallbacks if summary missing
  const merged = useMemo<Required<AnalyticsSummary>>(() => {
    const fromDaily = {
      totalViews: daily.reduce((a, b) => a + (b.views || 0), 0),
      totalPlayTimeSec: daily.reduce((a, b) => a + (b.playTimeSec || 0), 0),
      avgWatchSec:
        daily.length
          ? Math.round(daily.reduce((a, b) => a + (b.avgWatchSec || 0), 0) / daily.length)
          : 0,
      watchedFullPct:
        daily.length
          ? Math.round(daily.reduce((a, b) => a + (b.watchedFullPct || 0), 0) / daily.length)
          : 0,
      newFollowers: daily.reduce((a, b) => a + (b.newFollowers || 0), 0),
    };

    const s = summary || {};
    return {
      updatedAt: s.updatedAt || Date.now(),
      totalViews: s.totalViews ?? fromDaily.totalViews ?? (deed?.stats?.views || 0),
      totalPlayTimeSec: s.totalPlayTimeSec ?? fromDaily.totalPlayTimeSec ?? 0,
      avgWatchSec: s.avgWatchSec ?? fromDaily.avgWatchSec ?? 0,
      watchedFullPct: s.watchedFullPct ?? fromDaily.watchedFullPct ?? 0,
      newFollowers: s.newFollowers ?? fromDaily.newFollowers ?? 0,
      traffic: {
        forYou: s.traffic?.forYou ?? 0,
        search: s.traffic?.search ?? 0,
        profile: s.traffic?.profile ?? 0,
        other: s.traffic?.other ?? 0,
        sound: s.traffic?.sound ?? 0,
        following: s.traffic?.following ?? 0,
      },
      retention: {
        mostDropoffAtSec: s.retention?.mostDropoffAtSec ?? 2,
      },
    };
  }, [summary, daily, deed?.stats?.views]);

  const poster = deed?.media?.[0]?.thumbUrl || deed?.mediaThumbUrl || "/video-placeholder.jpg";

  const headerStats: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Views", value: nfmt(merged.totalViews), icon: <IoEyeOutline /> },
    { label: "Likes", value: nfmt(deed?.stats?.likes ?? 0), icon: <IoHeartOutline /> },
    { label: "Comments", value: nfmt(deed?.stats?.comments ?? 0), icon: <IoChatbubbleEllipsesOutline /> },
    { label: "Shares", value: nfmt(deed?.stats?.shares ?? 0), icon: <IoShareOutline /> },
    { label: "Saves", value: nfmt(deed?.stats?.saves ?? 0), icon: <IoBookmarkOutline /> },
  ];

  return (
    <StudioShell>
      {loading ? (
        <div className="p-10">
          <TikBallsLoader />
        </div>
      ) : (
        <div className="p-4 md:p-6">
          {/* Title bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IoAnalyticsOutline className="text-slate-600" />
              <h1 className="text-xl font-extrabold text-slate-900">Analytics</h1>
            </div>
            <div className="text-xs text-slate-500">
              Updated on{" "}
              {new Date(merged.updatedAt).toLocaleDateString(undefined, {
                month: "numeric", day: "numeric", year: "numeric",
              })}
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
                  {deed?.caption || "Untitled Post"}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  <IoTimeOutline />
                  <span>Posted on {postedDateStr((deed as any)?.createdAt ?? (deed as any)?.createdAtMs)}</span>
                  <span className="mx-1">•</span>
                  <Link
                    href={`/deeds/${deedId}`}
                    className="font-semibold text-slate-700 underline-offset-2 hover:underline"
                  >
                    Open video
                  </Link>
                </div>
              </div>
            </div>

            {/* header quick stats */}
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {headerStats.map((s) => (
                <div key={s.label} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    {s.icon}
                    {s.label}
                  </span>
                  <span className="font-bold text-slate-900">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* KPI row */}
          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            <Kpi title="Video views" value={nfmt(merged.totalViews)} />
            <Kpi title="Total play time" value={durHHMMSS(merged.totalPlayTimeSec)} />
            <Kpi title="Average watch time" value={`${(merged.avgWatchSec ?? 0).toFixed(2)}s`} />
            <Kpi title="Watched full video" value={pct(merged.watchedFullPct)} />
            <Kpi title="New followers" value={nfmt(merged.newFollowers)} />
          </div>

          {/* Retention + Traffic */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card title="Retention rate">
              <p className="text-sm text-slate-600">
                Most viewers stopped watching at{" "}
                <span className="font-bold">{merged.retention.mostDropoffAtSec?.toFixed?.(0) || 0}</span>s.
              </p>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-40 w-28 overflow-hidden rounded-lg border">
                  <Image src={poster} alt="thumb" fill className="object-cover" />
                </div>
                <div className="grow">
                  <div className="mb-2 text-xs text-slate-500">Illustrative drop-off</div>
                  <div className="h-3 w-full overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full bg-slate-800"
                      style={{
                        width: `${Math.min(
                          100,
                          (100 * (merged.retention.mostDropoffAtSec || 0)) /
                            Math.max(1, merged.avgWatchSec || 1)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Traffic source">
              <TrafficBar label="For You" value={merged.traffic.forYou} />
              <TrafficBar label="Search" value={merged.traffic.search} />
              <TrafficBar label="Personal profile" value={merged.traffic.profile} />
              <TrafficBar label="Other" value={merged.traffic.other} />
              <TrafficBar label="Sound" value={merged.traffic.sound} />
              <TrafficBar label="Following" value={merged.traffic.following} />
            </Card>
          </div>

          {/* Footer actions */}
          <div className="mt-6 flex items-center justify-between">
            <Link href="/studio/posts" className="text-sm font-semibold text-slate-700 underline-offset-4 hover:underline">
              ← Back to posts
            </Link>

            <Link
              href={`/deeds/${deedId}`}
              className="fixed right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-white shadow-lg hover:bg-black md:static md:right-0 md:bottom-0"
              title="Open video"
            >
              <IoEyeOutline />
              View post
            </Link>
          </div>
        </div>
      )}
    </StudioShell>
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 text-sm font-bold text-slate-900">{title}</div>
      {children}
    </div>
  );
}

function TrafficBar({ label, value = 0 }: { label: string; value?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-semibold">{clamped.toFixed(1).replace(/\.0$/, "")}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-100">
        <div className="h-full bg-slate-800" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
