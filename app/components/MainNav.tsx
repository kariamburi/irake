"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
    IoChatbubbleOutline,
    IoNotificationsOutline,
    IoPersonCircleOutline,
    IoSearch,
    IoSparklesOutline,
    IoInformationCircleOutline,
    IoFilmOutline,
    IoCartOutline,
    IoHomeOutline,
    IoCompassOutline,
} from "react-icons/io5";

import { useAuth } from "@/app/hooks/useAuth";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";

/* Theme */
const EKARI = {
    forest: "#233F39",
    bg: "#ffffff",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
    gold: "#C79257",
} as const;

function cn(...xs: (string | false | null | undefined)[]) {
    return xs.filter(Boolean).join(" ");
}

/** Internal: decide if a nav item should be "active" for current path */
function useIsActive(href: string, alsoMatch: string[] = []) {
    const pathname = usePathname() || "/";
    const matches = [href, ...alsoMatch];
    return matches.some(
        (m) =>
            pathname === m ||
            (m !== "/" && pathname.startsWith(m + "/")) ||
            (m === "/" && pathname === "/")
    );
}

/** A single left-nav item with optional auth gate + optional badge */
export function NavItem({
    icon,
    label,
    href,
    active,
    requiresAuth,
    uid,
    badgeCount,
}: {
    icon: React.ReactNode;
    label: string;
    href: string;
    active?: boolean;
    requiresAuth?: boolean;
    uid?: string;
    badgeCount?: number;
}) {
    const router = useRouter();
    const isActive = active ?? useIsActive(href);

    const onClick = (e: React.MouseEvent) => {
        if (requiresAuth && !uid) {
            e.preventDefault();
            router.push(`/getstarted?next=${encodeURIComponent(href)}`);
        }
    };

    const showBadge = typeof badgeCount === "number" && badgeCount > 0;
    const badgeText = !showBadge
        ? ""
        : badgeCount > 999
            ? "999+"
            : badgeCount > 99
                ? "99+"
                : String(badgeCount);

    const baseColor = EKARI.forest;
    const activeColor = EKARI.gold;

    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "group relative w-full flex items-center gap-2 rounded-xl px-3.5 py-1",
                "transition-colors duration-200",
                "hover:bg-gray-50",
                isActive &&
                "bg-white shadow-sm border border-[rgba(199,146,87,0.35)] ring-1 ring-[rgba(199,146,87,0.22)]"
            )}
            style={{
                color: isActive ? activeColor : baseColor,
            }}
        >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(35,63,57,0.05)] group-hover:bg-[rgba(35,63,57,0.08)] transition-colors">
                <span
                    className="text-[20px]"
                    style={{ color: isActive ? activeColor : baseColor }}
                >
                    {icon}
                </span>
                {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-[6px] rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-sm">
                        {badgeText}
                    </span>
                )}
            </span>
            <span
                className={cn(
                    "text-[14px] truncate",
                    isActive ? "font-semibold" : "font-medium"
                )}
            >
                {label}
            </span>
        </Link>
    );
}

/** Compact rail (mobile) */
export function LeftRailCompact() {
    const { user } = useAuth();
    const uid = user?.uid;

    const { unreadDM, notifTotal } = useInboxTotalsWeb(!!uid, uid);

    return (
        <>
            {/* Logo pill 
      <aside
            className="lg:hidden sticky top-0 h-screen w-[60px] shrink-0 border-r flex flex-col items-center py-3 gap-4 bg-white/95 backdrop-blur-sm"
            style={{ borderColor: EKARI.hair }}
        >
           
            <Link
                href="/"
                className="mt-1 rounded-2xl bg-gray-50 border border-gray-200 px-2 py-1 shadow-sm flex items-center justify-center"
            >
                <Image src="/ekarihub-logo.png" alt="logo" width={24} height={24} />
            </Link>

          
            <RailLink href="/search" icon={<IoSearch />} label="Search" />
            <RailLink href="/" icon={<IoHomeOutline />} label="Deeds" active />
            <RailLink href="/market" icon={<IoCartOutline />} label="Market" />
            <RailLink href="/nexus" icon={<IoCompassOutline />} label="Nexus" />
            <RailLink
                href="/studio/upload"
                icon={<IoFilmOutline />}
                label="Studio"
            />

            <RailLink
                href="/notifications"
                icon={<IoNotificationsOutline />}
                label="Alerts"
                badgeCount={uid ? notifTotal : 0}
            />

            <RailLink
                href="/bonga"
                icon={<IoChatbubbleOutline />}
                label="Bonga"
                badgeCount={uid ? unreadDM : 0}
            />

            <RailLink href="/ai" icon={<IoSparklesOutline />} label="AI" />

            <div className="mt-auto mb-2 text-[9px] text-gray-400 select-none">
                ekari
            </div>
        </aside>*/}
        </>
    );
}

