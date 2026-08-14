"use client";

import React from "react";
import {
    IoCompassOutline,
    IoMenu,
    IoPartlySunnyOutline,
    IoSearch,
} from "react-icons/io5";
import { FeedTabKey } from "../data/deedsFeedWeb";

const TABS: FeedTabKey[] = ["forYou", "following", "nearby"];

const LABEL: Record<FeedTabKey, string> = {
    forYou: "For You",
    following: "Following",
    nearby: "Nearby",
};

type Props = {
    uid?: string | null;
    profile?: {
        photoURL?: string | null;
        handle?: string | null;
    } | null;
    activeTab: FeedTabKey;
    onChangeTab: (tab: FeedTabKey) => void;
    onOpenMenu?: () => void;
    onOpenSearch: () => void;
    onOpenProfile: () => void;
    onOpenDive?: () => void;
    onOpenWeather?: () => void;
    isDesktop?: boolean;
};

export function DeedsTopBar({
    uid,
    profile,
    activeTab,
    onChangeTab,
    onOpenMenu,
    onOpenSearch,
    onOpenProfile,
    onOpenDive,
    onOpenWeather,
    isDesktop = false,
}: Props) {
    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-50">
            {!isDesktop ? (
                <div className="pointer-events-auto px-3 pb-1 pt-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onOpenMenu}
                                className="grid h-9 w-9 place-items-center text-white"
                                aria-label="Open menu"
                            >
                                <IoMenu size={20} />
                            </button>

                            <button
                                type="button"
                                onClick={onOpenSearch}
                                className="grid h-12 w-12 place-items-center rounded-full text-white"
                                aria-label="Search"
                            >
                                <IoSearch size={24} />
                            </button>

                            <button
                                type="button"
                                onClick={onOpenProfile}
                                className="h-11 w-11 overflow-hidden rounded-full border border-white/25 bg-white/10"
                                aria-label="Profile"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={profile?.photoURL ?? "/avatar-placeholder.png"}
                                    alt="Profile"
                                    className="h-full w-full object-cover"
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={onOpenDive}
                                className="flex h-12 items-center gap-2 rounded-full px-4 text-white"
                                aria-label="Dive"
                            >
                                <IoCompassOutline size={19} />
                                <span className="text-[15px] tracking-[0.01em]">Dive</span>
                            </button>

                            <button
                                type="button"
                                onClick={onOpenWeather}
                                className="flex h-12 items-center gap-2 rounded-full px-4 text-white"
                                aria-label="Weather"
                            >
                                <IoPartlySunnyOutline size={19} />
                                <span className="text-[15px] tracking-[0.01em]">Weather</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-2 flex items-center justify-center gap-8 px-2">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab;
                            const locked = !uid && tab !== "forYou";

                            return (
                                <button
                                    key={tab}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => {
                                        if (!locked) onChangeTab(tab);
                                    }}
                                    className={[
                                        "relative pb-1 text-[18px] tracking-[0.01em] transition",
                                        isActive
                                            ? "font-extrabold text-white"
                                            : "font-bold text-white/72",
                                        locked ? "cursor-not-allowed opacity-60" : "",
                                    ].join(" ")}
                                    style={{ textShadow: "0 2px 6px rgba(0,0,0,0.35)" }}
                                >
                                    {LABEL[tab]}
                                    {isActive ? (
                                        <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-[2px] w-8 rounded-full bg-white" />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="pointer-events-auto flex h-[76px] items-center px-5">
                    <div className="flex shrink-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={onOpenSearch}
                            className="grid h-12 w-12 place-items-center rounded-full border-2 border-white/35 bg-black/15 text-white backdrop-blur-sm transition hover:bg-white/10"
                            aria-label="Search"
                        >
                            <IoSearch size={24} />
                        </button>

                        <button
                            type="button"
                            onClick={onOpenProfile}
                            className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border-2 border-white/35 bg-black/15 backdrop-blur-sm"
                            aria-label="Profile"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={profile?.photoURL ?? "/avatar-placeholder.png"}
                                alt="Profile"
                                className="h-full w-full object-cover"
                            />
                        </button>
                    </div>

                    <div className="ml-7 flex min-w-0 flex-1 items-center justify-center gap-8">
                        <button
                            type="button"
                            onClick={onOpenDive}
                            className="relative pb-2 text-[17px] font-extrabold text-[#F59E0B]"
                        >
                            Trending
                        </button>

                        {TABS.map((tab) => {
                            const isActive = activeTab === tab;
                            const locked = !uid && tab !== "forYou";

                            return (
                                <button
                                    key={tab}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => {
                                        if (!locked) onChangeTab(tab);
                                    }}
                                    className={[
                                        "relative pb-2 text-[17px] tracking-[0.01em] transition",
                                        isActive
                                            ? "font-extrabold text-white"
                                            : "font-bold text-white/65",
                                        locked ? "cursor-not-allowed opacity-50" : "",
                                    ].join(" ")}
                                    style={{ textShadow: "0 2px 6px rgba(0,0,0,0.45)" }}
                                >
                                    {LABEL[tab]}
                                    {isActive ? (
                                        <span className="absolute inset-x-0 bottom-0 mx-auto h-[3px] w-9 rounded-full bg-white" />
                                    ) : null}
                                </button>
                            );
                        })}
                    </div>

                    <div className="w-[76px] shrink-0" />
                </div>
            )}
        </div>
    );
}
