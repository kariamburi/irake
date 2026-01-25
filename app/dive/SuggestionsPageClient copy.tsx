"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { IoArrowBack, IoSearch } from "react-icons/io5";
import { getFunctions, httpsCallable } from "firebase/functions";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
};

type SuggestionTab = "profiles" | "events" | "discussions";

type SuggestedProfile = {
    id?: string;
    handle?: string;
    firstName?: string;
    surname?: string;
    photoURL?: string;
    [key: string]: any;
};

type SuggestedEvent = {
    id?: string;
    title?: string;
    date?: any;
    location?: string;
    [key: string]: any;
};

type SuggestedDiscussion = {
    id?: string;
    title?: string;
    hashtag?: string;
    [key: string]: any;
};

/* ---------------------------- Responsive helpers ---------------------------- */
function useMediaQuery(queryStr: string) {
    const [matches, setMatches] = React.useState(false);
    React.useEffect(() => {
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

/* ---------------------------- Premium UI helpers ---------------------------- */
function cn(...xs: (string | false | null | undefined)[]) {
    return xs.filter(Boolean).join(" ");
}

function PageGlowBg({ mode }: { mode: "light" | "dark" }) {
    if (mode === "dark") {
        return (
            <div
                aria-hidden
                className="fixed inset-0 -z-10"
                style={{
                    background:
                        "radial-gradient(900px circle at 20% 0%, rgba(199,146,87,0.18), transparent 55%), radial-gradient(850px circle at 85% 20%, rgba(35,63,57,0.18), transparent 55%), linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(3,7,18,1) 100%)",
                }}
            />
        );
    }
    return (
        <div
            aria-hidden
            className="fixed inset-0 -z-10"
            style={{
                background:
                    "radial-gradient(1100px circle at 12% 8%, rgba(199,146,87,0.18), transparent 55%), radial-gradient(1000px circle at 92% 18%, rgba(35,63,57,0.12), transparent 55%), linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 55%, rgba(255,255,255,1) 100%)",
            }}
        />
    );
}

function GlassBar({
    children,
    className,
}: React.PropsWithChildren<{ className?: string }>) {
    return (
        <div
            className={cn(
                "relative border-b backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl",
                className
            )}
            style={{
                background:
                    "linear-gradient(135deg, rgba(35,63,57,0.94), rgba(199,146,87,0.86))",
                borderColor: "rgba(15,23,42,0.14)",
                boxShadow: "0 18px 55px rgba(15,23,42,0.18)",
            }}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(900px circle at 12% 10%, rgba(199,146,87,0.18), transparent 45%), radial-gradient(800px circle at 92% 20%, rgba(35,63,57,0.14), transparent 55%)",
                }}
            />
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{ background: "rgba(255,255,255,0.55)" }}
            />
            <div className="relative">{children}</div>
        </div>
    );
}

function PremiumIconButton({
    children,
    onClick,
    label,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
                "h-10 w-10 rounded-2xl grid place-items-center border transition",
                "bg-white/12 border-white/18 text-white hover:bg-white/16",
                "hover:scale-[1.03] active:scale-[0.98]"
            )}
            style={{ boxShadow: "0 18px 55px rgba(0,0,0,0.20)" }}
        >
            {children}
        </button>
    );
}

function PremiumPillLink({
    href,
    children,
    ariaLabel,
}: {
    href: string;
    children: React.ReactNode;
    ariaLabel: string;
}) {
    return (
        <Link
            href={href}
            aria-label={ariaLabel}
            className={cn(
                "h-10 px-3 rounded-full inline-flex items-center gap-2",
                "border border-white/18 bg-white/12 text-white",
                "hover:bg-white/16 transition font-extrabold text-xs"
            )}
            style={{ boxShadow: "0 18px 55px rgba(0,0,0,0.18)" }}
        >
            {children}
        </Link>
    );
}

