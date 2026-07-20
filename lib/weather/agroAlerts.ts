import type {
    WeatherAlert,
    WeatherAlertCategory,
    WeatherAlertSeverity,
    WeatherForecastDay,
} from "@/app/types/weather";

import {
    isRainCode,
    isStormCode,
} from "./weatherCodes";

export interface AgroAlertResult {
    /*
     * Main alert displayed prominently.
     */
    primary: string;

    /*
     * Existing string alerts kept for compatibility.
     */
    alerts: string[];

    /*
     * New structured alerts for cards, badges and
     * severity-based styling.
     */
    detailedAlerts: WeatherAlert[];
}

function getFriendlyDay(
    forecast: WeatherForecastDay,
    index: number
): string {
    if (index === 0) {
        return "today";
    }

    if (index === 1) {
        return "tomorrow";
    }

    const date = new Date(
        `${forecast.date}T12:00:00`
    );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return (
            forecast.day?.toLowerCase() ||
            `day ${index + 1}`
        );
    }

    return new Intl.DateTimeFormat(
        "en-KE",
        {
            weekday: "long",
        }
    )
        .format(date)
        .toLowerCase();
}

function capitalizeFirst(
    value: string
): string {
    if (!value) {
        return value;
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}

function createAlertId(
    category: WeatherAlertCategory,
    forecast: WeatherForecastDay,
    index: number
): string {
    return [
        category,
        forecast.date,
        index,
    ].join("-");
}

function createAlert({
    forecast,
    index,
    severity,
    category,
    title,
    message,
    advice,
}: {
    forecast: WeatherForecastDay;
    index: number;
    severity: WeatherAlertSeverity;
    category: WeatherAlertCategory;
    title: string;
    message: string;
    advice: string;
}): WeatherAlert {
    const friendlyDay =
        getFriendlyDay(
            forecast,
            index
        );

    return {
        id: createAlertId(
            category,
            forecast,
            index
        ),

        severity,

        category,

        title,

        message,

        advice,

        date: forecast.date,

        day:
            capitalizeFirst(
                friendlyDay
            ),

        day_index: index,
    };
}

function getSeverityPriority(
    severity: WeatherAlertSeverity
): number {
    switch (severity) {
        case "danger":
            return 4;

        case "warning":
            return 3;

        case "advisory":
            return 2;

        case "info":
        default:
            return 1;
    }
}

function removeDuplicateAlerts(
    alerts: WeatherAlert[]
): WeatherAlert[] {
    const seen =
        new Set<string>();

    return alerts.filter(
        (alert) => {
            const key = [
                alert.category,
                alert.date,
                alert.message,
            ].join("|");

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);

            return true;
        }
    );
}

function alertToString(
    alert: WeatherAlert
): string {
    return `${alert.message} ${alert.advice}`;
}

export function generateDailyFarmLabel(
    rainChance: number,
    high: number,
    low: number,
    weatherCode: number,
    precipitationMm: number
): string {
    if (
        isStormCode(
            weatherCode
        )
    ) {
        return "Storm risk";
    }

    if (
        precipitationMm >= 30 ||
        rainChance >= 85
    ) {
        return "Heavy rain likely";
    }

    if (
        precipitationMm >= 15 ||
        rainChance >= 60
    ) {
        return "Rain likely";
    }

    if (low <= 5) {
        return "Frost risk";
    }

    if (low < 10) {
        return "Cold conditions";
    }

    if (
        high >= 33 &&
        rainChance <= 30
    ) {
        return "Hot and dry";
    }

    if (
        rainChance <= 20 &&
        precipitationMm < 2 &&
        high >= 18 &&
        high <= 29
    ) {
        return "Good fieldwork day";
    }

    if (
        rainChance <= 35 &&
        precipitationMm < 5 &&
        high >= 16 &&
        high <= 30
    ) {
        return "Good planting day";
    }

    if (
        isRainCode(
            weatherCode
        )
    ) {
        return "Possible showers";
    }

    return "Moderate conditions";
}

