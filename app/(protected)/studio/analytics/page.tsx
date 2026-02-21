// app/studio/overview/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    IoAdd,
    IoPlayOutline,
    IoHeartOutline,
    IoChatbubbleOutline,
    IoShareSocialOutline,
} from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import {
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import StudioShell from "../components/StudioShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

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
    danger: "#B42318",
};

const UI = {
    radius: "24px",
    radiusSm: "16px",
    border: "rgba(15,23,42,0.08)",
    borderStrong: "rgba(15,23,42,0.12)",
    card: "rgba(255,255,255,0.86)",
    cardSolid: "#FFFFFF",
    soft: "rgba(15,23,42,0.03)",
    soft2: "rgba(15,23,42,0.05)",
    shadow: "0 18px 50px -28px rgba(16,24,40,0.35)",
    shadow2: "0 10px 30px -18px rgba(16,24,40,0.25)",
    glow: "0 0 0 6px rgba(199,146,87,0.15)",
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

/* ---------------- types ---------------- */
type Deed = {
    id: string;
    caption?: string;
    mediaThumbUrl?: string;
    createdAt?: any;
    createdAtMs?: number;
    stats?: { views?: number; likes?: number; comments?: number; shares?: number };
    media?: Array<{
        url: string;
        width?: number;
        height?: number;
        durationSec?: number;
        thumbUrl?: string;
        storagePath?: string;
        kind?: "video" | "image";
        muxAssetId?: string;
    }>;
};

type MiniProfile = {
    handle?: string;
    photoURL?: string;
    followersCount?: number;
    followingCount?: number;
    likesTotal?: number;
};

/* ---------------- helpers ---------------- */
function tsToMs(v: any): number | null {
    if (!v) return null;
    if (typeof v === "number") return v;
    if (v instanceof Date) return v.getTime();
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return null;
}

function nfmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 10_000) return `${Math.round(n / 1000)}k`;
    return n.toLocaleString();
}

/* ---------------- premium primitives ---------------- */
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
                <span
                    className="pointer-events-none absolute inset-0"
                    style={{
                        borderRadius: UI.radiusSm,
                        background:
                            variant === "primary"
                                ? "linear-gradient(180deg, rgba(255,255,255,0.22), transparent 55%)"
                                : "none",
                        mixBlendMode: "overlay",
                    }}
                />
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

/* ---------------- tiny skeletons ---------------- */
function MetricSkeleton() {
    return (
        <div
            className="rounded-2xl p-4 animate-pulse"
            style={{ border: `1px solid ${UI.border}`, background: "rgba(255,255,255,0.75)" }}
        >
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="mt-3 h-7 w-24 rounded bg-gray-200" />
        </div>
    );
}

function ChartSkeleton({ height = 120 }: { height?: number }) {
    return (
        <div
            className="mt-4 rounded-2xl p-4"
            style={{ border: `1px solid ${UI.border}`, background: "rgba(255,255,255,0.75)" }}
        >
            <div className="mb-3 h-3 w-40 rounded bg-gray-200 animate-pulse" />
            <div className="w-full rounded-xl bg-gray-100 animate-pulse" style={{ height }} />
        </div>
    );
}

function RowSkeleton() {
    return (
        <div
            className="flex items-center gap-3 rounded-2xl p-3"
            style={{ border: `1px solid ${UI.border}`, background: "rgba(255,255,255,0.75)" }}
        >
            <div className="relative h-16 w-28 overflow-hidden rounded-xl bg-gray-200 animate-pulse" />
            <div className="min-w-0 flex-1">
                <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="mt-3 flex items-center gap-4">
                    <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="mt-2 h-3 w-24 bg-gray-200 rounded animate-pulse" />
            </div>
        </div>
    );
}

