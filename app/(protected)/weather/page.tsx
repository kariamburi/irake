"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    CloudSun,
    MapPin,
    RefreshCw,
} from "lucide-react";

import AppShell from "@/app/components/AppShell";
import WeatherForecast from "@/app/components/weather/WeatherForecast";
import WeatherLocationPicker from "@/app/components/weather/WeatherLocationPicker";
import { useWeather } from "@/app/hooks/useWeather";
import { useWeatherLocation } from "@/app/hooks/useWeatherLocation";

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
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700" />

            <p className="mt-4 font-semibold text-slate-900">
                {title}
            </p>

            <p className="mt-1 text-sm leading-6 text-slate-500">
                {message}
            </p>
        </section>
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
                    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                                    <MapPin
                                        size={19}
                                        className="text-emerald-700"
                                    />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Forecast location
                                    </p>

                                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                                        {displayedLocationName}
                                    </p>

                                    {displayedAddress && (
                                        <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
                                            {displayedAddress}
                                        </p>
                                    )}

                                    {displayedLatitude !== null &&
                                        displayedLongitude !== null && (
                                            <p className="mt-1 text-xs text-slate-400">
                                                Coordinates:{" "}
                                                {displayedLatitude.toFixed(4)}
                                                ,{" "}
                                                {displayedLongitude.toFixed(4)}
                                            </p>
                                        )}

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                            <span
                                                className={`h-1.5 w-1.5 rounded-full ${isOfflineData
                                                    ? "bg-amber-500"
                                                    : "bg-emerald-500"
                                                    }`}
                                            />

                                            {isOfflineData
                                                ? "Saved forecast"
                                                : "Latest forecast"}
                                        </span>

                                        <span className="text-[11px] text-slate-500">
                                            Updated {lastUpdatedLabel}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:flex">
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-700 px-3.5 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <RefreshCw
                                        size={16}
                                        className={
                                            loading
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />

                                    {loading
                                        ? "Refreshing"
                                        : "Refresh"}
                                </button>

                                <button
                                    type="button"
                                    onClick={clearLocation}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                    <MapPin size={16} />
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

                    {/* Bottom refresh */}
                    <div className="mt-6 flex justify-center pb-4">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={loading}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <RefreshCw
                                size={17}
                                className={
                                    loading
                                        ? "animate-spin"
                                        : ""
                                }
                            />

                            {loading
                                ? "Refreshing forecast..."
                                : "Refresh forecast"}
                        </button>
                    </div>
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
        <AppShell>
            <div className="min-h-[100dvh] w-full bg-[#F6F7F9]">
                <div className="mx-auto w-full max-w-7xl px-4 py-5 xl:px-6">
                    {/* Desktop header */}
                    <header className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                        <div className="flex items-center justify-between gap-5">
                            <div className="flex min-w-0 items-center gap-4">
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50"
                                    aria-label="Go back"
                                >
                                    <ArrowLeft size={19} />
                                </button>

                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50">
                                    <CloudSun
                                        size={23}
                                        className="text-emerald-700"
                                    />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                        Ekarihub Weather
                                    </p>

                                    <h1 className="mt-0.5 text-2xl font-extrabold text-slate-900">
                                        Weather for your farm
                                    </h1>

                                    <p className="mt-1 max-w-3xl text-sm text-slate-500">
                                        Local weather, rainfall probability and practical farming
                                        recommendations for the next seven days.
                                    </p>

                                    {location && lastUpdated && (
                                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                            <span
                                                className={`h-2 w-2 rounded-full ${isOfflineData
                                                    ? "bg-amber-500"
                                                    : "bg-emerald-500"
                                                    }`}
                                            />

                                            <span>
                                                {isOfflineData
                                                    ? "Showing saved forecast"
                                                    : "Forecast updated"}{" "}
                                                {lastUpdatedLabel}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {location && (
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#233F39] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <RefreshCw
                                        size={16}
                                        className={
                                            loading
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />

                                    {loading
                                        ? "Refreshing..."
                                        : "Refresh weather"}
                                </button>
                            )}
                        </div>
                    </header>

                    {/* Desktop page body */}
                    <main className="mx-auto max-w-6xl">
                        {weatherContent}
                    </main>
                </div>
            </div>
        </AppShell>
    );
}