"use client";

import Link from "next/link";
import WeatherIcon from "@/app/components/weather/WeatherIcon";
import type { WeatherResponse } from "@/app/types/weather";

interface WeatherWidgetProps {
    weather: WeatherResponse | null;
    loading?: boolean;
    error?: string | null;
    isOfflineData?: boolean;
    lastUpdated?: Date | null;
    onRefresh?: () => void;
}

function formatLastUpdated(
    date: Date | null | undefined
): string {
    if (!date) {
        return "";
    }

    const differenceMs =
        Date.now() - date.getTime();

    const differenceMinutes =
        Math.max(
            0,
            Math.floor(
                differenceMs / (1000 * 60)
            )
        );

    if (differenceMinutes < 1) {
        return "Updated just now";
    }

    if (differenceMinutes < 60) {
        return `Updated ${differenceMinutes} minute${differenceMinutes === 1
            ? ""
            : "s"
            } ago`;
    }

    const differenceHours =
        Math.floor(
            differenceMinutes / 60
        );

    return `Updated ${differenceHours} hour${differenceHours === 1
        ? ""
        : "s"
        } ago`;
}

export default function WeatherWidget({
    weather,
    loading = false,
    error,
    isOfflineData = false,
    lastUpdated,
    onRefresh,
}: WeatherWidgetProps) {
    if (loading && !weather) {
        return (
            <section className="animate-pulse rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
                <div className="h-4 w-32 rounded bg-gray-200" />

                <div className="mt-5 flex items-center justify-between">
                    <div>
                        <div className="h-8 w-20 rounded bg-gray-200" />
                        <div className="mt-2 h-4 w-28 rounded bg-gray-100" />
                    </div>

                    <div className="h-16 w-16 rounded-full bg-gray-100" />
                </div>

                <div className="mt-5 h-14 rounded-xl bg-gray-100" />
            </section>
        );
    }

    if (!weather) {
        return (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-semibold text-gray-900">
                    Weather unavailable
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                    {error ||
                        "Choose your location to view local farm weather."}
                </p>

                <Link
                    href="/weather"
                    className="mt-4 inline-flex rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                    Open weather
                </Link>
            </section>
        );
    }

    const todayForecast =
        weather.forecast[0];

    return (
        <section className="overflow-hidden rounded-2xl border border-green-100 bg-white shadow-sm">
            {isOfflineData && (
                <div className="bg-amber-50 px-5 py-2 text-xs font-medium text-amber-800">
                    Showing saved weather.{" "}
                    {formatLastUpdated(
                        lastUpdated
                    )}
                </div>
            )}

            <Link
                href="/weather"
                className="block p-5 transition hover:bg-green-50/40"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                            Farm weather
                        </p>

                        <h2 className="mt-1 text-lg font-semibold text-gray-900">
                            {weather.location}
                        </h2>

                        <p className="mt-1 text-sm text-gray-500">
                            {weather.current.condition}
                        </p>
                    </div>

                    <WeatherIcon
                        weatherCode={
                            weather.current
                                .weather_code
                        }
                        isDay={
                            weather.current.is_day
                        }
                        className="text-5xl"
                    />
                </div>

                <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                        <p className="text-4xl font-bold tracking-tight text-gray-900">
                            {weather.current.temp_c}
                            °C
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                            Feels like{" "}
                            {
                                weather.current
                                    .apparent_temp_c
                            }
                            °C
                        </p>
                    </div>

                    {todayForecast && (
                        <div className="text-right text-sm">
                            <p className="font-medium text-gray-800">
                                {todayForecast.high}°
                                / {todayForecast.low}°
                            </p>

                            <p className="mt-1 text-blue-600">
                                💧{" "}
                                {
                                    todayForecast.rain_chance
                                }
                                % rain
                            </p>
                        </div>
                    )}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                            Humidity
                        </p>

                        <p className="mt-1 font-semibold text-gray-900">
                            {
                                weather.current
                                    .humidity
                            }
                            %
                        </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">
                            Wind
                        </p>

                        <p className="mt-1 font-semibold text-gray-900">
                            {
                                weather.current
                                    .wind_speed_kph
                            }{" "}
                            km/h
                        </p>
                    </div>
                </div>

                <div className="mt-4 rounded-xl bg-green-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                        Farming alert
                    </p>

                    <p className="mt-1 text-sm leading-5 text-green-900">
                        {weather.agro_alert}
                    </p>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        {formatLastUpdated(
                            lastUpdated
                        )}
                    </span>

                    <span className="text-sm font-semibold text-green-700">
                        View 7-day forecast →
                    </span>
                </div>
            </Link>

            {error && weather && (
                <div className="border-t border-amber-100 bg-amber-50 px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-amber-800">
                            {error}
                        </p>

                        {onRefresh && (
                            <button
                                type="button"
                                onClick={onRefresh}
                                className="shrink-0 text-xs font-semibold text-amber-900 underline"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}