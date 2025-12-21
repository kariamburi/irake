// app/bonga/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  DocumentSnapshot,
} from "firebase/firestore";
import { IoAdd, IoCartOutline, IoChatbubblesOutline, IoChevronForward, IoCloseCircle, IoCompassOutline, IoHomeOutline, IoInformationCircleOutline, IoMenu, IoNotificationsOutline, IoPersonCircleOutline, IoSearchOutline, IoSparklesOutline } from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import SmartAvatar from "@/app/components/SmartAvatar";
import clsx from "clsx";
import { cn } from "@/lib/utils";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
};

type UserLite = {
  firstName?: string;
  surname?: string;
  handle?: string;
  photoURL?: string;
};

type LastMessage =
  | { type: "text"; text: string; from: string; to: string; createdAt: any }
  | { type: "image"; from: string; to: string; createdAt: any }
  | { type: "audio"; from: string; to: string; createdAt: any }
  | undefined;

type ThreadMirror = {
  threadId: string;
  peerId: string;
  unread?: number;
  updatedAt?: any;

  // mirror snapshot
  lastMessage?: LastMessage;
  peer?: UserLite;
};

type RowData = {
  threadId: string;
  peerId: string;
  peer: UserLite | null;
  lastMessage?: LastMessage;
  unread: number;
  updatedAt?: any;
};

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  if (typeof ts === "number") return new Date(ts);
  return null;
}

