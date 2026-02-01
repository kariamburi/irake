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
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import {
  IoCartOutline,
  IoOptionsOutline,
  IoSwapVerticalOutline,
  IoTimeOutline,
  IoSearch,
  IoCloseCircle,
  IoPricetagOutline,
  IoAdd,
  IoChatbubblesOutline,
  IoHomeOutline,
  IoCompassOutline,
  IoChevronForward,
  IoChevronBack,
  IoInformationCircleOutline,
  IoPersonCircleOutline,
  IoNotificationsOutline,
  IoMenu,
  IoSparklesOutline,
  IoStar,
} from "react-icons/io5";

import FilterModal, { distanceKm, Filters, toLower } from "@/app/components/FilterModal";
import ProductCard, { computeStatus, KES, Product } from "@/app/components/ProductCard";
import SellModal from "@/app/components/SellModal";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { EKARI } from "@/app/constants/constants";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { useAuth } from "@/app/hooks/useAuth";
import clsx from "clsx";
import { EkariSideMenuSheet } from "@/app/components/EkariSideMenuSheet";

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

/* ---------------- tiny UI helpers (premium) ---------------- */
function PremiumSurface({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border bg-white/80 backdrop-blur-xl",
        "shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function PremiumPillButton({
  children,
  onClick,
  className,
  style,
  ariaLabel,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center gap-2",
        "rounded-full px-4 h-11",
        "font-black text-sm",
        "transition active:scale-[0.98]",
        "focus:outline-none focus:ring-2",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
      style={style}
    >
      {children}
    </button>
  );
}

/* ---------------- bottom tabs (premium) ---------------- */
/* -------------------- Mobile bottom tabs (keep logic) -------------------- */
function hexToRgba(hex: string, alpha: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
function MobileBottomTabs({ onCreate }: { onCreate: () => void }) {
  const router = useRouter();

  const TabBtn = ({
    label,
    icon,
    onClick,
    active,
  }: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    active?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition",
        active ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"
      )}
      aria-current={active ? "page" : undefined}
    >
      <div style={{ color: active ? EKARI.forest : EKARI.text }}>{icon}</div>
      <span className="text-[11px] font-semibold" style={{ color: active ? EKARI.forest : EKARI.text }}>
        {label}
      </span>
    </button>
  );

  const isBongaActive = true;

  return (
    <div className="fixed left-0 right-0 z-[60]" style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div
        className="mx-auto w-full max-w-[520px] h-[72px] px-4 flex items-center justify-between"
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: `1px solid ${EKARI.hair}`,
        }}
      >
        <TabBtn label="Deeds" icon={<IoHomeOutline size={20} />} onClick={() => router.push("/")} />
        <TabBtn label="ekariMarket" icon={<IoCartOutline size={20} />} onClick={() => router.push("/market")} />

        <button
          onClick={onCreate}
          className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg border"
          style={{
            background: `linear-gradient(135deg, ${EKARI.gold}, ${hexToRgba(EKARI.gold, 0.78)})`,
            borderColor: "rgba(0,0,0,0.06)",
          }}
          aria-label="New chat"
        >
          <IoAdd size={26} color="#111827" />
        </button>

        <TabBtn label="Nexus" icon={<IoCompassOutline size={20} />} onClick={() => router.push("/nexus")} />
        <TabBtn label="Bonga" icon={<IoChatbubblesOutline size={20} />} onClick={() => router.push("/bonga")} active={isBongaActive} />
      </div>
    </div>
  );
}


type MenuItem = {
  key: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  alsoMatch?: string[];
  requiresAuth?: boolean;
  badgeCount?: number;
};


/* ---------- Profiles ---------- */
function useUserProfile(uid?: string) {
  const [profile, setProfile] = useState<{
    handle?: string;
    photoURL?: string;
    dataSaverVideos?: boolean;
    uid?: string;
  } | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any | undefined;
      if (!data) {
        setProfile(null);
        return;
      }
      setProfile({
        uid,
        handle: data?.handle,
        photoURL: data?.photoURL,
        dataSaverVideos: !!data?.dataSaverVideos,
      });
    });
    return () => unsub();
  }, [uid]);

  return profile;
}

