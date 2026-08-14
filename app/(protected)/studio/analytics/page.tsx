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
    IoEyeOutline,
    IoTrendingUpOutline,
    IoPeopleOutline,
    IoSparklesOutline,
    IoChevronForward,
    IoPersonOutline,
    IoTimeOutline,
    IoBarChartOutline,
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
    danger: "#B42318",
};

const UI = {
    radius: "18px",
    radiusSm: "14px",
    border: "#DDD8CC",
    borderStrong: "#CFC8BB",
    card: "#FBFAF6",
    cardSolid: "#FBFAF6",
    soft: "#F3F1EB",
    soft2: "#EEEAE2",
    shadow: "0 16px 38px rgba(15,23,42,0.06)",
    shadow2: "0 10px 28px rgba(15,23,42,0.025)",
    glow: "0 0 0 5px rgba(243,154,34,0.12)",
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

function nfmt(
    input: number | string | null | undefined
) {
    const n = Number(input ?? 0);

    if (!Number.isFinite(n)) {
        return "0";
    }

    if (n >= 1_000_000) {
        return `${(n / 1_000_000)
            .toFixed(1)
            .replace(/\.0$/, "")}M`;
    }

    if (n >= 10_000) {
        return `${Math.round(n / 1000)}k`;
    }

    return n.toLocaleString();
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

function SafeAvatar({
    src,
    alt,
    size = 52,
}: {
    src?: string | null;
    alt: string;
    size?: number;
}) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    const hasImage =
        !!src?.trim() && !failed;

    return (
        <div
            className="relative shrink-0 overflow-hidden rounded-full border border-[#DDD8CC] bg-[#E8ECE8]"
            style={{
                width: size,
                height: size,
            }}
        >
            {hasImage ? (
                <Image
                    src={src || ""}
                    alt={alt}
                    fill
                    sizes={`${size}px`}
                    className="object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <div className="grid h-full w-full place-items-center text-[#173C2E]">
                    <IoPersonOutline
                        size={Math.round(size * 0.44)}
                    />
                </div>
            )}
        </div>
    );
}

function SafeThumb({
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
        <div className="relative h-[72px] w-[104px] shrink-0 overflow-hidden rounded-xl bg-[#E8ECE8]">
            {hasImage ? (
                <Image
                    src={src || ""}
                    alt={alt}
                    fill
                    sizes="104px"
                    className="object-cover transition duration-300 group-hover:scale-[1.02]"
                    onError={() => setFailed(true)}
                />
            ) : (
                <div className="grid h-full w-full place-items-center text-[#173C2E]">
                    <IoPlayOutline size={21} />
                </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
        </div>
    );
}

/* ---------------- tiny skeletons ---------------- */
function MetricSkeleton() {
    return (
        <div
            className="min-h-[156px] rounded-[16px] border border-[#E4DED2] bg-white p-4 animate-pulse"

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
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            whileHover={{ y: -2 }}
            className={[
                "group relative min-w-0 overflow-hidden",
                "min-h-[156px] rounded-[16px]",
                "border border-[#E4DED2] bg-white",
                "px-4 pb-4 pt-4",
                "transition-all duration-200",
                "hover:border-[#D8D0C2]",
                "hover:shadow-[0_10px_25px_rgba(15,23,42,0.045)]",
            ].join(" ")}
        >
            {icon ? (
                <div
                    className={[
                        "absolute right-3 top-3",
                        "grid h-9 w-9 shrink-0 place-items-center",
                        "rounded-[12px] bg-[#E8ECE8]",
                        "text-[#173C2E]",
                        "transition-all duration-200",
                        "group-hover:bg-[#173C2E]",
                        "group-hover:text-white",
                    ].join(" ")}
                >
                    {icon}
                </div>
            ) : null}

            <div className="min-w-0 pr-11">
                <div
                    className={[
                        "min-h-[26px]",
                        "text-[9px] font-black uppercase",
                        "leading-[13px]",
                        "tracking-[0.075em]",
                        "text-slate-400",
                    ].join(" ")}
                >
                    {label}
                </div>

                <div
                    className={[
                        "mt-2",
                        "text-[25px] font-black",
                        "leading-none tracking-[-0.04em]",
                        "text-[#173C2E]",
                    ].join(" ")}
                >
                    {nfmt(value)}
                </div>
            </div>

            {hint ? (
                <div
                    className={[
                        "absolute bottom-4 left-4 right-4",
                        "text-[9px] font-semibold",
                        "leading-[14px]",
                        "text-slate-400",
                    ].join(" ")}
                >
                    {hint}
                </div>
            ) : null}
        </motion.div>
    );
}

function Tip({
    title,
    body,
}: {
    title: string;
    body: string;
}) {
    return (
        <div className="flex gap-3 rounded-[14px] border border-[#E4DED2] bg-white p-3.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF4E3] text-[#F39A22]">
                <IoSparklesOutline size={16} />
            </div>

            <div className="min-w-0">
                <div className="text-[11px] font-black text-slate-800">
                    {title}
                </div>

                <div className="mt-1 text-[9px] font-medium leading-4 text-slate-400">
                    {body}
                </div>
            </div>
        </div>
    );
}

function MiniAreaChart({
    data,
    height = 120,
}: {
    data: number[];
    height?: number;
}) {
    const safeData =
        data.length > 0 ? data.map((value) => Number(value || 0)) : [0];

    const max =
        Math.max(1, ...safeData);

    const w = 700;
    const h = height;

    const pts = safeData
        .map((y, i) => {
            const x =
                (i /
                    Math.max(
                        1,
                        safeData.length - 1
                    )) *
                (w - 16) +
                8;

            const yy =
                h -
                8 -
                (y / max) *
                (h - 24);

            return `${x},${yy}`;
        })
        .join(" ");

    return (
        <div className="w-full overflow-hidden">
            <svg
                viewBox={`0 0 ${w} ${h}`}
                className="w-full"
            >
                <line
                    x1="8"
                    y1={h - 8}
                    x2={w - 8}
                    y2={h - 8}
                    stroke="#DDD8CC"
                />

                <polygon
                    points={`8,${h - 8} ${pts} ${w - 8},${h - 8}`}
                    fill="rgba(243,154,34,0.12)"
                    stroke="none"
                />

                <polyline
                    points={pts}
                    fill="none"
                    stroke="#F39A22"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
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
                acc.views += Number(p.stats?.views ?? 0);
                acc.likes += Number(p.stats?.likes ?? 0);
                acc.comments += Number(p.stats?.comments ?? 0);
                acc.shares += Number(p.stats?.shares ?? 0);
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
            if (map[k] !== undefined) map[k] += Number(p.stats?.views ?? 0);
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

    /* ---------------- Analytics header ---------------- */
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
                                    Analytics
                                </h1>

                                <p className="mt-1 text-[10px] font-medium text-white/50 sm:text-[11px]">
                                    Understand how your deeds and profile are performing.
                                </p>
                            </div>

                            <PremiumButton
                                href="/studio/upload"
                                variant="primary"
                            >
                                <IoAdd size={14} />
                                New deed
                            </PremiumButton>
                        </div>
                    </div>
                </div>
            </div>
        </motion.header>
    );

    /* ---------------- Main content ---------------- */
    const Main = (
        <div className={isDesktop ? "mx-auto max-w-[1180px] px-4 pb-10 pt-4 sm:px-5 md:px-6" : "px-3 pb-10 pt-3"}>
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px] xl:items-start">
                <section className="min-w-0 space-y-4">
                    {/* Creator summary */}
                    <Card>
                        <div className="p-4 sm:p-5">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                    <SafeAvatar
                                        src={profile?.photoURL || user?.photoURL}
                                        alt={handleText}
                                        size={54}
                                    />

                                    <div className="min-w-0">
                                        <div className="truncate text-[14px] font-black text-slate-900">
                                            {handleText}
                                        </div>

                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            <Chip active>
                                                Likes {likesHeader}
                                            </Chip>

                                            <Chip>
                                                Followers {followersText}
                                            </Chip>

                                            <Chip>
                                                Following {followingText}
                                            </Chip>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <PremiumButton
                                        href="/studio/deeds"
                                        variant="ghost"
                                    >
                                        Your deeds
                                    </PremiumButton>

                                    <PremiumButton
                                        href="/studio/upload"
                                        variant="primary"
                                    >
                                        <IoAdd size={14} />
                                        Upload
                                    </PremiumButton>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Metrics */}
                    <Card>
                        <div className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.09em] text-[#F39A22]">
                                        Performance
                                    </div>

                                    <h2 className="mt-1 text-[16px] font-black text-slate-900">
                                        Key metrics
                                    </h2>

                                    <p className="mt-1 text-[9px] font-medium text-slate-400">
                                        Current totals from your latest deeds and profile activity.
                                    </p>
                                </div>

                                <Chip>
                                    Last 7 days
                                </Chip>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-5">
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
                                        <Metric
                                            label="Deed views"
                                            value={totals.views}
                                            icon={<IoPlayOutline size={16} />}
                                            hint="Total content views"
                                        />

                                        <Metric
                                            label="Profile views"
                                            value={profileViewsTotal}
                                            icon={<IoEyeOutline size={16} />}
                                            hint="Profile reach"
                                        />

                                        <Metric
                                            label="Likes"
                                            value={totals.likes}
                                            icon={<IoHeartOutline size={16} />}
                                            hint="Engagement"
                                        />

                                        <Metric
                                            label="Comments"
                                            value={totals.comments}
                                            icon={<IoChatbubbleOutline size={16} />}
                                            hint="Replies"
                                        />

                                        <Metric
                                            label="Shares"
                                            value={totals.shares}
                                            icon={<IoShareSocialOutline size={16} />}
                                            hint="Virality"
                                        />
                                    </>
                                )}
                            </div>

                            {loading ? (
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    <ChartSkeleton height={140} />
                                    <ChartSkeleton height={140} />
                                </div>
                            ) : (
                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                    <div className="rounded-[16px] border border-[#E4DED2] bg-white p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                                    Deed views
                                                </div>

                                                <div className="mt-1 text-[11px] font-black text-slate-700">
                                                    Last 7 days
                                                </div>
                                            </div>

                                            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#FFF4E3] text-[#F39A22]">
                                                <IoTrendingUpOutline size={14} />
                                            </span>
                                        </div>

                                        <div className="mt-3">
                                            <MiniAreaChart
                                                data={series.map((item) => Number(item.y || 0))}
                                                height={140}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-[16px] border border-[#E4DED2] bg-white p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
                                                    Profile views
                                                </div>

                                                <div className="mt-1 text-[11px] font-black text-slate-700">
                                                    Last 7 days
                                                </div>
                                            </div>

                                            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                                                <IoEyeOutline size={14} />
                                            </span>
                                        </div>

                                        <div className="mt-3">
                                            <MiniAreaChart
                                                data={pvSeries.map((value) => Number(value || 0))}
                                                height={140}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Recent posts */}
                    <Card>
                        <div className="border-b border-[#E4DED2] px-4 py-4 sm:px-5">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                                        Content performance
                                    </div>

                                    <h2 className="mt-1 text-[15px] font-black text-slate-900">
                                        Recent deeds
                                    </h2>
                                </div>

                                <Link
                                    href="/studio/deeds"
                                    className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-[9px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
                                >
                                    View all
                                    <IoChevronForward size={12} />
                                </Link>
                            </div>
                        </div>

                        <div className="p-2 sm:p-3">
                            {loading ? (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-center py-5">
                                        <BouncingBallLoader />
                                    </div>

                                    <RowSkeleton />
                                    <RowSkeleton />
                                    <RowSkeleton />
                                </div>
                            ) : posts.length ? (
                                <div className="space-y-2">
                                    {posts.slice(0, 5).map((post) => (
                                        <motion.div
                                            key={post.id}
                                            initial={{ opacity: 0, y: 3 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.16 }}
                                        >
                                            <Link
                                                href={`/studio/analytics/${post.id}`}
                                                className="group flex min-w-0 items-center gap-3 rounded-[14px] border border-[#E4DED2] bg-white p-3 transition hover:border-[#CFC8BB] hover:bg-[#FDFCF9]"
                                            >
                                                <SafeThumb
                                                    src={
                                                        post.mediaThumbUrl ||
                                                        post.media?.[0]?.thumbUrl
                                                    }
                                                    alt={post.caption || "Deed"}
                                                />

                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-[11px] font-black text-slate-800">
                                                        {post.caption || "Untitled deed"}
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        <StatPill
                                                            icon={<IoPlayOutline size={11} />}
                                                            value={Number(post.stats?.views ?? 0)}
                                                            title="Views"
                                                        />

                                                        <StatPill
                                                            icon={<IoHeartOutline size={11} />}
                                                            value={Number(post.stats?.likes ?? 0)}
                                                            title="Likes"
                                                        />

                                                        <StatPill
                                                            icon={<IoChatbubbleOutline size={11} />}
                                                            value={Number(post.stats?.comments ?? 0)}
                                                            title="Comments"
                                                        />

                                                        <StatPill
                                                            icon={<IoShareSocialOutline size={11} />}
                                                            value={Number(post.stats?.shares ?? 0)}
                                                            title="Shares"
                                                        />
                                                    </div>

                                                    {post.createdAtMs ? (
                                                        <div className="mt-2 inline-flex items-center gap-1 text-[8px] font-semibold text-slate-400">
                                                            <IoTimeOutline size={10} />
                                                            {new Date(post.createdAtMs).toLocaleString()}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <IoChevronForward
                                                    size={14}
                                                    className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#173C2E]"
                                                />
                                            </Link>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <div className="grid min-h-[240px] place-items-center px-5 text-center">
                                    <div>
                                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#E8ECE8] text-[#173C2E]">
                                            <IoBarChartOutline size={23} />
                                        </div>

                                        <div className="mt-4 text-[14px] font-black text-slate-800">
                                            No deeds yet
                                        </div>

                                        <p className="mx-auto mt-1 max-w-sm text-[10px] font-medium leading-4 text-slate-400">
                                            Publish your first deed to begin building performance history.
                                        </p>

                                        <PremiumButton
                                            href="/studio/upload"
                                            variant="primary"
                                            className="mt-4"
                                        >
                                            <IoAdd size={13} />
                                            Create deed
                                        </PremiumButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
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
                            Audience
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            <RailStat
                                label="Followers"
                                value={Number(profile?.followersCount ?? 0)}
                                icon={<IoPeopleOutline size={14} />}
                            />

                            <RailStat
                                label="Following"
                                value={Number(profile?.followingCount ?? 0)}
                                icon={<IoPeopleOutline size={14} />}
                            />

                            <RailStat
                                label="Profile views"
                                value={Number(profileViewsTotal ?? 0)}
                                icon={<IoEyeOutline size={14} />}
                            />

                            <RailStat
                                label="Likes"
                                value={Number(profile?.likesTotal ?? totals.likes)}
                                icon={<IoHeartOutline size={14} />}
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
                                    Improve reach
                                </div>

                                <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
                                    Use clear cover images, focused captions and consistent posting to help members understand your content quickly.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                        <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                            Creator tips
                        </div>

                        <div className="mt-3 space-y-2">
                            <Tip
                                title="Use strong covers"
                                body="Bright, contextual covers make it easier for members to understand a deed before opening it."
                            />

                            <Tip
                                title="Post consistently"
                                body="A steady publishing cadence gives your audience more opportunities to engage."
                            />
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

            {isMobile ? (
                <div
                    style={{
                        height: "env(safe-area-inset-bottom)",
                    }}
                />
            ) : null}
        </div>
    );

    /* ---------------- Loading screen ---------------- */
    if (
        loading &&
        posts.length === 0 &&
        !profile
    ) {
        const LoadingBody = (
            <div className="grid min-h-[100svh] place-items-center bg-[#F8F7F2]">
                <div className="text-center">
                    <BouncingBallLoader />

                    <p className="mt-3 text-[10px] font-semibold text-slate-400">
                        Loading Studio analytics…
                    </p>
                </div>
            </div>
        );

        return isMobile ? (
            LoadingBody
        ) : (
            <AppShell>
                {LoadingBody}
            </AppShell>
        );
    }

    /* ---------------- MOBILE ---------------- */
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
                    {Main}
                </div>
            </div>
        );
    }

    /* ---------------- DESKTOP ---------------- */
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
                    {Main}
                </StudioShell>
            </div>
        </AppShell>
    );
}