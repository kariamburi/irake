"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import {
    IoHome, IoCompassOutline, IoPeopleOutline, IoChatbubbleOutline,
    IoCloudUploadOutline, IoNotificationsOutline, IoTvOutline,
    IoPersonCircleOutline, IoEllipsisHorizontal, IoSearch
} from "react-icons/io5";

/* Theme (same as your pages) */
const EKARI = {
    bg: "#ffffff",
    text: "#111827",
    subtext: "#6B7280",
    hair: "#E5E7EB",
    primary: "#C79257",
};

function cn(...xs: (string | false | null | undefined)[]) { return xs.filter(Boolean).join(" "); }

/** Internal: decide if a nav item should be "active" for current path */
function useIsActive(href: string, alsoMatch: string[] = []) {
    const pathname = usePathname() || "/";
    const matches = [href, ...alsoMatch];
    return matches.some((m) =>
        pathname === m || (m !== "/" && pathname.startsWith(m + "/")) || (m === "/" && pathname === "/")
    );
}

/** A single left-nav item with optional auth gate */
export function NavItem({
    icon, label, href, active, requiresAuth, uid,
}: {
    icon: React.ReactNode;
    label: string;
    href: string;
    active?: boolean;
    requiresAuth?: boolean;
    uid?: string;
}) {
    const router = useRouter();
    const isActive = active ?? useIsActive(href);

    const onClick = (e: React.MouseEvent) => {
        if (requiresAuth && !uid) {
            e.preventDefault();
            router.push(`/getstarted?next=${encodeURIComponent(href)}`);
        }
    };

    return (
        <Link
            href={href}
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50",
                isActive ? "font-bold bg-gray-50" : "font-medium"
            )}
            style={{ color: EKARI.text }}
        >
            <span className="text-[20px]">{icon}</span>
            <span>{label}</span>
        </Link>
    );
}

/** Compact rail (mobile) */
export function LeftRailCompact() {
    return (
        <aside
            className="lg:hidden sticky top-0 h-screen w-[54px] shrink-0 border-r flex flex-col items-center py-3 gap-4"
            style={{ borderColor: EKARI.hair }}
        >
            <Link href="/" className="mt-1">
                <Image src="/ekarihub-logo.png" alt="logo" width={22} height={22} />
            </Link>
            <RailIcon icon={<IoSearch />} label="Search" />
            <RailIcon icon={<IoHome />} label="Home" active />
            <RailIcon icon={<IoCompassOutline />} label="Dive" />
            <RailIcon icon={<IoPeopleOutline />} label="Following" />
            <RailIcon icon={<IoCloudUploadOutline />} label="Upload" />
            <RailIcon icon={<IoNotificationsOutline />} label="Inbox" badge="10" />
            <RailIcon icon={<IoTvOutline />} label="LIVE" />
            <div className="mt-auto mb-2" />
        </aside>
    );
}

function RailIcon(
    { icon, label, badge, active = false }:
        { icon: React.ReactNode; label: string; badge?: string; active?: boolean }
) {
    return (
        <button className="relative flex flex-col items-center gap-1 text-[22px] hover:opacity-80" aria-label={label}>
            {icon}
            {badge && (
                <span className="absolute -right-1 -top-1 text-[10px] rounded-full bg-red-500 text-white px-1">
                    {badge}
                </span>
            )}
            <span className={cn("text-[10px] leading-3", active && "font-bold")} style={{ color: EKARI.subtext }}>
                {label}
            </span>
        </button>
    );
}

/** Full left menu (desktop) — pass uid to enable auth gating on some items */
export function LeftNavDesktop({ uid, handle }: { uid?: string, handle?: string }) {
    // Map labels to routes; "/" is your Deeds feed now (also matches "/deeds")

    const items: Array<{
        label: string;
        href: string;
        icon: React.ReactNode;
        alsoMatch?: string[];
        requiresAuth?: boolean;
    }> = [
            { label: "Home", href: "/", icon: <IoHome /> },
            { label: "Dive", href: "/dive", icon: <IoCompassOutline /> },
            { label: "Following", href: "/following", icon: <IoPeopleOutline />, requiresAuth: true },
            { label: "Upload", href: "/studio/upload", icon: <IoCloudUploadOutline />, requiresAuth: true },
            { label: "Notifications", href: "/notifications", icon: <IoNotificationsOutline />, requiresAuth: true },
            { label: "Bonga", href: "/bonga", icon: <IoChatbubbleOutline /> },
            { label: "LIVE", href: "/live", icon: <IoTvOutline /> },
        ];

    return (
        <aside
            className="hidden lg:flex xl:w-[260px] lg:w-[220px] shrink-0 sticky top-0 h-screen flex-col border-r"
            style={{ borderColor: EKARI.hair }}
        >
            <div className="px-4 py-5">
                <Link href="/" className="inline-flex items-center gap-2">
                    <Image src="/ekarihub-logo.png" alt="Ekarihub" width={140} height={36} />
                </Link>
            </div>

            <nav className="px-2 space-y-1 text-[15px]">
                {items.map((it) => (
                    <NavItem
                        key={it.href}
                        icon={it.icon}
                        label={it.label}
                        href={it.href}
                        uid={uid}
                        requiresAuth={it.requiresAuth}
                        active={useIsActive(it.href, it.alsoMatch)}
                    />
                ))}
                <div className="pt-2">
                    <NavItem
                        icon={<IoPersonCircleOutline />}
                        label="Profile"
                        href={`/${handle}`}
                        uid={uid}
                        requiresAuth
                    />
                    <NavItem icon={<IoEllipsisHorizontal />} label="More" href="/more" />
                </div>
            </nav>

            <div className="mt-auto p-4 text-xs" style={{ color: EKARI.subtext }}>
                © {new Date().getFullYear()} Ekarihub
            </div>
        </aside>
    );
}
