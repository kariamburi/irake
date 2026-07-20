import type {
    WeatherForecastDay,
    WeatherResponse,
} from "@/app/types/weather";

import {
    getWeatherCondition,
} from "./weatherCodes";

import {
    generateAgroAlerts,
    generateDailyFarmLabel,
} from "./agroAlerts";

interface OpenMeteoCurrent {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
}

interface OpenMeteoDaily {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max?: number[];
    wind_gusts_10m_max?: number[];
    uv_index_max?: number[];
    sunrise: string[];
    sunset: string[];
}

interface OpenMeteoResponse {
    latitude: number;
    longitude: number;
    timezone: string;
    current?: OpenMeteoCurrent;
    daily?: OpenMeteoDaily;
}

interface FetchWeatherOptions {
    latitude: number;
    longitude: number;
    locationName?: string;
}

function roundNumber(
    value: number | undefined
): number {
    if (
        value === undefined ||
        !Number.isFinite(value)
    ) {
        return 0;
    }

    return Math.round(value);
}

function roundDecimal(
    value: number | undefined
): number {
    if (
        value === undefined ||
        !Number.isFinite(value)
    ) {
        return 0;
    }

    return Math.round(value * 10) / 10;
}

function getShortDayName(
    date: string
): string {
    return new Intl.DateTimeFormat(
        "en-KE",
        {
            weekday: "short",
        }
    ).format(
        new Date(
            `${date}T12:00:00`
        )
    );
}

export async function fetchOpenMeteoWeather(
    options: FetchWeatherOptions
): Promise<WeatherResponse> {
    const {
        latitude,
        longitude,
        locationName,
    } = options;

    const queryParameters =
        new URLSearchParams({
            latitude:
                latitude.toString(),

            longitude:
                longitude.toString(),

            current: [
                "temperature_2m",
                "apparent_temperature",
                "relative_humidity_2m",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "is_day",
            ].join(","),

            daily: [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
                "uv_index_max",
                "sunrise",
                "sunset",
            ].join(","),

            timezone: "auto",

            forecast_days: "7",
        });

    const weatherUrl =
        `https://api.open-meteo.com/v1/forecast?${queryParameters.toString()}`;

    const response =
        await fetch(
            weatherUrl,
            {
                method: "GET",

                headers: {
                    Accept:
                        "application/json",
                },

                /*
                 * weatherCache.ts controls the
                 * one-hour server cache.
                 */
                cache: "no-store",
            }
        );

    if (!response.ok) {
        throw new Error(
            `Weather provider returned status ${response.status}`
        );
    }

    const rawWeather =
        (await response.json()) as OpenMeteoResponse;

    if (
        !rawWeather.current ||
        !rawWeather.daily
    ) {
        throw new Error(
            "Weather provider returned incomplete information"
        );
    }

    const daily =
        rawWeather.daily;

    const forecast:
        WeatherForecastDay[] =
        daily.time.map(
            (
                date,
                index
            ) => {
                const weatherCode =
                    daily.weather_code[
                    index
                    ] ?? 0;

                const high =
                    roundNumber(
                        daily
                            .temperature_2m_max[
                        index
                        ]
                    );

                const low =
                    roundNumber(
                        daily
                            .temperature_2m_min[
                        index
                        ]
                    );

                const rainChance =
                    roundNumber(
                        daily
                            .precipitation_probability_max[
                        index
                        ]
                    );

                const precipitationMm =
                    roundDecimal(
                        daily
                            .precipitation_sum[
                        index
                        ]
                    );

                const windSpeedKph =
                    roundDecimal(
                        daily
                            .wind_speed_10m_max?.[
                        index
                        ]
                    );

                const windGustKph =
                    roundDecimal(
                        daily
                            .wind_gusts_10m_max?.[
                        index
                        ]
                    );

                const uvIndex =
                    roundDecimal(
                        daily
                            .uv_index_max?.[
                        index
                        ]
                    );

                return {
                    date,

                    day:
                        getShortDayName(
                            date
                        ),

                    high,

                    low,

                    rain_chance:
                        rainChance,

                    precipitation_mm:
                        precipitationMm,

                    weather_code:
                        weatherCode,

                    condition:
                        getWeatherCondition(
                            weatherCode
                        ).label,

                    label:
                        generateDailyFarmLabel(
                            rainChance,
                            high,
                            low,
                            weatherCode,
                            precipitationMm
                        ),

                    wind_speed_kph:
                        windSpeedKph,

                    wind_gust_kph:
                        windGustKph,

                    uv_index:
                        uvIndex,

                    sunrise:
                        daily.sunrise[
                        index
                        ],

                    sunset:
                        daily.sunset[
                        index
                        ],
                };
            }
        );

    const currentWeather =
        rawWeather.current;

    const currentWeatherCode =
        currentWeather.weather_code ??
        0;

    const agroInformation =
        generateAgroAlerts(
            forecast
        );

    const fetchedAt =
        new Date();

    const cacheExpiresAt =
        new Date(
            fetchedAt.getTime() +
            60 * 60 * 1000
        );

    return {
        location:
            locationName ||
            "Your farm location",

        coordinates: {
            latitude:
                rawWeather.latitude,

            longitude:
                rawWeather.longitude,
        },

        current: {
            temp_c:
                roundNumber(
                    currentWeather
                        .temperature_2m
                ),

            apparent_temp_c:
                roundNumber(
                    currentWeather
                        .apparent_temperature
                ),

            condition:
                getWeatherCondition(
                    currentWeatherCode
                ).label,

            weather_code:
                currentWeatherCode,

            rain_chance:
                forecast[0]
                    ?.rain_chance ??
                0,

            humidity:
                roundNumber(
                    currentWeather
                        .relative_humidity_2m
                ),

            wind_speed_kph:
                roundDecimal(
                    currentWeather
                        .wind_speed_10m
                ),

            is_day:
                currentWeather.is_day ===
                1,
        },

        forecast,

        agro_alert:
            agroInformation.primary,

        agro_alerts:
            agroInformation.alerts,

        weather_alerts:
            agroInformation
                .detailedAlerts,

        fetched_at:
            fetchedAt.toISOString(),

        cache_expires_at:
            cacheExpiresAt.toISOString(),

        cached: false,
    };
}