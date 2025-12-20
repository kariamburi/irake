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
import { useRouter } from "next/navigation";
import {
  IoCartOutline,
  IoOptionsOutline,
  IoSwapVerticalOutline,
  IoTimeOutline,
  IoSearch,
  IoCloseCircle,
  IoPricetagOutline,
  IoAdd,
  IoPlay,
  IoStorefrontOutline,
  IoGitNetworkOutline,
  IoChatbubblesOutline,
} from "react-icons/io5";

import FilterModal, { distanceKm, Filters, toLower } from "@/app/components/FilterModal";
import ProductCard, { computeStatus, KES, Product } from "@/app/components/ProductCard";
import SellModal from "@/app/components/SellModal";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { EKARI } from "@/app/constants/constants";

/* ---------------- utils ---------------- */
type SortKey = "recent" | "priceAsc" | "priceDesc";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(queryStr);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [queryStr]);
  return matches;
}
function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
function useIsMobile() {
  return useMediaQuery("(max-width: 1023px)");
}

/* ---------------- bottom tabs (match /) ---------------- */
function MobileBottomTabs({ onCreate }: { onCreate: () => void }) {
  const router = useRouter();

  return (
    <div
      className="fixed left-0 right-0 z-[60]"
      style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto w-full max-w-[520px] h-[64px] px-4 flex items-center justify-between"
        style={{
          backgroundColor: "#000000",
          borderTop: "1px solid rgba(255,255,255,.10)",
        }}
      >
        <button onClick={() => router.push("/")} className="flex flex-col items-center gap-1 text-white">
          <IoPlay size={20} />
          <span className="text-[11px] font-semibold">Deeds</span>
        </button>

        <button onClick={() => router.push("/market")} className="flex flex-col items-center gap-1 text-white">
          <IoStorefrontOutline size={20} />
          <span className="text-[11px] font-semibold">ekariMarket</span>
        </button>

        <button
          onClick={onCreate}
          className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg"
          style={{ backgroundColor: EKARI.gold }}
          aria-label="Sell / Lease"
        >
          <IoAdd size={26} color="#111827" />
        </button>

        <button onClick={() => router.push("/nexus")} className="flex flex-col items-center gap-1 text-white">
          <IoGitNetworkOutline size={20} />
          <span className="text-[11px] font-semibold">Nexus</span>
        </button>

        <button onClick={() => router.push("/bonga")} className="flex flex-col items-center gap-1 text-white">
          <IoChatbubblesOutline size={20} />
          <span className="text-[11px] font-semibold">Bonga</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- page ---------------- */
export default function MarketPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

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

  const [sellOpen, setSellOpen] = useState(false);

  // Tailwind ring color via CSS var so it uses EKARI.forest everywhere we put focus:ring
  const ringStyle = {

    "--tw-ring-color": EKARI.forest,
  } as React.CSSProperties;

  const buildQuery = useCallback(
    (after?: QueryDocumentSnapshot<DocumentData> | null) => {
      let qRef: any = collection(db, "marketListings");
      const wheres: any[] = [];

      if (filters.type) wheres.push(where("type", "==", filters.type));
      if (filters.category) wheres.push(where("categoryLower", "==", filters.category.toLowerCase()));
      if (typeof filters.minPrice === "number") wheres.push(where("price", ">=", filters.minPrice));
      if (typeof filters.maxPrice === "number") wheres.push(where("price", "<=", filters.maxPrice));
      if (filters.county) wheres.push(where("place.countyLower", "==", toLower(filters.county)));
      if (filters.town) wheres.push(where("place.townLower", "==", toLower(filters.town)));

      wheres.forEach((w) => (qRef = query(qRef, w)));

      if (sort === "recent") qRef = query(qRef, orderBy("createdAt", "desc"));
      else if (sort === "priceAsc") qRef = query(qRef, orderBy("price", "asc"));
      else qRef = query(qRef, orderBy("price", "desc"));

      if (after) qRef = query(qRef, startAfter(after));
      qRef = query(qRef, limit(24));
      return qRef;
    },
    [filters.type, filters.category, filters.minPrice, filters.maxPrice, filters.county, filters.town, sort]
  );

  const applyClientFilters = useCallback(
    (docs: Product[]) => {
      const visible = docs.filter((p) => computeStatus(p) !== "hidden");

      const searched = debouncedSearch
        ? visible.filter((p) => {
          const inName = (p.nameLower || p.name?.toLowerCase?.() || "").includes(debouncedSearch);
          const inPlace = (p.place?.textLower || p.place?.countyLower || p.place?.townLower || "").includes(
            debouncedSearch
          );
          return inName || inPlace;
        })
        : visible;

      const byLocText = filters.locationText
        ? searched.filter((p) =>
          (p.place?.textLower || p.place?.countyLower || p.place?.townLower || "").includes(
            toLower(filters.locationText)
          )
        )
        : searched;

      const byRadius =
        filters.center && filters.radiusKm
          ? byLocText.filter((p) => (p.location ? distanceKm(filters.center!, p.location) <= (filters.radiusKm as number) : false))
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

  const loadMore = useCallback(async () => {
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
  }, [buildQuery, items, paging, applyClientFilters]);

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

  /* ---------------- shared controls UI ---------------- */
  const Controls = (
    <div className="w-full">
      {/* Search row */}
      <div className="px-3 py-3 flex items-center gap-2">
        <div
          className={cn(
            "flex-1 h-10 rounded-full px-3 flex items-center gap-2 focus-within:ring-2",
            isMobile ? "bg-white/10" : "bg-white"
          )}
          style={{
            border: `1px solid ${isMobile ? "rgba(255,255,255,.12)" : EKARI.hair}`,
            ...ringStyle,
          }}
        >
          <IoSearch size={18} style={{ color: isMobile ? "rgba(255,255,255,.75)" : EKARI.dim }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, services or lease…"
            className="flex-1 outline-none bg-transparent"
            style={{ color: isMobile ? "#fff" : EKARI.text }}
          />
          {!!search && (
            <button onClick={() => setSearch("")} aria-label="Clear search">
              <IoCloseCircle size={18} style={{ color: isMobile ? "rgba(255,255,255,.75)" : EKARI.dim }} />
            </button>
          )}
        </div>

        <button
          onClick={() => setFilterOpen(true)}
          className={cn(
            "h-10 w-10 grid place-items-center rounded-full focus:ring-2",
            isMobile ? "bg-white/10 hover:bg-white/15" : "hover:bg-black/[0.03]"
          )}
          style={{
            border: `1px solid ${isMobile ? "rgba(255,255,255,.12)" : EKARI.hair}`,
            ...ringStyle,
          }}
          aria-label="Open filters"
        >
          <IoOptionsOutline size={18} style={{ color: isMobile ? "#fff" : EKARI.text }} />
        </button>

        <button
          onClick={() => setSort((s) => (s === "recent" ? "priceAsc" : s === "priceAsc" ? "priceDesc" : "recent"))}
          className={cn(
            "h-10 w-10 grid place-items-center rounded-full focus:ring-2",
            isMobile ? "bg-white/10 hover:bg-white/15" : "hover:bg-black/[0.03]"
          )}
          style={{
            border: `1px solid ${isMobile ? "rgba(255,255,255,.12)" : EKARI.hair}`,
            ...ringStyle,
          }}
          aria-label="Toggle sort"
        >
          {sort === "recent" ? (
            <IoTimeOutline size={18} style={{ color: isMobile ? "#fff" : EKARI.text }} />
          ) : (
            <IoSwapVerticalOutline size={18} style={{ color: isMobile ? "#fff" : EKARI.text }} />
          )}
        </button>
      </div>

      {/* chips */}
      {!!activeChips.length && (
        <div className="px-3 pb-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            {activeChips.map((c, i) => (
              <span
                key={`${c}-${i}`}
                className="shrink-0 text-xs font-bold rounded-full px-2.5 py-1"
                style={{
                  color: isMobile ? "#fff" : EKARI.text,
                  background: isMobile ? "rgba(255,255,255,.10)" : "white",
                  border: `1px solid ${isMobile ? "rgba(255,255,255,.12)" : EKARI.hair}`,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ---------------- mobile shell ---------------- */
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 bg-black">
          {/* Top overlay header (TikTok-like) */}
          <div className="sticky top-0 z-50">
            <div
              className="h-[56px] w-full px-3 flex items-center justify-between"
              style={{
                background: "linear-gradient(180deg, rgba(0,0,0,.75), rgba(0,0,0,0))",
              }}
            >
              <div className="flex items-center gap-2">
                <IoCartOutline size={20} color="#fff" />
                <div className="font-black text-base text-white">ekariMarket</div>
              </div>

              <button
                onClick={() => setSellOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black"
                style={{
                  background: "rgba(255,255,255,.10)",
                  border: "1px solid rgba(255,255,255,.12)",
                  color: "#fff",
                }}
              >
                <IoPricetagOutline size={16} />
                Sell / Lease
              </button>
            </div>

            {/* search/actions under top header */}
            {Controls}

            {/* small stats */}
            {!initialLoading && (
              <div className="px-3 pb-2 text-[12px]" style={{ color: "rgba(255,255,255,.75)" }}>
                {items.length} result{items.length === 1 ? "" : "s"}
                {sort !== "recent" ? ` • ${sort === "priceAsc" ? "price ↑" : "price ↓"}` : ""}
                <button onClick={onRefresh} className="ml-2 underline" style={{ color: "#fff" }}>
                  refresh
                </button>
              </div>
            )}
          </div>

          {/* content */}
          <div
            className="w-full"
            style={{
              paddingBottom: "calc(84px + env(safe-area-inset-bottom))",
            }}
          >
            {initialLoading && (
              <div className="h-[240px] grid place-items-center" style={{ color: "rgba(255,255,255,.8)" }}>
                <BouncingBallLoader />
              </div>
            )}

            {!initialLoading && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div
                  className="w-16 h-16 grid place-items-center rounded-full mb-3"
                  style={{ backgroundColor: "rgba(255,255,255,.10)" }}
                >
                  <IoCartOutline size={28} style={{ color: EKARI.gold }} />
                </div>
                <div className="text-lg font-black text-white">No Item found</div>
                <div className="mt-1" style={{ color: "rgba(255,255,255,.75)" }}>
                  Try adjusting your search or filters.
                </div>
                <button
                  onClick={() => setFilterOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 h-11 rounded-full text-black font-black"
                  style={{ backgroundColor: EKARI.gold }}
                >
                  <IoOptionsOutline size={18} />
                  Open Filters
                </button>
              </div>
            )}

            {/* grid (mobile) */}
            <div className="px-3 grid grid-cols-2 gap-2">
              {items.map((p) => (
                <ProductCard key={p.id} p={p} onClick={() => router.push(`/market/${p.id}`)} />
              ))}
            </div>

            {/* load more */}
            {!initialLoading && lastDocRef.current && (
              <div className="py-6 grid place-items-center">
                <button
                  onClick={loadMore}
                  disabled={paging}
                  className="px-4 py-2 rounded-lg text-black font-black disabled:opacity-60"
                  style={{ backgroundColor: EKARI.gold }}
                >
                  {paging ? <BouncingBallLoader /> : "Load more"}
                </button>
              </div>
            )}
          </div>

          {/* bottom tabs */}
          <MobileBottomTabs onCreate={() => setSellOpen(true)} />
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
      </>
    );
  }

  /* ---------------- desktop shell ---------------- */
  return (
    <AppShell>
      <div className="min-h-screen w-full">
        {/* Top bar */}
        <div
          className="sticky top-0 z-10 backdrop-blur border-b"
          style={{ backgroundColor: "rgba(255,255,255,0.92)", borderColor: EKARI.hair }}
        >
          <div className="h-14 px-4 max-w-[1180px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IoCartOutline size={22} style={{ color: EKARI.text }} />
              <div className="font-black text-lg" style={{ color: EKARI.text }}>
                ekariMarket
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSellOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition focus:ring-2"
                style={{
                  border: `1px solid ${EKARI.gold}`,
                  color: EKARI.gold,
                  ...ringStyle,
                }}
              >
                <IoPricetagOutline size={18} />
                <span>Sell / Lease</span>
              </button>
            </div>
          </div>

          <div className="max-w-[1180px] mx-auto">{Controls}</div>

          {/* Stats header */}
          {!initialLoading && (
            <div className="px-4 pb-3 max-w-[1180px] mx-auto text-xs" style={{ color: EKARI.dim }}>
              {items.length} result{items.length === 1 ? "" : "s"}
              {sort !== "recent" ? ` • sorted by ${sort === "priceAsc" ? "price ↑" : "price ↓"}` : ""}
              <button onClick={onRefresh} className="ml-2 underline" style={{ color: EKARI.forest }}>
                refresh
              </button>
            </div>
          )}
        </div>

        {/* Initial overlay */}
        {initialLoading && (
          <div className="h-[260px] grid place-items-center" style={{ color: EKARI.dim }}>
            <BouncingBallLoader />
          </div>
        )}

        {/* Grid */}
        <div className="max-w-[1180px] mx-auto px-4 pt-3 pb-24">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} onClick={() => router.push(`/market/${p.id}`)} />
            ))}
          </div>

          {/* Footer Load More */}
          {!initialLoading && lastDocRef.current && (
            <div className="py-8 grid place-items-center">
              <button
                onClick={loadMore}
                disabled={paging}
                className="px-5 py-2.5 rounded-lg text-white font-black hover:opacity-95 disabled:opacity-60 focus:ring-2"
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
