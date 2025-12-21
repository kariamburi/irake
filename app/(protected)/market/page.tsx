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
  IoPlay,
  IoStorefrontOutline,
  IoGitNetworkOutline,
  IoChatbubblesOutline,
  IoHomeOutline,
  IoCompassOutline,
  IoChevronForward,
  IoInformationCircleOutline,
  IoPersonCircleOutline,
  IoNotificationsOutline,
  IoMenu,
  IoSparklesOutline,
} from "react-icons/io5";

import FilterModal, { distanceKm, Filters, toLower } from "@/app/components/FilterModal";
import ProductCard, { computeStatus, KES, Product } from "@/app/components/ProductCard";
import SellModal from "@/app/components/SellModal";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { EKARI } from "@/app/constants/constants";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { useAuth } from "@/app/hooks/useAuth";

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

/* ---------------- bottom tabs (LIGHT) ---------------- */
/* ---------------- bottom tabs (LIGHT) ---------------- */
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
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition",
        active ? "bg-black/[0.04]" : "hover:bg-black/[0.03]"
      )}
      aria-current={active ? "page" : undefined}
    >
      <div style={{ color: active ? EKARI.forest : EKARI.text }}>{icon}</div>
      <span
        className="text-[11px] font-semibold"
        style={{ color: active ? EKARI.forest : EKARI.text }}
      >
        {label}
      </span>
    </button>
  );

  const isMarketActive = true; // because this is /market page

  return (
    <div
      className="fixed left-0 right-0 z-[60]"
      style={{ bottom: 0, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="mx-auto w-full max-w-[520px] h-[64px] px-4 flex items-center justify-between"
        style={{
          backgroundColor: "#FFFFFF",
          borderTop: `1px solid ${EKARI.hair}`,
        }}
      >
        <TabBtn
          label="Deeds"
          icon={<IoHomeOutline size={20} />}
          onClick={() => router.push("/")}
        />

        <TabBtn
          label="ekariMarket"
          icon={<IoCartOutline size={20} />}
          onClick={() => router.push("/market")}
          active={isMarketActive}
        />

        <button
          onClick={onCreate}
          className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg"
          style={{ backgroundColor: EKARI.gold }}
          aria-label="Sell / Lease"
        >
          <IoAdd size={26} color="#111827" />
        </button>

        <TabBtn
          label="Nexus"
          icon={<IoCompassOutline size={20} />}
          onClick={() => router.push("/nexus")}
        />

        <TabBtn
          label="Bonga"
          icon={<IoChatbubblesOutline size={20} />}
          onClick={() => router.push("/bonga")}
        />
      </div>
    </div>
  );
}

function useIsActivePath(href: string, alsoMatch: string[] = []) {
  const pathname = usePathname() || "/";
  const matches = [href, ...alsoMatch];
  return matches.some(
    (m) =>
      pathname === m ||
      (m !== "/" && pathname.startsWith(m + "/")) ||
      (m === "/" && pathname === "/")
  );
}

function badgeText(n?: number) {
  if (!n || n <= 0) return "";
  if (n > 999) return "999+";
  if (n > 99) return "99+";
  return String(n);
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

function SideMenuSheet({
  open,
  onClose,
  onNavigate,
  items,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string, requiresAuth?: boolean) => void;
  items: MenuItem[];
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn("fixed inset-0 z-[120] transition", open ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!open}
    >
      <div
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "absolute left-0 top-0 h-full w-[86%] max-w-[340px]",
          "bg-white shadow-2xl border-r",
          "transition-transform duration-300 will-change-transform",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ borderColor: EKARI.hair }}
        role="dialog"
        aria-modal="true"
      >
        <div className="h-[56px] px-4 flex items-center justify-between border-b" style={{ borderColor: EKARI.hair }}>
          <div className="font-black" style={{ color: EKARI.text }}>
            Menu
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-xl grid place-items-center border hover:bg-black/5"
            style={{ borderColor: EKARI.hair }}
            aria-label="Close menu"
          >
            <IoCloseCircle size={18} />
          </button>
        </div>

        <nav className="p-2 overflow-y-auto h-[calc(100%-56px)]">
          {items.map((it) => (
            <MenuRow key={it.key} item={it} onNavigate={onNavigate} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function MenuRow({
  item,
  onNavigate,
}: {
  item: MenuItem;
  onNavigate: (href: string, requiresAuth?: boolean) => void;
}) {
  const active = useIsActivePath(item.href, item.alsoMatch);
  const bt = badgeText(item.badgeCount);
  const showBadge = !!bt;

  return (
    <button
      onClick={() => onNavigate(item.href, item.requiresAuth)}
      className={cn("w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition", "hover:bg-black/5")}
      style={{
        color: EKARI.text,
        backgroundColor: active ? "rgba(199,146,87,0.10)" : undefined,
        border: active ? "1px solid rgba(199,146,87,0.35)" : "1px solid transparent",
      }}
    >
      <span
        className="relative h-10 w-10 rounded-xl grid place-items-center border bg-white"
        style={{ borderColor: active ? "rgba(199,146,87,0.45)" : EKARI.hair }}
      >
        <span style={{ color: active ? EKARI.gold : EKARI.forest }} className="text-[18px]">
          {item.icon}
        </span>

        {showBadge && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-[6px] rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center shadow-sm">
            {bt}
          </span>
        )}
      </span>

      <div className="flex-1 min-w-0">
        <div className={cn("text-sm truncate", active ? "font-black" : "font-extrabold")}>{item.label}</div>
      </div>

      <IoChevronForward size={18} style={{ color: EKARI.dim }} />
    </button>
  );
}
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
  const { user } = useAuth();
  const uid = user?.uid;
  const profile = useUserProfile(uid);
  const [menuOpen, setMenuOpen] = useState(false);

  const { unreadDM, notifTotal } = useInboxTotalsWeb(!!uid, uid);

  const handle = (profile as any)?.handle ?? null; // if you store handle elsewhere, use that instead
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

  /* ---------------- shared controls UI (LIGHT) ---------------- */
  const Controls = (
    <div className="w-full">
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
          onClick={() => setSort((s) => (s === "recent" ? "priceAsc" : s === "priceAsc" ? "priceDesc" : "recent"))}
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

      {!!activeChips.length && (
        <div className="px-3 pb-3 overflow-x-auto no-scrollbar">
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
  );

  /* ---------------- mobile shell (LIGHT) ---------------- */
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 bg-white">
          <div
            className="sticky top-0 z-50 border-b"
            style={{ backgroundColor: "rgba(255,255,255,0.95)", borderColor: EKARI.hair }}
          >
            <div className="h-[56px] w-full px-3 flex items-center justify-between">
              <button
                onClick={() => setMenuOpen(true)}
                className="h-9 w-9 rounded-full bg-black/[0.04] grid place-items-center backdrop-blur-md border"
                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                aria-label="Open menu"
              >
                <IoMenu size={20} />
              </button>
              <div className="flex items-center gap-2">
                <IoCartOutline size={20} style={{ color: EKARI.text }} />
                <div className="font-black text-base" style={{ color: EKARI.text }}>
                  ekariMarket
                </div>
              </div>

              <button
                onClick={() => setSellOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black focus:ring-2"
                style={{
                  background: "white",
                  border: `1px solid ${EKARI.gold}`,
                  color: EKARI.gold,
                  ...ringStyle,
                }}
              >
                <IoPricetagOutline size={16} />
                Sell / Lease
              </button>
            </div>

            {Controls}

            {!initialLoading && (
              <div className="px-3 pb-2 text-[12px]" style={{ color: EKARI.dim }}>
                {items.length} result{items.length === 1 ? "" : "s"}
                {sort !== "recent" ? ` • ${sort === "priceAsc" ? "price ↑" : "price ↓"}` : ""}
                <button onClick={onRefresh} className="ml-2 underline" style={{ color: EKARI.forest }}>
                  refresh
                </button>
              </div>
            )}
          </div>

          <div style={{ paddingBottom: "calc(84px + env(safe-area-inset-bottom))" }}>
            {initialLoading && (
              <div className="h-[240px] grid place-items-center" style={{ color: EKARI.dim }}>
                <BouncingBallLoader />
              </div>
            )}

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

            <div className="px-3 grid grid-cols-2 gap-2">
              {items.map((p) => (
                <ProductCard key={p.id} p={p} onClick={() => router.push(`/market/${p.id}`)} />
              ))}
            </div>

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
          </div>

          <MobileBottomTabs onCreate={() => setSellOpen(true)} />
          <SideMenuSheet
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onNavigate={navigateFromMenu}
            items={fullMenu}
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

  /* ---------------- desktop shell (already light) ---------------- */
  return (
    <AppShell>
      <div className="min-h-screen w-full">
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

          <div className="max-w-[1180px] mx-auto">{Controls}</div>

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

        {initialLoading && (
          <div className="h-[260px] grid place-items-center" style={{ color: EKARI.dim }}>
            <BouncingBallLoader />
          </div>
        )}

        <div className="max-w-[1180px] mx-auto px-4 pt-3 pb-24">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} onClick={() => router.push(`/market/${p.id}`)} />
            ))}
          </div>

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
