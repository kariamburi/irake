"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
    IoAdd, IoHomeOutline, IoBarChartOutline, IoChatbubblesOutline,
    IoSparklesOutline, IoPlayOutline, IoHeartOutline, IoChatbubbleOutline,
    IoShareSocialOutline
} from "react-icons/io5";
import {
    collection, getDocs, limit, orderBy, query, where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

// If you already have StudioShell from the Upload/Posts pages, keep using it.
// Otherwise drop in the implementation provided below in /studio/_components/StudioShell.tsx
import StudioShell from "./components/StudioShell";

type Deed = {
    id: string;
    caption?: string;
    mediaThumbUrl?: string;
    createdAtMs?: number;
    stats?: { views?: number; likes?: number; comments?: number; shares?: number };
};

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    hair: "#E5E7EB",
    text: "#0F172A",
    dim: "#6B7280",
};

export default function StudioHomePage() {
    const { user } = useAuth();
    const uid = user?.uid;

    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<Deed[]>([]);

    useEffect(() => {
        if (!uid) return;
        (async () => {
            setLoading(true);
            try {
                const q = query(
                    collection(db, "deeds"),
                    where("authorId", "==", uid),
                    orderBy("createdAtMs", "desc"),
                    limit(12)
                );
                const snap = await getDocs(q);
                const rows: Deed[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
                setPosts(rows);
            } catch (e) {
                console.error(e);
                setPosts([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [uid]);

    // Totals (lifetime)
    const totals = useMemo(() => {
        return posts.reduce(
            (acc, p) => {
                acc.views += p.stats?.views ?? 0;
                acc.likes += p.stats?.likes ?? 0;
                acc.comments += p.stats?.comments ?? 0;
                acc.shares += p.stats?.shares ?? 0;
                return acc;
            },
            { views: 0, likes: 0, comments: 0, shares: 0 }
        );
    }, [posts]);

    // Simple 7-day series based on post createdAtMs (fallback zeros if missing)
    const series = useMemo(() => {
        const days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            d.setHours(0, 0, 0, 0);
            return d;
        });

        const key = (d: Date) => d.toISOString().slice(0, 10);
        const map: Record<string, number> = {};
        days.forEach((d) => (map[key(d)] = 0));

        posts.forEach((p) => {
            if (!p.createdAtMs) return;
            const d = new Date(p.createdAtMs);
            d.setHours(0, 0, 0, 0);
            const k = key(d);
            if (map[k] !== undefined) map[k] += p.stats?.views ?? 0; // naive: bucket lifetime views on post day
        });

        return days.map((d) => ({ x: d, y: map[key(d)] ?? 0 }));
    }, [posts]);

    return (
        <StudioShell title="Home" ctaHref="/studio/upload" ctaLabel="+ Upload">
            {/* Channel header */}
            <div className="rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: EKARI.hair }}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                            <Image
                                src={user?.photoURL || "/avatar-placeholder.png"}
                                alt="avatar"
                                width={96}
                                height={96}
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div>
                            <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                                @{user?.displayName || "you"}
                            </div>
                            <div className="text-xs" style={{ color: EKARI.dim }}>
                                Likes {totals.likes.toLocaleString()} · Followers 0 · Following 0
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link
                            href="/studio/upload"
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-white"
                            style={{ backgroundColor: EKARI.gold }}
                        >
                            <IoAdd /> Upload
                        </Link>
                        <Link
                            href="/studio/posts"
                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        >
                            <IoPlayOutline /> Posts
                        </Link>
                    </div>
                </div>
            </div>

            {/* Key metrics */}
            <div className="mt-5 rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: EKARI.hair }}>
                <div className="mb-3 flex items-center justify-between">
                    <div className="text-base font-extrabold" style={{ color: EKARI.text }}>
                        Key metrics
                    </div>
                    <div className="text-xs" style={{ color: EKARI.dim }}>Last 7 days</div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Metric label="Video views" value={totals.views} />
                    <Metric label="Profile views" value={0} />
                    <Metric label="Likes" value={totals.likes} />
                    <Metric label="Comments" value={totals.comments} />
                    <Metric label="Shares" value={totals.shares} />
                </div>

                {/* tiny line chart */}
                <div className="mt-4 rounded-lg border p-3" style={{ borderColor: EKARI.hair }}>
                    <MiniAreaChart data={series.map((d) => d.y)} height={140} />
                </div>
            </div>

            {/* Recent posts + Knowledge */}
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="rounded-xl border bg-white p-4 sm:p-5 lg:col-span-2" style={{ borderColor: EKARI.hair }}>
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-base font-extrabold" style={{ color: EKARI.text }}>Recent posts</div>
                        <Link href="/studio/posts" className="text-xs font-bold" style={{ color: EKARI.forest }}>
                            View all
                        </Link>
                    </div>

                    <div className="space-y-3">
                        {loading && <div className="text-sm" style={{ color: EKARI.dim }}>Loading…</div>}

                        {!loading && posts.slice(0, 5).map((p) => (
                            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-gray-50"
                                style={{ borderColor: EKARI.hair }}>
                                <div className="relative h-16 w-28 overflow-hidden rounded-md bg-gray-200">
                                    <Image
                                        src={p.mediaThumbUrl || "/video-placeholder.jpg"}
                                        alt="thumb"
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold" style={{ color: EKARI.text }}>
                                        {p.caption || "Untitled"}
                                    </div>
                                    <div className="mt-1 flex items-center gap-4 text-xs" style={{ color: EKARI.dim }}>
                                        <span className="inline-flex items-center gap-1"><IoPlayOutline />{(p.stats?.views ?? 0).toLocaleString()}</span>
                                        <span className="inline-flex items-center gap-1"><IoHeartOutline />{p.stats?.likes ?? 0}</span>
                                        <span className="inline-flex items-center gap-1"><IoChatbubbleOutline />{p.stats?.comments ?? 0}</span>
                                        <span className="inline-flex items-center gap-1"><IoShareSocialOutline />{p.stats?.shares ?? 0}</span>
                                    </div>
                                    <div className="text-[11px]" style={{ color: EKARI.dim }}>
                                        {p.createdAtMs ? new Date(p.createdAtMs).toLocaleString() : ""}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {!loading && posts.length === 0 && (
                            <div className="text-sm" style={{ color: EKARI.dim }}>
                                No posts yet. <Link href="/studio/upload" className="font-semibold" style={{ color: EKARI.forest }}>Upload your first video</Link>.
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border bg-white p-4 sm:p-5" style={{ borderColor: EKARI.hair }}>
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-base font-extrabold" style={{ color: EKARI.text }}>Knowledge for you</div>
                    </div>

                    <div className="space-y-3">
                        <Tip
                            title="Leverage high-quality video covers to attract viewers"
                            body="Your profile can be a major traffic source, so having clear, engaging thumbnails matters. Pick bright frames with human faces and readable context."
                        />
                        <Tip
                            title="Post consistently"
                            body="A simple cadence (e.g., 2–3 times per week) helps the algorithm learn your audience. Batch record and schedule to stay consistent."
                        />
                    </div>
                </div>
            </div>
        </StudioShell>
    );
}

/* ---------------- components ---------------- */

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border p-3" style={{ borderColor: EKARI.hair }}>
            <div className="text-xs" style={{ color: EKARI.dim }}>{label}</div>
            <div className="mt-1 text-2xl font-extrabold" style={{ color: EKARI.text }}>
                {value.toLocaleString()}
            </div>
            {/* Placeholder delta */}
            <div className="text-[11px]" style={{ color: EKARI.dim }}>0 (0.0%)</div>
        </div>
    );
}

function Tip({ title, body }: { title: string; body: string }) {
    return (
        <div className="flex gap-3 rounded-lg border p-3" style={{ borderColor: EKARI.hair }}>
            <div className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: "#F6F7FB", color: EKARI.forest }}>
                <IoSparklesOutline />
            </div>
            <div>
                <div className="text-sm font-bold" style={{ color: EKARI.text }}>{title}</div>
                <div className="text-xs mt-1" style={{ color: EKARI.dim }}>{body}</div>
            </div>
        </div>
    );
}

function MiniAreaChart({ data, height = 120 }: { data: number[]; height?: number }) {
    // simple responsive SVG area
    const max = Math.max(1, ...data);
    const w = 700;
    const h = height;
    const pts = data.map((y, i) => {
        const x = (i / (data.length - 1)) * (w - 16) + 8;
        const yy = h - 8 - (y / max) * (h - 24);
        return `${x},${yy}`;
    }).join(" ");

    return (
        <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
                {/* gridline */}
                <line x1="8" y1={h - 8} x2={w - 8} y2={h - 8} stroke="#e5e7eb" />
                {/* area fill */}
                <polygon
                    points={`8,${h - 8} ${pts} ${w - 8},${h - 8}`}
                    fill="#C7925733"
                    stroke="none"
                />
                {/* line */}
                <polyline
                    points={pts}
                    fill="none"
                    stroke={EKARI.gold}
                    strokeWidth={2}
                />
            </svg>
        </div>
    );
}
