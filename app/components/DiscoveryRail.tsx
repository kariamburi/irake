"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IoCloudOutline,
  IoShieldCheckmarkOutline,
  IoCartOutline,
  IoLeafOutline,
  IoTrendingUpOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useWeather } from "@/app/hooks/useWeather";
import { useWeatherLocation } from "@/app/hooks/useWeatherLocation";
import { useTrendingTags } from "@/app/hooks/useTrendingTags";
import type { Deed } from "@/app/deeds/data/deedsFeedWeb";
import {
  buildDeedAiPrompt,
  getDeedAiSuggestions,
} from "@/app/deeds/utils/deedContextActions";

type Props = {
  activeDeed?: Deed | null;
};

type RailListing = {
  id: string;
  title: string;
  category: string;
  price: number | null;
  currency: string;
};

type RailExpert = {
  uid: string;
  displayName: string;
  headline: string;
  photoURL: string;
  handle: string;
  rating: number;
  distanceKm: number | null;
  locationLabel: string;
};

function RailCard({
  title,
  icon,
  children,
  className = "",
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "group rounded-[16px] border border-white/10",
        "bg-[#111713] px-3.5 py-3",
        "shadow-[0_10px_24px_rgba(0,0,0,0.16)]",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-[2px] hover:border-white/15",
        "hover:shadow-[0_16px_34px_rgba(0,0,0,0.24)]",
        className,
      ].join(" ")}
    >
      <div className="mb-2.5 flex items-center gap-2 text-emerald-400">
        <span className="shrink-0 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-rotate-3">
          {icon}
        </span>
        <h2 className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-white/55">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const n = num(value);
    if (n !== null) return n;
  }
  return null;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatKes(value: number | null, currency = "KES") {
  if (value === null) return "Ask price";

  const amount = new Intl.NumberFormat("en-KE", {
    maximumFractionDigits: 0,
  }).format(value);

  return currency.toUpperCase() === "KES"
    ? `KSh ${amount}`
    : `${currency.toUpperCase()} ${amount}`;
}

function compactCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Live";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function weatherLabel(code: number | null) {
  if (code === 0) return "Clear sky";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code !== null && [51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if (code !== null && [61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if (code !== null && [95, 96, 99].includes(code)) return "Thunderstorm";
  return "Current conditions";
}

function weatherEmoji(code: number | null, condition: string) {
  const c = condition.toLowerCase();
  if (c.includes("thunder") || (code !== null && [95, 96, 99].includes(code))) return "⛈️";
  if (c.includes("rain") || c.includes("drizzle")) return "🌧️";
  if (c.includes("cloud")) return "⛅";
  if (c.includes("fog")) return "🌫️";
  return "☀️";
}

function weatherView(weather: any) {
  const current =
    weather?.current ??
    weather?.currentWeather ??
    weather?.now ??
    {};

  const forecast = Array.isArray(weather?.forecast)
    ? weather.forecast[0]
    : {};

  const daily = Array.isArray(weather?.daily)
    ? weather.daily[0]
    : weather?.daily ?? {};

  const temperature = firstNumber(
    current?.temp_c,
    current?.temperature,
    current?.temperatureC,
    current?.temperature2m,
    current?.temperature_2m,
    current?.temp,
    weather?.temp_c,
    forecast?.temp_c,
    forecast?.high
  );

  const humidity = firstNumber(
    current?.humidity,
    current?.relative_humidity,
    current?.relativeHumidity,
    current?.relativeHumidity2m,
    current?.relative_humidity_2m,
    weather?.humidity
  );

  const wind = firstNumber(
    current?.wind_kph,
    current?.wind_speed_kmh,
    current?.windSpeed,
    current?.windSpeed10m,
    current?.wind_speed_10m,
    current?.windspeed,
    weather?.wind_kph,
    weather?.windSpeed
  );

  const rain = firstNumber(
    current?.rain_chance,
    current?.precipitation_probability,
    current?.precipitationProbability,
    current?.rainProbability,
    forecast?.rain_chance,
    forecast?.precipitation_probability,
    daily?.precipitationProbabilityMax,
    daily?.precipitation_probability_max,
    weather?.rain_chance
  );

  const code = firstNumber(
    current?.weather_code,
    current?.weatherCode,
    current?.code,
    forecast?.weather_code,
    forecast?.weatherCode,
    daily?.weatherCode,
    daily?.weather_code
  );

  const condition =
    text(
      current?.condition ??
      current?.description ??
      current?.weatherDescription ??
      current?.weather ??
      forecast?.condition
    ) || weatherLabel(code);

  return {
    temperature,
    humidity,
    wind,
    rain,
    condition,
    emoji: weatherEmoji(code, condition),
  };
}

function expertLocationStrings(data: any): string[] {
  const p = data?.primaryLocation ?? {};
  const serviceAreas = Array.isArray(data?.serviceCoverage?.serviceAreas)
    ? data.serviceCoverage.serviceAreas
    : [];

  return [
    p?.label,
    p?.locality,
    p?.city,
    p?.region,
    p?.country,
    p?.town,
    p?.county,
    ...(Array.isArray(data?.countiesServed) ? data.countiesServed : []),
    ...serviceAreas.flatMap((area: any) => [
      area?.label,
      area?.city,
      area?.region,
      area?.country,
      area?.county,
    ]),
  ]
    .map(text)
    .filter(Boolean);
}

function expertCoordinates(data: any) {
  const p = data?.primaryLocation ?? {};
  const latitude = firstNumber(p?.coordinates?.latitude, p?.latitude);
  const longitude = firstNumber(p?.coordinates?.longitude, p?.longitude);

  return latitude !== null && longitude !== null
    ? { latitude, longitude }
    : null;
}

function expertScore(data: any) {
  const rating = firstNumber(data?.rating?.average, data?.ratingAverage) ?? 0;
  const ratingCount = firstNumber(data?.rating?.count, data?.ratingCount) ?? 0;
  const consultations = firstNumber(data?.completedConsultations) ?? 0;

  return (
    (data?.acceptingBookings !== false ? 1000 : 0) +
    (data?.verified === true || data?.verificationStatus === "approved" ? 500 : 0) +
    rating * 100 +
    Math.min(ratingCount, 100) * 5 +
    Math.min(consultations, 200)
  );
}

function trendingCount(tag: string, meta: any): number {
  const clean = tag.replace(/^#/, "");
  const candidates = [meta?.[tag], meta?.[clean], meta?.[`#${clean}`]];

  for (const candidate of candidates) {
    if (typeof candidate === "number") return candidate;

    if (candidate && typeof candidate === "object") {
      const n = firstNumber(
        candidate?.uses,
        candidate?.count,
        candidate?.score,
        candidate?.total
      );
      if (n !== null) return n;
    }
  }

  return 0;
}


export default function DiscoveryRail({ activeDeed }: Props) {
  const router = useRouter();

  const caption = (activeDeed?.text || "this deed").trim();

  const aiSuggestions = useMemo(
    () => getDeedAiSuggestions(activeDeed),
    [activeDeed]
  );

  const buildAiPrompt = (label: string) =>
    buildDeedAiPrompt(activeDeed, label);

  /* WEATHER */
  const {
    location,
    initialized: locationInitialized,
  } = useWeatherLocation();

  const {
    weather,
    loading: weatherLoading,
  } = useWeather(
    location
      ? {
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: location.locationName,
      }
      : null
  );

  const farmWeather = useMemo(() => weatherView(weather as any), [weather]);

  /* EXPERT */
  const [nearbyExpert, setNearbyExpert] = useState<RailExpert | null>(null);
  const [expertLoading, setExpertLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "publicExperts"),
      orderBy("updatedAt", "desc"),
      limit(100)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const viewerLat = num(location?.latitude);
        const viewerLng = num(location?.longitude);
        const locationText = text(location?.locationName).toLowerCase();

        const candidates = snapshot.docs
          .map((snap) => {
            const data = snap.data() as any;
            const coords = expertCoordinates(data);

            const distance =
              viewerLat !== null && viewerLng !== null && coords
                ? distanceKm(
                  viewerLat,
                  viewerLng,
                  coords.latitude,
                  coords.longitude
                )
                : null;

            const locationValues = expertLocationStrings(data);
            const locationMatch =
              !!locationText &&
              locationValues.some((value) => {
                const v = value.toLowerCase();
                return v.includes(locationText) || locationText.includes(v);
              });

            const p = data?.primaryLocation ?? {};

            return {
              uid: text(data?.uid || snap.id),
              displayName:
                text(data?.displayName) ||
                [data?.firstName, data?.surname].map(text).filter(Boolean).join(" ") ||
                "ekari Expert",
              headline:
                text(data?.headline) ||
                text(Array.isArray(data?.specialties) ? data.specialties[0] : "") ||
                "Agricultural expert",
              photoURL: text(data?.photoURL),
              handle: text(data?.handle),
              rating: firstNumber(data?.rating?.average, data?.ratingAverage) ?? 0,
              distanceKm: distance,
              locationLabel:
                text(p?.label) ||
                [p?.city ?? p?.town, p?.region ?? p?.county]
                  .map(text)
                  .filter(Boolean)
                  .join(", "),
              locationMatch,
              score: expertScore(data),
              accepting: data?.acceptingBookings !== false,
            };
          })
          .filter((x) => x.uid && x.accepting)
          .sort((a, b) => {
            if (a.locationMatch !== b.locationMatch) return a.locationMatch ? -1 : 1;

            if (a.distanceKm !== null && b.distanceKm !== null) {
              const diff = a.distanceKm - b.distanceKm;
              if (diff !== 0) return diff;
            }

            if (a.distanceKm !== null && b.distanceKm === null) return -1;
            if (a.distanceKm === null && b.distanceKm !== null) return 1;

            return b.score - a.score;
          });

        setNearbyExpert(candidates[0] ?? null);
        setExpertLoading(false);
      },
      (error) => {
        console.error("DISCOVERY_RAIL_EXPERTS_FAILED", error);
        setNearbyExpert(null);
        setExpertLoading(false);
      }
    );
  }, [location?.latitude, location?.longitude, location?.locationName]);

  /* FRESH LISTINGS */
  const [listings, setListings] = useState<RailListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const mapListing = (snap: any): RailListing => {
      const data = snap.data() as any;

      return {
        id: snap.id,
        title:
          text(data?.name) ||
          text(data?.title) ||
          "Market listing",
        category:
          text(data?.category) ||
          text(data?.type) ||
          "Listing",
        price: num(data?.price),
        currency: text(data?.currency) || "KES",
      };
    };

    const activeQuery = query(
      collection(db, "marketListings"),
      where("status", "==", "active"),
      orderBy("publishedAt", "desc"),
      limit(3)
    );

    const unsubscribe = onSnapshot(
      activeQuery,
      async (snapshot) => {
        if (cancelled) return;

        if (!snapshot.empty) {
          setListings(snapshot.docs.map(mapListing));
          setListingsLoading(false);
          return;
        }

        try {
          const fallbackQuery = query(
            collection(db, "marketListings"),
            orderBy("publishedAt", "desc"),
            limit(3)
          );

          const fallbackSnap = await getDocs(fallbackQuery);

          if (cancelled) return;

          setListings(fallbackSnap.docs.map(mapListing));
        } catch (error) {
          console.error(
            "DISCOVERY_RAIL_LISTINGS_FALLBACK_FAILED",
            error
          );

          if (!cancelled) {
            setListings([]);
          }
        } finally {
          if (!cancelled) {
            setListingsLoading(false);
          }
        }
      },
      async (error) => {
        console.error(
          "DISCOVERY_RAIL_ACTIVE_LISTINGS_FAILED",
          error
        );

        try {
          const fallbackQuery = query(
            collection(db, "marketListings"),
            orderBy("publishedAt", "desc"),
            limit(3)
          );

          const fallbackSnap = await getDocs(fallbackQuery);

          if (cancelled) return;

          setListings(fallbackSnap.docs.map(mapListing));
        } catch (fallbackError) {
          console.error(
            "DISCOVERY_RAIL_LISTINGS_FALLBACK_FAILED",
            fallbackError
          );

          if (!cancelled) {
            setListings([]);
          }
        } finally {
          if (!cancelled) {
            setListingsLoading(false);
          }
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  /* TRENDING */
  const {
    list: liveTrending,
    meta: liveTrendingMeta,
  } = useTrendingTags();

  const tags = useMemo(() => {
    const seen = new Set<string>();

    return (liveTrending ?? [])
      .map((raw: any) => {
        const rawTag =
          typeof raw === "string"
            ? raw
            : text(raw?.tag ?? raw?.name ?? raw?.label);

        const clean = rawTag.replace(/^#/, "").trim();
        if (!clean) return null;

        const key = clean.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);

        const count =
          typeof raw === "object"
            ? firstNumber(raw?.uses, raw?.count, raw?.score) ?? 0
            : trendingCount(rawTag, liveTrendingMeta as any);

        return {
          tag: `#${clean}`,
          count,
        };
      })
      .filter(Boolean)
      .slice(0, 4) as Array<{ tag: string; count: number }>;
  }, [liveTrending, liveTrendingMeta]);

  return (
    <aside className="hidden h-[100svh] w-[300px] shrink-0 border-l border-white/10 bg-[#0D1510] xl:block 2xl:w-[320px]">
      <div className="h-full overflow-y-auto px-2.5 py-2.5 no-scrollbar">
        <div className="space-y-2.5">
          <RailCard title="Farm weather" icon={<IoCloudOutline size={15} />}>
            {!locationInitialized || weatherLoading ? (
              <div className="py-2">
                <div className="h-8 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-2 h-3 w-36 animate-pulse rounded bg-white/5" />
              </div>
            ) : !location ? (
              <button
                type="button"
                onClick={() => router.push("/weather")}
                className="w-full text-left text-[10px] font-semibold text-white/50"
              >
                Set your farm location to see local weather.
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/weather")}
                className="group/weather block w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-[28px] leading-none transition-transform duration-300 ease-out group-hover/weather:-translate-y-0.5 group-hover/weather:scale-110">
                    {farmWeather.emoji}
                  </span>
                  <span className="text-[32px] font-black leading-none text-white">
                    {farmWeather.temperature !== null
                      ? `${Math.round(farmWeather.temperature)}°C`
                      : "--°C"}
                  </span>
                </div>

                <p className="mt-2 truncate text-[11px] font-semibold text-white/50">
                  {location.locationName || "Your farm"} · {farmWeather.condition}
                </p>

                <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px] font-semibold text-white/35">
                  <span>
                    Rain {farmWeather.rain !== null ? `${Math.round(farmWeather.rain)}%` : "--"}
                  </span>
                  <span>
                    Humidity{" "}
                    {farmWeather.humidity !== null
                      ? `${Math.round(farmWeather.humidity)}%`
                      : "--"}
                  </span>
                  <span>
                    {farmWeather.wind !== null
                      ? `${farmWeather.wind.toFixed(1)} km/h`
                      : "-- km/h"}
                  </span>
                </div>
              </button>
            )}
          </RailCard>

          <RailCard
            title="Nearby experts"
            icon={<IoShieldCheckmarkOutline size={15} />}
          >
            {expertLoading ? (
              <div className="h-12 animate-pulse rounded-xl bg-white/5" />
            ) : nearbyExpert ? (
              <button
                type="button"
                onClick={() => {
                  if (nearbyExpert.handle) {
                    const handle = nearbyExpert.handle.startsWith("@")
                      ? nearbyExpert.handle
                      : `@${nearbyExpert.handle}`;

                    router.push(`/${handle}`);
                  } else {
                    router.push("/ekari-experts");
                  }
                }}
                className="group/expert flex w-full items-center gap-2.5 text-left transition-transform duration-300 ease-out hover:translate-x-0.5"
              >
                {nearbyExpert.photoURL ? (
                  <img
                    src={nearbyExpert.photoURL}
                    alt={nearbyExpert.displayName}
                    className="h-9 w-9 shrink-0 rounded-[10px] object-cover transition-transform duration-300 ease-out group-hover/expert:scale-105"
                  />
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-emerald-500/15 text-emerald-400 transition-all duration-300 ease-out group-hover/expert:scale-105 group-hover/expert:bg-emerald-500/20">
                    <IoShieldCheckmarkOutline size={20} />
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-white">
                    {nearbyExpert.displayName}
                  </span>
                  <span className="block truncate text-[10px] text-white/40">
                    {nearbyExpert.headline}
                    {nearbyExpert.rating > 0
                      ? ` · ★${nearbyExpert.rating.toFixed(1)}`
                      : ""}
                  </span>
                  <span className="block truncate text-[8px] text-white/30">
                    {nearbyExpert.distanceKm !== null
                      ? `${nearbyExpert.distanceKm.toFixed(
                        nearbyExpert.distanceKm < 10 ? 1 : 0
                      )} km away`
                      : nearbyExpert.locationLabel}
                  </span>
                </span>

                <span className="shrink-0 text-[11px] font-black text-[#F3A526] transition-transform duration-300 ease-out group-hover/expert:translate-x-0.5">
                  Book
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/ekari-experts")}
                className="text-[10px] font-semibold text-white/45"
              >
                Browse available ekariExperts
              </button>
            )}
          </RailCard>

          <RailCard title="Fresh listings" icon={<IoCartOutline size={15} />}>
            {listingsLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : listings.length ? (
              <div className="divide-y divide-white/10">
                {listings.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      router.push(`/market?search=${encodeURIComponent(item.title)}`)
                    }
                    className="group/listing flex w-full items-center gap-2.5 py-2 text-left transition-all duration-250 ease-out first:pt-0 last:pb-0 hover:translate-x-1 hover:bg-white/[0.02]"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#F3A526]/15 text-[#F3A526] transition-all duration-300 ease-out group-hover/listing:scale-110 group-hover/listing:bg-[#F3A526]/20">
                      <IoLeafOutline size={17} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-bold leading-4 text-white">
                        {item.title}
                      </span>
                      <span className="block truncate text-[9px] leading-4 text-white/35">
                        {item.category}
                      </span>
                    </span>

                    <span className="shrink-0 whitespace-nowrap text-[10px] font-black text-[#F3A526] transition-transform duration-300 ease-out group-hover/listing:translate-x-0.5">
                      {formatKes(item.price, item.currency)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/market")}
                className="text-[10px] font-semibold text-white/45"
              >
                No fresh listings right now.
              </button>
            )}
          </RailCard>

          <RailCard title="Trending tags" icon={<IoTrendingUpOutline size={15} />}>
            {tags.length ? (
              <div className="space-y-1.5">
                {tags.map((item, index) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() =>
                      router.push(`/search?q=${encodeURIComponent(item.tag)}`)
                    }
                    className="group/tag flex w-full items-center gap-2 text-left transition-transform duration-250 ease-out hover:translate-x-1"
                  >
                    <span className="w-3 shrink-0 text-[10px] font-black text-[#F3A526] transition-transform duration-300 ease-out group-hover/tag:scale-110">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-white/70 transition-colors duration-300 group-hover/tag:text-white">
                      {item.tag}
                    </span>
                    <span className="shrink-0 text-[9px] text-white/30">
                      {compactCount(item.count)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] font-semibold text-white/40">
                Trending tags are loading...
              </p>
            )}
          </RailCard>

          <RailCard
            title="ekari AI"
            icon={
              <span className="relative inline-flex">
                <span className="absolute inset-0 rounded-full bg-violet-400/20 blur-[4px] animate-pulse" />
                <IoSparklesOutline size={15} className="relative z-10" />
              </span>
            }
            className="border-violet-500/30 bg-[#231535] hover:border-violet-400/45 hover:shadow-[0_16px_34px_rgba(91,33,182,0.18)]"
          >
            <p className="line-clamp-2 text-[10px] font-semibold leading-4 text-white/80">
              Ask about{" "}
              {caption.length > 42 ? "this deed or your farm" : caption}
            </p>

            <div className="mt-2 flex flex-wrap gap-1">
              {aiSuggestions.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    router.push(
                      `/ai?prompt=${encodeURIComponent(
                        buildAiPrompt(label)
                      )}`
                    )
                  }
                  className="group/ai relative overflow-hidden rounded-full bg-white/10 px-2 py-1 text-[8px] font-bold text-white/75 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-white/15 hover:text-white active:scale-[0.97]"
                >
                  {label}
                </button>
              ))}
            </div>
          </RailCard>
        </div>
      </div>
    </aside>
  );
}