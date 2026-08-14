"use client";

import React, { useMemo } from "react";
import {
    IoCloudOutline,
    IoLocationOutline,
    IoSearch,
    IoSunnyOutline,
} from "react-icons/io5";

import { FeedTabKey } from "../data/deedsFeedWeb";
import { useWeather } from "@/app/hooks/useWeather";
import { useWeatherLocation } from "@/app/hooks/useWeatherLocation";
import EkariAvatar from "@/app/components/EkariAvatar";

const TABS: FeedTabKey[] = [
    "trending",
    "forYou",
    "following",
    "nearby",
];

const LABEL: Record<FeedTabKey, string> = {
    trending: "Trending",
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

/* =========================================================
   SMALL HELPERS
========================================================= */

function firstNumber(...values: unknown[]): number | null {
    for (const value of values) {
        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            continue;
        }

        const n = Number(value);

        if (Number.isFinite(n)) {
            return n;
        }
    }

    return null;
}

function getWeatherCode(weather: any) {
    const current =
        weather?.current ??
        weather?.currentWeather ??
        weather?.now ??
        {};

    const daily = Array.isArray(weather?.daily)
        ? weather.daily[0]
        : weather?.daily ?? {};

    return firstNumber(
        current?.weather_code,
        current?.weatherCode,
        current?.code,
        daily?.weatherCode,
        daily?.weather_code
    );
}

function getWeatherTemperature(weather: any) {
    const current =
        weather?.current ??
        weather?.currentWeather ??
        weather?.now ??
        {};

    return firstNumber(
        current?.temp_c,
        current?.temperature,
        current?.temperatureC,
        current?.temperature2m,
        current?.temperature_2m,
        current?.temp,
        weather?.temp_c
    );
}

function isSunnyWeather(code: number | null) {
    if (code === null) return false;

    return code === 0 || code === 1;
}

/* =========================================================
   COMPONENT
========================================================= */

