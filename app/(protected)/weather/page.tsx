"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    CloudSun,
    MapPin,
    RefreshCw,
} from "lucide-react";

import AppShell from "@/app/components/AppShell";
import WeatherForecast from "@/app/components/weather/WeatherForecast";
import WeatherLocationPicker from "@/app/components/weather/WeatherLocationPicker";
import WeatherDiscoveryRail from "@/app/components/weather/WeatherDiscoveryRail";
import { useWeather } from "@/app/hooks/useWeather";
import { useWeatherLocation } from "@/app/hooks/useWeatherLocation";
import AppShellRightRail from "@/app/components/AppShellRightRail";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

/* -------------------------------------------------------------------------- */
/* Responsive helpers                                                         */
/* -------------------------------------------------------------------------- */

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);

        const updateMatches = () => {
            setMatches(mediaQuery.matches);
        };

        updateMatches();

        mediaQuery.addEventListener?.("change", updateMatches);

        return () => {
            mediaQuery.removeEventListener?.("change", updateMatches);
        };
    }, [query]);

    return matches;
}

function useIsMobile() {
    return useMediaQuery("(max-width: 1023px)");
}

function formatLastUpdated(
    date: Date | null
): string {
    if (!date) {
        return "Not updated yet";
    }

    const now = new Date();

    const isToday =
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    const time = date.toLocaleTimeString(
        "en-KE",
        {
            hour: "numeric",
            minute: "2-digit",
        }
    );

    if (isToday) {
        return `Today, ${time}`;
    }

    return date.toLocaleString("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

/* -------------------------------------------------------------------------- */
/* Loading card                                                               */
/* -------------------------------------------------------------------------- */

function WeatherLoadingCard({
    title,
    message,
}: {
    title: string;
    message: string;
}) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.2,
                ease: "easeOut",
            }}
            className={[
                "grid min-h-[260px] place-items-center",
                "rounded-[18px]",
                "border border-[#DDD8CC]",
                "bg-[#FBFAF6]",
                "px-6 py-8",
                "shadow-[0_12px_30px_rgba(15,23,42,0.035)]",
            ].join(" ")}
        >
            <div className="text-center">
                <div className="flex justify-center">
                    <BouncingBallLoader />
                </div>

                <p className="mt-5 text-[13px] font-black text-slate-900">
                    {title}
                </p>

                <p className="mx-auto mt-1.5 max-w-sm text-[10px] font-medium leading-5 text-slate-400">
                    {message}
                </p>
            </div>
        </motion.section>
    );
}


interface WeatherLocationDetails {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
}

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

/*
 * Earlier API responses may have stored location as an object:
 *
 * location: {
 *     name,
 *     address,
 *     latitude,
 *     longitude,
 * }
 *
 * WeatherForecast expects weather.location to remain a string. This helper
 * converts old and new response shapes into one safe client-side structure.
 */
