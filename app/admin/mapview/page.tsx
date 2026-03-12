"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import {
    IoGlobeOutline,
    IoLocationOutline,
    IoPeopleOutline,
    IoSearchOutline,
    IoTimeOutline,
    IoFlameOutline,
    IoLayersOutline,
} from "react-icons/io5";
import SmartAvatar from "@/app/components/SmartAvatar";
import clsx from "clsx";

const EKARI = {
    forest: "#233F39",
    gold: "#C79257",
    sand: "#FFFFFF",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
    soft: "#F8FAFC",
};

type UserLocation = {
    lat: number;
    lng: number;
    place?: string;
};

type EkariMapUser = {
    uid: string;
    firstName?: string | null;
    surname?: string | null;
    email?: string | null;
    handle?: string | null;
    photoURL?: string | null;
    country?: string | null;
    county?: string | null;
    createdAt?: any;
    location?: UserLocation | null;
    roles?: string[];
    areaOfInterest?: string[];
};

type DateFilter = "all" | "today" | "7d" | "30d" | "90d";

function loadGoogleMaps(apiKey?: string): Promise<typeof google | null> {
    if (typeof window === "undefined") return Promise.resolve(null);
    if ((window as any).google?.maps) return Promise.resolve((window as any).google);

    return new Promise((resolve, reject) => {
        if (!apiKey) {
            console.warn("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — Map will not render.");
            resolve(null);
            return;
        }

        const existing = document.getElementById("gmaps-sdk");
        if (existing) {
            const check = () => {
                if ((window as any).google?.maps) resolve((window as any).google);
                else setTimeout(check, 100);
            };
            check();
            return;
        }

        const script = document.createElement("script");
        script.id = "gmaps-sdk";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker,visualization&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve((window as any).google || null);
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
    });
}

function formatDate(value: any) {
    try {
        if (value?.toDate && typeof value.toDate === "function") {
            return value.toDate().toLocaleDateString();
        }
        return "—";
    } catch {
        return "—";
    }
}

function getJoinedDate(value: any): Date | null {
    try {
        if (value?.toDate && typeof value.toDate === "function") {
            return value.toDate();
        }
        return null;
    } catch {
        return null;
    }
}

function displayName(u: EkariMapUser) {
    const full = [u.firstName, u.surname].filter(Boolean).join(" ").trim();
    return full || u.handle || u.email || "Unknown user";
}

function safeHandle(handle?: string | null) {
    if (!handle) return null;
    return handle.startsWith("@") ? handle : `@${handle}`;
}

function isValidCoord(n: unknown) {
    return typeof n === "number" && Number.isFinite(n);
}

function withinDateFilter(value: any, filter: DateFilter) {
    if (filter === "all") return true;
    const dt = getJoinedDate(value);
    if (!dt) return false;

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === "today") {
        return dt >= startToday;
    }

    const days =
        filter === "7d" ? 7 :
            filter === "30d" ? 30 :
                filter === "90d" ? 90 : 0;

    if (!days) return true;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return dt >= cutoff;
}

