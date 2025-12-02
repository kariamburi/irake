"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  DocumentData,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  IoCartOutline,
  IoOptionsOutline,
  IoSwapVerticalOutline,
  IoTimeOutline,
  IoSearch,
  IoCloseCircle,
  IoPricetagOutline,
} from "react-icons/io5";

import FilterModal, { distanceKm, Filters, toLower } from "@/app/components/FilterModal";
import ProductCard, { computeStatus, KES, Product } from "@/app/components/ProductCard";
import SellModal from "@/app/components/SellModal";
import AppShell from "@/app/components/AppShell";
//import { EKARI } from "../constants/constants";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { EKARI } from "@/app/constants/constants";

type SortKey = "recent" | "priceAsc" | "priceDesc";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function MarketPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim().toLowerCase(), 350);
  const [filters, setFilters] = useState<Filters>({ type: null, category: null });
  const [sort, setSort] = useState<SortKey>("recent");
  const [filterOpen, setFilterOpen] = useState(false);

  const [items, setItems] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);
  const hasLoadedOnce = useRef(false);

  // Tailwind ring color via CSS var so it uses EKARI.forest everywhere we put focus:ring
  const ringStyle = {

    "--tw-ring-color": EKARI.forest,
  } as React.CSSProperties;

  const buildQuery = useCallback(
    (after?: QueryDocumentSnapshot<DocumentData> | null) => {
      let qRef: any = collection(db, "marketListings");
      const wheres: any[] = [];

      if (filters.type) wheres.push(where("type", "==", filters.type));
      if (filters.category)
        wheres.push(where("categoryLower", "==", filters.category.toLowerCase()));
      if (typeof filters.minPrice === "number") wheres.push(where("price", ">=", filters.minPrice));
      if (typeof filters.maxPrice === "number") wheres.push(where("price", "<=", filters.maxPrice));
      if (filters.county) wheres.push(where("place.countyLower", "==", toLower(filters.county)));
      if (filters.town) wheres.push(where("place.townLower", "==", toLower(filters.town)));

      wheres.forEach((w) => (qRef = query(qRef, w)));

      if (sort === "recent") {
        qRef = query(qRef, orderBy("createdAt", "desc"));
      } else if (sort === "priceAsc") {
        qRef = query(qRef, orderBy("price", "asc"));
      } else {
        qRef = query(qRef, orderBy("price", "desc"));
      }

      if (after) qRef = query(qRef, startAfter(after));
      qRef = query(qRef, limit(24));
      return qRef;
    },
    [
      filters.type,
      filters.category,
      filters.minPrice,
      filters.maxPrice,
      filters.county,
      filters.town,
      sort,
    ]
  );

  const applyClientFilters = useCallback(
    (docs: Product[]) => {
      const visible = docs.filter((p) => computeStatus(p) !== "hidden");

      const searched = debouncedSearch
        ? visible.filter((p) => {
          const inName = (p.nameLower || p.name?.toLowerCase?.() || "").includes(debouncedSearch);
          const inPlace = (
            p.place?.textLower ||
            p.place?.countyLower ||
            p.place?.townLower ||
            ""
          ).includes(debouncedSearch);
          return inName || inPlace;
        })
        : visible;

      const byLocText = filters.locationText
        ? searched.filter((p) =>
          (
            p.place?.textLower ||
            p.place?.countyLower ||
            p.place?.townLower ||
            ""
          ).includes(toLower(filters.locationText))
        )
        : searched;

      const byRadius =
        filters.center && filters.radiusKm
          ? byLocText.filter((p) =>
            p.location ? distanceKm(filters.center!, p.location) <= (filters.radiusKm as number) : false
          )
          : byLocText;

      return byRadius;
    },
    [debouncedSearch, filters.locationText, filters.center, filters.radiusKm]
  );

  const runInitialLoad = useCallback(async () => {
    try {
      unsubRef.current?.();

      if (!hasLoadedOnce.current) setInitialLoading(true);

      if (sort === "recent") {
        const q = buildQuery();
        let firstSnapDone = false;
        const unsub = onSnapshot(
          q,
          (snap: QuerySnapshot<DocumentData>) => {
            const docs = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Product[];
            lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
            setItems(applyClientFilters(docs));
            if (!firstSnapDone) {
              firstSnapDone = true;
              hasLoadedOnce.current = true;
              setInitialLoading(false);
            }
          },
          () => {
            setItems([]);
            lastDocRef.current = null;
            setInitialLoading(false);
          }
        );
        unsubRef.current = unsub;
      } else {
        const q = buildQuery();
        const snap: QuerySnapshot<DocumentData> = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[];
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
        setItems(applyClientFilters(docs));
        hasLoadedOnce.current = true;
        setInitialLoading(false);
      }
    } catch {
      setItems([]);
      lastDocRef.current = null;
      setInitialLoading(false);
    }
  }, [buildQuery, sort, applyClientFilters]);

  useEffect(() => {
    runInitialLoad();
    return () => {
      try {
        unsubRef.current?.();
        unsubRef.current = null;
      } catch { }
    };
  }, [runInitialLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runInitialLoad();
    } finally {
      setRefreshing(false);
    }
  }, [runInitialLoad]);

  const loadMore = useCallback(
    async () => {
      if (paging || !lastDocRef.current) return;
      setPaging(true);
      try {
        const q = buildQuery(lastDocRef.current);
        const snap: QuerySnapshot<DocumentData> = await getDocs(q);
        if (!snap.empty) {
          const extra = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[];
          const merged = [...items, ...extra];
          setItems(applyClientFilters(merged));
          lastDocRef.current = snap.docs[snap.docs.length - 1] || lastDocRef.current;
        } else {
          lastDocRef.current = null;
        }
      } finally {
        setPaging(false);
      }
    },
    [buildQuery, items, paging, applyClientFilters]
  );

  const [sellOpen, setSellOpen] = useState(false);
  const activeChips = useMemo(() => {
    const chips: string[] = [];
    if (filters.type) chips.push(filters.type);
    if (filters.category) chips.push(filters.category);
    if (typeof filters.minPrice === "number") chips.push(`≥ ${KES(filters.minPrice)}`);
    if (typeof filters.maxPrice === "number") chips.push(`≤ ${KES(filters.maxPrice)}`);
    if (filters.county) chips.push(filters.county);
    if (filters.town) chips.push(filters.town);
    if (filters.locationText) chips.push(filters.locationText);
    if (filters.center && filters.radiusKm) chips.push(`${filters.radiusKm} km nearby`);
    if (debouncedSearch) chips.push(`“${debouncedSearch}”`);
    return chips;
  }, [filters, debouncedSearch]);

  const onCreated = useCallback(
    (p: Product) => {
      setItems((prev) => {
        const next = applyClientFilters([p, ...prev]);
        if (sort === "priceAsc") return next.sort((a, b) => (a.price || 0) - (b.price || 0));
        if (sort === "priceDesc") return next.sort((a, b) => (b.price || 0) - (a.price || 0));
        return next;
      });
    },
    [applyClientFilters, sort]
  );

  return (
    <AppShell>
      <div className="min-h-screen w-full">
        {/* Top bar */}
        <div
          className="sticky top-0 z-10 backdrop-blur border-b"
          style={{ backgroundColor: "rgba(255,255,255,0.9)", borderColor: EKARI.hair }}
        >
          <div className="h-14 px-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IoCartOutline size={22} style={{ color: EKARI.text }} />
              <div className="font-black text-lg" style={{ color: EKARI.text }}>
                ekariMarket
              </div>
            </div>

            <button
              onClick={() => setSellOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition focus:ring-2"
              style={{
                border: `1px solid ${EKARI.gold}`,
                color: EKARI.gold,
                // @ts-expect-error css var for tailwind ring
                "--tw-ring-color": EKARI.forest,
              }}
            >
              <IoPricetagOutline size={18} />
              <span>Sell / Lease</span>
            </button>
          </div>

          {/* Search & actions */}
          <div className="px-3 py-3 flex items-center gap-2">
            <div
              className="flex-1 h-10 rounded-full bg-white px-3 flex items-center gap-2 focus-within:ring-2"
              style={{ border: `1px solid ${EKARI.hair}`, ...ringStyle }}
            >
              <IoSearch size={18} style={{ color: EKARI.dim }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, services or lease…"
                className="flex-1 outline-none bg-transparent"
                style={{ color: EKARI.text }}
              />
              {!!search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  <IoCloseCircle size={18} style={{ color: EKARI.dim }} />
                </button>
              )}
            </div>

            <button
              onClick={() => setFilterOpen(true)}
              className="h-10 w-10 grid place-items-center rounded-full hover:bg-black/[0.03] focus:ring-2"
              style={{ border: `1px solid ${EKARI.hair}`, ...ringStyle }}
              aria-label="Open filters"
            >
              <IoOptionsOutline size={18} style={{ color: EKARI.text }} />
            </button>

            <button
              onClick={() =>
                setSort((s) => (s === "recent" ? "priceAsc" : s === "priceAsc" ? "priceDesc" : "recent"))
              }
              className="h-10 w-10 grid place-items-center rounded-full hover:bg-black/[0.03] focus:ring-2"
              style={{ border: `1px solid ${EKARI.hair}`, ...ringStyle }}
              aria-label="Toggle sort"
            >
              {sort === "recent" ? (
                <IoTimeOutline size={18} style={{ color: EKARI.text }} />
              ) : (
                <IoSwapVerticalOutline size={18} style={{ color: EKARI.text }} />
              )}
            </button>
          </div>

          {/* Active chips */}
          {!!activeChips.length && (
            <div className="px-3 pb-3 overflow-x-auto">
              <div className="flex items-center gap-2">
                {activeChips.map((c, i) => (
                  <span
                    key={`${c}-${i}`}
                    className="shrink-0 text-xs font-bold bg-white rounded-full px-2.5 py-1"
                    style={{ color: EKARI.text, border: `1px solid ${EKARI.hair}` }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Initial overlay */}
        {initialLoading && (
          <div className="h-[240px] grid place-items-center" style={{ color: EKARI.dim }}>
            <BouncingBallLoader />
          </div>
        )}

        {/* Stats header */}
        {!initialLoading && (
          <div className="px-3 py-2 text-xs" style={{ color: EKARI.dim }}>
            {items.length} result{items.length === 1 ? "" : "s"}
            {sort !== "recent" ? ` • sorted by ${sort === "priceAsc" ? "price ↑" : "price ↓"}` : ""}
            <button
              onClick={onRefresh}
              className="ml-2 underline"
              style={{ color: EKARI.forest }}
              aria-label="Refresh"
            >
              refresh
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="px-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pb-24">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} onClick={() => router.push(`/market/${p.id}`)} />
          ))}
        </div>

        {/* Footer Load More */}
        {!initialLoading && lastDocRef.current && (
          <div className="py-6 grid place-items-center">
            <button
              onClick={loadMore}
              disabled={paging}
              className="px-4 py-2 rounded-lg text-white font-black hover:opacity-90 disabled:opacity-60 focus:ring-2"
              style={{ backgroundColor: EKARI.forest, ...ringStyle }}
            >
              {paging ? <BouncingBallLoader /> : "Load more"}
            </button>
          </div>
        )}

        {/* Empty state */}
        {!initialLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 grid place-items-center rounded-full mb-3" style={{ backgroundColor: EKARI.hair }}>
              <IoCartOutline size={28} style={{ color: EKARI.forest }} />
            </div>
            <div className="text-lg font-black" style={{ color: EKARI.text }}>
              No Item found
            </div>
            <div className="mt-1" style={{ color: EKARI.dim }}>
              Try adjusting your search or filters.
            </div>
            <button
              onClick={() => setFilterOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 h-11 rounded-full text-white font-black focus:ring-2"
              style={{ backgroundColor: EKARI.forest, ...ringStyle }}
            >
              <IoOptionsOutline size={18} />
              Open Filters
            </button>
          </div>
        )}


      </div>
      {/* Modals */}
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        initial={filters}
        onApply={(f: any) => {
          setFilters(f);
          setFilterOpen(false);
        }}
      />

      <SellModal open={sellOpen} onClose={() => setSellOpen(false)} onCreated={onCreated} />
    </AppShell>
  );
}
