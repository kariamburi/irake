"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    Bot,
    Sun,
    Sunrise,
    Sunset,
} from "lucide-react";

import type { WeatherResponse } from "@/app/types/weather";

type Props = {
    weather: WeatherResponse | null;
};

function formatTime(value?: string): string {
    if (!value) return "—";

    try {
        return new Intl.DateTimeFormat("en-KE", {
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value));
    } catch {
        return "—";
    }
}

function shortDay(date: string, index: number) {
    if (index === 0) return "Today";
    if (index === 1) return "Tomorrow";

    try {
        return new Intl.DateTimeFormat("en-KE", {
            weekday: "long",
        }).format(new Date(`${date}T12:00:00`));
    } catch {
        return date;
    }
}

function RailCard({
    title,
    icon,
    children,
    accent = false,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    accent?: boolean;
}) {
    return (
        <section
            className={[
                "rounded-[18px] border px-4 py-4",
                accent
                    ? "border-[#F2B75F] bg-[#FFF9EE]"
                    : "border-[#DDD8CC] bg-[#FBFAF6]",
                "shadow-[0_10px_26px_rgba(15,23,42,0.035)]",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-[1px] hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]",
            ].join(" ")}
        >
            <div className="mb-3 flex items-center gap-2">
                <span className="text-[#F39A22]">{icon}</span>
                <h2 className="text-[11px] font-black uppercase tracking-[0.09em] text-slate-400">
                    {title}
                </h2>
            </div>

            {children}
        </section>
    );
}

export default function WeatherDiscoveryRail({
    weather,
}: Props) {
    const router = useRouter();

    if (!weather) {
        return (
            <aside className="h-[100svh] w-full bg-[#F8F7F2]">
                <div className="p-4 text-sm text-slate-400">
                    Weather insights will appear here after you choose a location.
                </div>
            </aside>
        );
    }

    const forecast = weather.forecast || [];
    const firstAlert =
        weather.agro_alerts?.[0] ||
        weather.agro_alert ||
        "Check field conditions before spraying or applying fertiliser.";

    const uvValue = Number(
        (weather.current as any)?.uv_index ??
        (weather.current as any)?.uv ??
        0
    );

    const uvPercent =
        uvValue > 0
            ? Math.max(5, Math.min(100, (uvValue / 11) * 100))
            : 0;

    const uvLabel =
        uvValue >= 8
            ? "Very high"
            : uvValue >= 6
                ? "High"
                : uvValue >= 3
                    ? "Moderate"
                    : uvValue > 0
                        ? "Low"
                        : "Unavailable";

    return (
        <aside className="h-[100svh] w-full bg-[#F8F7F2]">
            <div className="h-full overflow-y-auto px-3 py-4 no-scrollbar">
                <div className="space-y-3">
                    <RailCard
                        title="Farming notice"
                        icon={<AlertTriangle size={15} />}
                        accent
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-[12px] font-black text-[#9A5A08]">
                                Spraying caution
                            </div>

                            <span className="rounded-full bg-[#F7DFB5] px-2 py-0.5 text-[9px] font-black text-[#9A5A08]">
                                Notice
                            </span>
                        </div>

                        <p className="mt-1 text-[10px] font-semibold text-slate-400">
                            Today
                        </p>

                        <p className="mt-2 text-[12px] font-medium leading-5 text-slate-600">
                            {firstAlert}
                        </p>
                    </RailCard>

                    <RailCard
                        title="Sunrise · sunset"
                        icon={<Sun size={15} />}
                    >
                        <div className="divide-y divide-[#E7E2D8]">
                            {forecast.slice(0, 4).map((day, index) => (
                                <div
                                    key={day.date}
                                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                                >
                                    <span className="text-[11px] font-bold text-slate-600">
                                        {shortDay(day.date, index)}
                                    </span>

                                    <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                                        <span className="inline-flex items-center gap-1">
                                            <Sunrise
                                                size={12}
                                                className="text-[#F39A22]"
                                            />
                                            {formatTime(day.sunrise)}
                                        </span>

                                        <span>·</span>

                                        <span className="inline-flex items-center gap-1">
                                            <Sunset
                                                size={12}
                                                className="text-[#F39A22]"
                                            />
                                            {formatTime(day.sunset)}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </RailCard>

                    <RailCard
                        title="UV index today"
                        icon={<Sun size={15} />}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-medium text-slate-400">
                                UV index
                            </span>

                            <span className="text-[11px] font-black text-[#E88712]">
                                {uvValue > 0
                                    ? `${uvValue.toFixed(1)} · ${uvLabel}`
                                    : uvLabel}
                            </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEE9DF]">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-500"
                                style={{
                                    width: `${uvPercent}%`,
                                }}
                            />
                        </div>

                        <p className="mt-2 text-[11px] font-medium leading-5 text-slate-500">
                            {uvValue >= 6
                                ? "Use sunscreen and protective clothing during prolonged outdoor farm work."
                                : "Check UV conditions before long periods of outdoor farm work."}
                        </p>
                    </RailCard>

                    <RailCard
                        title="Ask ekari AI"
                        icon={<Bot size={15} />}
                    >
                        <p className="text-[12px] font-medium leading-5 text-slate-600">
                            Get personalised farming advice based on today&apos;s
                            weather and your crops.
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                const prompt =
                                    `Give me farming advice for ${weather.location}. ` +
                                    `Current weather is ${weather.current.condition}, ` +
                                    `${weather.current.temp_c}°C with ${weather.current.rain_chance}% rain chance.`;

                                router.push(
                                    `/ai?prompt=${encodeURIComponent(prompt)}`
                                );
                            }}
                            className={[
                                "mt-3 h-10 w-full rounded-xl bg-[#173C2E]",
                                "text-[12px] font-black text-white",
                                "transition-all duration-250 ease-out",
                                "hover:-translate-y-0.5 hover:bg-[#214C3A]",
                                "active:translate-y-0 active:scale-[0.98]",
                            ].join(" ")}
                        >
                            Ask about my farm
                        </button>
                    </RailCard>
                </div>
            </div>
        </aside>
    );
}