"use client";

import { useEffect, useMemo, useState } from "react";
import {
    collection, doc, getDoc, getDocs, query, where, orderBy, limit, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { INTERESTS, ROLES } from "@/app/constants/constants";

const normalize = (s: string) =>
    (s ?? "")
        .toLowerCase()
        .replace(/^#/, "")
        .replace(/&/g, "and")
        .replace(/\+/g, "plus")
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 30);

type Opts = {
    uid?: string | null;          // signed-in user id
    horizonDays?: number;         // lookback window for “trending”
    maxTrending?: number;         // how many trending to keep
};

export function useTagSuggestions(opts: Opts = {}) {
    const { uid, horizonDays = 30, maxTrending = 24 } = opts;

    const [userTags, setUserTags] = useState<string[]>([]);
    const [trending, setTrending] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // 1) Load user interests + roles (personalized)
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (!uid) {
                    setUserTags([]);
                    return;
                }
                const snap = await getDoc(doc(db, "users", uid));
                if (!snap.exists()) {
                    setUserTags([]);
                    return;
                }
                const d = snap.data() as any;
                const aoi: string[] = Array.isArray(d?.areaOfInterest) ? d.areaOfInterest : [];
                const roles: string[] = Array.isArray(d?.roles) ? d.roles : [];
                const merged = [...aoi, ...roles]
                    .map(normalize)
                    .filter(Boolean);
                const uniq = Array.from(new Set(merged));
                if (!cancelled) setUserTags(uniq);
            } catch {
                if (!cancelled) setUserTags([]);
            }
        })();
        return () => { cancelled = true; };
    }, [uid]);

    // 2) Compute trending from recent Events + Discussions
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const since = Timestamp.fromDate(new Date(Date.now() - horizonDays * 24 * 60 * 60 * 1000));

                // events (createdAt >= since)
                const qEvents = query(
                    collection(db, "events"),
                    where("createdAt", ">=", since),
                    orderBy("createdAt", "desc"),
                    limit(300)
                );

                // discussions (published===true, createdAt >= since)
                const qDiscs = query(
                    collection(db, "discussions"),
                    where("published", "==", true),
                    where("createdAt", ">=", since),
                    orderBy("createdAt", "desc"),
                    limit(300)
                );

                const [evSnap, diSnap] = await Promise.all([getDocs(qEvents), getDocs(qDiscs)]);
                const freq = new Map<string, number>();

                const bump = (arr?: string[]) => {
                    (arr || []).forEach((t) => {
                        const k = normalize(t);
                        if (!k) return;
                        freq.set(k, (freq.get(k) || 0) + 1);
                    });
                };

                evSnap.forEach((d) => bump((d.data() as any)?.tags));
                diSnap.forEach((d) => bump((d.data() as any)?.tags));

                const sorted = Array.from(freq.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, maxTrending)
                    .map(([k]) => k);

                if (!cancelled) setTrending(sorted);
            } catch {
                if (!cancelled) setTrending([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [horizonDays, maxTrending]);

    // 3) Global (curated) list
    const curatedAll = useMemo(() => {
        const base = [...INTERESTS, ...ROLES].map(normalize).filter(Boolean);
        return Array.from(new Set(base));
    }, []);

    // 4) Merge with priority: user → trending → all
    const mergedAll = useMemo(() => {
        const seen = new Set<string>();
        const push = (acc: string[], list: string[]) => {
            for (const t of list) {
                if (!t || seen.has(t)) continue;
                seen.add(t);
                acc.push(t);
            }
            return acc;
        };
        return push(push(push([], userTags), trending), curatedAll);
    }, [userTags, trending, curatedAll]);

    // Nice groupings for your SmartPicker
    const groups = useMemo(() => {
        const g: { title: string; items: string[] }[] = [];
        if (userTags.length) g.push({ title: "Suggested for you", items: userTags });
        if (trending.length) g.push({ title: "Trending now", items: trending.filter((t) => !userTags.includes(t)) });
        g.push({ title: "All tags", items: curatedAll.filter((t) => !userTags.includes(t) && !trending.includes(t)) });
        return g;
    }, [userTags, trending, curatedAll]);

    return {
        loading,
        userTags,       // personalized
        trending,       // computed
        all: mergedAll, // merged + deduped
        groups,         // for SmartPicker’s 'groups' prop
    };
}