export function generateAgroAlerts(
    forecast: WeatherForecastDay[]
): AgroAlertResult {
    const detailedAlerts:
        WeatherAlert[] = [];

    /*
     * Limit important alert generation to the next
     * seven forecast days.
     */
    forecast
        .slice(0, 7)
        .forEach(
            (
                day,
                index
            ) => {
                const dayName =
                    getFriendlyDay(
                        day,
                        index
                    );

                /*
                 * Thunderstorm warning
                 */
                if (
                    isStormCode(
                        day.weather_code
                    )
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "danger",

                            category:
                                "storm",

                            title:
                                "Thunderstorm risk",

                            message:
                                `Thunderstorms may occur ${dayName}.`,

                            advice:
                                "Avoid open-field work, keep livestock under safe shelter and secure loose farm equipment.",
                        })
                    );
                }

                /*
                 * Heavy rainfall warning
                 */
                if (
                    day.precipitation_mm >=
                    25 ||
                    day.rain_chance >=
                    85
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "warning",

                            category:
                                "heavy_rain",

                            title:
                                "Heavy rainfall expected",

                            message:
                                `Heavy rainfall is expected ${dayName}.`,

                            advice:
                                "Clear drainage channels and check crop fields, livestock shelters and stored produce.",
                        })
                    );
                } else if (
                    day.rain_chance >=
                    65 ||
                    day.precipitation_mm >=
                    10
                ) {
                    /*
                     * Normal rain advisory
                     */
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "advisory",

                            category:
                                "rain",

                            title:
                                "Rain likely",

                            message:
                                `Rain is likely ${dayName}.`,

                            advice:
                                "Plan harvesting, planting and transport activities around the expected rainfall.",
                        })
                    );
                }

                /*
                 * Spraying warning
                 */
                if (
                    day.rain_chance >=
                    50 ||
                    day.precipitation_mm >=
                    5 ||
                    isRainCode(
                        day.weather_code
                    )
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "advisory",

                            category:
                                "spraying",

                            title:
                                "Delay spraying",

                            message:
                                `Spraying conditions may be unsuitable ${dayName}.`,

                            advice:
                                "Delay pesticide, herbicide and foliar fertilizer application until a drier period.",
                        })
                    );
                }

                /*
                 * Possible frost risk
                 */
                if (
                    day.low <= 5
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "warning",

                            category:
                                "frost",

                            title:
                                "Possible frost risk",

                            message:
                                `Very low temperatures are expected ${dayName}.`,

                            advice:
                                "Protect seedlings and sensitive crops, and provide warm shelter for young livestock.",
                        })
                    );
                } else if (
                    day.low < 10
                ) {
                    /*
                     * Cold weather advisory
                     */
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "advisory",

                            category:
                                "cold",

                            title:
                                "Cold conditions",

                            message:
                                `Low temperatures are expected ${dayName}.`,

                            advice:
                                "Protect sensitive crops and monitor young or vulnerable livestock.",
                        })
                    );
                }

                /*
                 * Heat warning
                 */
                if (
                    day.high >= 35
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "warning",

                            category:
                                "heat",

                            title:
                                "High heat risk",

                            message:
                                `Very hot conditions are expected ${dayName}.`,

                            advice:
                                "Provide livestock with shade and water, and irrigate crops early in the morning or late in the evening.",
                        })
                    );
                } else if (
                    day.high >= 33 &&
                    day.rain_chance <=
                    30
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "advisory",

                            category:
                                "dry",

                            title:
                                "Hot and dry conditions",

                            message:
                                `Hot and dry weather is expected ${dayName}.`,

                            advice:
                                "Check soil moisture and irrigate during cooler hours to reduce water loss.",
                        })
                    );
                }

                /*
                 * Optional wind warning.
                 *
                 * This only runs when wind forecast
                 * fields are returned by Open-Meteo.
                 */
                const maximumWind =
                    Math.max(
                        day.wind_speed_kph ??
                        0,

                        day.wind_gust_kph ??
                        0
                    );

                if (
                    maximumWind >= 50
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "warning",

                            category:
                                "wind",

                            title:
                                "Strong winds expected",

                            message:
                                `Strong winds may occur ${dayName}.`,

                            advice:
                                "Secure greenhouses, shade nets, roofing materials and other loose farm equipment.",
                        })
                    );
                } else if (
                    maximumWind >= 35
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "advisory",

                            category:
                                "wind",

                            title:
                                "Windy conditions",

                            message:
                                `Windy conditions are possible ${dayName}.`,

                            advice:
                                "Avoid spraying because wind may cause chemical drift and uneven application.",
                        })
                    );
                }

                /*
                 * Optional UV warning.
                 *
                 * This only runs when uv_index is
                 * returned by Open-Meteo.
                 */
                if (
                    typeof day.uv_index ===
                    "number" &&
                    day.uv_index >= 8
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "warning",

                            category:
                                "uv",

                            title:
                                "Very high UV levels",

                            message:
                                `Very high ultraviolet exposure is expected ${dayName}.`,

                            advice:
                                "Limit long periods of direct sun exposure and use protective clothing when working outdoors.",
                        })
                    );
                }

                /*
                 * Good fieldwork conditions.
                 *
                 * Only include positive recommendations
                 * for the first four days.
                 */
                if (
                    index <= 3 &&
                    day.rain_chance <=
                    20 &&
                    day.precipitation_mm <
                    2 &&
                    day.high >= 18 &&
                    day.high <= 29 &&
                    !isStormCode(
                        day.weather_code
                    )
                ) {
                    detailedAlerts.push(
                        createAlert({
                            forecast:
                                day,

                            index,

                            severity:
                                "info",

                            category:
                                "fieldwork",

                            title:
                                "Good fieldwork conditions",

                            message:
                                `${capitalizeFirst(
                                    dayName
                                )} should have favourable conditions for fieldwork.`,

                            advice:
                                "Consider planting, weeding, harvesting or spraying during the calmer parts of the day.",
                        })
                    );
                }
            }
        );

    const uniqueAlerts =
        removeDuplicateAlerts(
            detailedAlerts
        );

    /*
     * Put dangerous and urgent alerts first.
     * When severity is the same, show the nearest
     * forecast day first.
     */
    uniqueAlerts.sort(
        (
            first,
            second
        ) => {
            const severityDifference =
                getSeverityPriority(
                    second.severity
                ) -
                getSeverityPriority(
                    first.severity
                );

            if (
                severityDifference !==
                0
            ) {
                return severityDifference;
            }

            return (
                first.day_index -
                second.day_index
            );
        }
    );

    /*
     * Keep the dashboard concise.
     */
    const displayedAlerts =
        uniqueAlerts.slice(
            0,
            6
        );

    if (
        displayedAlerts.length ===
        0
    ) {
        displayedAlerts.push({
            id: "general-moderate-conditions",

            severity: "info",

            category: "general",

            title:
                "Moderate weather conditions",

            message:
                "Weather conditions are generally moderate over the coming days.",

            advice:
                "Continue checking the forecast before planting, spraying, irrigating or harvesting.",

            date:
                forecast[0]?.date ||
                new Date()
                    .toISOString()
                    .slice(0, 10),

            day: "Upcoming",

            day_index: 0,
        });
    }

    const stringAlerts =
        displayedAlerts
            .map(alertToString)
            .slice(0, 4);

    return {
        primary:
            stringAlerts[0],

        alerts:
            stringAlerts,

        detailedAlerts:
            displayedAlerts,
    };
}