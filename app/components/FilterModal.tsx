"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs, limit, query, orderBy } from "firebase/firestore";
import { IoClose, IoLocationOutline, IoSearchOutline, IoRefreshOutline, IoFilterOutline } from "react-icons/io5";
import { db } from "@/lib/firebase";
import type { CurrencyCode } from "@/app/components/ProductCard";
import type { MarketType } from "@/utils/market_master_catalog";

export type Filters = {
    type: MarketType | null;
    category: string | null;
    name?: string | null;
    minPrice?: number;
    maxPrice?: number;
    county?: string | null;
    town?: string | null;
    locationText?: string | null;
    radiusKm?: number | null;
    center?: { latitude: number; longitude: number } | null;
    currency?: CurrencyCode | null;
};

export const toLower = (s?: string | null) => (s ?? "").trim().toLowerCase();

export function distanceKm(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
) {
    const rad = Math.PI / 180;
    const dLat = (b.latitude - a.latitude) * rad;
    const dLng = (b.longitude - a.longitude) * rad;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

const validCenter = (v: any): v is { latitude: number; longitude: number } =>
    !!v && Number.isFinite(v.latitude) && Number.isFinite(v.longitude) &&
    Math.abs(v.latitude) <= 90 && Math.abs(v.longitude) <= 180;

export default function FilterModal({ open, onClose, initial, onApply }: {
    open: boolean;
    onClose: () => void;
    initial: Filters;
    onApply: (filters: Filters) => void;
}) {
    const [mounted, setMounted] = useState(false);
    const [name, setName] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [names, setNames] = useState<string[]>([]);
    const [distanceEnabled, setDistanceEnabled] = useState(false);
    const [placeQuery, setPlaceQuery] = useState("");
    const [radius, setRadius] = useState(25);
    const [center, setCenter] = useState<Filters["center"]>(null);
    const [locError, setLocError] = useState("");
    const [finding, setFinding] = useState(false);

    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (!open) return;
        setName(initial.name || "");
        setShowSuggestions(false);
        setRadius(initial.radiusKm || 25);
        setCenter(validCenter(initial.center) ? initial.center : null);
        setDistanceEnabled(!!(initial.center && initial.radiusKm));
        setPlaceQuery(initial.locationText || "");
        setLocError("");
    }, [open]); // reset only when opened, not while typing

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        // These names are suggestions only; searching never depends on their availability.
        getDocs(query(collection(db, "market_items"), orderBy("nameLower"), limit(500)))
            .then(s => {
                if (cancelled) return;
                setNames(Array.from(new Set(s.docs.map(d => String(d.data().name || "").trim()).filter(Boolean))));
            })
            .catch(() => { if (!cancelled) setNames([]); });
        return () => { cancelled = true; };
    }, [open]);

    const suggestions = useMemo(() => {
        const term = toLower(name);
        if (!term) return [];
        return names.filter(n => toLower(n).includes(term) && toLower(n) !== term).slice(0, 7);
    }, [names, name]);

    async function locatePlace() {
        const q = placeQuery.trim();
        if (!q) { setLocError("Enter a town, county or address first."); return; }
        setFinding(true);
        setLocError("");
        try {
            // Geocoding is only used to resolve the user's explicitly chosen search center.
            // It does not automatically use Nairobi or an inferred browser location.
            const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            if (!key) throw new Error("Google Maps API key is not configured.");
            const googleApi = (window as any).google;
            if (googleApi?.maps?.Geocoder) {
                const geo = new googleApi.maps.Geocoder();
                const result = await geo.geocode({ address: q });
                const coords = result.results?.[0]?.geometry?.location;
                if (!coords) throw new Error("Location not found. Try a nearby town or county.");
                setCenter({ latitude: coords.lat(), longitude: coords.lng() });
            } else {
                // Load Google's JS Maps SDK if it was not already loaded elsewhere.
                await new Promise<void>((resolve, reject) => {
                    const existing = document.querySelector<HTMLScriptElement>('script[data-ekari-maps-geocoder]');
                    if (existing) {
                        if ((window as any).google?.maps?.Geocoder) { resolve(); return; }
                        existing.addEventListener("load", () => resolve(), { once: true });
                        existing.addEventListener("error", () => reject(new Error("Maps could not load.")), { once: true });
                    } else {
                        const script = document.createElement("script");
                        script.dataset.ekariMapsGeocoder = "1";
                        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}`;
                        script.async = true;
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error("Maps could not load."));
                        document.head.appendChild(script);
                    }
                });
                const geo = new (window as any).google.maps.Geocoder();
                const result = await geo.geocode({ address: q });
                const coords = result.results?.[0]?.geometry?.location;
                if (!coords) throw new Error("Location not found. Try a nearby town or county.");
                setCenter({ latitude: coords.lat(), longitude: coords.lng() });
            }
        } catch (e: any) { setCenter(null); setLocError(e?.message || "Unable to resolve this location."); }
        finally { setFinding(false); }
    }

    function clearFilters() {
        setName("");
        setPlaceQuery("");
        setCenter(null);
        setDistanceEnabled(false);
        setRadius(25);
        setLocError("");
        // Preserve category selected on the main market page.
        onApply({
            type: initial.type || null, category: null, name: null,
            minPrice: undefined, maxPrice: undefined, county: null, town: null,
            locationText: null, radiusKm: null, center: null, currency: null
        });
        onClose();
    }

    function apply() {
        if (distanceEnabled && !validCenter(center)) {
            setLocError("Find and select a valid location before applying a distance radius.");
            return;
        }
        onApply({
            type: initial.type || null, category: null, name: name.trim() || null,
            minPrice: undefined, maxPrice: undefined, county: null, town: null,
            // Don't additionally text-filter place fields: radius must include neighboring counties.
            locationText: null, radiusKm: distanceEnabled ? radius : null,
            center: distanceEnabled ? center : null, currency: null
        });
        onClose();
    }

    if (!mounted || !open) return null;
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="market-filter-heading" className="flex max-h-[93svh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-[#E5E7EB] bg-white shadow-2xl sm:rounded-3xl">
                <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div><h2 id="market-filter-heading" className="text-lg font-black text-[#173C2E]">Find listings</h2><p className="text-xs text-slate-500">Search by name, or narrow by distance</p></div>
                    <button type="button" onClick={onClose} aria-label="Close filters" className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"><IoClose size={20} /></button>
                </header>
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                    <div>
                        <label htmlFor="market-modal-name" className="mb-2 block text-sm font-extrabold text-slate-700">Search listings by name</label>
                        <div className="relative">
                            <IoSearchOutline className="absolute left-3 top-3.5 text-slate-400" size={19} />
                            <input id="market-modal-name" value={name} onChange={e => { setName(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} placeholder="e.g. Apple, tomatoes, tractor, chicken…" autoComplete="off" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#173C2E]" />
                        </div>
                        {showSuggestions && suggestions.length > 0 && <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                            {suggestions.map(s => <button type="button" key={s} onClick={() => { setName(s); setShowSuggestions(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-50">{s}</button>)}
                        </div>}
                        <p className="mt-2 text-xs text-slate-400">Partial names work too; you do not need to choose a product type.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-4">
                        <label className="flex cursor-pointer items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 font-extrabold text-[#173C2E]"><IoLocationOutline size={19} /> Filter by distance</span>
                            <input type="checkbox" checked={distanceEnabled} onChange={e => { setDistanceEnabled(e.target.checked); setLocError(""); }} className="h-5 w-5 accent-[#173C2E]" />
                        </label>
                        {distanceEnabled && <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                            <div><label htmlFor="market-distance-place" className="mb-2 block text-xs font-bold text-slate-600">Location center (town, county or address)</label>
                                <div className="flex gap-2"><input id="market-distance-place" value={placeQuery} onChange={e => { setPlaceQuery(e.target.value); setCenter(null); setLocError(""); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void locatePlace(); } }} placeholder="e.g. Nakuru, Kenya" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#173C2E]" />
                                    <button type="button" disabled={finding} onClick={() => void locatePlace()} className="rounded-xl bg-[#173C2E] px-4 text-sm font-bold text-white disabled:opacity-50">{finding ? "Finding…" : "Find"}</button></div>
                                {validCenter(center) && <p className="mt-2 text-xs font-semibold text-emerald-700">Location selected. Radius will be measured from this point.</p>}
                                {locError && <p role="alert" className="mt-2 text-xs font-medium text-rose-600">{locError}</p>}
                            </div>
                            <div><label htmlFor="market-distance-radius" className="mb-2 block text-xs font-bold text-slate-600">Maximum distance</label>
                                <select id="market-distance-radius" value={radius} onChange={e => setRadius(Number(e.target.value))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
                                    {[5, 10, 20, 25, 50, 100, 200, 300, 500].map(km => <option key={km} value={km}>Within {km} km</option>)}
                                </select>
                            </div>
                            <p className="text-xs leading-5 text-slate-400">Only listings with valid coordinates can be matched by distance.</p>
                        </div>}
                    </div>
                </div>
                <footer className="flex gap-3 border-t border-slate-100 bg-white px-5 py-4">
                    <button type="button" onClick={clearFilters} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600"><IoRefreshOutline size={16} />Clear</button>
                    <button type="button" onClick={apply} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#C79257] px-5 text-sm font-black text-white hover:bg-[#AE7A42]"><IoFilterOutline size={16} />Apply filters</button>
                </footer>
            </section>
        </div>, document.body
    );
}
