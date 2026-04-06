"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
    IoAdd,
    IoCartOutline,
    IoChatbubblesOutline,
    IoCompassOutline,
    IoHome,
    IoHomeOutline,
} from "react-icons/io5";
import { EKARI, hexToRgba } from "@/app/nexus/discussions/[discussionId]/discussion-thread.utils";

type ThemeMode = "light" | "dark";
type TabKey = "deeds" | "market" | "nexus" | "bonga";

type Props = {
    onCreate: () => void;
    theme?: ThemeMode;
    activeKey?: TabKey;
    createLabel?: string;
    maxWidthClassName?: string;
    onActiveTabClick?: (key: TabKey) => void;
    refreshingKey?: TabKey | null;
};

type TabBtnProps = {
    tabKey: TabKey;
    label: string;
    icon: React.ReactNode;
    activeIcon?: React.ReactNode;
    onClick: () => void;
    active?: boolean;
    theme: ThemeMode;
    refreshing?: boolean;
};

function Spinner({ dark }: { dark?: boolean }) {
    return (
        <span
            className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-2 border-solid border-current border-r-transparent"
            style={{ color: dark ? EKARI.gold : EKARI.forest }}
            aria-hidden="true"
        />
    );
}

function TabBtn({
    label,
    icon,
    activeIcon,
    onClick,
    active,
    theme,
    refreshing,
}: TabBtnProps) {
    if (theme === "dark") {
        return (
            <button
                onClick={onClick}
                className={clsx(
                    "flex min-w-[58px] flex-col items-center gap-1 transition",
                    active ? "text-white" : "text-white/70"
                )}
                aria-current={active ? "page" : undefined}
                aria-busy={refreshing ? "true" : undefined}
            >
                <div style={{ color: active ? EKARI.gold : "rgba(255,255,255,.70)" }}>
                    {refreshing ? <Spinner dark /> : active && activeIcon ? activeIcon : icon}
                </div>

                <span className={clsx("text-[11px]", active ? "font-black" : "font-semibold")}>
                    {label}
                </span>

                {active ? (
                    <span
                        className="mt-0.5 h-[3px] w-6 rounded-full"
                        style={{ backgroundColor: EKARI.gold }}
                    />
                ) : null}
            </button>
        );
    }

    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex min-w-[58px] flex-col items-center gap-1 rounded-2xl px-3 py-2 transition",
                active ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"
            )}
            aria-current={active ? "page" : undefined}
            aria-busy={refreshing ? "true" : undefined}
        >
            <div style={{ color: active ? EKARI.forest : EKARI.text }}>
                {refreshing ? <Spinner /> : active && activeIcon ? activeIcon : icon}
            </div>

            <span
                className="text-[11px] font-semibold"
                style={{ color: active ? EKARI.forest : EKARI.text }}
            >
                {label}
            </span>
        </button>
    );
}

export default function MobileBottomTabs({
    onCreate,
    theme = "light",
    activeKey,
    createLabel = "Create",
    maxWidthClassName = "max-w-[520px]",
    onActiveTabClick,
    refreshingKey = null,
}: Props) {
    const router = useRouter();
    const pathname = usePathname() || "/";

    const isActive = (href: string) => {
        if (href === "/") return pathname === "/";
        return pathname === href || pathname.startsWith(`${href}/`);
    };

    const resolvedActive = {
        deeds: activeKey ? activeKey === "deeds" : isActive("/"),
        market: activeKey ? activeKey === "market" : isActive("/market"),
        nexus: activeKey ? activeKey === "nexus" : isActive("/nexus"),
        bonga: activeKey ? activeKey === "bonga" : isActive("/bonga"),
    };

    const isDark = theme === "dark";

    const handleTabPress = (key: TabKey, href: string) => {
        const active = resolvedActive[key];
        if (active) {
            onActiveTabClick?.(key);
            return;
        }
        router.push(href);
    };

    return (
        <div
            className="fixed left-0 right-0 z-[60]"
            style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div
                className={clsx(
                    "mx-auto flex w-full items-center justify-between px-4",
                    maxWidthClassName,
                    isDark ? "h-[64px]" : "h-[72px]"
                )}
                style={{
                    backgroundColor: isDark ? "#000000" : "#FFFFFF",
                    borderTop: isDark
                        ? "1px solid rgba(255,255,255,.10)"
                        : `1px solid ${EKARI.hair}`,
                }}
            >
                <TabBtn
                    tabKey="deeds"
                    label="Deeds"
                    icon={<IoHomeOutline size={20} />}
                    activeIcon={<IoHome size={20} />}
                    onClick={() => handleTabPress("deeds", "/")}
                    active={resolvedActive.deeds}
                    theme={theme}
                    refreshing={refreshingKey === "deeds"}
                />

                <TabBtn
                    tabKey="market"
                    label="ekariMarket"
                    icon={<IoCartOutline size={20} />}
                    onClick={() => handleTabPress("market", "/market")}
                    active={resolvedActive.market}
                    theme={theme}
                    refreshing={refreshingKey === "market"}
                />

                <button
                    onClick={onCreate}
                    className={clsx(
                        "grid place-items-center shadow-lg",
                        isDark ? "h-12 w-16 rounded-2xl" : "h-12 w-16 rounded-2xl border"
                    )}
                    style={
                        isDark
                            ? {
                                backgroundColor: EKARI.gold,
                            }
                            : {
                                background: `linear-gradient(135deg, ${EKARI.gold}, ${hexToRgba(
                                    EKARI.gold,
                                    0.78
                                )})`,
                                borderColor: "rgba(0,0,0,0.06)",
                            }
                    }
                    aria-label={createLabel}
                    title={createLabel}
                >
                    <IoAdd size={26} color="#111827" />
                </button>

                <TabBtn
                    tabKey="nexus"
                    label="Nexus"
                    icon={<IoCompassOutline size={20} />}
                    onClick={() => handleTabPress("nexus", "/nexus")}
                    active={resolvedActive.nexus}
                    theme={theme}
                    refreshing={refreshingKey === "nexus"}
                />

                <TabBtn
                    tabKey="bonga"
                    label="Bonga"
                    icon={<IoChatbubblesOutline size={20} />}
                    onClick={() => handleTabPress("bonga", "/bonga")}
                    active={resolvedActive.bonga}
                    theme={theme}
                    refreshing={refreshingKey === "bonga"}
                />
            </div>
        </div>
    );
}