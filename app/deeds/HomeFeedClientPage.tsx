"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/app/components/AppShell";
import { FeedShell } from "./components/FeedShell";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../providers/UserProfileProvider";
import OpenInAppBanner from "../components/OpenInAppBanner";
import { EkariSideMenuSheet } from "../components/EkariSideMenuSheet";
import MobileBottomTabs from "../components/navigation/MobileBottomTabs";
import DiscoveryRail from "../components/DiscoveryRail";

type Props = {
  archivePageNumber?: number;
  hasNextPage?: boolean;
  archiveMode?: "deeds" | null;
};

type TabKey = "deeds" | "market" | "experts" | "bonga";

function useWarmAuthorStub() {
  return React.useCallback((_authorId: string) => { }, []);
}

export default function HomeFeedClientPage({
  archivePageNumber = 1,
  hasNextPage = false,
  archiveMode = null,
}: Props) {
  const router = useRouter();
  const { user, loading: authLoading, signOutUser } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { unreadDM, notifTotal } = useInboxTotalsWeb(!!user?.uid, user?.uid);

  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshingTab, setRefreshingTab] = useState<TabKey | null>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  const warmAuthor = useWarmAuthorStub();
  const isSuspended = profile?.isSuspended === true;
  const suspendedReason =
    (profile as any)?.suspendedReason ||
    "Your account has been suspended due to community guideline violations.";

  const fallbackName = [(profile as any)?.firstName, (profile as any)?.surname]
    .filter(Boolean)
    .join(" ");

  const profileForShell = useMemo(
    () => ({
      photoURL: profile?.photoURL ?? (user as any)?.photoURL ?? null,
      handle: profile?.handle ?? null,
      name: (profile as any)?.name ?? fallbackName,
    }),
    [profile, user, fallbackName],
  );

  const profileHref = profile?.handle ? `/${profile.handle}` : "/getstarted";
  const loading = authLoading || profileLoading;

  const goUpload = () => {
    router.push(user?.uid ? "/studio/upload" : "/getstarted?next=/studio/upload");
  };

  const triggerTabRefresh = useCallback((key: TabKey) => {
    setRefreshingTab(key);
    if (key === "deeds") setFeedRefreshKey((value) => value + 1);
    window.setTimeout(() => {
      setRefreshingTab((current) => (current === key ? null : current));
    }, 900);
  }, []);

  if (archiveMode === "deeds") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0B1D12] px-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-black">Archive mode</h1>
          <p className="mt-3 text-white/60">Page {archivePageNumber}</p>
          <div className="mt-5 flex justify-center gap-3">
            {archivePageNumber > 1 && (
              <a
                href={archivePageNumber === 2 ? "/deeds" : `/deeds/page/${archivePageNumber - 1}`}
                className="rounded-xl border border-white/15 px-4 py-2 font-bold"
              >
                Previous
              </a>
            )}
            {hasNextPage && (
              <a
                href={`/deeds/page/${archivePageNumber + 1}`}
                className="rounded-xl bg-[#F3A526] px-4 py-2 font-black text-[#173C2E]"
              >
                Next
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      rightRail={
        <DiscoveryRail />
      }
      handle={profile?.handle ?? undefined}>
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
        isSuspended={isSuspended}
        suspendedReason={suspendedReason}
      />

      <div className="lg:hidden">
        <MobileBottomTabs
          onCreate={goUpload}
          theme="dark"
          activeKey="deeds"
          refreshingKey={refreshingTab}
          onActiveTabClick={triggerTabRefresh}
        />
      </div>

      <EkariSideMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        uid={user?.uid}
        handle={profile?.handle ?? null}
        photoURL={profile?.photoURL ?? null}
        profileHref={profileHref}
        unreadDM={user?.uid ? unreadDM ?? 0 : 0}
        notifTotal={user?.uid ? notifTotal ?? 0 : 0}
        onLogout={signOutUser}
      />
    </AppShell>
  );
}
