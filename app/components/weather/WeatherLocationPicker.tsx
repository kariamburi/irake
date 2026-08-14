"use client";

import React, {
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Crosshair,
    Loader2,
    MapPin,
    Search,
    X,
    ChevronRight,
} from "lucide-react";

import {
    weatherCounties,
} from "@/app/constants/weatherCounties";

import type {
    SelectedWeatherLocation,
} from "@/app/hooks/useWeatherLocation";

interface WeatherLocationPickerProps {
    permissionState:
    | "idle"
    | "requesting"
    | "granted"
    | "denied"
    | "unavailable";

    error?: string | null;

    onRequestLocation: () => void;

    onSelectLocation: (
        location: SelectedWeatherLocation
    ) => void;
}

type PlaceSearchResult = {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    country_code?: string;
    admin1?: string;
    admin2?: string;
    admin3?: string;
    timezone?: string;
};

type PlaceSearchResponse = {
    results?: PlaceSearchResult[];
    error?: boolean;
    reason?: string;
};

function buildPlaceLabel(
    place: PlaceSearchResult
) {
    return [
        place.name,
        place.admin2,
        place.admin1,
    ]
        .filter(Boolean)
        .filter(
            (
                value,
                index,
                array
            ) =>
                array.indexOf(value) ===
                index
        )
        .join(", ");
}