export function DeedsTopBar({
    uid,
    profile,
    activeTab,
    onChangeTab,
    onOpenSearch,
    onOpenProfile,
    onOpenWeather,
    isDesktop = false,
}: Props) {
    /* =====================================================
       MOBILE WEATHER
    ===================================================== */

    const {
        location,
        initialized: locationInitialized,
    } = useWeatherLocation();

    const {
        weather,
        loading: weatherLoading,
    } = useWeather(
        location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                locationName: location.locationName,
            }
            : null
    );

    const weatherView = useMemo(() => {
        const temperature =
            getWeatherTemperature(weather);

        const code =
            getWeatherCode(weather);

        return {
            temperature,
            code,
        };
    }, [weather]);

    const cleanHandle =
        (profile?.handle || "")
            .trim()
            .replace(/^@/, "");

    /* =====================================================
       TAB RENDERER
    ===================================================== */

    const renderTabs = (
        mobile: boolean
    ) => (
        <div
            className={[
                "flex items-center",
                mobile
                    ? "w-full justify-between gap-1 px-2"
                    : "gap-6",
            ].join(" ")}
        >
            {TABS.map((tab) => {
                const isActive =
                    activeTab === tab;

                const locked =
                    !uid &&
                    tab !== "forYou" &&
                    tab !== "trending";

                return (
                    <button
                        key={tab}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                            if (locked) {
                                return;
                            }

                            onChangeTab(tab);
                        }}
                        className={[
                            "relative",
                            "flex",
                            "items-center",
                            "justify-center",
                            "whitespace-nowrap",
                            "transition-all",
                            "duration-200",

                            mobile
                                ? [
                                    "min-w-0",
                                    "flex-1",
                                    "pb-[10px]",
                                    "text-[15px]",
                                    "sm:text-[16px]",
                                ].join(" ")
                                : [
                                    "pb-[7px]",
                                    "text-[16px]",
                                ].join(" "),

                            isActive
                                ? tab === "trending"
                                    ? "font-black text-[#F3A526]"
                                    : "font-black text-white"
                                : "font-bold text-white/55",

                            locked
                                ? "cursor-default opacity-40"
                                : "hover:text-white",
                        ].join(" ")}
                        style={{
                            textShadow:
                                "0 2px 8px rgba(0,0,0,0.45)",
                        }}
                    >
                        {LABEL[tab]}

                        {isActive ? (
                            <span
                                className={[
                                    "absolute",
                                    "bottom-0",
                                    "left-1/2",
                                    "h-[3px]",
                                    "-translate-x-1/2",
                                    "rounded-full",

                                    tab === "trending"
                                        ? "w-7 bg-[#F3A526]"
                                        : "w-7 bg-white",
                                ].join(" ")}
                            />
                        ) : null}
                    </button>
                );
            })}
        </div>
    );

    return (
        <header
            className={[
                "sticky",
                "top-0",
                "z-[60]",
                "w-full",
            ].join(" ")}
        >
            {/* =================================================
                MOBILE
            ================================================= */}
            {!isDesktop ? (
                <div
                    className={[
                        "relative",
                        "w-full",
                        "px-3",
                        "pt-[max(8px,env(safe-area-inset-top))]",
                        "pb-1",
                    ].join(" ")}
                >
                    {/* subtle dark fade behind header */}
                    <div
                        aria-hidden="true"
                        className="
                            pointer-events-none
                            absolute
                            inset-x-0
                            top-0
                            h-[124px]
                            bg-gradient-to-b
                            from-black/60
                            via-black/25
                            to-transparent
                        "
                    />

                    {/* =================================================
                        TOP ROW
                    ================================================= */}
                    <div className="relative z-10 flex h-[52px] items-center justify-between">
                        {/* LEFT */}
                        <div className="flex items-center gap-2">
                            {/* SEARCH */}
                            <button
                                type="button"
                                onClick={onOpenSearch}
                                aria-label="Search"
                                title="Search"
                                className={[
                                    "grid",
                                    "h-11",
                                    "w-11",
                                    "place-items-center",
                                    "rounded-full",
                                    "border",
                                    "border-white/25",
                                    "bg-black/22",
                                    "text-white",
                                    "backdrop-blur-md",
                                    "transition-all",
                                    "duration-200",
                                    "active:scale-95",
                                ].join(" ")}
                            >
                                <IoSearch size={22} />
                            </button>

                            {/* PROFILE */}
                            <button
                                type="button"
                                onClick={onOpenProfile}
                                aria-label="Open profile"
                                title={
                                    cleanHandle
                                        ? `@${cleanHandle}`
                                        : "Profile"
                                }
                                className="
                                    relative
                                    rounded-full
                                    transition
                                    active:scale-95
                                "
                            >
                                <div
                                    className="
                                        rounded-full
                                        border-2
                                        border-white/55
                                        bg-black/20
                                        shadow-[0_6px_20px_rgba(0,0,0,0.28)]
                                    "
                                >
                                    <EkariAvatar
                                        src={
                                            profile?.photoURL ??
                                            null
                                        }
                                        handle={
                                            cleanHandle ||
                                            "user"
                                        }
                                        alt={
                                            cleanHandle
                                                ? `@${cleanHandle}`
                                                : "Profile"
                                        }
                                        size={44}
                                    />
                                </div>
                            </button>
                        </div>

                        {/* RIGHT: WEATHER PILL */}
                        <button
                            type="button"
                            onClick={onOpenWeather}
                            aria-label="Open weather"
                            title="Farm weather"
                            className={[
                                "flex",
                                "h-10",
                                "max-w-[160px]",
                                "items-center",
                                "gap-2",
                                "rounded-full",
                                "border",
                                "border-white/25",
                                "bg-black/25",
                                "px-3",
                                "text-white",
                                "shadow-[0_6px_20px_rgba(0,0,0,0.18)]",
                                "backdrop-blur-md",
                                "transition",
                                "active:scale-[0.97]",
                            ].join(" ")}
                        >
                            {!locationInitialized ||
                                weatherLoading ? (
                                <>
                                    <IoCloudOutline
                                        size={17}
                                        className="text-white/75"
                                    />

                                    <span className="text-[12px] font-bold text-white/70">
                                        Weather
                                    </span>
                                </>
                            ) : weatherView.temperature !==
                                null ? (
                                <>
                                    {isSunnyWeather(
                                        weatherView.code
                                    ) ? (
                                        <IoSunnyOutline
                                            size={18}
                                            className="text-[#F3A526]"
                                        />
                                    ) : (
                                        <IoCloudOutline
                                            size={18}
                                            className="text-sky-300"
                                        />
                                    )}

                                    <span className="text-[13px] font-black">
                                        {Math.round(
                                            weatherView.temperature
                                        )}
                                        °C
                                    </span>

                                    {location?.locationName ? (
                                        <span
                                            className="
                                                hidden
                                                max-w-[66px]
                                                truncate
                                                text-[10px]
                                                font-bold
                                                text-white/65
                                                min-[380px]:block
                                            "
                                        >
                                            {location.locationName}
                                        </span>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <IoLocationOutline
                                        size={17}
                                        className="text-[#F3A526]"
                                    />

                                    <span className="text-[11px] font-bold">
                                        Weather
                                    </span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* =================================================
                        TABS
                    ================================================= */}
                    <div className="relative z-10 mt-2">
                        {renderTabs(true)}
                    </div>
                </div>
            ) : (
                /* =====================================================
                   DESKTOP
                   Keep desktop clean and close to existing appearance.
                ===================================================== */
                <div
                    className="
                        relative
                        flex
                        h-[64px]
                        w-full
                        items-center
                        px-4
                    "
                >
                    {/* SEARCH */}
                    <div className="flex w-[52px] items-center">
                        <button
                            type="button"
                            onClick={onOpenSearch}
                            className="
                                grid
                                h-10
                                w-10
                                place-items-center
                                rounded-full
                                border
                                border-white/20
                                bg-black/18
                                text-white
                                backdrop-blur-md
                                transition
                                hover:bg-white/10
                                active:scale-95
                            "
                            aria-label="Search"
                        >
                            <IoSearch size={20} />
                        </button>
                    </div>

                    {/* CENTER TABS */}
                    <div
                        className="
                            absolute
                            left-1/2
                            top-1/2
                            -translate-x-1/2
                            -translate-y-1/2
                        "
                    >
                        {renderTabs(false)}
                    </div>

                    {/* BALANCE */}
                    <div className="ml-auto w-[52px]" />
                </div>
            )}
        </header>
    );
}