export default function AdminMapViewPage() {
    const { user } = useAuth();
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const [users, setUsers] = useState<EkariMapUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [selectedUid, setSelectedUid] = useState<string | null>(null);

    const [countryFilter, setCountryFilter] = useState("all");
    const [countyFilter, setCountyFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState<DateFilter>("all");
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [showMarkers, setShowMarkers] = useState(true);

    const mapDivRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const clustererRef = useRef<MarkerClusterer | null>(null);
    const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
    const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);

        const qUsers = query(collection(db, "users"), orderBy("createdAt", "desc"));

        const unsub = onSnapshot(
            qUsers,
            (snap) => {
                const list: EkariMapUser[] = snap.docs.map((docSnap) => {
                    const d = docSnap.data() as any;
                    return {
                        uid: docSnap.id,
                        firstName: d.firstName ?? null,
                        surname: d.surname ?? null,
                        email: d.email ?? null,
                        handle: d.handle ?? null,
                        photoURL: d.photoURL ?? null,
                        country: d.country ?? null,
                        county: d.county ?? null,
                        createdAt: d.createdAt ?? null,
                        location: d.location
                            ? {
                                lat: d.location.lat,
                                lng: d.location.lng,
                                place: d.location.place ?? undefined,
                            }
                            : null,
                        roles: Array.isArray(d.roles) ? d.roles : [],
                        areaOfInterest: Array.isArray(d.areaOfInterest) ? d.areaOfInterest : [],
                    };
                });

                setUsers(list);
                setLoading(false);
            },
            (err) => {
                console.error("Failed to load users for map view", err);
                setError("Failed to load users for map view.");
                setLoading(false);
            }
        );

        return () => unsub();
    }, []);

    const mappableUsers = useMemo(() => {
        return users.filter(
            (u) =>
                u.location &&
                isValidCoord(u.location.lat) &&
                isValidCoord(u.location.lng)
        );
    }, [users]);

    const countryOptions = useMemo(() => {
        return Array.from(
            new Set(mappableUsers.map((u) => (u.country || "").trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));
    }, [mappableUsers]);

    const countyOptions = useMemo(() => {
        const source =
            countryFilter === "all"
                ? mappableUsers
                : mappableUsers.filter((u) => (u.country || "").trim() === countryFilter);

        return Array.from(
            new Set(source.map((u) => (u.county || "").trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));
    }, [mappableUsers, countryFilter]);

    const filteredUsers = useMemo(() => {
        const term = search.trim().toLowerCase();

        return mappableUsers.filter((u) => {
            if (countryFilter !== "all" && (u.country || "").trim() !== countryFilter) {
                return false;
            }

            if (countyFilter !== "all" && (u.county || "").trim() !== countyFilter) {
                return false;
            }

            if (!withinDateFilter(u.createdAt, dateFilter)) {
                return false;
            }

            if (!term) return true;

            const hay = [
                u.firstName,
                u.surname,
                u.email,
                u.handle,
                u.country,
                u.county,
                u.location?.place,
                ...(u.roles || []),
                ...(u.areaOfInterest || []),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return hay.includes(term);
        });
    }, [mappableUsers, search, countryFilter, countyFilter, dateFilter]);

    const selectedUser = useMemo(() => {
        return filteredUsers.find((u) => u.uid === selectedUid) || null;
    }, [filteredUsers, selectedUid]);

    const totalCountries = useMemo(() => {
        return new Set(
            filteredUsers.map((u) => (u.country || "").trim()).filter(Boolean)
        ).size;
    }, [filteredUsers]);

    const totalCounties = useMemo(() => {
        return new Set(
            filteredUsers.map((u) => (u.county || "").trim()).filter(Boolean)
        ).size;
    }, [filteredUsers]);

    const joinedToday = useMemo(() => {
        return filteredUsers.filter((u) => withinDateFilter(u.createdAt, "today")).length;
    }, [filteredUsers]);

    useEffect(() => {
        if (countyFilter !== "all" && !countyOptions.includes(countyFilter)) {
            setCountyFilter("all");
        }
    }, [countyFilter, countyOptions]);

    useEffect(() => {
        let alive = true;

        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !mapDivRef.current) return;

            if (!mapRef.current) {
                mapRef.current = new g.maps.Map(mapDivRef.current, {
                    center: { lat: 0.0236, lng: 37.9062 },
                    zoom: 6,
                    mapTypeControl: true,
                    streetViewControl: false,
                    fullscreenControl: true,
                });
            }

            if (!infoWindowRef.current) {
                infoWindowRef.current = new g.maps.InfoWindow();
            }

            markersRef.current.forEach((m) => m.setMap(null));
            markersRef.current = [];

            if (clustererRef.current) {
                clustererRef.current.clearMarkers();
                clustererRef.current = null;
            }

            if (heatmapRef.current) {
                heatmapRef.current.setMap(null);
                heatmapRef.current = null;
            }

            if (!filteredUsers.length) return;

            const bounds = new g.maps.LatLngBounds();

            const nextMarkers: google.maps.Marker[] = filteredUsers.map((u) => {
                const marker = new g.maps.Marker({
                    position: { lat: u.location!.lat, lng: u.location!.lng },
                    title: displayName(u),
                });

                marker.addListener("click", () => {
                    setSelectedUid(u.uid);

                    const html = `
            <div style="min-width:220px;padding:8px 4px 4px 4px;font-family:Arial,sans-serif;">
              <div style="font-size:14px;font-weight:700;color:#0F172A;">
                ${displayName(u)}
              </div>
              ${u.handle
                            ? `<div style="font-size:12px;color:#6B7280;margin-top:2px;">${safeHandle(u.handle)}</div>`
                            : ""
                        }
              ${u.email
                            ? `<div style="font-size:12px;color:#6B7280;margin-top:4px;">${u.email}</div>`
                            : ""
                        }
              ${u.location?.place
                            ? `<div style="font-size:12px;color:#233F39;margin-top:6px;">${u.location.place}</div>`
                            : ""
                        }
              <div style="font-size:11px;color:#6B7280;margin-top:6px;">
                ${u.country || "—"}${u.county ? ` • ${u.county}` : ""}
              </div>
            </div>
          `;

                    infoWindowRef.current?.setContent(html);
                    infoWindowRef.current?.open({
                        anchor: marker,
                        map: mapRef.current!,
                    });
                });

                bounds.extend(new g.maps.LatLng(u.location!.lat, u.location!.lng));
                return marker;
            });

            markersRef.current = nextMarkers;

            if (showMarkers) {
                clustererRef.current = new MarkerClusterer({
                    map: mapRef.current!,
                    markers: nextMarkers,
                });
            } else {
                nextMarkers.forEach((m) => m.setMap(null));
            }

            if (showHeatmap && g.maps.visualization) {
                const points = filteredUsers.map(
                    (u) => new g.maps.LatLng(u.location!.lat, u.location!.lng)
                );

                heatmapRef.current = new g.maps.visualization.HeatmapLayer({
                    data: points,
                    map: mapRef.current!,
                    radius: 30,
                    opacity: 0.7,
                });
            }

            if (selectedUser?.location) {
                mapRef.current.setCenter({
                    lat: selectedUser.location.lat,
                    lng: selectedUser.location.lng,
                });
                mapRef.current.setZoom(11);
            } else {
                mapRef.current.fitBounds(bounds);

                google.maps.event.addListenerOnce(mapRef.current, "bounds_changed", () => {
                    if ((mapRef.current?.getZoom() || 0) > 12) {
                        mapRef.current?.setZoom(12);
                    }
                });
            }
        })();

        return () => {
            alive = false;
        };
    }, [apiKey, filteredUsers, selectedUid, selectedUser, showHeatmap, showMarkers]);

    const centerOnUser = async (u: EkariMapUser) => {
        setSelectedUid(u.uid);

        const g = await loadGoogleMaps(apiKey);
        if (!g || !mapRef.current || !u.location) return;

        mapRef.current.panTo({
            lat: u.location.lat,
            lng: u.location.lng,
        });
        mapRef.current.setZoom(11);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1
                        className="text-xl font-extrabold md:text-2xl"
                        style={{ color: EKARI.text }}
                    >
                        User map view
                    </h1>
                    <p className="text-sm" style={{ color: EKARI.dim }}>
                        Monitor where users are joining from across regions and countries.
                    </p>
                </div>

                {user && (
                    <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2">
                        <div className="relative h-9 w-9 overflow-hidden rounded-full bg-gray-200">
                            <Image
                                src={user.photoURL || "/avatar-placeholder.png"}
                                alt={user.displayName || "Admin"}
                                fill
                                sizes="36px"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span
                                className="max-w-[220px] truncate text-sm font-semibold"
                                style={{ color: EKARI.text }}
                            >
                                {user.displayName || user.email || "Admin"}
                            </span>
                            <span className="text-[11px]" style={{ color: EKARI.dim }}>
                                Admin map monitor
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div
                    className="rounded-2xl px-4 py-3 text-sm"
                    style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
                >
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard icon={<IoPeopleOutline size={18} />} title="Total users" value={loading ? "…" : String(users.length)} />
                <StatCard icon={<IoLocationOutline size={18} />} title="With coordinates" value={loading ? "…" : String(mappableUsers.length)} />
                <StatCard icon={<IoGlobeOutline size={18} />} title="Countries" value={loading ? "…" : String(totalCountries)} />
                <StatCard icon={<IoLocationOutline size={18} />} title="Counties" value={loading ? "…" : String(totalCounties)} />
                <StatCard icon={<IoTimeOutline size={18} />} title="Joined today" value={loading ? "…" : String(joinedToday)} />
            </div>

            <div className="rounded-3xl border bg-white p-4">
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr,1fr,1fr,1fr,auto,auto]">
                    <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                            <IoSearchOutline size={16} style={{ color: EKARI.dim }} />
                        </span>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, email, county, role, interest..."
                            className="w-full rounded-full border py-2 pl-9 pr-3 text-sm outline-none"
                            style={{ borderColor: EKARI.hair, color: EKARI.text }}
                        />
                    </div>

                    <select
                        value={countryFilter}
                        onChange={(e) => setCountryFilter(e.target.value)}
                        className="rounded-full border px-3 py-2 text-sm outline-none"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        <option value="all">All countries</option>
                        {countryOptions.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>

                    <select
                        value={countyFilter}
                        onChange={(e) => setCountyFilter(e.target.value)}
                        className="rounded-full border px-3 py-2 text-sm outline-none"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        <option value="all">All counties</option>
                        {countyOptions.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>

                    <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                        className="rounded-full border px-3 py-2 text-sm outline-none"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        <option value="all">All time</option>
                        <option value="today">Joined today</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                    </select>

                    <button
                        type="button"
                        onClick={() => setShowMarkers((v) => !v)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
                        style={{
                            borderColor: showMarkers ? EKARI.forest : EKARI.hair,
                            backgroundColor: showMarkers ? EKARI.forest : "#fff",
                            color: showMarkers ? "#fff" : EKARI.text,
                        }}
                    >
                        <IoLayersOutline size={16} />
                        Markers
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowHeatmap((v) => !v)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
                        style={{
                            borderColor: showHeatmap ? EKARI.gold : EKARI.hair,
                            backgroundColor: showHeatmap ? EKARI.gold : "#fff",
                            color: showHeatmap ? "#fff" : EKARI.text,
                        }}
                    >
                        <IoFlameOutline size={16} />
                        Heatmap
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr,0.9fr]">
                <section className="overflow-hidden rounded-3xl border bg-white">
                    <div
                        className="flex items-center justify-between border-b px-4 py-3"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <h2
                            className="text-sm font-semibold uppercase tracking-wide"
                            style={{ color: EKARI.dim }}
                        >
                            Member location map
                        </h2>

                        <span
                            className="rounded-full px-2 py-[3px] text-[11px]"
                            style={{ backgroundColor: EKARI.soft, color: EKARI.dim }}
                        >
                            {filteredUsers.length} visible
                        </span>
                    </div>

                    {!apiKey ? (
                        <div className="px-4 py-8 text-sm" style={{ color: "#B91C1C" }}>
                            Missing <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="px-4 py-8 text-sm" style={{ color: EKARI.dim }}>
                            No users with valid location found for the selected filters.
                        </div>
                    ) : (
                        <div
                            ref={mapDivRef}
                            style={{
                                height: 680,
                                width: "100%",
                                background: "#F8FAFC",
                            }}
                        />
                    )}
                </section>

                <section className="overflow-hidden rounded-3xl border bg-white">
                    <div
                        className="border-b px-4 py-3"
                        style={{ borderColor: EKARI.hair }}
                    >
                        <h2
                            className="text-sm font-semibold uppercase tracking-wide"
                            style={{ color: EKARI.dim }}
                        >
                            Matching users
                        </h2>
                        <p className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                            Click a user to focus the map.
                        </p>
                    </div>

                    <div className="max-h-[680px] overflow-y-auto">
                        {loading && (
                            <div className="px-4 py-6 text-sm" style={{ color: EKARI.dim }}>
                                Loading users…
                            </div>
                        )}

                        {!loading && filteredUsers.length === 0 && (
                            <div className="px-4 py-6 text-sm" style={{ color: EKARI.dim }}>
                                No matching users found.
                            </div>
                        )}

                        {!loading &&
                            filteredUsers.map((u) => {
                                const active = selectedUid === u.uid;
                                const joined = formatDate(u.createdAt);

                                return (
                                    <button
                                        key={u.uid}
                                        type="button"
                                        onClick={() => centerOnUser(u)}
                                        className="w-full border-b px-4 py-3 text-left transition hover:bg-slate-50"
                                        style={{
                                            borderColor: EKARI.hair,
                                            backgroundColor: active ? "#F8FAFC" : "transparent",
                                        }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gray-200">

                                                <SmartAvatar
                                                    src={u?.photoURL || ""}
                                                    alt={displayName(u)}
                                                    size={48}
                                                    className={clsx("ring-2")}

                                                />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div
                                                    className="truncate text-sm font-semibold"
                                                    style={{ color: EKARI.text }}
                                                >
                                                    {displayName(u)}
                                                </div>

                                                {u.handle && (
                                                    <div className="text-xs" style={{ color: EKARI.dim }}>
                                                        {safeHandle(u.handle)}
                                                    </div>
                                                )}

                                                <div
                                                    className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]"
                                                    style={{ color: EKARI.dim }}
                                                >
                                                    <span className="inline-flex items-center gap-1">
                                                        <IoLocationOutline size={12} />
                                                        {u.location?.place || `${u.country || "—"}${u.county ? `, ${u.county}` : ""}`}
                                                    </span>
                                                </div>

                                                <div
                                                    className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
                                                    style={{ color: EKARI.dim }}
                                                >
                                                    <span>{u.country || "—"}</span>
                                                    {u.county ? <span>• {u.county}</span> : null}
                                                    <span className="inline-flex items-center gap-1">
                                                        <IoTimeOutline size={12} />
                                                        {joined}
                                                    </span>
                                                </div>

                                                {!!u.roles?.length && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {u.roles.slice(0, 2).map((role) => (
                                                            <span
                                                                key={role}
                                                                className="rounded-full px-2 py-[2px] text-[10px] font-medium"
                                                                style={{
                                                                    backgroundColor: "#F3F4F6",
                                                                    color: EKARI.text,
                                                                }}
                                                            >
                                                                {role}
                                                            </span>
                                                        ))}
                                                        {u.roles.length > 2 && (
                                                            <span
                                                                className="rounded-full px-2 py-[2px] text-[10px] font-medium"
                                                                style={{
                                                                    backgroundColor: "#F3F4F6",
                                                                    color: EKARI.dim,
                                                                }}
                                                            >
                                                                +{u.roles.length - 2} more
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>
                </section>
            </div>
        </div>
    );
}

function StatCard({
    icon,
    title,
    value,
}: {
    icon: React.ReactNode;
    title: string;
    value: string;
}) {
    return (
        <div className="rounded-3xl border bg-white p-4">
            <div className="flex items-center gap-3">
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{
                        backgroundColor: "#F8FAFC",
                        color: EKARI.forest,
                        border: `1px solid ${EKARI.hair}`,
                    }}
                >
                    {icon}
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide" style={{ color: EKARI.dim }}>
                        {title}
                    </div>
                    <div className="text-xl font-extrabold" style={{ color: EKARI.text }}>
                        {value}
                    </div>
                </div>
            </div>
        </div>
    );
}