export default function WeatherLocationPicker({
    permissionState,
    error,
    onRequestLocation,
    onSelectLocation,
}: WeatherLocationPickerProps) {
    const [query, setQuery] =
        useState("");

    const [results, setResults] =
        useState<PlaceSearchResult[]>([]);

    const [searching, setSearching] =
        useState(false);

    const [searchError, setSearchError] =
        useState<string | null>(null);

    const [searchFocused, setSearchFocused] =
        useState(false);

    const abortRef =
        useRef<AbortController | null>(null);

    const trimmedQuery =
        query.trim();

    const canSearch =
        trimmedQuery.length >= 3;

    const showResults =
        searchFocused &&
        canSearch &&
        (
            searching ||
            results.length > 0 ||
            !!searchError
        );

    useEffect(() => {
        if (
            trimmedQuery.length <
            3
        ) {
            abortRef.current?.abort();
            setResults([]);
            setSearchError(null);
            setSearching(false);
            return;
        }

        const timeout =
            window.setTimeout(
                async () => {
                    abortRef.current?.abort();

                    const controller =
                        new AbortController();

                    abortRef.current =
                        controller;

                    try {
                        setSearching(true);
                        setSearchError(null);

                        const params =
                            new URLSearchParams({
                                name:
                                    trimmedQuery,
                                count: "7",
                                language:
                                    "en",
                                format: "json",
                                countryCode:
                                    "KE",
                            });

                        const response =
                            await fetch(
                                `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
                                {
                                    signal:
                                        controller.signal,
                                }
                            );

                        if (
                            !response.ok
                        ) {
                            throw new Error(
                                "Place search is temporarily unavailable."
                            );
                        }

                        const data =
                            (await response.json()) as PlaceSearchResponse;

                        if (
                            data.error
                        ) {
                            throw new Error(
                                data.reason ||
                                "Place search failed."
                            );
                        }

                        if (
                            controller.signal.aborted
                        ) {
                            return;
                        }

                        setResults(
                            Array.isArray(
                                data.results
                            )
                                ? data.results
                                : []
                        );
                    } catch (
                    searchErr
                    ) {
                        if (
                            controller.signal.aborted
                        ) {
                            return;
                        }

                        console.error(
                            "weather place search:",
                            searchErr
                        );

                        setResults([]);

                        setSearchError(
                            searchErr instanceof Error
                                ? searchErr.message
                                : "Could not search for this place."
                        );
                    } finally {
                        if (
                            !controller.signal.aborted
                        ) {
                            setSearching(false);
                        }
                    }
                },
                350
            );

        return () => {
            window.clearTimeout(
                timeout
            );
        };
    }, [trimmedQuery]);

    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    const handleCountySelection = (
        value: string
    ) => {
        const selected =
            weatherCounties.find(
                (county) =>
                    county.county ===
                    value
            );

        if (!selected) {
            return;
        }

        onSelectLocation({
            latitude:
                selected.latitude,
            longitude:
                selected.longitude,
            locationName:
                `${selected.name}, ${selected.county}`,
            source: "county",
        });
    };

    const selectPlace = (
        place: PlaceSearchResult
    ) => {
        const label =
            buildPlaceLabel(
                place
            );

        onSelectLocation({
            latitude:
                place.latitude,
            longitude:
                place.longitude,
            locationName:
                label ||
                place.name,
            source: "county",
        });

        setQuery(
            label ||
            place.name
        );

        setResults([]);
        setSearchFocused(
            false
        );
    };

    const gpsLabel =
        permissionState ===
            "requesting"
            ? "Detecting your location…"
            : "Use my current location";

    return (
        <section
            className={[
                "rounded-[18px]",
                "border border-[#DDD8CC]",
                "bg-[#FBFAF6]",
                "p-4 sm:p-5",
                "shadow-[0_12px_30px_rgba(15,23,42,0.04)]",
            ].join(" ")}
        >
            <div className="flex items-start gap-3">
                <span
                    className={[
                        "grid h-11 w-11 shrink-0 place-items-center",
                        "rounded-[14px]",
                        "bg-[#E8ECE8]",
                        "text-[#173C2E]",
                    ].join(" ")}
                >
                    <MapPin
                        size={20}
                    />
                </span>

                <div className="min-w-0">
                    <h2 className="text-[17px] font-black tracking-[-0.025em] text-slate-900">
                        Weather for your farm
                    </h2>

                    <p className="mt-1 max-w-xl text-[11px] font-medium leading-5 text-slate-500">
                        Use GPS, search for
                        your town or place,
                        or choose a county
                        to see local weather
                        and farming
                        guidance.
                    </p>
                </div>
            </div>

            <button
                type="button"
                onClick={
                    onRequestLocation
                }
                disabled={
                    permissionState ===
                    "requesting"
                }
                className={[
                    "mt-5 flex h-12 w-full items-center justify-center gap-2",
                    "rounded-[14px]",
                    "bg-[#173C2E]",
                    "text-[11px] font-black text-white",
                    "transition-all duration-200",
                    "hover:-translate-y-0.5 hover:bg-[#214C3A]",
                    "active:translate-y-0 active:scale-[0.995]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                ].join(" ")}
            >
                {permissionState ===
                    "requesting" ? (
                    <Loader2
                        size={17}
                        className="animate-spin"
                    />
                ) : (
                    <Crosshair
                        size={17}
                    />
                )}

                {gpsLabel}
            </button>

            {error ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] font-semibold leading-4 text-amber-800">
                    {error}
                </div>
            ) : null}

            <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#DDD8CC]" />

                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                    Or search a place
                </span>

                <div className="h-px flex-1 bg-[#DDD8CC]" />
            </div>

            <div className="relative">
                <label
                    htmlFor="weather-place-search"
                    className="mb-2 block text-[10px] font-black text-slate-700"
                >
                    Town, village or
                    place
                </label>

                <div
                    className={[
                        "flex h-12 items-center gap-2",
                        "rounded-[14px]",
                        "border border-[#D9D3C7]",
                        "bg-white px-3",
                        "transition-all duration-200",
                        "focus-within:border-[#173C2E]/50",
                        "focus-within:ring-4 focus-within:ring-[#173C2E]/5",
                    ].join(" ")}
                >
                    <Search
                        size={17}
                        className="shrink-0 text-slate-400"
                    />

                    <input
                        id="weather-place-search"
                        type="search"
                        value={query}
                        onChange={(
                            event
                        ) =>
                            setQuery(
                                event.target.value
                            )
                        }
                        onFocus={() =>
                            setSearchFocused(
                                true
                            )
                        }
                        onBlur={() => {
                            window.setTimeout(
                                () =>
                                    setSearchFocused(
                                        false
                                    ),
                                180
                            );
                        }}
                        autoComplete="off"
                        placeholder="e.g. Nyahururu, Nanyuki…"
                        className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                    />

                    {searching ? (
                        <Loader2
                            size={16}
                            className="shrink-0 animate-spin text-[#173C2E]"
                        />
                    ) : query ? (
                        <button
                            type="button"
                            onMouseDown={(
                                event
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() => {
                                setQuery("");
                                setResults([]);
                                setSearchError(null);
                            }}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-[#F3F1EB] hover:text-slate-700"
                            aria-label="Clear place search"
                        >
                            <X
                                size={14}
                            />
                        </button>
                    ) : null}
                </div>

                {trimmedQuery.length >
                    0 &&
                    trimmedQuery.length <
                    3 ? (
                    <p className="mt-1.5 text-[9px] font-medium text-slate-400">
                        Type at least 3
                        characters.
                    </p>
                ) : null}

                {showResults ? (
                    <div
                        className={[
                            "absolute inset-x-0 top-[76px] z-30",
                            "max-h-[300px] overflow-y-auto",
                            "rounded-[16px]",
                            "border border-[#DDD8CC]",
                            "bg-[#FBFAF6]",
                            "p-1.5",
                            "shadow-[0_18px_48px_rgba(15,23,42,0.14)]",
                        ].join(" ")}
                    >
                        {searching &&
                            results.length ===
                            0 ? (
                            <div className="flex items-center gap-2 px-3 py-4 text-[10px] font-semibold text-slate-400">
                                <Loader2
                                    size={14}
                                    className="animate-spin"
                                />
                                Searching places…
                            </div>
                        ) : searchError ? (
                            <div className="rounded-xl bg-rose-50 px-3 py-3 text-[10px] font-semibold leading-4 text-rose-700">
                                {searchError}
                            </div>
                        ) : results.length >
                            0 ? (
                            results.map(
                                (
                                    place
                                ) => {
                                    const label =
                                        buildPlaceLabel(
                                            place
                                        );

                                    return (
                                        <button
                                            key={
                                                place.id
                                            }
                                            type="button"
                                            onMouseDown={(
                                                event
                                            ) =>
                                                event.preventDefault()
                                            }
                                            onClick={() =>
                                                selectPlace(
                                                    place
                                                )
                                            }
                                            className={[
                                                "group flex w-full items-center gap-3",
                                                "rounded-xl px-3 py-2.5 text-left",
                                                "transition hover:bg-[#EEF3EE]",
                                            ].join(" ")}
                                        >
                                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
                                                <MapPin
                                                    size={15}
                                                />
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-[11px] font-black text-slate-800">
                                                    {place.name}
                                                </div>

                                                <div className="mt-0.5 truncate text-[9px] font-medium text-slate-400">
                                                    {label ||
                                                        place.country ||
                                                        "Kenya"}
                                                </div>
                                            </div>

                                            <ChevronRight
                                                size={14}
                                                className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#173C2E]"
                                            />
                                        </button>
                                    );
                                }
                            )
                        ) : (
                            <div className="px-3 py-4 text-center">
                                <div className="text-[10px] font-black text-slate-600">
                                    No matching place found
                                </div>

                                <p className="mt-1 text-[9px] font-medium text-slate-400">
                                    Try another town or nearby place.
                                </p>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>




        </section>
    );
}