export interface WeatherCurrent {
    temp_c: number;
    apparent_temp_c: number;
    condition: string;
    weather_code: number;
    rain_chance: number;
    humidity: number;
    wind_speed_kph: number;
    is_day: boolean;
}

export interface WeatherForecastDay {
    date: string;
    day: string;
    high: number;
    low: number;
    rain_chance: number;
    precipitation_mm: number;
    weather_code: number;
    condition: string;
    label: string;
    sunrise?: string;
    sunset?: string;

    /*
     * These can be populated later when you add
     * forecast wind and UV data from Open-Meteo.
     */
    wind_speed_kph?: number;
    wind_gust_kph?: number;
    uv_index?: number;
}

export type WeatherAlertSeverity =
    | "info"
    | "advisory"
    | "warning"
    | "danger";

export type WeatherAlertCategory =
    | "storm"
    | "heavy_rain"
    | "rain"
    | "cold"
    | "frost"
    | "heat"
    | "dry"
    | "wind"
    | "uv"
    | "spraying"
    | "fieldwork"
    | "general";

export interface WeatherAlert {
    id: string;

    severity: WeatherAlertSeverity;

    category: WeatherAlertCategory;

    title: string;

    message: string;

    advice: string;

    date: string;

    day: string;

    day_index: number;
}

export interface WeatherLocationDetails {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
}

export interface WeatherResponse {
    /*
     * Keep this as a string because WeatherForecast
     * renders it directly.
     */
    location: string;

    /*
     * Readable address information added by the
     * weather API route.
     */
    locationDetails?: WeatherLocationDetails;

    coordinates: {
        latitude: number;
        longitude: number;
    };

    current: WeatherCurrent;

    forecast: WeatherForecastDay[];

    /*
     * Existing alert fields kept for compatibility.
     */
    agro_alert: string;

    agro_alerts: string[];

    /*
     * New structured alerts for the improved UI.
     */
    weather_alerts?: WeatherAlert[];

    fetched_at: string;

    cache_expires_at: string;

    cached: boolean;
}

export interface WeatherApiError {
    error: string;
    message: string;
}