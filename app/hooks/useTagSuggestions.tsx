"use client";

import { useEffect, useMemo, useState } from "react";
import {
    collection,
    doc,
    getDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
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
    uid?: string | null;   // signed-in user id
    horizonDays?: number;  // still accepted but no longer used directly
    maxTrending?: number;  // how many trending to keep
};

export function useTagSuggestions(opts: Opts = {}) {
    const { uid, /* horizonDays = 30, */ maxTrending = 24 } = opts;

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
                const aoi: string[] = Array.isArray(d?.areaOfInterest)
                    ? d.areaOfInterest
                    : [];
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
        return () => {
            cancelled = true;
        };
    }, [uid]);

    // 2) Trending from hashtags collection (top by uses)
    useEffect(() => {
        setLoading(true);
        const qHashtags = query(
            collection(db, "hashtags"),
            orderBy("uses", "desc"),
            limit(maxTrending)
        );

        const unsub = onSnapshot(
            qHashtags,
            (snap) => {
                const tags: string[] = snap.docs.map((d) => {
                    const data = d.data() as { tag?: string; uses?: number };
                    // use data.tag if present, fall back to doc id
                    const raw = data.tag || d.id || "";
                    return normalize(raw);
                });

                const uniq = Array.from(
                    new Set(tags.filter(Boolean))
                );
                setTrending(uniq);
                setLoading(false);
            },
            () => {
                setTrending([]);
                setLoading(false);
            }
        );

        return () => unsub();
    }, [maxTrending]);

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
        if (userTags.length)
            g.push({ title: "Suggested for you", items: userTags });
        if (trending.length)
            g.push({
                title: "Trending now",
                items: trending.filter((t) => !userTags.includes(t)),
            });
        g.push({
            title: "All tags",
            items: curatedAll.filter(
                (t) => !userTags.includes(t) && !trending.includes(t)
            ),
        });
        return g;
    }, [userTags, trending, curatedAll]);

    return {
        loading,
        userTags,   // personalized
        trending,   // from hashtags
        all: mergedAll,
        groups,
    };
}