function shortTime(ts: any) {
  const d = tsToDate(ts);
  if (!d) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${m} ${ampm}`;
  }
  const mon = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  return `${mon} ${day}`;
}

function previewOf(last?: LastMessage) {
  if (!last) return "";
  if (last.type === "text") return last.text || "";
  if (last.type === "image") return "📷 Photo";
  if (last.type === "audio") return "🎤 Voice message";
  return "";
}

function nameOf(peer: UserLite | null | undefined) {
  const first = (peer?.firstName || "").trim();
  const handle = (peer?.handle || "").replace(/^@+/, "").trim();
  if (first) return first;
  if (handle) return `@${handle}`;
  return "User";
}

/* ---------------- responsive helpers ---------------- */
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
/* ----------------------------- Page ----------------------------- */
export default function MessagesPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const router = useRouter();

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);

  // UI state
  const [qStr, setQStr] = useState("");
  const [tab, setTab] = useState<"all" | "unread">("all");

  // caches to avoid extra reads
  const userCache = useRef<Map<string, UserLite | null>>(new Map());
  const threadCache = useRef<Map<string, LastMessage | undefined>>(new Map());

  const ringStyle: React.CSSProperties = {
    ["--tw-ring-color" as any]: EKARI.forest,
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useUserProfile(uid);
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

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  function normalizeUser(raw: any): UserLite | null {
    if (!raw) return null;
    return {
      firstName: raw.firstName ?? raw.name ?? "",
      surname: raw.surname ?? raw.lastName ?? "",
      handle: raw.handle ?? raw.username ?? "",
      photoURL: raw.photoURL ?? raw.photo ?? raw.imageUrl ?? "",
    };
  }

  const fetchPeer = useCallback(async (peerId: string) => {
    if (userCache.current.has(peerId)) return userCache.current.get(peerId)!;
    try {
      const snap = await getDoc(doc(db, "users", peerId));
      const raw = snap.exists() ? snap.data() : null;
      const data = normalizeUser(raw);
      userCache.current.set(peerId, data);
      return data;
    } catch (err) {
      console.error("Error fetching peer:", err);
      userCache.current.set(peerId, null);
      return null;
    }
  }, []);

  const fetchLastMessageFromThread = useCallback(async (threadId: string) => {
    if (threadCache.current.has(threadId)) return threadCache.current.get(threadId);
    try {
      const tSnap = await getDoc(doc(db, "threads", threadId));
      const data = tSnap.data() as any;
      const last: LastMessage | undefined = data?.lastMessage;
      threadCache.current.set(threadId, last);
      return last;
    } catch (err) {
      console.error("Error fetching lastMessage:", err);
      threadCache.current.set(threadId, undefined);
      return undefined;
    }
  }, []);

  // initial + live list
  useEffect(() => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const qy = query(
      collection(db, "userThreads", uid, "threads"),
      orderBy("updatedAt", "desc"),
      limit(25)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        (async () => {
          try {
            const docs = snap.docs;
            setCursor(docs.length > 0 ? docs[docs.length - 1] : null);

            // lastMessage may have changed — don’t keep stale cached values
            for (const d of docs) {
              const m = d.data() as ThreadMirror;
              threadCache.current.delete(m.threadId);
            }

            const base: RowData[] = await Promise.all(
              docs.map(async (d) => {
                const m = d.data() as ThreadMirror;

                const mirrorLast = (m as any).lastMessage as LastMessage | undefined;

                const [peer, lastMessageFallback] = await Promise.all([
                  (m.peer as any) ? Promise.resolve(m.peer as any) : fetchPeer(m.peerId),
                  mirrorLast ? Promise.resolve(undefined) : fetchLastMessageFromThread(m.threadId),
                ]);

                const lastMessage = mirrorLast ?? lastMessageFallback;

                return {
                  threadId: m.threadId,
                  peerId: m.peerId,
                  peer: peer ?? null,
                  lastMessage,
                  unread: m.unread ?? 0,
                  updatedAt: (d.data() as any).updatedAt,
                };
              })
            );

            setRows(base);
            setLoading(false);
          } catch (err) {
            console.error("Messages snapshot processing error:", err);
            setRows([]);
            setLoading(false);
          }
        })();
      },
      (error) => {
        console.error("Messages onSnapshot error:", error);
        setRows([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid, fetchPeer, fetchLastMessageFromThread]);

  const loadMore = useCallback(async () => {
    if (!uid || !cursor || paging) return;
    setPaging(true);
    try {
      const qMore = query(
        collection(db, "userThreads", uid, "threads"),
        orderBy("updatedAt", "desc"),
        startAfter(cursor),
        limit(25)
      );
      const snap = await getDocs(qMore);
      const docs = snap.docs;
      setCursor(docs.length > 0 ? docs[docs.length - 1] : null);

      const extra: RowData[] = await Promise.all(
        docs.map(async (d) => {
          const m = d.data() as ThreadMirror;
          threadCache.current.delete(m.threadId);

          const mirrorLast = (m as any).lastMessage as LastMessage | undefined;

          const [peer, lastMessageFallback] = await Promise.all([
            (m.peer as any) ? Promise.resolve(m.peer as any) : fetchPeer(m.peerId),
            mirrorLast ? Promise.resolve(undefined) : fetchLastMessageFromThread(m.threadId),
          ]);

          const lastMessage = mirrorLast ?? lastMessageFallback;

          return {
            threadId: m.threadId,
            peerId: m.peerId,
            peer: peer ?? null,
            lastMessage,
            unread: m.unread ?? 0,
            updatedAt: (d.data() as any).updatedAt,
          };
        })
      );

      setRows((prev) => [...prev, ...extra]);
    } catch (err) {
      console.error("loadMore messages error:", err);
    } finally {
      setPaging(false);
    }
  }, [uid, cursor, paging, fetchPeer, fetchLastMessageFromThread]);

  const openThread = (row: RowData) => {
    const peerName = row.peer?.firstName ?? "";
    const peerPhotoURL = row.peer?.photoURL ?? "";
    const peerHandle = row.peer?.handle ?? "";
    const q = new URLSearchParams({
      peerId: row.peerId,
      peerName,
      peerPhotoURL,
      peerHandle,
    });
    router.push(`/bonga/${row.threadId}?${q.toString()}`);
  };

  const filtered = useMemo(() => {
    const term = qStr.trim().toLowerCase();
    let list = rows;
    if (tab === "unread") list = list.filter((r) => (r.unread ?? 0) > 0);

    if (!term) return list;
    return list.filter((r) => {
      const name = r.peer?.firstName || "";
      const handle = r.peer?.handle || "";
      const last = previewOf(r.lastMessage) || "";
      return (
        name.toLowerCase().includes(term) ||
        handle.toLowerCase().includes(term) ||
        last.toLowerCase().includes(term)
      );
    });
  }, [rows, qStr, tab]);

  if (!uid) {
    return (
      <> {isDesktop ? (<AppShell>
        <div
          className="min-h-screen flex items-center justify-center px-6 text-center"
          style={{ backgroundColor: EKARI.sand }}
        >
          <div>
            <div className="text-lg font-extrabold" style={{ color: EKARI.text }}>
              Sign in to view your messages
            </div>
            <div className="text-sm mt-1" style={{ color: EKARI.dim }}>
              Chats appear here once you start conversations from profiles or ads.
            </div>
          </div>
        </div>
      </AppShell>) : (

        <div
          className="min-h-screen flex items-center justify-center px-6 text-center"
          style={{ backgroundColor: EKARI.sand }}
        >
          <div>
            <div className="text-lg font-extrabold" style={{ color: EKARI.text }}>
              Sign in to view your messages
            </div>
            <div className="text-sm mt-1" style={{ color: EKARI.dim }}>
              Chats appear here once you start conversations from profiles or ads.
            </div>
          </div>
        </div>

      )}

      </>
    );
  }

  const Header = (
    <div
      className={clsx("border-b", isDesktop ? "sticky top-0 z-20 backdrop-blur" : "sticky top-0 z-50")}
      style={{ backgroundColor: "rgba(255,255,255,0.92)", borderColor: EKARI.hair }}
    >
      <div className={clsx(isDesktop ? "h-14 px-4 max-w-[1180px] mx-auto" : "h-14 px-3")} >
        <div className="h-full flex items-center justify-between gap-2">
          <button
            onClick={() => setMenuOpen(true)}
            className="h-9 w-9 rounded-full bg-black/[0.04] grid place-items-center backdrop-blur-md border"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            aria-label="Open menu"
          >
            <IoMenu size={20} />
          </button>
          <div className="flex-1">
            <div className="font-black text-[18px] leading-none" style={{ color: EKARI.text }}>
              Messages
            </div>
            {isMobile && (
              <div className="text-[11px] mt-0.5" style={{ color: EKARI.dim }}>
                {rows.length} thread{rows.length === 1 ? "" : "s"}
              </div>
            )}
          </div>

          <button
            onClick={() => router.push("/search")}
            className="p-2 rounded-xl border transition hover:bg-black/5 focus:outline-none focus:ring-2"
            aria-label="Search"
            style={{ borderColor: EKARI.hair, ...ringStyle }}
          >
            <IoSearchOutline size={20} style={{ color: EKARI.text }} />
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className={clsx(isDesktop ? "px-4 pb-3 max-w-[1180px] mx-auto" : "px-3 pb-3")}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              className="h-8 px-3 rounded-full text-xs font-extrabold transition"
              onClick={() => setTab("all")}
              style={{
                backgroundColor: tab === "all" ? EKARI.forest : "#F3F4F6",
                color: tab === "all" ? EKARI.sand : EKARI.text,
              }}
            >
              All
            </button>
            <button
              className="h-8 px-3 rounded-full text-xs font-extrabold transition"
              onClick={() => setTab("unread")}
              style={{
                backgroundColor: tab === "unread" ? EKARI.forest : "#F3F4F6",
                color: tab === "unread" ? EKARI.sand : EKARI.text,
              }}
            >
              Unread
            </button>

            {isDesktop && (
              <span className="ml-auto text-xs" style={{ color: EKARI.dim }}>
                {rows.length} thread{rows.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="relative">
            <input
              value={qStr}
              onChange={(e) => setQStr(e.target.value)}
              placeholder="Search by name, handle, or message…"
              className="w-full h-10 rounded-xl px-3 pr-9 text-sm outline-none border focus:ring-2"
              aria-label="Filter messages"
              style={{
                borderColor: EKARI.hair,
                ["--tw-ring-color" as any]: EKARI.forest,
              }}
            />
            {qStr ? (
              <button
                onClick={() => setQStr("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-80"
                aria-label="Clear search"
                style={{ color: EKARI.dim }}
              >
                ✕
              </button>
            ) : (
              <IoSearchOutline
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "#94A3B8" }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
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

    const isBongaActive = true; // because this file is /bonga/page.tsx

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
          />

          <button
            onClick={onCreate}
            className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg"
            style={{ backgroundColor: EKARI.gold }}
            aria-label="New chat"
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
            active={isBongaActive}
          />
        </div>
      </div>
    );
  }


  const Content = (
    <>
      {loading ? (
        <div className="py-16 flex items-center justify-center" style={{ color: EKARI.dim }}>
          <span className="ml-2">
            <BouncingBallLoader />
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div
            className="mx-auto mb-3 h-12 w-12 rounded-full grid place-items-center"
            style={{ backgroundColor: "#F3F4F6", color: EKARI.text }}
          >
            💬
          </div>
          <div className="font-extrabold" style={{ color: EKARI.text }}>
            No conversations found
          </div>
          <div className="text-sm mt-1" style={{ color: EKARI.dim }}>
            {qStr ? "Try clearing the search or filters." : "Start a chat from a profile to see it here."}
          </div>
        </div>
      ) : (
        <ul className="divide-y" style={{ borderColor: EKARI.hair }}>
          {filtered.map((item) => {
            const name = nameOf(item.peer);
            const last = previewOf(item.lastMessage) || "";
            const when = shortTime(item.lastMessage?.createdAt ?? item.updatedAt);
            const hasUnread = (item.unread ?? 0) > 0;

            return (
              <li key={item.threadId}>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className={clsx(
                    "w-full flex items-center gap-3 transition text-left hover:bg-black/5 focus:bg-black/5 focus:outline-none focus:ring-2",
                    isDesktop ? "px-4 py-3" : "px-3 py-3"
                  )}
                  onClick={() => openThread(item)}
                  aria-label={`Open chat with ${name}`}
                  style={ringStyle}
                >
                  <div className="relative">
                    <SmartAvatar
                      src={item.peer?.photoURL || ""}
                      alt={name}
                      size={46}
                      className={clsx(hasUnread && "ring-2")}
                    />
                    {hasUnread && (
                      <span
                        className="absolute -right-0.5 -bottom-0.5 w-[12px] h-[12px] rounded-full border-2"
                        title="Unread"
                        style={{ backgroundColor: EKARI.forest, borderColor: EKARI.sand }}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={clsx("truncate text-[15px]", hasUnread ? "font-black" : "font-extrabold")}
                        style={{ color: EKARI.text }}
                      >
                        {name}
                      </div>
                      <div className="ml-auto text-[11px]" style={{ color: EKARI.dim }}>
                        {when}
                      </div>
                    </div>

                    <div className="mt-0.5 flex items-center gap-2 min-w-0">
                      <div
                        className={clsx(
                          "truncate text-[13px]",
                          hasUnread ? "font-semibold" : "font-normal"
                        )}
                        style={{ color: hasUnread ? EKARI.text : EKARI.dim }}
                      >
                        {last || <span style={{ color: "#94A3B8" }}>No messages yet</span>}
                      </div>

                      {hasUnread && (
                        <span
                          className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold"
                          style={{ backgroundColor: EKARI.forest, color: EKARI.sand }}
                        >
                          {item.unread > 99 ? "99+" : item.unread}
                        </span>
                      )}
                    </div>
                  </div>

                  <IoChevronForward size={18} style={{ color: EKARI.sub }} className="hidden sm:block" />
                </motion.button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Load more */}
      {filtered.length > 0 && (
        <div className={clsx(isDesktop ? "p-6" : "p-4", "grid place-items-center")}>
          <button
            onClick={loadMore}
            disabled={paging || !cursor}
            className="h-10 rounded-lg px-4 border text-sm font-bold transition disabled:opacity-50"
            style={{
              borderColor: EKARI.hair,
              color: EKARI.text,
              backgroundColor: EKARI.sand,
            }}
          >
            {paging ? <BouncingBallLoader /> : cursor ? "Load more…" : "No more"}
          </button>
        </div>
      )}

      {/* Mobile: safe bottom spacer so last row doesn't touch browser bar */}
      {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
    </>
  );

  // MOBILE: fixed inset like Market, no bottom tabs, just sticky header + list
  // MOBILE: fixed inset + MobileBottomTabs (like Market)
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: EKARI.sand }}>
        {Header}

        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: "calc(84px + env(safe-area-inset-bottom))" }}
        >
          {Content}
        </div>

        <MobileBottomTabs onCreate={() => router.push("/search")} />
        <SideMenuSheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onNavigate={navigateFromMenu}
          items={fullMenu}
        />

      </div>
    );
  }


  // DESKTOP: AppShell + max width container like Market desktop
  return (
    <AppShell>
      <div className="min-h-screen w-full" style={{ backgroundColor: EKARI.sand }}>
        {Header}
        <div className="max-w-[1180px] mx-auto">{Content}</div>
      </div>
    </AppShell>
  );
}
