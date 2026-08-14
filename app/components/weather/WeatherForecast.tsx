"use client";

import React from "react";
import { motion } from "framer-motion";
import {
    Droplets,
    Leaf,
    Sunrise,
    Sunset,
    Wind,
} from "lucide-react";

import WeatherIcon from "@/app/components/weather/WeatherIcon";

import type {
    WeatherForecastDay,
    WeatherResponse,
} from "@/app/types/weather";

interface WeatherForecastProps {
    weather: WeatherResponse;
}

function formatFullDate(date: string): string {
    return new Intl.DateTimeFormat("en-KE", {
        weekday: "long",
        month: "short",
        day: "numeric",
    }).format(new Date(`${date}T12:00:00`));
}

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

function guidanceTone(label: string) {
    const value = label.toLowerCase();

    if (
        value.includes("rain") ||
        value.includes("shower")
    ) {
        return "bg-[#EAF3FF] text-[#1762A8]";
    }

    if (
        value.includes("good") ||
        value.includes("fieldwork")
    ) {
        return "bg-[#EAF6E7] text-[#3B6F1C]";
    }

    return "bg-[#FFF4E3] text-[#9A5A08]";
}

function ForecastDayCard({
    forecast,
    index,
}: {
    forecast: WeatherForecastDay;
    index: number;
}) {
    return (
        <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.25,
                delay: Math.min(index * 0.035, 0.18),
                ease: "easeOut",
            }}
            className={[
                "rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6]",
                "px-4 py-4",
                "shadow-[0_8px_22px_rgba(15,23,42,0.03)]",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-[2px]",
                "hover:border-[#CBC4B7]",
                "hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]",
                index === 0 ? "bg-[#F3F7F3]" : "",
            ].join(" ")}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-[13px] font-black text-slate-800">
                        {formatFullDate(forecast.date)}
                    </h3>

                    <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                        {forecast.condition}
                    </p>
                </div>

                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF3F7]">
                    <WeatherIcon
                        weatherCode={forecast.weather_code}
                        className="text-[25px]"
                    />
                </span>
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
                <p className="text-[24px] font-black leading-none text-slate-900">
                    {forecast.high}°
                    <span className="ml-1 text-[14px] font-semibold text-slate-400">
                        / {forecast.low}°
                    </span>
                </p>

                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1762A8]">
                    <Droplets size={12} />
                    {forecast.rain_chance}%
                </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-slate-400">
                <span className="inline-flex items-center gap-1">
                    <Droplets size={11} />
                    {forecast.precipitation_mm} mm
                </span>

                <span className="inline-flex items-center gap-1">
                    <Sunrise size={11} />
                    {formatTime(forecast.sunrise)}
                </span>

                <span className="inline-flex items-center gap-1">
                    <Sunset size={11} />
                    {formatTime(forecast.sunset)}
                </span>
            </div>

            <div
                className={[
                    "mt-3 inline-flex rounded-full px-3 py-1",
                    "text-[10px] font-black",
                    guidanceTone(forecast.label),
                ].join(" ")}
            >
                {forecast.label}
            </div>
        </motion.article>
    );
}

export default function WeatherForecast({
    weather,
}: WeatherForecastProps) {
    return (
        <div className="space-y-4">
            <motion.section
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.28,
                    ease: "easeOut",
                }}
                className={[
                    "rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6]",
                    "px-5 py-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]",
                ].join(" ")}
            >
                <p className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">
                    Current conditions
                </p>

                <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="truncate text-[16px] font-black text-slate-900">
                            {weather.location}
                        </h2>

                        <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                            {weather.current.condition}
                        </p>

                        <p className="mt-2 text-[44px] font-black leading-none tracking-[-0.05em] text-[#173C2E]">
                            {weather.current.temp_c}°C
                        </p>

                        <p className="mt-1 text-[11px] font-medium text-slate-400">
                            Feels like{" "}
                            {weather.current.apparent_temp_c}°C
                        </p>
                    </div>

                    <div className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-full bg-[#EAF2FB]">
                        <WeatherIcon
                            weatherCode={weather.current.weather_code}
                            isDay={weather.current.is_day}
                            className="text-[52px]"
                        />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                        {
                            label: "Rain",
                            value: `${weather.current.rain_chance}%`,
                            icon: <Droplets size={14} />,
                        },
                        {
                            label: "Humidity",
                            value: `${weather.current.humidity}%`,
                            icon: <Droplets size={14} />,
                        },
                        {
                            label: "Wind",
                            value: `${weather.current.wind_speed_kph} km/h`,
                            icon: <Wind size={14} />,
                        },
                    ].map((metric) => (
                        <div
                            key={metric.label}
                            className="rounded-[14px] bg-[#F2F0EB] px-3 py-3 text-center"
                        >
                            <div className="mx-auto flex items-center justify-center gap-1 text-[9px] font-semibold text-slate-400">
                                {metric.icon}
                                {metric.label}
                            </div>

                            <div className="mt-1 text-[15px] font-black text-slate-800">
                                {metric.value}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.section>

            {weather.agro_alerts?.length ? (
                <motion.section
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                        duration: 0.28,
                        delay: 0.04,
                        ease: "easeOut",
                    }}
                    className="rounded-[20px] border border-[#A8D870] bg-[#ECF7EA] px-5 py-4"
                >
                    <div className="flex items-center gap-2 text-[#173C2E]">
                        <Leaf size={17} />
                        <h2 className="text-[13px] font-black">
                            Agro-weather guidance
                        </h2>
                    </div>

                    <div className="mt-3 space-y-2.5">
                        {weather.agro_alerts.map(
                            (alert, index) => (
                                <div
                                    key={`${alert}-${index}`}
                                    className="flex gap-2.5 text-[12px] font-medium leading-5 text-[#294B35]"
                                >
                                    <span className="mt-0.5 shrink-0 text-[#4D8B27]">
                                        <Leaf size={14} />
                                    </span>

                                    <p>{alert}</p>
                                </div>
                            )
                        )}
                    </div>
                </motion.section>
            ) : weather.agro_alert ? (
                <section className="rounded-[20px] border border-[#A8D870] bg-[#ECF7EA] px-5 py-4">
                    <div className="flex gap-2.5 text-[12px] font-medium leading-5 text-[#294B35]">
                        <Leaf
                            size={15}
                            className="mt-0.5 shrink-0"
                        />
                        <p>{weather.agro_alert}</p>
                    </div>
                </section>
            ) : null}

            <section>
                <div className="mb-3 flex flex-wrap items-end gap-x-4 gap-y-1">
                    <h2 className="text-[17px] font-black text-slate-900">
                        7-day forecast
                    </h2>

                    <p className="pb-0.5 text-[11px] font-medium text-slate-400">
                        Plan planting, spraying, harvesting and other farm activities.
                    </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {weather.forecast.map(
                        (forecast, index) => (
                            <ForecastDayCard
                                key={forecast.date}
                                forecast={forecast}
                                index={index}
                            />
                        )
                    )}
                </div>
            </section>
        </div>
    );
}