function normalizeWeatherResponse<T extends object>(
    weather: T,
    fallbackName: string,
    fallbackLatitude: number,
    fallbackLongitude: number
): T & {
    location: string;
    locationDetails: WeatherLocationDetails;
} {
    const weatherRecord =
        weather as Record<string, unknown>;

    const rawLocation =
        weatherRecord.location;

    const rawLocationDetails =
        weatherRecord.locationDetails;

    let name = fallbackName;
    let address: string | null = null;
    let latitude = fallbackLatitude;
    let longitude = fallbackLongitude;

    if (
        typeof rawLocation === "string" &&
        rawLocation.trim()
    ) {
        name = rawLocation.trim();
    }

    /*
     * Support the older response that replaced location
     * with an object.
     */
    if (isRecord(rawLocation)) {
        if (
            typeof rawLocation.name === "string" &&
            rawLocation.name.trim()
        ) {
            name = rawLocation.name.trim();
        }

        if (
            typeof rawLocation.address === "string" &&
            rawLocation.address.trim()
        ) {
            address = rawLocation.address.trim();
        }

        if (
            typeof rawLocation.latitude === "number" &&
            Number.isFinite(
                rawLocation.latitude
            )
        ) {
            latitude =
                rawLocation.latitude;
        }

        if (
            typeof rawLocation.longitude === "number" &&
            Number.isFinite(
                rawLocation.longitude
            )
        ) {
            longitude =
                rawLocation.longitude;
        }
    }

    /*
     * Prefer the new locationDetails property when present.
     */
    if (isRecord(rawLocationDetails)) {
        if (
            typeof rawLocationDetails.name === "string" &&
            rawLocationDetails.name.trim()
        ) {
            name =
                rawLocationDetails.name.trim();
        }

        if (
            typeof rawLocationDetails.address === "string" &&
            rawLocationDetails.address.trim()
        ) {
            address =
                rawLocationDetails.address.trim();
        }

        if (
            typeof rawLocationDetails.latitude === "number" &&
            Number.isFinite(
                rawLocationDetails.latitude
            )
        ) {
            latitude =
                rawLocationDetails.latitude;
        }

        if (
            typeof rawLocationDetails.longitude === "number" &&
            Number.isFinite(
                rawLocationDetails.longitude
            )
        ) {
            longitude =
                rawLocationDetails.longitude;
        }
    }

    return Object.assign(
        {},
        weather,
        {
            location: name,
            locationDetails: {
                name,
                address,
                latitude,
                longitude,
            },
        }
    ) as T & {
        location: string;
        locationDetails: WeatherLocationDetails;
    };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function WeatherPage() {
    const router = useRouter();
    const isMobile = useIsMobile();

    const {
        location,
        permissionState,
        error: locationError,
        initialized,
        requestLocation,
        selectManualLocation,
        clearLocation,
    } = useWeatherLocation();

    const {
        weather,
        loading,
        error: weatherError,
        isOfflineData,
        lastUpdated,
        refreshWeather,
    } = useWeather(
        location
            ? {
                latitude: location.latitude,
                longitude: location.longitude,
                locationName: location.locationName,
            }
            : null
    );

    const handleRefresh = () => {
        void refreshWeather();
    };

    const handleBack = () => {
        if (window.history.length > 1) {
            router.back();
            return;
        }

        router.push("/");
    };

    const locationLabel =
        location?.locationName ||
        (location?.source === "gps"
            ? "Current location"
            : "Selected location");

    const lastUpdatedLabel =
        formatLastUpdated(lastUpdated);

    /*
     * Normalize both old cached responses and the current API response.
     * This prevents React from trying to render a location object.
     */
    const normalizedWeather =
        useMemo(() => {
            if (!weather || !location) {
                return null;
            }

            return normalizeWeatherResponse(
                weather,
                locationLabel,
                location.latitude,
                location.longitude
            );
        }, [
            weather,
            location,
            locationLabel,
        ]);

    const locationDetails =
        normalizedWeather?.locationDetails;

    const displayedLocationName =
        locationDetails?.name ||
        locationLabel;

    const displayedAddress =
        locationDetails?.address ||
        null;

    const displayedLatitude =
        locationDetails?.latitude ??
        location?.latitude ??
        null;

    const displayedLongitude =
        locationDetails?.longitude ??
        location?.longitude ??
        null;

    /* ------------------------------------------------------------------------ */
    /* Shared weather page content                                              */
    /* ------------------------------------------------------------------------ */

    const weatherContent = (
        <>
            {/* Loading saved location */}
            {!initialized && (
                <WeatherLoadingCard
                    title="Loading weather location..."
                    message="Checking for your previously saved farm location."
                />
            )}

            {/* Location selector */}
            {initialized && !location && (
                <div className="mx-auto max-w-xl">
                    <WeatherLocationPicker
                        permissionState={permissionState}
                        error={locationError}
                        onRequestLocation={requestLocation}
                        onSelectLocation={selectManualLocation}
                    />
                </div>
            )}

            {/* Initial weather loading */}
            {initialized && location && loading && !weather && (
                <WeatherLoadingCard
                    title="Loading farm weather..."
                    message="Fetching the latest forecast and farming recommendations."
                />
            )}

            {/* Fatal loading error */}
            {initialized &&
                location &&
                !loading &&
                !weather &&
                weatherError && (
                    <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <CloudSun
                                size={24}
                                className="text-red-700"
                            />
                        </div>

                        <h2 className="mt-4 font-bold text-red-900">
                            Weather could not be loaded
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-red-700">
                            {weatherError}
                        </p>

                        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={handleRefresh}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
                            >
                                <RefreshCw size={16} />
                                Try again
                            </button>

                            <button
                                type="button"
                                onClick={clearLocation}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                            >
                                <MapPin size={16} />
                                Choose another location
                            </button>
                        </div>
                    </section>
                )}

            {/* Weather information */}
            {initialized && location && normalizedWeather && (
                <>
                    {/* Location and actions */}
                    <section
                        className={[
                            "mb-4 rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] lg:hidden",
                            "px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.035)]",
                        ].join(" ")}
                    >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E8ECE8] text-[#F39A22]">
                                    <MapPin size={17} />
                                </span>

                                <div className="min-w-0">
                                    <p className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                                        Forecast location
                                    </p>

                                    <p className="mt-0.5 truncate text-[12px] font-black text-slate-800">
                                        {displayedLocationName}
                                    </p>

                                    {displayedAddress ? (
                                        <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
                                            {displayedAddress}
                                        </p>
                                    ) : null}

                                    {displayedLatitude !== null &&
                                        displayedLongitude !== null ? (
                                        <p className="mt-0.5 text-[9px] text-slate-300">
                                            {displayedLatitude.toFixed(4)},{" "}
                                            {displayedLongitude.toFixed(4)}
                                        </p>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className={[
                                        "inline-flex h-9 items-center justify-center gap-2 rounded-full",
                                        "border border-[#D7D2C7] bg-white px-3.5",
                                        "text-[10px] font-black text-slate-600",
                                        "transition-all duration-200",
                                        "hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]",
                                        "disabled:cursor-not-allowed disabled:opacity-60",
                                    ].join(" ")}
                                >
                                    <RefreshCw
                                        size={14}
                                        className={
                                            loading
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />
                                    Refresh
                                </button>

                                <button
                                    type="button"
                                    onClick={clearLocation}
                                    className={[
                                        "inline-flex h-9 items-center justify-center gap-2 rounded-full",
                                        "border border-[#D7D2C7] bg-white px-3.5",
                                        "text-[10px] font-black text-slate-600",
                                        "transition-all duration-200",
                                        "hover:border-[#F39A22]/55 hover:bg-[#FFF9F0]",
                                    ].join(" ")}
                                >
                                    <MapPin size={14} />
                                    Change
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Offline cached weather notice */}
                    {isOfflineData && (
                        <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            <p className="font-bold">
                                Showing saved weather information
                            </p>

                            <p className="mt-1 leading-6">
                                Ekarihub could not reach the weather service, so the most
                                recent saved forecast is being displayed.

                                {lastUpdated && (
                                    <>
                                        {" "}
                                        Last updated{" "}
                                        {lastUpdated.toLocaleString(
                                            "en-KE",
                                            {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            }
                                        )}
                                        .
                                    </>
                                )}
                            </p>
                        </section>
                    )}

                    {/* Refresh warning when old weather remains available */}
                    {weatherError && (
                        <section className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                            <p className="leading-6">
                                {weatherError}
                            </p>

                            <button
                                type="button"
                                onClick={handleRefresh}
                                disabled={loading}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-900 px-3.5 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw
                                    size={14}
                                    className={
                                        loading
                                            ? "animate-spin"
                                            : ""
                                    }
                                />

                                {loading
                                    ? "Trying..."
                                    : "Try again"}
                            </button>
                        </section>
                    )}

                    {/* Main forecast */}
                    <WeatherForecast weather={normalizedWeather} />

                </>
            )}
        </>
    );

    /* ------------------------------------------------------------------------ */
    /* Mobile view                                                              */
    /* ------------------------------------------------------------------------ */

    if (isMobile) {
        return (
            <div className="fixed inset-0 z-40 flex flex-col bg-[#F6F7F9]">
                {/* Mobile header */}
                <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
                    <div className="flex h-14 items-center justify-between gap-3 px-3">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50"
                            aria-label="Go back"
                        >
                            <ArrowLeft size={18} />
                        </button>

                        <div className="min-w-0 flex-1 text-center">
                            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1">
                                <CloudSun
                                    size={15}
                                    className="shrink-0 text-emerald-700"
                                />

                                <span className="truncate text-[11px] font-semibold text-emerald-800">
                                    Ekarihub Weather
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={
                                loading ||
                                !location
                            }
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Refresh weather"
                        >
                            <RefreshCw
                                size={17}
                                className={
                                    loading
                                        ? "animate-spin"
                                        : ""
                                }
                            />
                        </button>
                    </div>

                    <div className="border-t border-slate-100 px-4 py-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="truncate text-sm font-extrabold text-slate-900">
                                    Weather for your farm
                                </h1>

                                <p className="truncate text-[11px] text-slate-500">
                                    {location
                                        ? displayedAddress ||
                                        displayedLocationName
                                        : "Choose your farm location"}
                                </p>

                                {location && lastUpdated && (
                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                        Updated {lastUpdatedLabel}
                                    </p>
                                )}
                            </div>

                            {location && (
                                <button
                                    type="button"
                                    onClick={clearLocation}
                                    className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                    Change
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                {/* Mobile scrollable content */}
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    <main className="px-3 py-4">
                        <div className="mx-auto max-w-3xl">
                            {weatherContent}
                        </div>

                        <div
                            style={{
                                height:
                                    "env(safe-area-inset-bottom)",
                            }}
                        />
                    </main>
                </div>
            </div>
        );
    }

    /* ------------------------------------------------------------------------ */
    /* Desktop view                                                             */
    /* ------------------------------------------------------------------------ */

    return (
        <AppShellRightRail
            rightRail={
                <WeatherDiscoveryRail
                    weather={normalizedWeather}
                />
            }
            rightRailClassName="border-l border-[#E4DED2] bg-[#F8F7F2]"
        >
            <div className="h-[100svh] w-full overflow-y-auto bg-[#F8F7F2] no-scrollbar">
                {/* Desktop hero */}
                <motion.header
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                        duration: 0.3,
                        ease: "easeOut",
                    }}
                    className="relative overflow-hidden bg-[#173C2E]"
                >
                    <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/[0.035]" />
                    <div className="pointer-events-none absolute bottom-[-80px] right-20 h-48 w-48 rounded-full bg-[#F39A22]/10" />

                    <div className="mx-auto max-w-[940px] px-5 pb-5 pt-5">
                        <div className="flex items-start justify-between gap-5">
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.11em] text-white/40">
                                    Ekarihub Weather
                                </p>

                                <h1 className="mt-1.5 text-[27px] font-black tracking-[-0.035em] text-white">
                                    Weather for your farm
                                </h1>

                                <p className="mt-1 max-w-2xl text-[12px] font-medium leading-5 text-white/50">
                                    Local weather, rainfall probability and practical
                                    farming recommendations for the next seven days.
                                </p>

                                {location && lastUpdated ? (
                                    <p className="mt-2 text-[10px] font-semibold text-white/35">
                                        {isOfflineData
                                            ? "Showing saved forecast"
                                            : "Forecast updated"}{" "}
                                        {lastUpdatedLabel}
                                    </p>
                                ) : null}
                            </div>

                            {location ? (
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className={[
                                        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full",
                                        "border border-white/20 bg-white/[0.08] px-4",
                                        "text-[11px] font-black text-white",
                                        "backdrop-blur-sm transition-all duration-200",
                                        "hover:-translate-y-0.5 hover:bg-white/[0.13]",
                                        "active:translate-y-0 active:scale-[0.98]",
                                        "disabled:cursor-not-allowed disabled:opacity-60",
                                    ].join(" ")}
                                >
                                    <RefreshCw
                                        size={15}
                                        className={
                                            loading
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />

                                    {loading
                                        ? "Refreshing…"
                                        : "Refresh weather"}
                                </button>
                            ) : null}
                        </div>

                        {location ? (
                            <div className="mt-4 flex items-center justify-between gap-4 rounded-[16px] bg-white/[0.09] px-4 py-3 backdrop-blur-sm">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#F39A22]">
                                        <MapPin size={21} />
                                    </span>

                                    <div className="min-w-0">
                                        <div className="text-[13px] font-black text-white">
                                            {displayedLocationName}
                                        </div>

                                        <div className="mt-0.5 truncate text-[10px] font-medium text-white/45">
                                            {displayedAddress ||
                                                (displayedLatitude !== null &&
                                                    displayedLongitude !== null
                                                    ? `${displayedLatitude.toFixed(
                                                        4
                                                    )}, ${displayedLongitude.toFixed(
                                                        4
                                                    )}`
                                                    : "Current forecast location")}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleRefresh}
                                        disabled={loading}
                                        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3.5 text-[10px] font-black text-white transition hover:bg-white/[0.13] disabled:opacity-60"
                                    >
                                        <RefreshCw
                                            size={13}
                                            className={
                                                loading
                                                    ? "animate-spin"
                                                    : ""
                                            }
                                        />
                                        Refresh
                                    </button>

                                    <button
                                        type="button"
                                        onClick={clearLocation}
                                        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3.5 text-[10px] font-black text-white transition hover:bg-white/[0.13]"
                                    >
                                        <MapPin size={13} />
                                        Change
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </motion.header>

                {/* Desktop page body */}
                <main className="mx-auto max-w-[940px] px-5 pb-24 pt-4">
                    {weatherContent}
                </main>
            </div>
        </AppShellRightRail>
    );
}