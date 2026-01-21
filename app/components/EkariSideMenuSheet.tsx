// app/components/EkariSideMenuSheet.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    IoAdd,
    IoCartOutline,
    IoChatbubblesOutline,
    IoChevronForward,
    IoCloseCircle,
    IoCompassOutline,
    IoHomeOutline,
    IoInformationCircleOutline,
    IoLogInOutline,
    IoLogOutOutline,
    IoNotificationsOutline,
    IoPersonCircleOutline,
    IoSparklesOutline,
} from "react-icons/io5";
import { cn } from "@/lib/utils";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
    sub: "#5C6B66",
};

export type EkariMenuItem = {
    key: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    alsoMatch?: string[];
    requiresAuth?: boolean;
    badgeCount?: number;
};

function badgeText(n?: number) {
    if (!n || n <= 0) return "";
    if (n > 999) return "999+";
    if (n > 99) return "99+";
    return String(n);
}

function useIsActivePath(href: string, alsoMatch: string[] = []) {
    const pathname = usePathname() || "/";
    const matches = [href, ...alsoMatch];
    return matches.some(
        (m) =>
            pathname === m ||
            (m !== "/" && pathname.startsWith(m + "/")) ||
            (m === "/" && pathname === "/")
    );
}

function MenuRow({
    item,
    onNavigate,
}: {
    item: EkariMenuItem;
    onNavigate: (href: string, requiresAuth?: boolean) => void;
}) {
    const active = useIsActivePath(item.href, item.alsoMatch);
    const bt = badgeText(item.badgeCount);
    const showBadge = !!bt;

    return (
        <button
            onClick={() => onNavigate(item.href, item.requiresAuth)}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition",
                "hover:bg-black/5"
            )}
            style={{
                color: EKARI.text,
                backgroundColor: active ? "rgba(199,146,87,0.10)" : undefined,
                border: active
                    ? "1px solid rgba(199,146,87,0.35)"
                    : "1px solid transparent",
            }}
        >
            <span
                className="relative h-10 w-10 rounded-2xl grid place-items-center border bg-white shadow-sm"
                style={{
                    borderColor: active ? "rgba(199,146,87,0.45)" : EKARI.hair,
                }}
            >
                <span
                    style={{ color: active ? EKARI.gold : EKARI.forest }}
                    className="text-[18px]"
                >
                    {item.icon}
                </span>

                {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-[6px] rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-sm">
                        {bt}
                    </span>
                )}
            </span>

            <div className="flex-1 min-w-0">
                <div
                    className={cn(
                        "text-sm truncate",
                        active ? "font-black" : "font-extrabold"
                    )}
                >
                    {item.label}
                </div>
            </div>

            <IoChevronForward size={18} style={{ color: EKARI.dim }} />
        </button>
    );
}

function AvatarHeader({
    uid,
    handle,
    photoURL,
    profileHref,
    onNavigate,
}: {
    uid: string;
    handle?: string | null;
    photoURL?: string | null;
    profileHref: string;
    onNavigate: (href: string, requiresAuth?: boolean) => void;
}) {
    const avatarSrc = photoURL || "/avatar-placeholder.png";
    const displayHandle =
        (handle || "").trim().length > 0 ? `@${String(handle).replace(/^@+/, "")}` : "Your profile";

    return (
        <button
            onClick={() => onNavigate(profileHref, true)}
            className="w-full px-3 py-3 rounded-2xl border hover:bg-black/5 transition flex items-center gap-3"
            style={{ borderColor: EKARI.hair }}
        >
            <div className="h-11 w-11 rounded-full grid place-items-center overflow-hidden">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#C79257] to-[#233F39]" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={avatarSrc}
                        alt="Profile"
                        className="relative h-10 w-10 rounded-full border-2 border-white object-cover"
                    />
                </div>
            </div>

            <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-black truncate" style={{ color: EKARI.text }}>
                    {displayHandle}
                </div>
                <div className="text-[11px] mt-0.5 truncate" style={{ color: EKARI.dim }}>
                    View profile • Manage account
                </div>
            </div>

            <IoChevronForward size={18} style={{ color: EKARI.dim }} />
        </button>
    );
}

