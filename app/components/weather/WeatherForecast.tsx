"use client";

import WeatherIcon from "@/app/components/weather/WeatherIcon";
import type {
    WeatherForecastDay,
    WeatherResponse,
} from "@/app/types/weather";

interface WeatherForecastProps {
    weather: WeatherResponse;
}

function formatFullDate(
    date: string
): string {
    return new Intl.DateTimeFormat(
        "en-KE",
        {
            weekday: "long",
            month: "short",
            day: "numeric",
        }
    ).format(
        new Date(`${date}T12:00:00`)
    );
}

function formatTime(
    value?: string
): string {
    if (!value) {
        return "—";
    }

    return new Intl.DateTimeFormat(
        "en-KE",
        {
            hour: "2-digit",
            minute: "2-digit",
        }
    ).format(new Date(value));
}

function ForecastDayCard({
    forecast,
}: {
    forecast: WeatherForecastDay;
}) {
    return (
        <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="font-semibold text-gray-900">
                        {formatFullDate(
                            forecast.date
                        )}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                        {forecast.condition}
                    </p>
                </div>

                <WeatherIcon
                    weatherCode={
                        forecast.weather_code
                    }
                    className="text-4xl"
                />
            </div>

            <div className="mt-4 flex items-end justify-between">
                <p className="text-2xl font-bold text-gray-900">
                    {forecast.high}°
                    <span className="ml-1 text-base font-medium text-gray-400">
                        / {forecast.low}°
                    </span>
                </p>

                <p className="text-sm font-medium text-blue-600">
                    💧{" "}
                    {forecast.rain_chance}%
                </p>
            </div>

            <div className="mt-4 rounded-xl bg-green-50 p-3">
                <p className="text-sm font-medium text-green-800">
                    {forecast.label}
                </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 px-2 py-3">
                    <p className="text-xs text-gray-500">
                        Rain
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-900">
                        {
                            forecast.precipitation_mm
                        }{" "}
                        mm
                    </p>
                </div>

                <div className="rounded-lg bg-gray-50 px-2 py-3">
                    <p className="text-xs text-gray-500">
                        Sunrise
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatTime(
                            forecast.sunrise
                        )}
                    </p>
                </div>

                <div className="rounded-lg bg-gray-50 px-2 py-3">
                    <p className="text-xs text-gray-500">
                        Sunset
                    </p>

                    <p className="mt-1 text-sm font-semibold text-gray-900">
                        {formatTime(
                            forecast.sunset
                        )}
                    </p>
                </div>
            </div>
        </article>
    );
}

export default function WeatherForecast({
    weather,
}: WeatherForecastProps) {
    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    Current conditions
                </p>

                <div className="mt-4 flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {weather.location}
                        </h1>

                        <p className="mt-1 text-gray-600">
                            {
                                weather.current
                                    .condition
                            }
                        </p>

                        <p className="mt-4 text-5xl font-bold tracking-tight text-gray-900">
                            {
                                weather.current
                                    .temp_c
                            }
                            °C
                        </p>

                        <p className="mt-2 text-sm text-gray-500">
                            Feels like{" "}
                            {
                                weather.current
                                    .apparent_temp_c
                            }
                            °C
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
                        className="text-7xl"
                    />
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                        <p className="text-xs text-gray-500">
                            Rain
                        </p>

                        <p className="mt-1 font-semibold text-gray-900">
                            {
                                weather.current
                                    .rain_chance
                            }
                            %
                        </p>
                    </div>

                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
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

                    <div className="rounded-xl bg-white p-3 text-center shadow-sm">
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
            </section>

            <section className="rounded-2xl border border-green-200 bg-green-50 p-5">
                <h2 className="font-semibold text-green-900">
                    Agro-weather guidance
                </h2>

                <div className="mt-3 space-y-3">
                    {weather.agro_alerts.map(
                        (alert, index) => (
                            <div
                                key={`${alert}-${index}`}
                                className="flex gap-3 rounded-xl bg-white p-3 text-sm leading-6 text-green-900"
                            >
                                <span aria-hidden="true">
                                    🌱
                                </span>

                                <p>{alert}</p>
                            </div>
                        )
                    )}
                </div>
            </section>

            <section>
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                        7-day forecast
                    </h2>

                    <p className="mt-1 text-sm text-gray-500">
                        Plan planting, spraying,
                        harvesting and other farm
                        activities.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {weather.forecast.map(
                        (forecast) => (
                            <ForecastDayCard
                                key={forecast.date}
                                forecast={forecast}
                            />
                        )
                    )}
                </div>
            </section>
        </div>
    );
}