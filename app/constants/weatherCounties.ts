export interface WeatherCounty {
    name: string;
    county: string;
    latitude: number;
    longitude: number;
}

export const weatherCounties: WeatherCounty[] = [
    {
        name: "Kitale",
        county: "Trans Nzoia",
        latitude: 1.0157,
        longitude: 35.0062,
    },
    {
        name: "Eldoret",
        county: "Uasin Gishu",
        latitude: 0.5143,
        longitude: 35.2698,
    },
    {
        name: "Nakuru",
        county: "Nakuru",
        latitude: -0.3031,
        longitude: 36.08,
    },
    {
        name: "Nyahururu",
        county: "Laikipia",
        latitude: 0.0421,
        longitude: 36.3673,
    },
    {
        name: "Nyeri",
        county: "Nyeri",
        latitude: -0.4197,
        longitude: 36.9476,
    },
    {
        name: "Meru",
        county: "Meru",
        latitude: 0.0463,
        longitude: 37.6559,
    },
    {
        name: "Embu",
        county: "Embu",
        latitude: -0.5388,
        longitude: 37.4596,
    },
    {
        name: "Kerugoya",
        county: "Kirinyaga",
        latitude: -0.4989,
        longitude: 37.2803,
    },
    {
        name: "Machakos",
        county: "Machakos",
        latitude: -1.5177,
        longitude: 37.2634,
    },
    {
        name: "Kisii",
        county: "Kisii",
        latitude: -0.6817,
        longitude: 34.7667,
    },
    {
        name: "Kisumu",
        county: "Kisumu",
        latitude: -0.0917,
        longitude: 34.768,
    },
    {
        name: "Kakamega",
        county: "Kakamega",
        latitude: 0.2827,
        longitude: 34.7519,
    },
    {
        name: "Bungoma",
        county: "Bungoma",
        latitude: 0.5635,
        longitude: 34.5606,
    },
    {
        name: "Kericho",
        county: "Kericho",
        latitude: -0.3689,
        longitude: 35.2863,
    },
    {
        name: "Narok",
        county: "Narok",
        latitude: -1.0833,
        longitude: 35.8667,
    },
    {
        name: "Nairobi",
        county: "Nairobi",
        latitude: -1.2864,
        longitude: 36.8172,
    },
    {
        name: "Mombasa",
        county: "Mombasa",
        latitude: -4.0435,
        longitude: 39.6682,
    },
    {
        name: "Kilifi",
        county: "Kilifi",
        latitude: -3.6305,
        longitude: 39.8499,
    },
    {
        name: "Garissa",
        county: "Garissa",
        latitude: -0.4532,
        longitude: 39.6461,
    },
    {
        name: "Isiolo",
        county: "Isiolo",
        latitude: 0.3546,
        longitude: 37.5822,
    },
];

export const defaultWeatherCounty = weatherCounties[0];