export function EkariSideMenuSheet({
    open,
    onClose,

    // auth/profile
    uid,
    handle,
    photoURL,
    profileHref,

    // badges
    unreadDM = 0,
    notifTotal = 0,

    // optional: when user taps logout
    onLogout,

    // optional: customize
    title = "Menu",
    tip = "Tip: Use “Unread” to jump to active chats faster.",
}: {
    open: boolean;
    onClose: () => void;

    uid?: string | null;
    handle?: string | null;
    photoURL?: string | null;
    profileHref: string;

    unreadDM?: number;
    notifTotal?: number;

    onLogout?: () => Promise<void> | void;

    title?: string;
    tip?: string;
}) {
    const router = useRouter();

    const navigate = (href: string, requiresAuth?: boolean) => {
        onClose();

        const isAuthed = !!uid;
        if (requiresAuth && !isAuthed) {
            window.location.href = `/getstarted?next=${encodeURIComponent(href)}`;
            return;
        }

        // keep your pattern (hard redirect) for consistency everywhere
        window.location.href = href;
    };

    const fullMenu: EkariMenuItem[] = useMemo(
        () => [
            { key: "deeds", label: "Deeds", href: "/", icon: <IoHomeOutline /> },
            {
                key: "market",
                label: "ekariMarket",
                href: "/market",
                icon: <IoCartOutline />,
                alsoMatch: ["/market"],
            },
            { key: "nexus", label: "Nexus", href: "/nexus", icon: <IoCompassOutline /> },
            { key: "studio", label: "Deed studio", href: "/studio/upload", icon: <IoAdd />, requiresAuth: true },

            {
                key: "notifications",
                label: "Notifications",
                href: "/notifications",
                icon: <IoNotificationsOutline />,
                requiresAuth: true,
                badgeCount: uid ? notifTotal ?? 0 : 0,
            },
            {
                key: "bonga",
                label: "Bonga",
                href: "/bonga",
                icon: <IoChatbubblesOutline />,
                requiresAuth: true,
                badgeCount: uid ? unreadDM ?? 0 : 0,
            },

            { key: "ai", label: "ekari AI", href: "/ai", icon: <IoSparklesOutline /> },
            {
                key: "profile",
                label: "Profile",
                href: profileHref,
                icon: <IoPersonCircleOutline />,
                requiresAuth: true,
            },
            { key: "about", label: "About ekarihub", href: "/about", icon: <IoInformationCircleOutline /> },
        ],
        [uid, notifTotal, unreadDM, profileHref]
    );

    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const heroBg =
        "radial-gradient(900px circle at 10% 10%, rgba(199,146,87,0.18), transparent 45%), radial-gradient(820px circle at 85% 30%, rgba(35,63,57,0.18), transparent 55%), linear-gradient(135deg, rgba(35,63,57,0.06), rgba(255,255,255,1))";

    const doLogout = async () => {
        onClose();
        try {
            if (onLogout) await onLogout();
            // keep refresh so UI updates
            router.refresh();
        } catch (e) {
            console.error("Logout failed:", e);
        }
    };

    return (
        <div
            className={cn(
                "fixed inset-0 z-[120] transition",
                open ? "pointer-events-auto" : "pointer-events-none"
            )}
            aria-hidden={!open}
        >
            <div
                className={cn(
                    "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity",
                    open ? "opacity-100" : "opacity-0"
                )}
                onClick={onClose}
            />

            <div
                className={cn(
                    "absolute left-0 top-0 h-full w-[86%] max-w-[360px]",
                    "bg-white shadow-2xl border-r",
                    "transition-transform duration-300 will-change-transform",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
                style={{ borderColor: EKARI.hair }}
                role="dialog"
                aria-modal="true"
            >
                {/* Top */}
                <div className="relative">
                    <div
                        className="h-[76px] px-4 flex items-center justify-between border-b"
                        style={{ borderColor: EKARI.hair, background: heroBg }}
                    >
                        <div>
                            <div className="text-[12px] font-extrabold tracking-wide" style={{ color: EKARI.sub }}>
                                ekarihub
                            </div>
                            <div className="text-[16px] font-black leading-tight" style={{ color: EKARI.text }}>
                                {title}
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="h-10 w-10 rounded-2xl grid place-items-center border hover:bg-black/5"
                            style={{ borderColor: EKARI.hair }}
                            aria-label="Close menu"
                        >
                            <IoCloseCircle size={18} style={{ color: EKARI.text }} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-2 overflow-y-auto h-[calc(100%-76px)]">
                    {/* Profile / Login */}
                    {!!uid ? (
                        <div className="p-1">
                            <AvatarHeader
                                uid={uid}
                                handle={handle}
                                photoURL={photoURL}
                                profileHref={profileHref}
                                onNavigate={navigate}
                            />
                        </div>
                    ) : (
                        <div className="p-1">
                            <button
                                onClick={() => navigate("/getstarted", false)}
                                className="w-full px-3 py-3 rounded-2xl border hover:bg-black/5 transition flex items-center gap-3"
                                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                            >
                                <span
                                    className="h-10 w-10 rounded-2xl grid place-items-center border bg-white shadow-sm"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    <IoLogInOutline size={18} style={{ color: EKARI.forest }} />
                                </span>
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-black">Log in</div>
                                    <div className="text-[11px] mt-0.5" style={{ color: EKARI.dim }}>
                                        Sign in to unlock chats & notifications
                                    </div>
                                </div>
                                <IoChevronForward size={18} style={{ color: EKARI.dim }} />
                            </button>
                        </div>
                    )}

                    <div className="my-2 h-px" style={{ backgroundColor: "rgba(229,231,235,0.9)" }} />

                    {/* Menu Items */}
                    <nav className="space-y-1">
                        {fullMenu.map((it) => (
                            <MenuRow key={it.key} item={it} onNavigate={navigate} />
                        ))}
                    </nav>

                    {/* Logout (only if logged in) */}
                    {!!uid && (
                        <>
                            <div className="my-2 h-px" style={{ backgroundColor: "rgba(229,231,235,0.9)" }} />

                            <button
                                onClick={doLogout}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition hover:bg-black/5 border"
                                style={{ borderColor: "rgba(229,231,235,0.9)", color: EKARI.text }}
                            >
                                <span
                                    className="h-10 w-10 rounded-2xl grid place-items-center border bg-white shadow-sm"
                                    style={{ borderColor: EKARI.hair }}
                                >
                                    <IoLogOutOutline size={18} style={{ color: EKARI.forest }} />
                                </span>
                                <div className="flex-1">
                                    <div className="text-sm font-black">Log out</div>
                                    <div className="text-[11px] mt-0.5" style={{ color: EKARI.dim }}>
                                        Sign out of your account
                                    </div>
                                </div>
                            </button>
                        </>
                    )}

                    {/* Footer tip */}
                    <div className="mt-3 p-3 rounded-2xl border" style={{ borderColor: EKARI.hair, background: "rgba(35,63,57,0.03)" }}>
                        <div className="text-[11px]" style={{ color: EKARI.dim }}>
                            {tip}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
