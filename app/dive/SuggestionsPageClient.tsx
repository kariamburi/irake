"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { IoArrowBack } from "react-icons/io5";

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

export default function SuggestionsPageClient() {
    const { user } = useAuth();
    const uid = user?.uid;

    const isDesktop = useIsDesktop();
    const isMobile = useIsMobile();

    const [activeTab, setActiveTab] = useState<SuggestionTab>("profiles");

    const [suggestedProfiles, setSuggestedProfiles] = useState<SuggestedProfile[]>(
        []
    );
    const [suggestedEvents, setSuggestedEvents] = useState<SuggestedEvent[]>([]);
    const [suggestedDiscussions, setSuggestedDiscussions] = useState<
        SuggestedDiscussion[]
    >([]);
    const [loading, setLoading] = useState(true);

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
            },
            () => setSuggestedProfiles([])
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

        const t = setTimeout(() => setLoading(false), 200);

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

    const MobileChrome = ({
        children,
    }: {
        children: React.ReactNode;
    }) => (
        <div className="fixed inset-0 flex flex-col bg-white">
            {/* Sticky top bar */}
            <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
                <div className="px-3" style={{ paddingTop: "env(safe-area-inset-top)" }}>
                    <div className="h-14 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof window !== "undefined" && window.history.length > 1)
                                    window.history.back();
                                else window.location.href = "/";
                            }}
                            className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
                            aria-label="Back"
                            title="Back"
                        >
                            <IoArrowBack size={18} color={EKARI.text} />
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-extrabold text-gray-900 truncate">
                                Suggestions
                            </div>
                            <div className="text-[11px] text-gray-500 truncate">
                                Profiles, events & discussions for you
                            </div>
                        </div>

                        <Link
                            href="/search"
                            className="h-10 px-3 rounded-full border border-gray-200 text-xs font-semibold grid place-items-center"
                            style={{ color: EKARI.text }}
                        >
                            Search
                        </Link>
                    </div>

                    {/* Tabs (mobile) */}
                    <div className="w-full overflow-x-auto pb-2 no-scrollbar">
                        <div className="flex gap-2">
                            <TabChip
                                label="Profiles"
                                active={activeTab === "profiles"}
                                onClick={() => setActiveTab("profiles")}
                                compact
                            />
                            <TabChip
                                label="Events"
                                active={activeTab === "events"}
                                onClick={() => setActiveTab("events")}
                                compact
                            />
                            <TabChip
                                label="Discussions"
                                active={activeTab === "discussions"}
                                onClick={() => setActiveTab("discussions")}
                                compact
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>

            <div style={{ height: "env(safe-area-inset-bottom)" }} />
        </div>
    );

    const PageBody = (
        <main className="min-h-screen w-full bg-white">
            <div className="mx-auto max-w-5xl px-4 pt-5 pb-10">
                {/* Desktop header only (mobile has its own chrome) */}
                {isDesktop && (
                    <header className="mb-6">
                        <h1
                            className="text-2xl md:text-3xl font-extrabold tracking-tight"
                            style={{ color: EKARI.text }}
                        >
                            Suggestions for you
                        </h1>
                        <p className="mt-1 text-sm md:text-base" style={{ color: EKARI.dim }}>
                            Profiles, events & discussions recommended based on your activity.
                        </p>
                    </header>
                )}

                {/* If not logged in */}
                {!uid && (
                    <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
                        <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                            Sign in to see personalised suggestions on ekarihub.
                        </p>
                        <Link
                            href="/getstarted"
                            className="inline-flex mt-3 rounded-full px-4 py-2 text-sm font-semibold shadow-sm"
                            style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                        >
                            Get started
                        </Link>
                    </div>
                )}

                {/* Tabs (desktop only; mobile has tabs in top bar) */}
                {isDesktop && (
                    <div className="mt-6 flex flex-wrap gap-2">
                        <TabChip
                            label="Profiles"
                            active={activeTab === "profiles"}
                            onClick={() => setActiveTab("profiles")}
                        />
                        <TabChip
                            label="Events"
                            active={activeTab === "events"}
                            onClick={() => setActiveTab("events")}
                        />
                        <TabChip
                            label="Discussions"
                            active={activeTab === "discussions"}
                            onClick={() => setActiveTab("discussions")}
                        />
                    </div>
                )}

                {/* List area */}
                <section className="mt-4">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center">
                            <div
                                className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                                style={{ borderColor: EKARI.forest }}
                            />
                        </div>
                    ) : dataForTab.length === 0 ? (
                        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center">
                            <p className="text-sm md:text-base" style={{ color: EKARI.dim }}>
                                No suggestions here yet. Keep exploring ekarihub to see more.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {dataForTab.map((item: any, index: number) => {
                                if (activeTab === "profiles") {
                                    const p = item as SuggestedProfile;
                                    const name =
                                        p.handle ||
                                        [p.firstName, p.surname].filter(Boolean).join(" ") ||
                                        "Suggested profile";
                                    const profilePath = handleToPath(p.handle);

                                    return (
                                        <article
                                            key={p.id ?? index}
                                            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <h2
                                                    className="text-sm md:text-base font-semibold truncate"
                                                    style={{ color: EKARI.text }}
                                                >
                                                    {name}
                                                </h2>
                                                <p
                                                    className="mt-1 text-xs md:text-sm"
                                                    style={{ color: EKARI.dim }}
                                                >
                                                    Suggested profile
                                                </p>
                                            </div>
                                            {profilePath && (
                                                <Link
                                                    href={profilePath}
                                                    className="shrink-0 rounded-full px-3 py-1 text-xs md:text-sm font-semibold border"
                                                    style={{
                                                        borderColor: EKARI.forest,
                                                        color: EKARI.forest,
                                                    }}
                                                >
                                                    View profile
                                                </Link>
                                            )}
                                        </article>
                                    );
                                }

                                if (activeTab === "events") {
                                    const e = item as SuggestedEvent;
                                    return (
                                        <article
                                            key={e.id ?? index}
                                            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                                        >
                                            <h2
                                                className="text-sm md:text-base font-semibold"
                                                style={{ color: EKARI.text }}
                                            >
                                                {e.title || "Untitled event"}
                                            </h2>
                                            <div
                                                className="mt-1 text-xs md:text-sm space-y-0.5"
                                                style={{ color: EKARI.dim }}
                                            >
                                                {e.location && <p>{e.location}</p>}
                                                {/* format e.date if needed */}
                                            </div>
                                        </article>
                                    );
                                }

                                const d = item as SuggestedDiscussion;
                                return (
                                    <article
                                        key={d.id ?? index}
                                        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                                    >
                                        <h2
                                            className="text-sm md:text-base font-semibold"
                                            style={{ color: EKARI.text }}
                                        >
                                            {d.title || "Discussion"}
                                        </h2>
                                        {d.hashtag && (
                                            <p
                                                className="mt-1 text-xs md:text-sm"
                                                style={{ color: EKARI.dim }}
                                            >
                                                #{d.hashtag}
                                            </p>
                                        )}
                                    </article>
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
    return (
        <AppShell rightRail={null}>
            {PageBody}
        </AppShell>
    );
}

function TabChip({
    label,
    active,
    onClick,
    compact,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
    compact?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                compact ? "px-3 py-1" : "px-4 py-1.5",
                "rounded-full text-xs md:text-sm font-semibold border transition",
                active ? "shadow-sm" : "bg-white hover:bg-gray-50",
            ].join(" ")}
            style={{
                borderColor: active ? EKARI.forest : EKARI.hair,
                backgroundColor: active ? EKARI.forest : undefined,
                color: active ? EKARI.sand : EKARI.text,
            }}
        >
            {label}
        </button>
    );
}
