// shared/useMarketCatalog.ts
import { useEffect, useState, useMemo } from "react";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
} from "firebase/firestore";

// For web: "@/lib/firebase"
// For mobile: "../firebase/config"
import { db } from "@/lib/firebase"; // adjust in mobile build

import type { MarketType } from "@/utils/market_master_catalog";

export type MarketTypeDoc = {
    id: MarketType;
    label: string;
    description?: string;
    iconName?: string;
    order: number;
    active: boolean;
};

export type MarketCategoryDoc = {
    id: string;
    typeId: MarketType;
    name: string;
    description?: string;
    order: number;
    active: boolean;
};

export type MarketItemDoc = {
    id: string;
    type: MarketType;
    category: string;
    subCategory?: string | null;
    name: string;
    variety?: string | null;
    form?: string | null;
    useCase?: string | null;
    typicalPackSize?: string | number | null;
    unit?: string | null;
    grade?: string | null;
    extras?: Record<string, string>;
    active: boolean;
};

type UseMarketCatalogResult = {
    types: MarketTypeDoc[];
    categories: MarketCategoryDoc[];
    items: MarketItemDoc[];
    loading: boolean;
    error?: string;
};

export function useMarketCatalog(): UseMarketCatalogResult {
    const [types, setTypes] = useState<MarketTypeDoc[]>([]);
    const [categories, setCategories] = useState<MarketCategoryDoc[]>([]);
    const [items, setItems] = useState<MarketItemDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        const q = query(collection(db, "market_types"), orderBy("order", "asc"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const list: MarketTypeDoc[] = [];
                snap.forEach((d) => list.push(d.data() as MarketTypeDoc));
                setTypes(list.filter((t) => t.active !== false));
            },
            (err) => {
                console.error("market_types error", err);
                setError("Failed to load market types");
            }
        );
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(
            collection(db, "market_categories"),
            orderBy("order", "asc")
        );
        const unsub = onSnapshot(
            q,
            (snap) => {
                const list: MarketCategoryDoc[] = [];
                snap.forEach((d) => list.push(d.data() as MarketCategoryDoc));
                setCategories(list.filter((c) => c.active !== false));
            },
            (err) => {
                console.error("market_categories error", err);
                setError("Failed to load market categories");
            }
        );
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, "market_items"), orderBy("nameLower", "asc"));
        const unsub = onSnapshot(
            q,
            (snap) => {
                const list: MarketItemDoc[] = [];
                snap.forEach((d) => list.push(d.data() as MarketItemDoc));
                setItems(list.filter((i) => i.active !== false));
                setLoading(false);
            },
            (err) => {
                console.error("market_items error", err);
                setError("Failed to load market items");
                setLoading(false);
            }
        );
        return () => unsub();
    }, []);

    return { types, categories, items, loading, error };
}
