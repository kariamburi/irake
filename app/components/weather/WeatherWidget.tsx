"use client";

import Link from "next/link";
import {
    CloudSun,
    Droplets,
    Wind,
} from "lucide-react";

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
    if (!date) return "";

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
            <section className="animate-pulse rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4">
                <div className="h-3 w-28 rounded bg-slate-200" />
                <div className="mt-4 h-10 w-24 rounded bg-slate-200" />
                <div className="mt-4 h-14 rounded-xl bg-slate-100" />
            </section>
        );
    }

    if (!weather) {
        return (
            <section className="rounded-[18px] border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-amber-800">
                    <CloudSun size={17} />
                    <h2 className="text-sm font-black">
                        Weather unavailable
                    </h2>
                </div>

                <p className="mt-2 text-[12px] leading-5 text-amber-700">
                    {error ||
                        "Choose your location to view local farm weather."}
                </p>

                <Link
                    href="/weather"
                    className="mt-3 inline-flex rounded-xl bg-[#173C2E] px-4 py-2 text-[11px] font-black text-white"
                >
                    Open weather
                </Link>
            </section>
        );
    }

    const todayForecast =
        weather.forecast[0];

    return (
        <section className="overflow-hidden rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
            {isOfflineData ? (
                <div className="bg-amber-50 px-4 py-2 text-[10px] font-bold text-amber-800">
                    Showing saved weather.{" "}
                    {formatLastUpdated(
                        lastUpdated
                    )}
                </div>
            ) : null}

            <Link
                href="/weather"
                className="block p-4 transition-all duration-200 hover:bg-[#FFFDF8]"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#4B7C5A]">
                            Farm weather
                        </p>

                        <h2 className="mt-1 text-[14px] font-black text-slate-900">
                            {weather.location}
                        </h2>

                        <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                            {weather.current.condition}
                        </p>
                    </div>

                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#EAF2FB]">
                        <WeatherIcon
                            weatherCode={
                                weather.current
                                    .weather_code
                            }
                            isDay={
                                weather.current.is_day
                            }
                            className="text-[30px]"
                        />
                    </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                        <p className="text-[32px] font-black leading-none text-[#173C2E]">
                            {weather.current.temp_c}
                            °C
                        </p>

                        <p className="mt-1 text-[10px] font-medium text-slate-400">
                            Feels like{" "}
                            {
                                weather.current
                                    .apparent_temp_c
                            }
                            °C
                        </p>
                    </div>

                    {todayForecast ? (
                        <div className="text-right text-[11px]">
                            <p className="font-black text-slate-700">
                                {todayForecast.high}° /{" "}
                                {todayForecast.low}°
                            </p>

                            <p className="mt-1 font-bold text-[#1762A8]">
                                {todayForecast.rain_chance}% rain
                            </p>
                        </div>
                    ) : null}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[#F2F0EB] p-2.5">
                        <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            <Droplets size={11} />
                            Humidity
                        </div>

                        <p className="mt-1 text-[12px] font-black text-slate-800">
                            {weather.current.humidity}%
                        </p>
                    </div>

                    <div className="rounded-xl bg-[#F2F0EB] p-2.5">
                        <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            <Wind size={11} />
                            Wind
                        </div>

                        <p className="mt-1 text-[12px] font-black text-slate-800">
                            {weather.current.wind_speed_kph} km/h
                        </p>
                    </div>
                </div>

                <div className="mt-3 rounded-xl bg-[#ECF7EA] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.09em] text-[#4B7C5A]">
                        Farming alert
                    </p>

                    <p className="mt-1 line-clamp-3 text-[11px] font-medium leading-5 text-[#294B35]">
                        {weather.agro_alert}
                    </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[9px] text-slate-400">
                        {formatLastUpdated(
                            lastUpdated
                        )}
                    </span>

                    <span className="text-[10px] font-black text-[#173C2E]">
                        View 7-day forecast →
                    </span>
                </div>
            </Link>

            {error && weather ? (
                <div className="border-t border-amber-100 bg-amber-50 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] text-amber-800">
                            {error}
                        </p>

                        {onRefresh ? (
                            <button
                                type="button"
                                onClick={onRefresh}
                                className="shrink-0 text-[10px] font-black text-amber-900 underline"
                            >
                                Retry
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </section>
    );
}