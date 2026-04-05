"use client";

import React from "react";
import { IoCompassOutline, IoMenu, IoSearch } from "react-icons/io5";
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
    isDesktop = false,
}: Props) {
    return (
        <div className="sticky top-0 z-50">
            <div className="relative w-full">
                {!isDesktop ? (
                    <div className="px-3 pt-2 pb-1">
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
                                    className="grid h-12 w-12 place-items-center rounded-full bg-black/28 text-white backdrop-blur-md"
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

                            <button
                                type="button"
                                onClick={onOpenDive}
                                className="flex h-12 items-center gap-2 rounded-full bg-black/28 px-4 text-white backdrop-blur-md"
                                aria-label="Dive"
                            >
                                <IoCompassOutline size={19} />
                                <span className="text-[15px] font-bold tracking-[0.01em]">
                                    Dive
                                </span>
                            </button>
                        </div>

                        <div className="mt-2 flex items-center justify-center gap-8 px-2">
                            {TABS.map((k) => {
                                const isActive = activeTab === k;
                                const locked = !uid && k !== "forYou";

                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => {
                                            if (locked) return;
                                            onChangeTab(k);
                                        }}
                                        className={[
                                            "relative pb-1 text-[18px] tracking-[0.01em] transition",
                                            isActive
                                                ? "font-extrabold text-white"
                                                : "font-bold text-white/72",
                                            locked ? "opacity-60" : "",
                                        ].join(" ")}
                                        style={{
                                            textShadow: "0 2px 6px rgba(0,0,0,0.35)",
                                        }}
                                    >
                                        {LABEL[k]}
                                        {isActive ? (
                                            <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-[2px] w-8 rounded-full bg-white" />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex h-[58px] items-center justify-between px-4">

                        <button
                            type="button"
                            onClick={onOpenDive}
                            className="flex h-10 items-center gap-2 rounded-full bg-black/28 px-2 text-white backdrop-blur-md"
                            aria-label="Dive"
                        >
                            <IoCompassOutline size={19} />
                            <span className="text-[12px] font-bold tracking-[0.01em]">
                                Dive
                            </span>
                        </button>
                        <div className="flex items-center gap-7">
                            {TABS.map((k) => {
                                const isActive = activeTab === k;
                                const locked = !uid && k !== "forYou";

                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => {
                                            if (locked) return;
                                            onChangeTab(k);
                                        }}
                                        className={[
                                            "relative pb-1 text-[17px] tracking-[0.01em] transition",
                                            isActive
                                                ? "font-extrabold text-white"
                                                : "font-bold text-white/70",
                                            locked ? "opacity-60" : "",
                                        ].join(" ")}
                                        style={{
                                            textShadow: "0 2px 6px rgba(0,0,0,0.35)",
                                        }}
                                    >
                                        {LABEL[k]}
                                        {isActive ? (
                                            <span className="absolute inset-x-0 -bottom-0.5 mx-auto h-[2px] w-8 rounded-full bg-white" />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex w-12 items-center justify-end">
                            <button
                                type="button"
                                onClick={onOpenSearch}
                                className="grid h-10 w-10 place-items-center rounded-full bg-black/28 text-white backdrop-blur-md"
                                aria-label="Search"
                            >
                                <IoSearch size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}