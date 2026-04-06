"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/AppShell";
import { FeedShell } from "./components/FeedShell";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../providers/UserProfileProvider";
import OpenInAppBanner from "../components/OpenInAppBanner";
import { EkariSideMenuSheet } from "../components/EkariSideMenuSheet";
import MobileBottomTabs from "../components/navigation/MobileBottomTabs";

const EKARI = {
  bg: "#ffffff",
  text: "#111827",
  subtext: "#6B7280",
  hair: "#E5E7EB",
  primary: "#C79257",
};

function useWarmAuthorStub() {
  return React.useCallback((_authorId: string) => {
    // no-op for now
  }, []);
}

function useIsDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= breakpoint);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [breakpoint]);

  return isDesktop;
}

type Props = {
  archivePageNumber?: number;
  hasNextPage?: boolean;
  archiveMode?: "deeds" | null;
};

type TabKey = "deeds" | "market" | "nexus" | "bonga";

export default function HomeFeedClientPage({
  archivePageNumber = 1,
  hasNextPage = false,
  archiveMode = null,
}: Props) {
  const isDesktop = useIsDesktop();

  const { user, loading: authLoading, signOutUser } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { unreadDM, notifTotal } = useInboxTotalsWeb(!!user?.uid, user?.uid);

  const handle = (profile as any)?.handle ?? null;
  const profileHref =
    handle && String(handle).trim().length > 0 ? `/${handle}` : "/getstarted";

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [refreshingTab, setRefreshingTab] = useState<TabKey | null>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  const warmAuthor = useWarmAuthorStub();

  const fallbackName =
    [((profile as any)?.firstName), ((profile as any)?.surname)]
      .filter(Boolean)
      .join(" ") || null;

  const profileForShell = useMemo(
    () => ({
      photoURL: profile?.photoURL ?? (user as any)?.photoURL ?? null,
      handle: profile?.handle ?? null,
      name: (profile as any)?.name ?? fallbackName,
    }),
    [profile, user, fallbackName]
  );

  const loading = authLoading || profileLoading;
  const router = useRouter();

  const goUpload = () => {
    if (!user?.uid) router.push("/getstarted?next=/studio/upload");
    else router.push("/studio/upload");
  };

  const triggerTabRefresh = useCallback((key: TabKey) => {
    setRefreshingTab(key);

    if (key === "deeds") {
      setFeedRefreshKey((prev) => prev + 1);
    }

    window.setTimeout(() => {
      setRefreshingTab((current) => (current === key ? null : current));
    }, 900);
  }, []);

  const contentArchive = (
    <div className="min-h-[100svh] text-white">
      <OpenInAppBanner
        webUrl={typeof window !== "undefined" ? window.location.href : "https://ekarihub.com/"}
        appUrl="ekarihub://"
        title="Open ekarihub"
        subtitle="Best experience in the app."
      />

      <div className="mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold">Archive mode</h1>
        <p className="mt-3 max-w-md text-sm text-white/75">
          This refactored client page is now optimized for the fast live feed.
          Keep archive pagination in your archive route/page, then use this
          component for the main mobile-style feed.
        </p>

        <div className="mt-6 flex items-center gap-3">
          {archivePageNumber > 1 ? (
            <a
              href={archivePageNumber === 2 ? "/deeds" : `/deeds/page/${archivePageNumber - 1}`}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              ← Prev
            </a>
          ) : (
            <span />
          )}

          <span className="text-sm font-semibold text-white/80">
            Page {archivePageNumber}
          </span>

          {hasNextPage ? (
            <a
              href={`/deeds/page/${archivePageNumber + 1}`}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white"
            >
              Next →
            </a>
          ) : (
            <span />
          )}
        </div>

        <button
          onClick={() => router.push("/deeds")}
          className="mt-6 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
        >
          Open live feed
        </button>
      </div>
    </div>
  );

  const contentLiveFeed = (
    <div className="relative min-h-[100svh]">
      <OpenInAppBanner
        webUrl={typeof window !== "undefined" ? window.location.href : "https://ekarihub.com/"}
        appUrl="ekarihub://"
        title="Open ekarihub"
        subtitle="Best experience in the app."
      />

      <FeedShell
        uid={user?.uid ?? null}
        profile={profileForShell}
        warmAuthor={warmAuthor}
        dataSaverOn={false}
        onOpenMenu={() => setMenuOpen(true)}
        loading={loading}
        refreshKey={feedRefreshKey}
      />

      {!isDesktop && (
        <MobileBottomTabs
          onCreate={goUpload}
          theme="dark"
          activeKey="deeds"
          refreshingKey={refreshingTab}
          onActiveTabClick={triggerTabRefresh}
        />
      )}

      <EkariSideMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        uid={user?.uid}
        handle={(profile as any)?.handle ?? null}
        photoURL={(profile as any)?.photoURL ?? null}
        profileHref={profileHref}
        unreadDM={user?.uid ? unreadDM ?? 0 : 0}
        notifTotal={user?.uid ? notifTotal ?? 0 : 0}
        onLogout={signOutUser}
      />
    </div>
  );

  if (archiveMode === "deeds") {
    return isDesktop ? <AppShell>{contentArchive}</AppShell> : <div>{contentArchive}</div>;
  }

  return isDesktop ? <AppShell>{contentLiveFeed}</AppShell> : <div>{contentLiveFeed}</div>;
}