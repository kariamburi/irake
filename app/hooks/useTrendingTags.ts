// app/hooks/useTrendingTags.ts
import {
    onSnapshot,
    collection,
    query,
    orderBy,
    limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

type TagMeta = { count: number; delta?: number };

export function useTrendingTags() {
    const [list, setList] = useState<string[]>([]);
    const [meta, setMeta] = useState<Record<string, TagMeta>>({});
    const [loading, setLoading] = useState(true); // 👈 add loading state

    useEffect(() => {
        // Top 30 hashtags by uses
        const q = query(
            collection(db, "hashtags"),
            orderBy("uses", "desc"),
            limit(30)
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const rows = snap.docs.map((docSnap) => {
                    const data = docSnap.data() as {
                        tag?: string;
                        uses?: number;
                        delta?: number;
                    };
                    const tag = data.tag || docSnap.id;
                    const count = data.uses ?? 0;
                    return { tag, count, delta: data.delta };
                });

                setList(rows.map((r) => r.tag));
                setMeta(
                    Object.fromEntries(
                        rows.map((r) => [
                            r.tag,
                            { count: r.count, delta: r.delta } as TagMeta,
                        ])
                    )
                );
                setLoading(false); // 👈 mark as loaded
            },
            (err) => {
                console.error("useTrendingTags snapshot error", err);
                setLoading(false); // 👈 also stop loading on error
            }
        );

        return () => unsub();
    }, []);

    // 👇 now the hook *does* have loading
    return { list, meta, loading };
}
