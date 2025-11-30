// LandPolygonMap.tsx
"use client";

import React, { useEffect, useRef } from "react";

const EKARI = {
    hair: "#E5E7EB",
};
function loadGoogleMaps(apiKey?: string): Promise<typeof google | null> {
    if (typeof window === "undefined") return Promise.resolve(null);
    if ((window as any).google?.maps) return Promise.resolve((window as any).google);

    return new Promise((resolve, reject) => {
        if (!apiKey) {
            console.warn("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — Map will not render.");
            resolve(null);
            return;
        }
        const exist = document.getElementById("gmaps-sdk");
        if (exist) {
            const check = () => {
                if ((window as any).google?.maps) resolve((window as any).google);
                else setTimeout(check, 100);
            };
            check();
            return;
        }
        const script = document.createElement("script");
        script.id = "gmaps-sdk";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve((window as any).google || null);
        script.onerror = (e) => reject(e);
        document.head.appendChild(script);
    });
}

export function LandPolygonMap({
    polygon,
}: {
    polygon: { lat: number; lng: number }[];
}) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const mapRef = useRef<google.maps.Map | null>(null);
    const divRef = useRef<HTMLDivElement | null>(null);
    const polygonRef = useRef<google.maps.Polygon | null>(null);

    useEffect(() => {
        if (!polygon || polygon.length < 3) return;
        let alive = true;

        (async () => {
            const g = await loadGoogleMaps(apiKey);
            if (!alive || !g || !divRef.current) return;

            if (!mapRef.current) {
                mapRef.current = new g.maps.Map(divRef.current, {
                    center: polygon[0],
                    zoom: 14,
                    disableDefaultUI: true,
                });
            }

            if (!polygonRef.current) {
                polygonRef.current = new g.maps.Polygon({
                    map: mapRef.current,
                    paths: polygon,
                    strokeColor: "#10B981",
                    strokeOpacity: 0.9,
                    strokeWeight: 2,
                    fillColor: "#10B981",
                    fillOpacity: 0.2,
                });
            } else {
                polygonRef.current.setPath(polygon);
            }

            const bounds = new g.maps.LatLngBounds();
            polygon.forEach((p) => bounds.extend(new g.maps.LatLng(p.lat, p.lng)));
            mapRef.current.fitBounds(bounds);
        })();

        return () => {
            alive = false;
        };
    }, [apiKey, polygon]);

    if (!polygon || polygon.length < 3) {
        return (
            <div className="text-xs text-gray-500">
                No land boundary drawn for this listing.
            </div>
        );
    }

    return (
        <div
            ref={divRef}
            style={{
                height: 320,
                borderRadius: 12,
                border: `1px solid ${EKARI.hair}`,
                overflow: "hidden",
            }}
        />
    );
}