/* ---------------- page ---------------- */
export default function MarketPage() {

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
  const ringStyle = { "--tw-ring-color": EKARI.forest } as React.CSSProperties;

  const { user } = useAuth();
  const uid = user?.uid;
  const profile = useUserProfile(uid);
  const [menuOpen, setMenuOpen] = useState(false);

  const { unreadDM, notifTotal } = useInboxTotalsWeb(!!uid, uid);

  const handle = (profile as any)?.handle ?? null;
  const profileHref = handle && String(handle).trim().length > 0 ? `/${handle}` : "/getstarted";

  const fullMenu: MenuItem[] = useMemo(
    () => [
      { key: "deeds", label: "Deeds", href: "/", icon: <IoHomeOutline /> },
      { key: "market", label: "ekariMarket", href: "/market", icon: <IoCartOutline />, alsoMatch: ["/market"] },
      { key: "nexus", label: "Nexus", href: "/nexus", icon: <IoCompassOutline /> },
      { key: "studio", label: "Deed studio", href: "/studio/upload", icon: <IoAdd />, requiresAuth: true },
      {
        key: "notifications",
        label: "Notifications",
        href: "/notifications",
        icon: <IoNotificationsOutline />,
        requiresAuth: true,
        badgeCount: uid ? notifTotal ?? 0 : 0,
      },
      {
        key: "bonga",
        label: "Bonga",
        href: "/bonga",
        icon: <IoChatbubblesOutline />,
        requiresAuth: true,
        badgeCount: uid ? unreadDM ?? 0 : 0,
      },
      { key: "ai", label: "ekari AI", href: "/ai", icon: <IoSparklesOutline /> },
      { key: "profile", label: "Profile", href: profileHref, icon: <IoPersonCircleOutline />, requiresAuth: true },
      { key: "about", label: "About ekarihub", href: "/about", icon: <IoInformationCircleOutline /> },
    ],
    [uid, notifTotal, unreadDM, profileHref]
  );

  const navigateFromMenu = (href: string, requiresAuth?: boolean) => {
    setMenuOpen(false);
    if (requiresAuth && !uid) {
      window.location.href = `/getstarted?next=${encodeURIComponent(href)}`;
      return;
    }
    window.location.href = href;
  };

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
          ? byLocText.filter((p) =>
            p.location ? distanceKm(filters.center!, p.location) <= (filters.radiusKm as number) : false
          )
          : byLocText;

      return byRadius;
    },
    [debouncedSearch, filters.locationText, filters.center, filters.radiusKm]
  );

  /* ================= Featured strip (snap + arrows + auto every 2.5s) ================= */
  const [featuredItems, setFeaturedItems] = useState<Product[]>([]);
  const featRef = useRef<HTMLDivElement | null>(null);
  const featTimer = useRef<number | null>(null);
  const featPausedRef = useRef(false);

  const { signOutUser } = useAuth();
  useEffect(() => {
    const now = new Date();
    const q = query(
      collection(db, "marketListings"),
      where("status", "==", "active"),
      where("featured", "==", true),
      where("featuredUntil", ">", now),
      orderBy("featuredUntil", "desc"),
      orderBy("publishedAt", "desc"),
      limit(14)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[];
        setFeaturedItems(applyClientFilters(docs));
      },
      () => setFeaturedItems([])
    );

    return () => unsub();
  }, [applyClientFilters]);

  const scrollFeaturedByCards = useCallback((dir: -1 | 1) => {
    const el = featRef.current;
    if (!el) return;

    const firstCard = el.querySelector<HTMLElement>("[data-feat-card]");
    const cardW = firstCard?.offsetWidth ?? 180;
    const gap = 8;
    const step = cardW + gap;

    const max = el.scrollWidth - el.clientWidth;

    let nextLeft = el.scrollLeft + step * dir;

    if (nextLeft < 0) nextLeft = max;
    if (nextLeft > max - 2) nextLeft = 0;

    el.scrollTo({ left: nextLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (featTimer.current) window.clearInterval(featTimer.current);
    featTimer.current = null;

    if (!featuredItems.length) return;

    featTimer.current = window.setInterval(() => {
      if (featPausedRef.current) return;
      scrollFeaturedByCards(1);
    }, 2500);

    return () => {
      if (featTimer.current) window.clearInterval(featTimer.current);
      featTimer.current = null;
    };
  }, [featuredItems, scrollFeaturedByCards]);

  const FeaturedStrip = !initialLoading && featuredItems.length > 0 ? (
    <div className={cn(isMobile ? "px-3 mb-2 mt-3" : "px-4 mt-4")}>
      <PremiumSurface
        className={cn(isMobile ? "px-3 py-3" : "px-4 py-4")}
        style={{
          borderColor: "rgba(199,146,87,0.22)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.86), rgba(255,255,255,0.70))",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="h-9 w-9 rounded-2xl grid place-items-center border"
              style={{
                borderColor: "rgba(199,146,87,0.30)",
                background:
                  "linear-gradient(135deg, rgba(199,146,87,0.18), rgba(35,63,57,0.08))",
              }}
            >
              <IoStar size={16} style={{ color: EKARI.gold }} />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-black" style={{ color: EKARI.text }}>
                Featured
              </div>
              <div className="text-[12px]" style={{ color: EKARI.dim }}>
                Premium listings curated for you
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollFeaturedByCards(-1)}
              className="h-10 w-10 rounded-2xl border grid place-items-center hover:bg-black/[0.03] focus:ring-2"
              style={{ borderColor: "rgba(199,146,87,0.25)", ...ringStyle }}
              aria-label="Previous featured"
              onMouseEnter={() => (featPausedRef.current = true)}
              onMouseLeave={() => (featPausedRef.current = false)}
            >
              <IoChevronBack size={18} style={{ color: EKARI.text }} />
            </button>
            <button
              onClick={() => scrollFeaturedByCards(1)}
              className="h-10 w-10 rounded-2xl border grid place-items-center hover:bg-black/[0.03] focus:ring-2"
              style={{ borderColor: "rgba(199,146,87,0.25)", ...ringStyle }}
              aria-label="Next featured"
              onMouseEnter={() => (featPausedRef.current = true)}
              onMouseLeave={() => (featPausedRef.current = false)}
            >
              <IoChevronForward size={18} style={{ color: EKARI.text }} />
            </button>
          </div>
        </div>

        <div className="relative">
          <div
            ref={featRef}
            className={cn(
              "flex gap-3 overflow-x-auto overflow-y-hidden no-scrollbar pb-0",
              "snap-x snap-mandatory"
            )}
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-x",     // ✅ horizontal gestures handled here
            }}
            onWheel={(e) => {
              // ✅ Convert mouse wheel vertical → horizontal scroll on desktop trackpads/mice
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.currentTarget.scrollLeft += e.deltaY;
                e.preventDefault();
              }
            }}
          >

            {featuredItems.map((p) => (
              <div key={p.id} data-feat-card className="min-w-[190px] max-w-[190px] snap-start">
                <div
                  className="rounded-3xl p-[1px]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(199,146,87,0.55), rgba(35,63,57,0.45))",
                  }}
                >
                  <div className="rounded-3xl h-full bg-white overflow-hidden">
                    <ProductCard p={p} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PremiumSurface>
    </div>
  ) : null;

  function debugLog(...args: any[]) {
    console.log("[MarketPage]", ...args);
  }

  /* ================= Main list query ================= */
  const buildQuery = useCallback(
    (after?: QueryDocumentSnapshot<DocumentData> | null) => {
      let qRef: any = collection(db, "marketListings");
      const wheres: any[] = [];

      wheres.push(where("status", "==", "active"));

      if (filters.type) wheres.push(where("type", "==", filters.type));
      if (filters.category) wheres.push(where("categoryLower", "==", filters.category.toLowerCase()));
      if (typeof filters.minPrice === "number") wheres.push(where("price", ">=", filters.minPrice));
      if (typeof filters.maxPrice === "number") wheres.push(where("price", "<=", filters.maxPrice));
      if (filters.county) wheres.push(where("place.countyLower", "==", toLower(filters.county)));
      if (filters.town) wheres.push(where("place.townLower", "==", toLower(filters.town)));

      wheres.forEach((w) => (qRef = query(qRef, w)));

      if (sort === "recent") {
        qRef = query(qRef, orderBy("featured", "desc"), orderBy("rankBoost", "desc"), orderBy("publishedAt", "desc"));
      } else if (sort === "priceAsc") qRef = query(qRef, orderBy("price", "asc"));
      else qRef = query(qRef, orderBy("price", "desc"));

      if (after) qRef = query(qRef, startAfter(after));
      qRef = query(qRef, limit(24));
      return qRef;
    },
    [filters.type, filters.category, filters.minPrice, filters.maxPrice, filters.county, filters.town, sort]
  );

  const runInitialLoad = useCallback(async () => {
    const startedAt = Date.now();

    try {
      debugLog("runInitialLoad:start", { sort, filters, search: debouncedSearch });

      unsubRef.current?.();
      if (!hasLoadedOnce.current) setInitialLoading(true);

      const q = buildQuery();

      if (sort === "recent") {
        let firstSnapDone = false;

        const unsub = onSnapshot(
          q,
          (snap: QuerySnapshot<DocumentData>) => {
            debugLog("onSnapshot:success", {
              size: snap.size,
              empty: snap.empty,
              tookMs: Date.now() - startedAt,
              lastId: snap.docs[snap.docs.length - 1]?.id ?? null,
            });

            const docs = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as Product[];
            lastDocRef.current = snap.docs[snap.docs.length - 1] || null;

            const filtered = applyClientFilters(docs);
            debugLog("applyClientFilters", { before: docs.length, after: filtered.length });

            setItems(filtered);

            if (!firstSnapDone) {
              firstSnapDone = true;
              hasLoadedOnce.current = true;
              setInitialLoading(false);
            }
          },
          (err: any) => {
            debugLog("onSnapshot:error", { message: err?.message, code: err?.code, name: err?.name, stack: err?.stack });

            setItems([]);
            lastDocRef.current = null;
            hasLoadedOnce.current = true;
            setInitialLoading(false);
          }
        );

        unsubRef.current = unsub;
      } else {
        debugLog("getDocs:start");
        const snap: QuerySnapshot<DocumentData> = await getDocs(q);

        debugLog("getDocs:success", {
          size: snap.size,
          empty: snap.empty,
          tookMs: Date.now() - startedAt,
          lastId: snap.docs[snap.docs.length - 1]?.id ?? null,
        });

        const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[];
        lastDocRef.current = snap.docs[snap.docs.length - 1] || null;

        const filtered = applyClientFilters(docs);
        debugLog("applyClientFilters", { before: docs.length, after: filtered.length });

        setItems(filtered);
        hasLoadedOnce.current = true;
        setInitialLoading(false);
      }
    } catch (err: any) {
      debugLog("runInitialLoad:catch", { message: err?.message, code: err?.code, name: err?.name, stack: err?.stack });

      setItems([]);
      lastDocRef.current = null;
      hasLoadedOnce.current = true;
      setInitialLoading(false);
    }
  }, [buildQuery, sort, applyClientFilters, filters, debouncedSearch]);

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

  const featuredIdSet = useMemo(() => new Set(featuredItems.map((x) => x.id)), [featuredItems]);
  const normalItems = useMemo(() => {
    if (!featuredItems.length) return items;
    return items.filter((p) => !featuredIdSet.has(p.id));
  }, [items, featuredItems, featuredIdSet]);

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

  /* ---------------- premium controls UI ---------------- */
  const Controls = (
    <div className="w-full">
      <div className="px-3 py-3 flex items-center gap-2">
        <div
          className={cn(
            "flex-1 h-11 rounded-full px-3 flex items-center gap-2",
            "bg-white/80 backdrop-blur-xl",
            "shadow-[0_14px_50px_rgba(15,23,42,0.08)]",
            "border focus-within:ring-2"
          )}
          style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
        >
          <span
            className="h-9 w-9 rounded-2xl grid place-items-center border"
            style={{
              borderColor: "rgba(199,146,87,0.20)",
              background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
            }}
          >
            <IoSearch size={18} style={{ color: EKARI.forest }} />
          </span>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products, services or lease…"
            className="flex-1 outline-none bg-transparent text-[14px] font-semibold"
            style={{ color: EKARI.text }}
          />

          {!!search && (
            <button
              onClick={() => setSearch("")}
              className="h-9 w-9 rounded-2xl grid place-items-center hover:bg-black/[0.03]"
              aria-label="Clear search"
            >
              <IoCloseCircle size={18} style={{ color: EKARI.dim }} />
            </button>
          )}
        </div>

        <button
          onClick={() => setFilterOpen(true)}
          className={cn(
            "h-11 w-11 grid place-items-center rounded-2xl",
            "bg-white/80 backdrop-blur-xl border",
            "shadow-[0_14px_50px_rgba(15,23,42,0.08)]",
            "hover:bg-white focus:ring-2 active:scale-[0.98] transition"
          )}
          style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
          aria-label="Open filters"
        >
          <IoOptionsOutline size={18} style={{ color: EKARI.text }} />
        </button>

        <button
          onClick={() => setSort((s) => (s === "recent" ? "priceAsc" : s === "priceAsc" ? "priceDesc" : "recent"))}
          className={cn(
            "h-11 w-11 grid place-items-center rounded-2xl",
            "bg-white/80 backdrop-blur-xl border",
            "shadow-[0_14px_50px_rgba(15,23,42,0.08)]",
            "hover:bg-white focus:ring-2 active:scale-[0.98] transition"
          )}
          style={{ borderColor: "rgba(199,146,87,0.22)", ...ringStyle }}
          aria-label="Toggle sort"
        >
          {sort === "recent" ? (
            <IoTimeOutline size={18} style={{ color: EKARI.text }} />
          ) : (
            <IoSwapVerticalOutline size={18} style={{ color: EKARI.text }} />
          )}
        </button>
      </div>

      {!!activeChips.length && (
        <div className="px-3 pb-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            {activeChips.map((c, i) => (
              <span
                key={`${c}-${i}`}
                className={cn(
                  "shrink-0 text-xs font-extrabold rounded-full px-3 py-1.5",
                  "border bg-white/80 backdrop-blur-xl",
                  "shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                )}
                style={{
                  color: EKARI.text,
                  borderColor: "rgba(199,146,87,0.20)",
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

  /* ---------------- premium page background (forest + gold only) ---------------- */
  const premiumBg: React.CSSProperties = {
    background:
      "radial-gradient(900px circle at 10% 0%, rgba(199,146,87,0.22), rgba(255,255,255,0) 55%), radial-gradient(900px circle at 90% 20%, rgba(35,63,57,0.16), rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(255,255,255,1), rgba(255,255,255,1))",
  };

  /* ---------------- mobile shell ---------------- */
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 -z-10" style={premiumBg} />

        {/* Scrollable page content */}
        <div className="min-h-[100dvh] w-full">
          <div
            className="sticky top-0 z-50"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))",
              backdropFilter: "blur(14px)",
              borderBottom: "1px solid rgba(199,146,87,0.18)",
            }}
          >
            <div className="h-[64px] w-full px-3 flex items-center justify-between">
              <button
                onClick={() => setMenuOpen(true)}
                className="h-10 w-10 rounded-2xl grid place-items-center border shadow-sm active:scale-[0.98] transition"
                style={{
                  borderColor: "rgba(199,146,87,0.22)",
                  background: "rgba(255,255,255,0.85)",
                  color: EKARI.text,
                }}
                aria-label="Open menu"
              >
                <IoMenu size={20} />
              </button>

              <div className="flex items-center gap-2">
                <span
                  className="h-10 w-10 rounded-2xl grid place-items-center border"
                  style={{
                    borderColor: "rgba(199,146,87,0.22)",
                    background:
                      "linear-gradient(135deg, rgba(199,146,87,0.18), rgba(35,63,57,0.08))",
                  }}
                >
                  <IoCartOutline size={20} style={{ color: EKARI.forest }} />
                </span>
                <div className="leading-tight">
                  <div className="font-black text-base" style={{ color: EKARI.text }}>
                    ekariMarket
                  </div>
                  <div className="text-[11px] font-semibold" style={{ color: EKARI.dim }}>
                    Buy • Sell • Lease
                  </div>
                </div>
              </div>

              <PremiumPillButton
                onClick={() => setSellOpen(true)}
                style={{
                  background: "linear-gradient(135deg, rgba(199,146,87,1), rgba(35,63,57,1))",
                  color: "white",
                  ...ringStyle,
                }}
              >
                <IoPricetagOutline size={16} />
                Sell
              </PremiumPillButton>
            </div>

            {Controls}

            {!initialLoading && (
              <div className="px-3 pb-2 text-[12px] font-semibold" style={{ color: EKARI.dim }}>
                {normalItems.length} result{normalItems.length === 1 ? "" : "s"}
                {sort !== "recent" ? ` • ${sort === "priceAsc" ? "price ↑" : "price ↓"}` : ""}
                <button onClick={onRefresh} className="ml-2 underline" style={{ color: EKARI.forest }}>
                  refresh
                </button>
              </div>
            )}
          </div>

          <div style={{ paddingBottom: "calc(94px + env(safe-area-inset-bottom))" }}>
            {initialLoading && (
              <div className="h-[260px] grid place-items-center" style={{ color: EKARI.dim }}>
                <BouncingBallLoader />
              </div>
            )}

            {!initialLoading && FeaturedStrip}

            {!initialLoading && normalItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div
                  className="w-16 h-16 grid place-items-center rounded-3xl mb-3 border shadow-sm"
                  style={{
                    borderColor: "rgba(199,146,87,0.22)",
                    background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
                  }}
                >
                  <IoCartOutline size={28} style={{ color: EKARI.forest }} />
                </div>
                <div className="text-lg font-black" style={{ color: EKARI.text }}>
                  No item found
                </div>
                <div className="mt-1 text-sm" style={{ color: EKARI.dim }}>
                  Try adjusting your search or filters.
                </div>
                <PremiumPillButton
                  onClick={() => setFilterOpen(true)}
                  className="mt-5 w-full max-w-[320px]"
                  style={{
                    background: "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,1))",
                    color: "white",
                    ...ringStyle,
                  }}
                >
                  <IoOptionsOutline size={18} />
                  Open Filters
                </PremiumPillButton>
              </div>
            )}

            <div className="px-3 grid grid-cols-2 gap-3">
              {normalItems.map((p) => (
                <div
                  key={p.id}
                  className="rounded-3xl p-[1px]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(199,146,87,0.22), rgba(35,63,57,0.16))",
                  }}
                >
                  <div className="rounded-3xl bg-white overflow-hidden">
                    <ProductCard p={p} />
                  </div>
                </div>
              ))}
            </div>

            {!initialLoading && lastDocRef.current && (
              <div className="py-8 grid place-items-center">
                <PremiumPillButton
                  onClick={loadMore}
                  disabled={paging}
                  className="px-6"
                  style={{
                    borderColor: "rgba(229,231,235,0.9)",
                    color: EKARI.text,
                    background: `linear-gradient(135deg, ${hexToRgba(EKARI.gold, 0.18)}, rgba(255,255,255,1))`,
                  }}
                >
                  {paging ? <BouncingBallLoader /> : "Load more"}
                </PremiumPillButton>
              </div>
            )}
          </div>

          {!sellOpen && <MobileBottomTabs onCreate={() => setSellOpen(true)} />}

          <EkariSideMenuSheet
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            uid={uid}
            handle={(profile as any)?.handle ?? null}
            photoURL={(profile as any)?.photoURL ?? null}
            profileHref={profileHref}
            unreadDM={uid ? unreadDM ?? 0 : 0}
            notifTotal={uid ? notifTotal ?? 0 : 0}
            onLogout={signOutUser}
          />
        </div>

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
      <div className="min-h-screen w-full" style={premiumBg}>
        <div
          className="sticky top-0 z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82))",
            backdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(199,146,87,0.18)",
          }}
        >
          <div className="h-[72px] px-4 max-w-[1180px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="h-11 w-11 rounded-3xl grid place-items-center border shadow-sm"
                style={{
                  borderColor: "rgba(199,146,87,0.22)",
                  background: "linear-gradient(135deg, rgba(199,146,87,0.18), rgba(35,63,57,0.08))",
                }}
              >
                <IoCartOutline size={22} style={{ color: EKARI.forest }} />
              </span>
              <div className="leading-tight">
                <div className="font-black text-lg" style={{ color: EKARI.text }}>
                  ekariMarket
                </div>
                <div className="text-[12px] font-semibold" style={{ color: EKARI.dim }}>
                  Premium marketplace for ekarihub
                </div>
              </div>
            </div>

            <PremiumPillButton
              onClick={() => setSellOpen(true)}
              style={{
                background: "linear-gradient(135deg, rgba(199,146,87,1), rgba(35,63,57,1))",
                color: "white",
                ...ringStyle,
              }}
            >
              <IoPricetagOutline size={18} />
              <span>Sell / Lease</span>
            </PremiumPillButton>
          </div>

          <div className="max-w-[1180px] mx-auto">{Controls}</div>

          {!initialLoading && (
            <div className="px-4 pb-3 max-w-[1180px] mx-auto text-xs font-semibold" style={{ color: EKARI.dim }}>
              {normalItems.length} result{normalItems.length === 1 ? "" : "s"}
              {sort !== "recent" ? ` • sorted by ${sort === "priceAsc" ? "price ↑" : "price ↓"}` : ""}
              <button onClick={onRefresh} className="ml-2 underline" style={{ color: EKARI.forest }}>
                refresh
              </button>
            </div>
          )}
        </div>

        {initialLoading && (
          <div className="h-[280px] grid place-items-center" style={{ color: EKARI.dim }}>
            <BouncingBallLoader />
          </div>
        )}

        <div className="max-w-[1180px] mx-auto px-4 pt-4 pb-24">
          {!initialLoading && FeaturedStrip}

          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
            {normalItems.map((p) => (
              <div
                key={p.id}
                className="rounded-3xl p-[1px]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(199,146,87,0.22), rgba(35,63,57,0.16))",
                }}
              >
                <div className="rounded-3xl bg-white overflow-hidden">
                  <ProductCard p={p} />
                </div>
              </div>
            ))}
          </div>

          {!initialLoading && lastDocRef.current && (
            <div className="py-10 grid place-items-center">
              <PremiumPillButton
                onClick={loadMore}
                disabled={paging}
                className="px-7"
                style={{
                  borderColor: "rgba(229,231,235,0.9)",
                  color: EKARI.text,
                  background: `linear-gradient(135deg, ${hexToRgba(EKARI.gold, 0.18)}, rgba(255,255,255,1))`,
                }}
              >
                {paging ? <BouncingBallLoader /> : "Load more"}
              </PremiumPillButton>
            </div>
          )}

          {!initialLoading && normalItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div
                className="w-16 h-16 grid place-items-center rounded-3xl mb-3 border shadow-sm"
                style={{
                  borderColor: "rgba(199,146,87,0.22)",
                  background: "linear-gradient(135deg, rgba(199,146,87,0.16), rgba(35,63,57,0.06))",
                }}
              >
                <IoCartOutline size={28} style={{ color: EKARI.forest }} />
              </div>
              <div className="text-lg font-black" style={{ color: EKARI.text }}>
                No item found
              </div>
              <div className="mt-1 text-sm" style={{ color: EKARI.dim }}>
                Try adjusting your search or filters.
              </div>
              <PremiumPillButton
                onClick={() => setFilterOpen(true)}
                className="mt-5 px-6"
                style={{
                  background: "linear-gradient(135deg, rgba(35,63,57,1), rgba(199,146,87,1))",
                  color: "white",
                  ...ringStyle,
                }}
              >
                <IoOptionsOutline size={18} />
                Open Filters
              </PremiumPillButton>
            </div>
          )}
        </div>
      </div>

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