function RailLink({
    href,
    icon,
    label,
    badgeCount,
    active = false,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    badgeCount?: number;
    active?: boolean;
}) {
    const showBadge = typeof badgeCount === "number" && badgeCount > 0;
    const badgeText = !showBadge
        ? ""
        : badgeCount > 999
            ? "999+"
            : badgeCount > 99
                ? "99+"
                : String(badgeCount);

    const baseColor = EKARI.forest;
    const activeColor = EKARI.gold;

    return (
        <Link
            href={href}
            className={cn(
                "relative flex flex-col items-center gap-1 text-[22px] px-2 py-1.5 rounded-2xl",
                "transition-all duration-200",
                "hover:bg-gray-50 hover:shadow-sm",
                active && "bg-gray-50 shadow-sm"
            )}
            aria-label={label}
            style={{ color: active ? activeColor : baseColor }}
        >
            <span className="relative flex items-center justify-center">
                {icon}
                {showBadge && (
                    <span className="absolute -right-1 -top-1 text-[9px] rounded-full bg-red-500 text-white px-1 min-w-[16px] h-[16px] flex items-center justify-center font-extrabold shadow-sm">
                        {badgeText}
                    </span>
                )}
            </span>
            <span
                className={cn("text-[10px] leading-3", active && "font-semibold")}
                style={{ color: active ? activeColor : EKARI.subtext }}
            >
                {label}
            </span>
        </Link>
    );
}

/** Full left menu (desktop) */
export function LeftNavDesktop({
    uid,
    handle,
}: {
    uid?: string;
    handle?: string;
}) {
    const router = useRouter();
    const { user } = useAuth();
    const authUid = uid ?? user?.uid;

    const { unreadDM, notifTotal } = useInboxTotalsWeb(!!authUid, authUid);

    const items: Array<{
        label: string;
        href: string;
        icon: React.ReactNode;
        alsoMatch?: string[];
        requiresAuth?: boolean;
        badgeCount?: number;
    }> = [
            { label: "Deeds", href: "/", icon: <IoHomeOutline /> },
            { label: "ekariMarket", href: "/market", icon: <IoCartOutline /> },
            { label: "Nexus", href: "/nexus", icon: <IoCompassOutline /> },
            {
                label: "Deed studio",
                href: "/studio/upload",
                icon: <IoFilmOutline />,
                requiresAuth: true,
            },
            {
                label: "Notifications",
                href: "/notifications",
                icon: <IoNotificationsOutline />,
                requiresAuth: true,
                badgeCount: authUid ? notifTotal : 0,
            },
            {
                label: "Bonga",
                href: "/bonga",
                icon: <IoChatbubbleOutline />,
                requiresAuth: true,
                badgeCount: authUid ? unreadDM : 0,
            },
            { label: "ekari AI", href: "/ai", icon: <IoSparklesOutline /> },
        ];

    const profileHref =
        handle && handle.trim().length > 0 ? `/${handle}` : "/getstarted";

    return (
        <aside
            className="hidden lg:flex xl:w-[260px] lg:w-[260px] shrink-0 sticky top-0 h-screen flex-col border-r bg-white/90 backdrop-blur-sm"
            style={{ borderColor: EKARI.hair }}
        >
            {/* Logo + Search button */}
            <div
                className="px-4 pt-3 pb-3 border-b"
                style={{ borderColor: EKARI.hair }}
            >
                <div className="flex items-center justify-between gap-2">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-2xl px-2.5 py-2 hover:bg-gray-50 transition-colors"
                    >
                        <Image
                            src="/ekarihub-logo.png"
                            alt="ekarihub"
                            width={140}
                            height={36}
                        />
                    </Link>

                    <button
                        type="button"
                        onClick={() => router.push("/search")}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-2xl px-3 py-2",
                            "border bg-white hover:bg-gray-50 transition-colors",
                            "text-[13px] font-semibold"
                        )}
                        style={{
                            borderColor: "rgba(35,63,57,0.16)",
                            color: EKARI.forest,
                        }}
                        aria-label="Search"
                        title="Search"
                    >
                        <span className="text-[18px]">
                            <IoSearch />
                        </span>
                        <span className="hidden xl:inline">Search</span>
                    </button>
                </div>
            </div>

            {/* Main nav */}
            <nav className="px-3 pt-2 space-y-1 text-[15px]">
                {items.map((it) => {
                    const active = useIsActive(it.href, it.alsoMatch);
                    return (
                        <NavItem
                            key={it.href}
                            icon={it.icon}
                            label={it.label}
                            href={it.href}
                            uid={authUid}
                            requiresAuth={it.requiresAuth}
                            badgeCount={it.badgeCount}
                            active={active}
                        />
                    );
                })}
                <NavItem
                    icon={<IoPersonCircleOutline />}
                    label="Profile"
                    href={profileHref}
                    uid={authUid}
                    requiresAuth
                />
                <NavItem
                    icon={<IoInformationCircleOutline />}
                    label="About ekarihub"
                    href="/about"
                />
            </nav>

            {/* Footer */}
            <div className="mt-auto px-4 pb-4 pt-3 text-[11px] text-gray-400 border-t" style={{ borderColor: EKARI.hair }}>
                <div>© {new Date().getFullYear()} ekarihub</div>
                <div className="mt-0.5">Collaborate • Innovate • Cultivate</div>
            </div>
        </aside>
    );
}
