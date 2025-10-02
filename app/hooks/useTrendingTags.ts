// app/hooks/useTrendingTags.ts
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

export function useTrendingTags() {
    const [list, setList] = useState<string[]>([]);
    const [meta, setMeta] = useState<Record<string, { count: number; delta?: number }>>({});
    useEffect(() => {
        const unsub = onSnapshot(doc(db, "meta/trendingTags"), (d) => {
            const rows = (d.data()?.tags || []) as { tag: string; count: number; delta?: number }[];
            setList(rows.map((r) => r.tag));
            setMeta(Object.fromEntries(rows.map((r) => [r.tag, { count: r.count, delta: r.delta }])));
        });
        return () => unsub();
    }, []);
    return { list, meta };
}