/* ---------------- components ---------------- */
function Metric({
    label,
    value,
    icon,
    hint,
}: {
    label: string;
    value: number;
    icon?: React.ReactNode;
    hint?: string;
}) {
    return (
        <div
            className="p-4"
            style={{
                borderRadius: UI.radius,
                border: `1px solid ${UI.border}`,
                background: "rgba(255,255,255,0.82)",
                boxShadow: "0 10px 30px -22px rgba(16,24,40,0.22)",
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-extrabold tracking-wide uppercase" style={{ color: EKARI.dim }}>
                        {label}
                    </div>
                    <div className="mt-2 text-3xl font-black tracking-tight" style={{ color: EKARI.text }}>
                        {nfmt(value)}
                    </div>
                    {hint ? (
                        <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                            {hint}
                        </div>
                    ) : null}
                </div>

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
            </div>
        </div>
    );
}

function Tip({ title, body }: { title: string; body: string }) {
    return (
        <div
            className="flex gap-3 p-4"
            style={{
                borderRadius: UI.radius,
                border: `1px solid ${UI.border}`,
                background: "rgba(255,255,255,0.82)",
                boxShadow: "0 10px 30px -22px rgba(16,24,40,0.18)",
            }}
        >
            <div
                className="grid h-10 w-10 place-items-center rounded-2xl"
                style={{ background: "rgba(199,146,87,0.12)", color: EKARI.gold, border: `1px solid rgba(199,146,87,0.25)` }}
            >
                ✨
            </div>
            <div className="min-w-0">
                <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                    {title}
                </div>
                <div className="text-xs mt-1 leading-5" style={{ color: EKARI.dim }}>
                    {body}
                </div>
            </div>
        </div>
    );
}

function MiniAreaChart({ data, height = 120 }: { data: number[]; height?: number }) {
    const max = Math.max(1, ...data);
    const w = 700;
    const h = height;
    const pts = data
        .map((y, i) => {
            const x = (i / Math.max(1, data.length - 1)) * (w - 16) + 8;
            const yy = h - 8 - (y / max) * (h - 24);
            return `${x},${yy}`;
        })
        .join(" ");

    return (
        <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
                <line x1="8" y1={h - 8} x2={w - 8} y2={h - 8} stroke="#e5e7eb" />
                <polygon points={`8,${h - 8} ${pts} ${w - 8},${h - 8}`} fill="#C7925733" stroke="none" />
                <polyline points={pts} fill="none" stroke={EKARI.gold} strokeWidth={2} />
            </svg>
        </div>
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

/* ---------------- page ---------------- */
export default function StudioHomePage() {
    const router = useRouter();
    const { user } = useAuth();
    const uid = user?.uid;

    const isDesktop = useIsDesktop();
    const isMobile = useIsMobile();

    const goBack = React.useCallback(() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/studio");
    }, [router]);

    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<Deed[]>([]);
    const [profile, setProfile] = useState<MiniProfile | null>(null);

    // Profile views total
    const [profileViewsTotal, setProfileViewsTotal] = useState(0);

    // Live user profile (handle + counts)
    useEffect(() => {
        if (!uid) {
            setProfile(null);
            setProfileViewsTotal(0);
            return;
        }
        const unsub = onSnapshot(doc(db, "users", uid), (snap) => {
            const d = snap.exists() ? (snap.data() as any) : null;
            setProfile(
                d
                    ? {
                        handle:
                            d.handle || d.handleLower
                                ? `@${(d.handle || d.handleLower || "").replace(/^@/, "")}`
                                : undefined,
                        photoURL: d.photoURL || d.avatarUrl || undefined,
                        followersCount: Number(d.followersCount ?? 0),
                        followingCount: Number(d.followingCount ?? 0),
                        likesTotal: Number(d.likesTotal ?? 0),
                    }
                    : null
            );
            setProfileViewsTotal(Number(d?.profileViews ?? 0));
        });
        return () => unsub();
    }, [uid]);

    // Live deeds list (latest 12)
    useEffect(() => {
        if (!uid) {
            setPosts([]);
            setLoading(false);
            return;
        }
        setLoading(true);

        const qRef = query(
            collection(db, "deeds"),
            where("authorId", "==", uid),
            orderBy("createdAt", "desc"),
            limit(12)
        );

        const unsub = onSnapshot(
            qRef,
            (snap) => {
                const rows: Deed[] = snap.docs.map((d) => {
                    const data = d.data() as any;
                    const createdAtMs = tsToMs(data.createdAt) ?? data.createdAtMs ?? null;
                    return {
                        id: d.id,
                        caption: data.caption,
                        mediaThumbUrl: data.media?.[0]?.thumbUrl ?? data.mediaThumbUrl,
                        createdAt: data.createdAt ?? data.createdAtMs,
                        createdAtMs: createdAtMs || undefined,
                        stats: {
                            views: Number(data?.stats?.views ?? 0),
                            likes: Number(data?.stats?.likes ?? 0),
                            comments: Number(data?.stats?.comments ?? 0),
                            shares: Number(data?.stats?.shares ?? 0),
                        },
                    };
                });
                setPosts(rows);
                setLoading(false);
            },
            () => setLoading(false)
        );

        return () => unsub();
    }, [uid]);

    // Totals (sum over fetched docs)
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

    // 7-day series (views bucket by post-created day)
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
            const ms = p.createdAtMs ?? tsToMs(p.createdAt);
            if (!ms) return;
            const d = new Date(ms);
            d.setHours(0, 0, 0, 0);
            const k = key(d);
            if (map[k] !== undefined) map[k] += p.stats?.views ?? 0;
        });

        return days.map((d) => ({ x: d, y: map[key(d)] ?? 0 }));
    }, [posts]);

    // Profile Views sparkline series (last 7 days from profileViews collection)
    const [pvSeries, setPvSeries] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
    useEffect(() => {
        if (!uid) {
            setPvSeries([0, 0, 0, 0, 0, 0, 0]);
            return;
        }

        (async () => {
            const days = [...Array(7)].map((_, i) => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - (6 - i));
                return d;
            });
            const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
            const sinceYmd = ymd(days[0]);

            const qs = await getDocs(
                query(
                    collection(db, "profileViews"),
                    where("profileId", "==", uid),
                    where("ymd", ">=", sinceYmd),
                    limit(800)
                )
            );

            const bucket: Record<string, number> = {};
            days.forEach((d) => (bucket[ymd(d)] = 0));
            qs.forEach((d) => {
                const k = String((d.data() as any)?.ymd || "");
                if (k in bucket) bucket[k] += 1;
            });

            setPvSeries(days.map((d) => bucket[ymd(d)] || 0));
        })();
    }, [uid]);

    const handleText = profile?.handle || (user?.displayName ? `@${user.displayName}` : "@you");
    const followersText = (profile?.followersCount ?? 0).toLocaleString();
    const followingText = (profile?.followingCount ?? 0).toLocaleString();
    const likesHeader = (profile?.likesTotal ?? totals.likes).toLocaleString();

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
                            Studio
                        </div>
                        <div className="text-[11px] mt-0.5 truncate" style={{ color: EKARI.dim }}>
                            Overview
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <PremiumButton href="/studio/upload" variant="primary">
                            <IoAdd /> Upload
                        </PremiumButton>
                    </div>
                </div>
            </div>
        </div>
    );

    /* ---------------- Main content ---------------- */
    const Main = (
        <div className={isDesktop ? "max-w-[1180px] mx-auto px-4 pb-10" : "px-3 pb-10"}>
            {/* Profile hero */}
            <Card className="mt-4" solid>
                <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                            <div
                                className="h-12 w-12 overflow-hidden rounded-full shrink-0"
                                style={{
                                    border: `1px solid ${UI.border}`,
                                    boxShadow: "0 12px 28px -20px rgba(16,24,40,0.35)",
                                    background: "rgba(15,23,42,0.03)",
                                }}
                            >
                                <Image
                                    src={profile?.photoURL || user?.photoURL || "/avatar-placeholder.png"}
                                    alt="avatar"
                                    width={96}
                                    height={96}
                                    className="h-full w-full object-cover"
                                />
                            </div>

                            <div className="min-w-0">
                                <div className="text-sm font-black truncate" style={{ color: EKARI.text }}>
                                    {handleText}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Chip active>Likes {likesHeader}</Chip>
                                    <Chip>Followers {followersText}</Chip>
                                    <Chip>Following {followingText}</Chip>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <PremiumButton href="/studio/upload" variant="primary">
                                <IoAdd /> Upload
                            </PremiumButton>
                            <PremiumButton href="/studio/deeds" variant="ghost">
                                View all
                            </PremiumButton>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Key metrics */}
            <Card className="mt-5" solid>
                <div className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-base font-black" style={{ color: EKARI.text }}>
                            Key metrics
                        </div>
                        <Chip>Last 7 days</Chip>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {loading ? (
                            <>
                                <MetricSkeleton />
                                <MetricSkeleton />
                                <MetricSkeleton />
                                <MetricSkeleton />
                                <MetricSkeleton />
                            </>
                        ) : (
                            <>
                                <Metric label="Video views" value={totals.views} icon={<IoPlayOutline />} hint="Total views" />
                                <Metric label="Profile views" value={profileViewsTotal} icon={<span>👀</span>} hint="Profile reach" />
                                <Metric label="Likes" value={totals.likes} icon={<IoHeartOutline />} hint="Engagement" />
                                <Metric label="Comments" value={totals.comments} icon={<IoChatbubbleOutline />} hint="Replies" />
                                <Metric label="Shares" value={totals.shares} icon={<IoShareSocialOutline />} hint="Virality" />
                            </>
                        )}
                    </div>

                    {loading ? (
                        <>
                            <ChartSkeleton height={140} />
                            <ChartSkeleton height={100} />
                        </>
                    ) : (
                        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div
                                className="p-4"
                                style={{
                                    borderRadius: UI.radius,
                                    border: `1px solid ${UI.border}`,
                                    background: "rgba(255,255,255,0.82)",
                                }}
                            >
                                <div className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: EKARI.dim }}>
                                    Video views (7 days)
                                </div>
                                <MiniAreaChart data={series.map((d) => d.y)} height={140} />
                            </div>

                            <div
                                className="p-4"
                                style={{
                                    borderRadius: UI.radius,
                                    border: `1px solid ${UI.border}`,
                                    background: "rgba(255,255,255,0.82)",
                                }}
                            >
                                <div className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: EKARI.dim }}>
                                    Profile views (7 days)
                                </div>
                                <MiniAreaChart data={pvSeries} height={100} />
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Recent + Knowledge */}
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <Card className="lg:col-span-2" solid>
                    <div className="p-4 sm:p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-base font-black" style={{ color: EKARI.text }}>
                                Recent posts
                            </div>
                            <Link href="/studio/deeds" className="text-xs font-extrabold" style={{ color: EKARI.forest }}>
                                View all
                            </Link>
                        </div>

                        <div className="space-y-3">
                            {loading && (
                                <>
                                    <div className="flex items-center justify-center py-5">
                                        <BouncingBallLoader />
                                    </div>
                                    <RowSkeleton />
                                    <RowSkeleton />
                                    <RowSkeleton />
                                </>
                            )}

                            {!loading &&
                                posts.slice(0, 5).map((p) => (
                                    <Link
                                        key={p.id}
                                        href={`/studio/analytics/${p.id}`}
                                        className="group flex items-center gap-3 p-3 transition active:scale-[0.995]"
                                        style={{
                                            borderRadius: UI.radius,
                                            border: `1px solid ${UI.border}`,
                                            background: "rgba(255,255,255,0.82)",
                                            boxShadow: "0 10px 30px -22px rgba(16,24,40,0.12)",
                                        }}
                                    >
                                        <div
                                            className="relative h-16 w-28 sm:h-16 sm:w-28 overflow-hidden shrink-0"
                                            style={{
                                                borderRadius: UI.radiusSm,
                                                border: `1px solid ${UI.border}`,
                                                background: "rgba(15,23,42,0.04)",
                                            }}
                                        >
                                            <Image
                                                src={p.mediaThumbUrl || p.media?.[0]?.thumbUrl || "/video-placeholder.jpg"}
                                                alt="thumb"
                                                fill
                                                className="object-cover transition group-hover:scale-[1.03]"
                                                sizes="112px"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-extrabold" style={{ color: EKARI.text }}>
                                                {p.caption || "Untitled"}
                                            </div>

                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <StatPill icon={<IoPlayOutline />} value={p.stats?.views ?? 0} title="Views" />
                                                <StatPill icon={<IoHeartOutline />} value={p.stats?.likes ?? 0} title="Likes" />
                                                <StatPill icon={<IoChatbubbleOutline />} value={p.stats?.comments ?? 0} title="Comments" />
                                                <StatPill icon={<IoShareSocialOutline />} value={p.stats?.shares ?? 0} title="Shares" />
                                            </div>

                                            <div className="mt-2 text-[11px]" style={{ color: EKARI.dim }}>
                                                {p.createdAtMs ? new Date(p.createdAtMs).toLocaleString() : ""}
                                            </div>
                                        </div>
                                    </Link>
                                ))}

                            {!loading && posts.length === 0 && (
                                <div className="text-sm" style={{ color: EKARI.dim }}>
                                    No posts yet.{" "}
                                    <Link href="/studio/upload" className="font-extrabold" style={{ color: EKARI.forest }}>
                                        Upload your first video
                                    </Link>
                                    .
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                <Card solid>
                    <div className="p-4 sm:p-5">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="text-base font-black" style={{ color: EKARI.text }}>
                                Knowledge for you
                            </div>
                            <Chip>Tips</Chip>
                        </div>

                        <div className="space-y-3">
                            <Tip
                                title="Use high-quality covers"
                                body="Pick bright frames with clear subject + context. Strong thumbnails lift your CTR."
                            />
                            <Tip
                                title="Post consistently"
                                body="A simple cadence (2–3 posts/week) helps the algorithm learn your audience faster."
                            />
                        </div>
                    </div>
                </Card>
            </div>

            {/* safe area spacer on mobile */}
            {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
        </div>
    );

    /* ---------------- Loading screen ---------------- */
    if (loading && posts.length === 0 && !profile) {
        if (isMobile) {
            return (
                <div className="fixed inset-0 flex items-center justify-center" style={{ background: UI.gradient }}>
                    <BouncingBallLoader />
                </div>
            );
        }
        return (
            <AppShell>
                <div className="min-h-screen flex items-center justify-center" style={{ background: UI.gradient }}>
                    <BouncingBallLoader />
                </div>
            </AppShell>
        );
    }

    /* ---------------- MOBILE: fixed inset, NO StudioShell wrapper ---------------- */
    if (isMobile) {
        return (
            <div className="fixed inset-0 flex flex-col" style={{ background: UI.gradient }}>
                {Header}
                <div className="flex-1 overflow-y-auto overscroll-contain">{Main}</div>
            </div>
        );
    }

    /* ---------------- DESKTOP: AppShell + StudioShell ---------------- */
    return (
        <AppShell>
            <div style={{ background: UI.gradient, minHeight: "100dvh" }}>
                <StudioShell title="Home" ctaHref="/studio/upload" ctaLabel="+ Upload">
                    {Header}
                    {Main}
                </StudioShell>
            </div>
        </AppShell>
    );
}