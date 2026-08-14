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
    IoPartlySunnyOutline,
    IoShieldCheckmarkOutline,
} from "react-icons/io5";

import { useAuth } from "@/app/hooks/useAuth";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import UserAvatarMenu from "./UserAvatarMenu";

/* Theme */
const EKARI = {
    forest: "#D8E7DD",
    bg: "#173C2E",
    text: "#F7F3E8",
    subtext: "#9DB2A6",
    hair: "rgba(255,255,255,0.10)",
    gold: "#c69258",
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

    const onClick = (event: React.MouseEvent) => {
        if (requiresAuth && !uid) {
            event.preventDefault();
            router.push(`/getstarted?next=${encodeURIComponent(href)}`);
        }
    };

    const showBadge =
        typeof badgeCount === "number" && badgeCount > 0;

    const badgeText = !showBadge
        ? ""
        : badgeCount > 999
            ? "999+"
            : badgeCount > 99
                ? "99+"
                : String(badgeCount);

    const baseColor = EKARI.subtext;
    const activeColor = EKARI.gold;

    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "group relative flex min-h-[42px] w-full items-center gap-2.5",
                "border-l-[3px] px-4 py-1.5",
                "transition-colors duration-200",
                isActive
                    ? "border-l-[#c69258] bg-white/[0.10]"
                    : "border-l-transparent hover:bg-white/[0.055]",
            )}
            style={{
                color: isActive ? activeColor : baseColor,
            }}
        >
            <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                <span
                    className="text-[18px]"
                    style={{
                        color: isActive ? activeColor : baseColor,
                    }}
                >
                    {icon}
                </span>

                {showBadge ? (
                    <span className="absolute -right-2 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#c69258] px-1 text-[9px] font-black text-[#173C2E]">
                        {badgeText}
                    </span>
                ) : null}
            </span>

            <span
                className={cn(
                    "min-w-0 truncate text-[13px]",
                    isActive ? "font-bold" : "font-semibold",
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

    const baseColor = EKARI.subtext;
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
    photoURL,
}: {
    uid?: string;
    handle?: string;
    photoURL?: string | null;
}) {
    const { user } = useAuth();
    const authUid = uid ?? user?.uid;

    const { unreadDM, notifTotal } = useInboxTotalsWeb(
        !!authUid,
        authUid,
    );

    const items: Array<{
        label: string;
        href: string;
        icon: React.ReactNode;
        alsoMatch?: string[];
        requiresAuth?: boolean;
        badgeCount?: number;
    }> = [
            {
                label: "Deeds",
                href: "/",
                icon: <IoHomeOutline />,
            },
            {
                label: "ekariMarket",
                href: "/market",
                icon: <IoCartOutline />,
            },
            {
                label: "ekariExperts",
                href: "/ekari-experts",
                icon: <IoShieldCheckmarkOutline />,
            },
            {
                label: "Weather",
                href: "/weather",
                icon: <IoPartlySunnyOutline />,
                requiresAuth: true,
            },
            {
                label: "ekari AI",
                href: "/ai",
                icon: <IoSparklesOutline />,
            },
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
        ];

    const profileHref =
        handle && handle.trim().length > 0
            ? `/${handle}`
            : "/getstarted";

    return (
        <aside
            className={[
                "sticky top-0 hidden h-[100svh] w-[250px] shrink-0",
                "flex-col overflow-hidden border-r bg-[#173C2E]",
                "lg:flex xl:w-[270px]",
            ].join(" ")}
            style={{ borderColor: EKARI.hair }}
        >
            {/* Logo */}
            <div
                className="shrink-0 border-b px-5 pb-4 pt-5"
                style={{ borderColor: EKARI.hair }}
            >
                <Link
                    href="/"
                    className="inline-flex items-center"
                    aria-label="ekarihub home"
                >
                    <Image
                        src="/ekarihub-logo-green.png"
                        alt="ekarihub"
                        width={144}
                        height={40}
                        priority
                        className="h-auto w-[138px] object-contain"
                    />
                </Link>

                <p className="mt-1 whitespace-nowrap text-[11px] font-medium text-white/45">
                    Collaborate · Innovate · Cultivate
                </p>
            </div>

            {/* Scrollable navigation */}
            <nav className="min-h-0 flex-1 overflow-y-auto py-3 no-scrollbar">
                {items.map((item) => {
                    const active = useIsActive(
                        item.href,
                        item.alsoMatch,
                    );

                    return (
                        <NavItem
                            key={item.href}
                            icon={item.icon}
                            label={item.label}
                            href={item.href}
                            uid={authUid}
                            requiresAuth={item.requiresAuth}
                            badgeCount={item.badgeCount}
                            active={active}
                        />
                    );
                })}

                <div className="my-2 border-t border-white/10" />

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

            {/* Signed-in account */}
            {authUid ? (
                <div className="shrink-0 border-t border-white/10 p-3">
                    <UserAvatarMenu
                        uid={authUid}
                        handle={handle}
                        photoURL={photoURL}
                        profileHref={profileHref}
                    />
                </div>
            ) : (
                <div className="shrink-0 border-t border-white/10 p-3">
                    <Link
                        href="/getstarted"
                        className={[
                            "flex h-11 w-full items-center justify-center",
                            "rounded-xl bg-[#c69258]",
                            "text-[11px] font-black text-[#173C2E]",
                            "transition hover:bg-[#F8B33E]",
                            "active:scale-[0.98]",
                        ].join(" ")}
                    >
                        Sign in / Get started
                    </Link>
                </div>
            )}
        </aside>
    );
}