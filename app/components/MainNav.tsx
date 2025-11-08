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
    IoTelescopeOutline,
    IoSparklesOutline,
    IoHelpBuoyOutline,
    IoInformationCircleOutline,
    IoFilmOutline,
    IoCartOutline,
    IoHomeOutline,
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
    gold: "#C79257", // renamed for clarity
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
            (m === "/" && pathname === "/"),
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

    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "relative w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-100 transition",
                // REVERSED COLORS + border only when active:
                // default (inactive): forest text/icon, no border
                !isActive && "font-medium",
                // active: gold text/icon + gold border
                isActive && "font-bold border-2",
            )}
            style={
                {
                    // expose theme as CSS vars
                    ["--ekari-forest" as any]: EKARI.forest,
                    ["--ekari-gold" as any]: EKARI.gold,
                    // inactive color
                    color: isActive ? "var(--ekari-gold)" : "var(--ekari-forest)",
                    // border only for active
                    borderColor: isActive ? "var(--ekari-gold)" : "transparent",
                } as React.CSSProperties
            }
        >
            <span
                className="text-[20px] relative"
                style={{ color: isActive ? "var(--ekari-gold)" : "var(--ekari-forest)" }}
            >
                {icon}
                {showBadge && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-[6px] rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center">
                        {badgeText}
                    </span>
                )}
            </span>
            <span>{label}</span>
        </Link>
    );
}

/** Compact rail (mobile) — unchanged visuals except minor hover */
export function LeftRailCompact() {
    const { user } = useAuth();
    const uid = user?.uid;

    const { unreadDM, notifTotal } = useInboxTotalsWeb(!!uid, uid);

    return (
        <aside
            className="lg:hidden sticky top-0 h-screen w-[54px] shrink-0 border-r flex flex-col items-center py-3 gap-4"
            style={{ borderColor: EKARI.hair }}
        >
            <Link href="/" className="mt-1">
                <Image src="/ekarihub-logo.png" alt="logo" width={22} height={22} />
            </Link>

            <RailLink href="/search" icon={<IoSearch />} label="Search" />
            <RailLink href="/" icon={<IoHomeOutline />} label="Deeds" active />
            <RailLink href="/market" icon={<IoCartOutline />} label="ekariMarket" />
            <RailLink href="/dive" icon={<IoTelescopeOutline />} label="Dive" />
            <RailLink href="/studio/upload" icon={<IoFilmOutline />} label="Deed studio" />

            <RailLink
                href="/notifications"
                icon={<IoNotificationsOutline />}
                label="Notifications"
                badgeCount={uid ? notifTotal : 0}
            />

            <RailLink
                href="/messages"
                icon={<IoChatbubbleOutline />}
                label="Bonga"
                badgeCount={uid ? unreadDM : 0}
            />

            <RailLink href="/ai" icon={<IoSparklesOutline />} label="ekarihub AI" />
            <RailLink href="/support" icon={<IoHelpBuoyOutline />} label="ekarihub Support" />
            <div className="mt-auto mb-2" />
        </aside>
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

    return (
        <Link
            href={href}
            className="relative flex flex-col items-center gap-1 text-[22px] hover:opacity-80"
            aria-label={label}
            style={{ color: active ? EKARI.gold : EKARI.forest }}
        >
            <span className="relative">
                {icon}
                {showBadge && (
                    <span className="absolute -right-1 -top-1 text-[10px] rounded-full bg-red-500 text-white px-1 min-w-[16px] h-[16px] flex items-center justify-center font-extrabold">
                        {badgeText}
                    </span>
                )}
            </span>
            <span className={cn("text-[10px] leading-3", active && "font-bold")} style={{ color: EKARI.subtext }}>
                {label}
            </span>
        </Link>
    );
}

/** Full left menu (desktop) — pass uid to enable auth gating on some items */
export function LeftNavDesktop({ uid, handle }: { uid?: string; handle?: string }) {
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
            { label: "Dive", href: "/dive", icon: <IoTelescopeOutline /> },
            { label: "Deed studio", href: "/studio/upload", icon: <IoFilmOutline />, requiresAuth: true },
            {
                label: "Notifications",
                href: "/notifications",
                icon: <IoNotificationsOutline />,
                requiresAuth: true,
                badgeCount: authUid ? notifTotal : 0,
            },
            {
                label: "Bonga",
                href: "/messages",
                icon: <IoChatbubbleOutline />,
                requiresAuth: true,
                badgeCount: authUid ? unreadDM : 0,
            },
            { label: "ekarihub AI", href: "/ai", icon: <IoSparklesOutline /> },
            { label: "ekarihub Support", href: "/support", icon: <IoHelpBuoyOutline /> },
        ];

    return (
        <aside
            className="hidden lg:flex xl:w-[260px] lg:w-[220px] shrink-0 sticky top-0 h-screen flex-col border-r"
            style={{ borderColor: EKARI.hair }}
        >
            <div className="px-4 py-5">
                <Link href="/" className="inline-flex items-center gap-2">
                    <Image src="/ekarihub-logo.png" alt="ekarihub" width={140} height={36} />
                </Link>
            </div>

            <nav className="px-2 space-y-1 text-[15px]">
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
                <div className="pt-2">
                    <NavItem
                        icon={<IoPersonCircleOutline />}
                        label="Profile"
                        href={`/${handle}`}
                        uid={authUid}
                        requiresAuth
                    />
                    <NavItem icon={<IoInformationCircleOutline />} label="About ekarihub" href="/about" />
                </div>
            </nav>

            <div className="mt-auto p-4 text-xs" style={{ color: EKARI.subtext }}>
                © {new Date().getFullYear()} ekarihub
            </div>
        </aside>
    );
}
