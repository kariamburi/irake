"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import { useAuth } from "../hooks/useAuth";

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

export default function SuggestionsPage() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [activeTab, setActiveTab] = useState<SuggestionTab>("profiles");

  const [suggestedProfiles, setSuggestedProfiles] = useState<SuggestedProfile[]>([]);
  const [suggestedEvents, setSuggestedEvents] = useState<SuggestedEvent[]>([]);
  const [suggestedDiscussions, setSuggestedDiscussions] = useState<SuggestedDiscussion[]>([]);
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
    handle ? `/@${encodeURIComponent(handle.startsWith("@") ? handle.slice(1) : handle)}` : null;

  return (
    <AppShell rightRail={null}>
      <main className="min-h-screen w-full bg-gray-100">
        <div className="mx-auto max-w-5xl px-4 pt-5 pb-10">
          {/* Header */}
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

          {/* Tabs */}
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
                        <div>
                          <h2 className="text-sm md:text-base font-semibold" style={{ color: EKARI.text }}>
                            {name}
                          </h2>
                          <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
                            Suggested profile
                          </p>
                        </div>
                        {profilePath && (
                          <Link
                            href={profilePath}
                            className="rounded-full px-3 py-1 text-xs md:text-sm font-semibold border"
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
                        <h2 className="text-sm md:text-base font-semibold" style={{ color: EKARI.text }}>
                          {e.title || "Untitled event"}
                        </h2>
                        <div className="mt-1 text-xs md:text-sm space-y-0.5" style={{ color: EKARI.dim }}>
                          {e.location && <p>{e.location}</p>}
                          {/* You can format e.date here if it's a Timestamp */}
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
                      <h2 className="text-sm md:text-base font-semibold" style={{ color: EKARI.text }}>
                        {d.title || "Discussion"}
                      </h2>
                      {d.hashtag && (
                        <p className="mt-1 text-xs md:text-sm" style={{ color: EKARI.dim }}>
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
    </AppShell>
  );
}

function TabChip({
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
      className={[
        "px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold border transition",
        active
          ? "shadow-sm"
          : "bg-white hover:bg-gray-50",
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
