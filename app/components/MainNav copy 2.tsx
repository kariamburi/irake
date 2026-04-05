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

function useViewportHeight() {
    const [vh, setVh] = React.useState(900);

    React.useEffect(() => {
        const update = () => setVh(window.innerHeight || 900);
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    return vh;
}

type Density = "normal" | "compact" | "tight";

function getDensity(vh: number): Density {
    if (vh <= 760) return "tight";
    if (vh <= 880) return "compact";
    return "normal";
}

function getDensityStyles(density: Density) {
    if (density === "tight") {
        return {
            railWidth: "228px",
            logoWidth: 126,
            headerPx: "14px",
            headerPt: "12px",
            headerPb: "8px",
            searchHeight: 38,
            searchIcon: 18,
            searchText: 13,
            navGapY: "2px",
            navPx: "8px",
            navPy: "4px",
            itemGap: "10px",
            itemPx: "10px",
            itemPy: "7px",
            iconBox: 34,
            iconSize: 20,
            labelSize: 14,
            footerPx: "14px",
            footerPt: "8px",
            footerPb: "10px",
            footerText: 10,
        };
    }

    if (density === "compact") {
        return {
            railWidth: "238px",
            logoWidth: 134,
            headerPx: "15px",
            headerPt: "14px",
            headerPb: "10px",
            searchHeight: 40,
            searchIcon: 18,
            searchText: 14,
            navGapY: "3px",
            navPx: "9px",
            navPy: "6px",
            itemGap: "10px",
            itemPx: "10px",
            itemPy: "8px",
            iconBox: 36,
            iconSize: 21,
            labelSize: 14.5,
            footerPx: "15px",
            footerPt: "10px",
            footerPb: "12px",
            footerText: 11,
        };
    }

    return {
        railWidth: "252px",
        logoWidth: 148,
        headerPx: "20px",
        headerPt: "20px",
        headerPb: "14px",
        searchHeight: 46,
        searchIcon: 21,
        searchText: 15,
        navGapY: "4px",
        navPx: "12px",
        navPy: "8px",
        itemGap: "12px",
        itemPx: "12px",
        itemPy: "10px",
        iconBox: 40,
        iconSize: 23,
        labelSize: 16,
        footerPx: "20px",
        footerPt: "14px",
        footerPb: "16px",
        footerText: 12,
    };
}

export function NavItem({
    icon,
    label,
    href,
    active,
    requiresAuth,
    uid,
    badgeCount,
    density = "normal",
}: {
    icon: React.ReactNode;
    label: string;
    href: string;
    active?: boolean;
    requiresAuth?: boolean;
    uid?: string;
    badgeCount?: number;
    density?: Density;
}) {
    const router = useRouter();
    const isActive = active ?? useIsActive(href);
    const ds = getDensityStyles(density);

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
                "group relative flex w-full items-center rounded-xl transition-all duration-200",
                isActive ? "bg-white shadow-sm" : "hover:bg-white/75"
            )}
            style={{
                gap: ds.itemGap,
                paddingLeft: ds.itemPx,
                paddingRight: ds.itemPx,
                paddingTop: ds.itemPy,
                paddingBottom: ds.itemPy,
                color: isActive ? activeColor : baseColor,
            }}
        >
            <span
                className="relative flex shrink-0 items-center justify-center"
                style={{
                    width: ds.iconBox,
                    height: ds.iconBox,
                }}
            >
                <span
                    style={{
                        fontSize: ds.iconSize,
                        color: isActive ? activeColor : baseColor,
                    }}
                >
                    {icon}
                </span>

                {showBadge ? (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-[5px] text-[10px] font-extrabold text-white shadow-sm">
                        {badgeText}
                    </span>
                ) : null}
            </span>

            <span
                className={cn(
                    "truncate leading-none",
                    isActive ? "font-bold" : "font-medium"
                )}
                style={{
                    fontSize: ds.labelSize,
                }}
            >
                {label}
            </span>
        </Link>
    );
}

export function LeftRailCompact() {
    return null;
}

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

    const vh = useViewportHeight();
    const density = getDensity(vh);
    const ds = getDensityStyles(density);

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
            className="hidden shrink-0 flex-col border-r bg-white/92 backdrop-blur-sm lg:flex"
            style={{
                borderColor: EKARI.hair,
                width: ds.railWidth,
                height: "100svh",
            }}
        >
            {/* Header */}
            <div
                className="shrink-0"
                style={{
                    paddingLeft: ds.headerPx,
                    paddingRight: ds.headerPx,
                    paddingTop: ds.headerPt,
                    paddingBottom: ds.headerPb,
                }}
            >
                <Link
                    href="/"
                    className="inline-flex items-center rounded-2xl transition-opacity hover:opacity-95"
                >
                    <Image
                        src="/ekarihub-logo.png"
                        alt="ekarihub"
                        width={148}
                        height={36}
                        className="h-auto"
                        style={{ width: ds.logoWidth }}
                    />
                </Link>

                <button
                    type="button"
                    onClick={() => router.push("/search")}
                    className="mt-4 flex w-full items-center rounded-full border bg-[#F7F7F8] text-left transition-colors hover:bg-[#f1f2f3]"
                    style={{
                        borderColor: EKARI.hair,
                        color: EKARI.forest,
                        height: ds.searchHeight,
                        gap: density === "tight" ? "10px" : "12px",
                        paddingLeft: density === "tight" ? "12px" : "14px",
                        paddingRight: density === "tight" ? "12px" : "14px",
                        marginTop: density === "tight" ? "12px" : density === "compact" ? "14px" : "18px",
                    }}
                    aria-label="Search"
                >
                    <span style={{ fontSize: ds.searchIcon }}>
                        <IoSearch />
                    </span>
                    <span
                        className="font-medium"
                        style={{ fontSize: ds.searchText }}
                    >
                        Search
                    </span>
                </button>
            </div>

            {/* Nav */}
            <div className="min-h-0 flex-1">
                <nav
                    style={{
                        paddingLeft: ds.navPx,
                        paddingRight: ds.navPx,
                        paddingTop: ds.navPy,
                        paddingBottom: ds.navPy,
                        display: "flex",
                        flexDirection: "column",
                        gap: ds.navGapY,
                    }}
                >
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
                                density={density}
                            />
                        );
                    })}

                    <NavItem
                        icon={<IoPersonCircleOutline />}
                        label="Profile"
                        href={profileHref}
                        uid={authUid}
                        requiresAuth
                        density={density}
                    />

                    <NavItem
                        icon={<IoInformationCircleOutline />}
                        label="About ekarihub"
                        href="/about"
                        density={density}
                    />
                </nav>
            </div>

            {/* Footer */}
            <div
                className="shrink-0 border-t"
                style={{
                    borderColor: EKARI.hair,
                    color: EKARI.subtext,
                    paddingLeft: ds.footerPx,
                    paddingRight: ds.footerPx,
                    paddingTop: ds.footerPt,
                    paddingBottom: ds.footerPb,
                    fontSize: ds.footerText,
                }}
            >
                <div>© {new Date().getFullYear()} ekarihub</div>
                <div className="mt-1 line-clamp-2">Collaborate • Innovate • Cultivate</div>
            </div>
        </aside>
    );
}