function SegmentedTabs({
    activeTab,
    setActiveTab,
}: {
    activeTab: SuggestionTab;
    setActiveTab: (t: SuggestionTab) => void;
}) {
    const tabs: { key: SuggestionTab; label: string }[] = [
        { key: "profiles", label: "Profiles" },
        { key: "events", label: "Events" },
        { key: "discussions", label: "Discussions" },
    ];

    return (
        <div className="w-full overflow-x-auto no-scrollbar">
            <div
                className={cn(
                    "inline-flex items-center gap-1 rounded-full p-1",
                    "border border-white/18 bg-white/10 backdrop-blur-md",
                    "shadow-[0_18px_55px_rgba(0,0,0,0.18)]"
                )}
            >
                {tabs.map((t) => {
                    const isActive = activeTab === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setActiveTab(t.key)}
                            className={cn(
                                "px-3 py-2 rounded-full text-[11px] font-extrabold transition",
                                "min-w-[92px] flex items-center justify-center"
                            )}
                            style={{
                                color: isActive ? "#0B1220" : "rgba(255,255,255,0.88)",
                                background: isActive
                                    ? "linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72))"
                                    : "transparent",
                                boxShadow: isActive ? "0 14px 40px rgba(0,0,0,0.22)" : "none",
                            }}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function PremiumCard({
    children,
    className,
}: React.PropsWithChildren<{ className?: string }>) {
    return (
        <article
            className={cn(
                "rounded-3xl border bg-white",
                "shadow-[0_22px_70px_rgba(15,23,42,0.10)]",
                "overflow-hidden",
                className
            )}
            style={{ borderColor: "rgba(15,23,42,0.10)" }}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-0"
            />
            {children}
        </article>
    );
}

function SkeletonRow() {
    return (
        <div className="rounded-3xl border bg-white p-4">
            <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-gray-100 animate-pulse" />
                <div className="flex-1">
                    <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
                    <div className="mt-2 h-3 w-28 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-9 w-28 rounded-full bg-gray-100 animate-pulse" />
            </div>
        </div>
    );
}

/* ------------------------------- Main page ------------------------------- */
export default function SuggestionsPageClient() {
    const { user } = useAuth();
    const uid = user?.uid;

    const isDesktop = useIsDesktop();
    const isMobile = useIsMobile();

    const [activeTab, setActiveTab] = useState<SuggestionTab>("profiles");

    const [suggestedProfiles, setSuggestedProfiles] = useState<SuggestedProfile[]>([]);
    const [suggestedEvents, setSuggestedEvents] = useState<SuggestedEvent[]>([]);
    const [suggestedDiscussions, setSuggestedDiscussions] = useState<SuggestedDiscussion[]>([]);
    const [loading, setLoading] = useState(true);
    const calledRef = React.useRef(false);

    useEffect(() => {
        if (!uid) return;
        if (calledRef.current) return;
        calledRef.current = true;

        const run = async () => {
            try {
                const functions = getFunctions(undefined, "us-central1");
                const refresh = httpsCallable(functions, "refreshSuggestionsForMe");
                const res = await refresh({ force: false });
                console.log("refreshSuggestionsForMe:", res.data);
            } catch (e: any) {
                console.error("refreshSuggestionsForMe failed:", e?.message || e);
                if (e?.details?.indexUrl) console.error("Create Firestore index here:", e.details.indexUrl);
            }
        };

        run();
    }, [uid]);


    // Subscribe to suggestions per user
    useEffect(() => {
        if (!uid) {
            setSuggestedProfiles([]);
            setSuggestedEvents([]);
            setSuggestedDiscussions([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const profilesRef = doc(db, "users", uid, "suggestions", "profiles");
        const unsubProfiles = onSnapshot(
            profilesRef,
            (snap) => {
                const data: any = snap.data() || {};
                const items = Array.isArray(data.items) ? data.items : [];
                setSuggestedProfiles(items as SuggestedProfile[]);
                setLoading(false);
            },
            () => {
                setSuggestedProfiles([]);
                setLoading(false);
            }
        );

        const discussionsRef = doc(db, "users", uid, "suggestions", "discussions");
        const unsubDiscussions = onSnapshot(
            discussionsRef,
            (snap) => {
                const data: any = snap.data() || {};
                const items = Array.isArray(data.items) ? data.items : [];
                setSuggestedDiscussions(items as SuggestedDiscussion[]);
            },
            () => setSuggestedDiscussions([])
        );

        const eventsRef = doc(db, "users", uid, "suggestions", "events");
        const unsubEvents = onSnapshot(
            eventsRef,
            (snap) => {
                const data: any = snap.data() || {};
                const items = Array.isArray(data.items) ? data.items : [];
                setSuggestedEvents(items as SuggestedEvent[]);
            },
            () => setSuggestedEvents([])
        );

        const t = setTimeout(() => setLoading(false), 220);

        return () => {
            unsubProfiles();
            unsubDiscussions();
            unsubEvents();
            clearTimeout(t);
        };
    }, [uid]);

    const dataForTab = useMemo(() => {
        switch (activeTab) {
            case "profiles":
                return suggestedProfiles;
            case "events":
                return suggestedEvents;
            case "discussions":
                return suggestedDiscussions;
            default:
                return [];
        }
    }, [activeTab, suggestedProfiles, suggestedEvents, suggestedDiscussions]);

    const handleToPath = (handle?: string) =>
        handle
            ? `/@${encodeURIComponent(handle.startsWith("@") ? handle.slice(1) : handle)}`
            : null;

    const MobileChrome = ({ children }: { children: React.ReactNode }) => (
        <div className="fixed inset-0 flex flex-col">
            <PageGlowBg mode="light" />

            {/* Sticky top bar (premium glass) */}
            <div className="sticky top-0 z-50">
                <GlassBar>
                    <div className="px-3" style={{ paddingTop: "env(safe-area-inset-top)" }}>
                        <div className="h-14 flex items-center gap-2">
                            <PremiumIconButton
                                label="Back"
                                onClick={() => {
                                    if (typeof window !== "undefined" && window.history.length > 1)
                                        window.history.back();
                                    else window.location.href = "/";
                                }}
                            >
                                <IoArrowBack size={18} />
                            </PremiumIconButton>

                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-white truncate">
                                    Dive In
                                </div>
                                <div className="text-[11px] text-white/80 truncate">
                                    Profiles, events & discussions for you
                                </div>
                            </div>

                            <PremiumPillLink href="/search" ariaLabel="Search">
                                <IoSearch />
                                <span>Search</span>
                            </PremiumPillLink>
                        </div>

                        {/* Segmented tabs */}
                        <div className="pb-3">
                            <SegmentedTabs activeTab={activeTab} setActiveTab={setActiveTab} />
                        </div>
                    </div>
                </GlassBar>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
            <div style={{ height: "env(safe-area-inset-bottom)" }} />
        </div>
    );

    const PageBody = (
        <main className="min-h-screen w-full">
            <PageGlowBg mode="light" />

            <div className="mx-auto max-w-5xl px-4 pt-5 pb-10">
                {/* Desktop header only */}
                {isDesktop && (
                    <header className="mb-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h1
                                    className="text-2xl md:text-3xl font-black tracking-tight truncate"
                                    style={{ color: EKARI.text }}
                                >
                                    Dive In
                                </h1>
                                <p className="mt-1 text-sm md:text-base" style={{ color: EKARI.dim }}>
                                    Profiles, events & discussions recommended based on your activity.
                                </p>
                            </div>

                            <Link
                                href="/search"
                                className={cn(
                                    "shrink-0 h-10 px-4 rounded-full inline-flex items-center gap-2",
                                    "border bg-white/70 backdrop-blur-md",
                                    "shadow-[0_22px_70px_rgba(15,23,42,0.10)]"
                                )}
                                style={{ borderColor: "rgba(15,23,42,0.10)", color: EKARI.text }}
                            >
                                <IoSearch />
                                <span className="text-sm font-extrabold">Search</span>
                            </Link>
                        </div>

                        {/* Desktop tabs */}
                        <div className="mt-5">
                            <div
                                className="inline-flex items-center gap-1 rounded-full p-1 border bg-white/70 backdrop-blur-md"
                                style={{
                                    borderColor: "rgba(15,23,42,0.10)",
                                    boxShadow: "0 22px 70px rgba(15,23,42,0.10)",
                                }}
                            >
                                <DesktopTab
                                    label="Profiles"
                                    active={activeTab === "profiles"}
                                    onClick={() => setActiveTab("profiles")}
                                />
                                <DesktopTab
                                    label="Events"
                                    active={activeTab === "events"}
                                    onClick={() => setActiveTab("events")}
                                />
                                <DesktopTab
                                    label="Discussions"
                                    active={activeTab === "discussions"}
                                    onClick={() => setActiveTab("discussions")}
                                />
                            </div>
                        </div>
                    </header>
                )}

                {/* If not logged in */}
                {!uid && (
                    <div
                        className="mt-6 rounded-3xl border border-dashed bg-white/70 backdrop-blur-md p-6 text-center"
                        style={{
                            borderColor: "rgba(15,23,42,0.18)",
                            boxShadow: "0 22px 70px rgba(15,23,42,0.10)",
                        }}
                    >
                        <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                            Sign in to see personalised suggestions on ekarihub.
                        </p>
                        <Link
                            href="/getstarted"
                            className="inline-flex mt-3 rounded-full px-4 py-2 text-sm font-extrabold shadow-sm"
                            style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                        >
                            Get started
                        </Link>
                    </div>
                )}

                {/* List area */}
                <section className="mt-6">
                    {loading ? (
                        <div className="grid gap-3">
                            <SkeletonRow />
                            <SkeletonRow />
                            <SkeletonRow />
                        </div>
                    ) : dataForTab.length === 0 ? (
                        <div
                            className="rounded-3xl border bg-white/70 backdrop-blur-md p-6 text-center"
                            style={{
                                borderColor: "rgba(15,23,42,0.10)",
                                boxShadow: "0 22px 70px rgba(15,23,42,0.10)",
                            }}
                        >
                            <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                                No suggestions here yet. Keep exploring ekarihub to see more.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {dataForTab.map((item: any, index: number) => {
                                if (activeTab === "profiles") {
                                    const p = item as SuggestedProfile;
                                    const name =
                                        p.handle ||
                                        [p.firstName, p.surname].filter(Boolean).join(" ") ||
                                        "Suggested profile";
                                    const profilePath = handleToPath(p.handle);

                                    return (
                                        <PremiumCard key={p.id ?? index} className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-11 w-11 rounded-2xl overflow-hidden shrink-0 bg-gray-100">
                                                    <div
                                                        className="absolute inset-0"
                                                        style={{
                                                            background:
                                                                "linear-gradient(135deg, rgba(35,63,57,0.20), rgba(199,146,87,0.22))",
                                                        }}
                                                    />
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={p.photoURL || "/avatar-placeholder.png"}
                                                        alt={name}
                                                        className="relative h-full w-full object-cover"
                                                    />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <h2
                                                        className="text-sm md:text-base font-extrabold truncate"
                                                        style={{ color: EKARI.text }}
                                                    >
                                                        {name}
                                                    </h2>
                                                    <p className="mt-0.5 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                                                        Suggested profile
                                                    </p>
                                                </div>

                                                {profilePath && (
                                                    <Link
                                                        href={profilePath}
                                                        className={cn(
                                                            "shrink-0 rounded-full px-3 py-2 text-xs md:text-sm font-extrabold border transition",
                                                            "hover:scale-[1.02] active:scale-[0.99]"
                                                        )}
                                                        style={{
                                                            borderColor: "rgba(35,63,57,0.35)",
                                                            color: EKARI.forest,
                                                            background:
                                                                "linear-gradient(180deg, rgba(35,63,57,0.06), rgba(199,146,87,0.05))",
                                                        }}
                                                    >
                                                        View
                                                    </Link>
                                                )}
                                            </div>
                                        </PremiumCard>
                                    );
                                }

                                if (activeTab === "events") {
                                    const e = item as SuggestedEvent;
                                    return (
                                        <PremiumCard key={e.id ?? index} className="p-4">
                                            <h2
                                                className="text-sm md:text-base font-extrabold"
                                                style={{ color: EKARI.text }}
                                            >
                                                {e.title || "Untitled event"}
                                            </h2>
                                            <div className="mt-1 text-xs md:text-sm space-y-0.5" style={{ color: EKARI.dim }}>
                                                {e.location && <p>{e.location}</p>}
                                                {/* format e.date if needed */}
                                            </div>
                                        </PremiumCard>
                                    );
                                }

                                const d = item as SuggestedDiscussion;
                                return (
                                    <PremiumCard key={d.id ?? index} className="p-4">
                                        <h2
                                            className="text-sm md:text-base font-extrabold"
                                            style={{ color: EKARI.text }}
                                        >
                                            {d.title || "Discussion"}
                                        </h2>
                                        {d.hashtag && (
                                            <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                                                #{d.hashtag}
                                            </p>
                                        )}
                                    </PremiumCard>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );

    // ✅ Mobile: full-screen fixed layout (no AppShell)
    if (isMobile) return <MobileChrome>{PageBody}</MobileChrome>;

    // ✅ Desktop: keep AppShell
    return <AppShell rightRail={null}>{PageBody}</AppShell>;
}

/* ---------------------------- Desktop tab chip ---------------------------- */
function DesktopTab({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-full text-sm font-extrabold transition",
                active ? "shadow-sm" : "hover:bg-black/5"
            )}
            style={{
                background: active
                    ? "linear-gradient(135deg, rgba(35,63,57,0.10), rgba(199,146,87,0.10))"
                    : "transparent",
                color: active ? EKARI.text : EKARI.text,
                border: active ? "1px solid rgba(199,146,87,0.35)" : "1px solid transparent",
            }}
        >
            {label}
        </button>
    );
}
