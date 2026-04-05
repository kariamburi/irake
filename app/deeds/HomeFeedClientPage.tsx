"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import AppShell from "@/app/components/AppShell";

import BouncingBallLoader from "@/components/ui/TikBallsLoader";

import { FeedShell } from "./components/FeedShell";

import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { useAuth } from "../hooks/useAuth";
import { useUserProfile } from "../providers/UserProfileProvider";
import OpenInAppBanner from "../components/OpenInAppBanner";
import { EkariSideMenuSheet } from "../components/EkariSideMenuSheet";
import { IoAdd, IoCartOutline, IoChatbubblesOutline, IoCompassOutline, IoHome, IoHomeOutline } from "react-icons/io5";
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
function MobileBottomTabs({ onUpload }: { onUpload: () => void }) {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"; // ✅ only exact home
    return pathname === href || pathname.startsWith(href + "/");
  };

  const activeClass = "text-white";
  const inactiveClass = "text-white/70";

  const activeIconStyle = { color: EKARI.primary };
  const inactiveIconStyle = { color: "rgba(255,255,255,.70)" };

  const homeActive = isActive("/");
  const marketActive = isActive("/market");
  const nexusActive = isActive("/nexus");
  const bongaActive = isActive("/bonga");

  return (
    <div
      className="fixed left-0 right-0 z-[60]"
      style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto w-full max-w-[520px] h-[64px] px-4 flex items-center justify-between"
        style={{
          backgroundColor: "#000000",
          borderTop: "1px solid rgba(255,255,255,.10)",
        }}
      >
        {/* Home / Deeds */}
        <button
          onClick={() => router.push("/")}
          className={`flex flex-col items-center gap-1 ${homeActive ? activeClass : inactiveClass}`}
          aria-current={homeActive ? "page" : undefined}
        >
          {homeActive ? (
            <IoHome size={20} style={activeIconStyle} />
          ) : (
            <IoHomeOutline size={20} style={inactiveIconStyle} />
          )}
          <span className={`text-[11px] ${homeActive ? "font-black" : "font-semibold"}`}>
            Deeds
          </span>
          {homeActive && (
            <span
              className="mt-0.5 h-[3px] w-6 rounded-full"
              style={{ backgroundColor: EKARI.primary }}
            />
          )}
        </button>

        {/* Market */}
        <button
          onClick={() => router.push("/market")}
          className={`flex flex-col items-center gap-1 ${marketActive ? activeClass : inactiveClass}`}
          aria-current={marketActive ? "page" : undefined}
        >
          <IoCartOutline size={20} style={marketActive ? activeIconStyle : inactiveIconStyle} />
          <span className={`text-[11px] ${marketActive ? "font-black" : "font-semibold"}`}>
            ekariMarket
          </span>
        </button>

        {/* Center + */}
        <button
          onClick={onUpload}
          className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg"
          style={{ backgroundColor: EKARI.primary }}
          aria-label="Create"
        >
          <IoAdd size={26} color="#111827" />
        </button>

        {/* Nexus */}
        <button
          onClick={() => router.push("/nexus")}
          className={`flex flex-col items-center gap-1 ${nexusActive ? activeClass : inactiveClass}`}
          aria-current={nexusActive ? "page" : undefined}
        >
          <IoCompassOutline size={20} style={nexusActive ? activeIconStyle : inactiveIconStyle} />
          <span className={`text-[11px] ${nexusActive ? "font-black" : "font-semibold"}`}>
            Nexus
          </span>
        </button>

        {/* Bonga */}
        <button
          onClick={() => router.push("/bonga")}
          className={`flex flex-col items-center gap-1 ${bongaActive ? activeClass : inactiveClass}`}
          aria-current={bongaActive ? "page" : undefined}
        >
          <IoChatbubblesOutline size={20} style={bongaActive ? activeIconStyle : inactiveIconStyle} />
          <span className={`text-[11px] ${bongaActive ? "font-black" : "font-semibold"}`}>
            Bonga
          </span>
        </button>
      </div>
    </div>
  );
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

export default function HomeFeedClientPage({
  archivePageNumber = 1,
  hasNextPage = false,
  archiveMode = null,
}: Props) {
  const router = useRouter();
  const isDesktop = useIsDesktop();

  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const { unreadDM, notifTotal } = useInboxTotalsWeb(!!user?.uid, user?.uid);
  const { signOutUser } = useAuth();

  const handle = (profile as any)?.handle ?? null;
  const profileHref =
    handle && String(handle).trim().length > 0 ? `/${handle}` : "/getstarted";

  const [menuOpen, setMenuOpen] = React.useState(false);

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
    [profile, user]
  );

  const loading = authLoading || profileLoading;
  const goUpload = () => {
    if (!user?.uid) router.push("/getstarted?next=/studio/upload");
    else router.push("/studio/upload");
  };

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
      />
      {/* Bottom tabs like your app */}
      {!isDesktop && (<MobileBottomTabs onUpload={goUpload} />)}
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