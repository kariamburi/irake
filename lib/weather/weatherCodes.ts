export interface WeatherCondition {
    label: string;
    icon: string;
}

const conditions: Record<number, WeatherCondition> = {
    0: {
        label: "Clear sky",
        icon: "sun",
    },
    1: {
        label: "Mainly clear",
        icon: "sun",
    },
    2: {
        label: "Partly cloudy",
        icon: "cloud-sun",
    },
    3: {
        label: "Cloudy",
        icon: "cloud",
    },
    45: {
        label: "Foggy",
        icon: "fog",
    },
    48: {
        label: "Foggy",
        icon: "fog",
    },
    51: {
        label: "Light drizzle",
        icon: "drizzle",
    },
    53: {
        label: "Drizzle",
        icon: "drizzle",
    },
    55: {
        label: "Heavy drizzle",
        icon: "rain",
    },
    61: {
        label: "Light rain",
        icon: "rain",
    },
    63: {
        label: "Moderate rain",
        icon: "rain",
    },
    65: {
        label: "Heavy rain",
        icon: "heavy-rain",
    },
    80: {
        label: "Light rain showers",
        icon: "rain",
    },
    81: {
        label: "Rain showers",
        icon: "rain",
    },
    82: {
        label: "Heavy rain showers",
        icon: "heavy-rain",
    },
    95: {
        label: "Thunderstorm",
        icon: "storm",
    },
    96: {
        label: "Thunderstorm with hail",
        icon: "storm",
    },
    99: {
        label: "Severe thunderstorm",
        icon: "storm",
    },
};

export function getWeatherCondition(
    code: number
): WeatherCondition {
    return (
        conditions[code] || {
            label: "Unknown conditions",
            icon: "cloud",
        }
    );
}

export function isRainCode(code: number): boolean {
    return (
        (code >= 51 && code <= 67) ||
        (code >= 80 && code <= 82) ||
        (code >= 95 && code <= 99)
    );
}

export function isStormCode(code: number): boolean {
    return code >= 95 && code <= 99;
}