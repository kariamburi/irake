// app/lib/discussionCache.ts
export type DiscussionItem = {
    id: string;
    title: string;
    body?: string | null;
    authorId?: string;
    createdAt?: any;
    repliesCount?: number;
    category?: string;
    tags?: string[];
    published?: boolean;
    author?: any;
    authorBadge?: any;
};

const KEY = "ekari:nexus:discussionCache:v1";

type CacheShape = Record<string, { data: DiscussionItem; ts: number }>;

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

export function cacheDiscussion(d: DiscussionItem) {
    const all = read();
    all[d.id] = { data: d, ts: Date.now() };

    // optional: keep small
    const entries = Object.entries(all).sort((a, b) => b[1].ts - a[1].ts);
    write(Object.fromEntries(entries.slice(0, 120)));
}

export function getCachedDiscussion(id: string): DiscussionItem | null {
    const all = read();
    return all[id]?.data ?? null;
}
