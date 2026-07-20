interface WeatherIconProps {
    weatherCode: number;
    isDay?: boolean;
    className?: string;
}

function getWeatherEmoji(
    weatherCode: number,
    isDay: boolean
): string {
    if (weatherCode === 0) {
        return isDay ? "☀️" : "🌙";
    }

    if (weatherCode === 1) {
        return isDay ? "🌤️" : "🌙";
    }

    if (weatherCode === 2) {
        return "⛅";
    }

    if (weatherCode === 3) {
        return "☁️";
    }

    if (weatherCode === 45 || weatherCode === 48) {
        return "🌫️";
    }

    if (weatherCode >= 51 && weatherCode <= 57) {
        return "🌦️";
    }

    if (weatherCode >= 61 && weatherCode <= 67) {
        return "🌧️";
    }

    if (weatherCode >= 71 && weatherCode <= 77) {
        return "❄️";
    }

    if (weatherCode >= 80 && weatherCode <= 82) {
        return "🌦️";
    }

    if (weatherCode >= 85 && weatherCode <= 86) {
        return "🌨️";
    }

    if (weatherCode >= 95 && weatherCode <= 99) {
        return "⛈️";
    }

    return "☁️";
}

export default function WeatherIcon({
    weatherCode,
    isDay = true,
    className = "",
}: WeatherIconProps) {
    return (
        <span
            aria-hidden="true"
            className={className}
        >
            {getWeatherEmoji(
                weatherCode,
                isDay
            )}
        </span>
    );
}