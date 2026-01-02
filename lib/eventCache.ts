// app/lib/eventCache.ts
export type CurrencyCode = "KES" | "USD";

export type EventItem = {
    id: string;
    title: string;
    dateISO?: string;
    location?: string;
    coverUrl?: string;
    createdAt?: any;
    organizerId?: string;
    price?: number | null;
    registrationUrl?: string | null;
    category?: "Workshop" | "Fair" | "Training" | "Meetup" | "Other";
    tags?: string[];
    description?: string | null;
    currency?: CurrencyCode;
};

const KEY = "ekari:nexus:eventCache:v1";

type CacheShape = Record<string, { data: EventItem; ts: number }>;

function read(): CacheShape {
    if (typeof window === "undefined") return {};
    try {
        return JSON.parse(sessionStorage.getItem(KEY) || "{}");
    } catch {
        return {};
    }
}

function write(v: CacheShape) {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(KEY, JSON.stringify(v));
    } catch { }
}

export function cacheEvent(ev: EventItem) {
    const all = read();
    all[ev.id] = { data: ev, ts: Date.now() };

    // (optional) keep cache small
    const entries = Object.entries(all).sort((a, b) => b[1].ts - a[1].ts);
    const trimmed = Object.fromEntries(entries.slice(0, 80));
    write(trimmed);
}

export function getCachedEvent(id: string): EventItem | null {
    const all = read();
    return all[id]?.data ?? null;
}

export function dropCachedEvent(id: string) {
    const all = read();
    delete all[id];
    write(all);
}
