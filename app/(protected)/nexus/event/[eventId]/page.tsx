// app/nexus/event/[eventId]/page.tsx  (adjust path as needed)
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "@/lib/firebase";
import {
  IoCalendarOutline,
  IoLocationOutline,
  IoCashOutline,
  IoHeart,
  IoHeartOutline,
  IoBookmark,
  IoBookmarkOutline,
  IoShareSocialOutline,
  IoOpenOutline,
  IoCalendar,
  IoCheckmarkCircle,
} from "react-icons/io5";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import clsx from "clsx";
import { getCachedEvent } from "@/lib/eventCache";

export const dynamic = "force-dynamic";

/* currency type */
type CurrencyCode = "KES" | "USD";

type EventItem = {
  id: string;
  title: string;
  location?: string;
  dateISO?: string;
  price?: number;
  currency?: CurrencyCode;
  tags?: string[];
  category?: string;
  coverUrl?: string;
  description?: string;
  registrationUrl?: string;
  stats?: { likes?: number; saves?: number; shares?: number; rsvps?: number };
  counts?: { likes?: number; saves?: number; shares?: number; rsvps?: number };
  rsvps?: number;
};

const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
  sub: "#5C6B66",
};

const formatMoney = (n?: number, currency?: CurrencyCode) => {
  if (typeof n !== "number") return "";
  const cur: CurrencyCode = currency === "USD" || currency === "KES" ? currency : "KES";

  if (cur === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  }

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
};

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

export default function EventDetailsPage() {
  const router = useRouter();
  const params = useParams() as Record<string, string | string[]>;

  // support multiple param casings
  const eventIdRaw =
    (params?.eventId as any) ?? (params?.eventid as any) ?? (params?.eventID as any);

  const eventId = Array.isArray(eventIdRaw)
    ? eventIdRaw[0]
    : (eventIdRaw as string | undefined);

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

  const ringStyle: React.CSSProperties = {
    ["--tw-ring-color" as any]: EKARI.forest,
  };

  const goBack = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/nexus");
  }, [router]);

  const auth = getAuth();
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [me, setMe] = useState<any>(null);

  const [ev, setEv] = useState<EventItem | null>(null);
  const [loadingEv, setLoadingEv] = useState(true);

  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [going, setGoing] = useState(false);

  const [counts, setCounts] = useState<{
    likes?: number;
    saves?: number;
    shares?: number;
    rsvps?: number;
  }>({});
  const [rsvps, setRsvps] = useState<Array<{ userId: string; photoURL?: string }>>([]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUid(user?.uid ?? null));
    return unsub;
  }, [auth]);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists() && mountedRef.current) setMe(snap.data());
      } catch (e) {
        console.warn("load me failed", e);
      }
    })();
  }, [uid]);

  // Event + counts (prefer counts.* first)
  useEffect(() => {
    if (!eventId) {
      setLoadingEv(false);
      return;
    }

    // ✅ 1) hydrate immediately from cache (no fetch)
    const cached = getCachedEvent(eventId);
    if (cached) {
      setEv(cached as any);
      setLoadingEv(false);
    }

    // ✅ 2) subscribe for fresh data (optional but recommended)
    const pickNum = (...vals: any[]) => {
      for (const v of vals) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) return n;
      }
      return 0;
    };

    const unsub = onSnapshot(
      doc(db, "events", eventId),
      (snap) => {
        const exists = snap.exists();
        const data = (exists ? (snap.data() as any) : null) || {};

        setCounts({
          likes: pickNum(data?.counts?.likes, data?.stats?.likes, data?.likes),
          saves: pickNum(data?.counts?.saves, data?.stats?.saves, data?.saves),
          shares: pickNum(data?.counts?.shares, data?.stats?.shares, data?.shares),
          rsvps: pickNum(data?.counts?.rsvps, data?.stats?.rsvps, data?.rsvps),
        });

        setEv(exists ? { id: snap.id, ...(data as any) } : null);
        setLoadingEv(false);
      },
      () => {
        setEv(null);
        setLoadingEv(false);
      }
    );

    return unsub;
  }, [eventId]);


  // RSVPs avatars
  useEffect(() => {
    if (!eventId) return;
    const rRef = collection(db, "events", eventId, "rsvps");
    const unsub = onSnapshot(rRef, (snap) => {
      if (!mountedRef.current) return;
      const rows = snap.docs.map((d) => ({ userId: d.id, ...(d.data() as any) }));
      setRsvps(rows.slice(0, 12));
    });
    return unsub;
  }, [eventId]);

  // personal state docs
  useEffect(() => {
    if (!eventId || !uid) return;
    const likeId = `${eventId}_${uid}`;
    const a = onSnapshot(doc(db, "eventLikes", likeId), (s) => setLiked(s.exists()));
    const b = onSnapshot(doc(db, "eventBookmarks", likeId), (s) => setSaved(s.exists()));
    const c = onSnapshot(doc(db, "events", eventId, "rsvps", uid), (s) => setGoing(s.exists()));
    return () => {
      a();
      b();
      c();
    };
  }, [eventId, uid]);

  const requireAuth = useCallback(() => {
    if (!uid) {
      router.push("/login");
      return false;
    }
    return true;
  }, [router, uid]);

  const toggleLike = useCallback(async () => {
    if (!requireAuth() || !eventId || !uid) return;
    const likeRef = doc(db, "eventLikes", `${eventId}_${uid}`);
    if (liked) await deleteDoc(likeRef);
    else
      await setDoc(likeRef, {
        eventId,
        userId: uid,
        photoURL: me?.photoURL ?? null,
        createdAt: serverTimestamp(),
      });
  }, [eventId, uid, liked, me, requireAuth]);

  const toggleSave = useCallback(async () => {
    if (!requireAuth() || !eventId || !uid) return;
    const saveRef = doc(db, "eventBookmarks", `${eventId}_${uid}`);
    if (saved) await deleteDoc(saveRef);
    else
      await setDoc(saveRef, {
        eventId,
        userId: uid,
        photoURL: me?.photoURL ?? null,
        createdAt: serverTimestamp(),
      });
  }, [eventId, uid, saved, me, requireAuth]);

  const toggleRsvp = useCallback(async () => {
    if (!requireAuth() || !eventId || !uid) return;
    const rsvpRef = doc(db, "events", eventId, "rsvps", uid);
    if (going) await deleteDoc(rsvpRef);
    else
      await setDoc(rsvpRef, {
        userId: uid,
        photoURL: me?.photoURL ?? null,
        createdAt: serverTimestamp(),
      });
  }, [eventId, uid, going, me, requireAuth]);

  const shareEvent = useCallback(async () => {
    if (!ev) return;
    const message = `${ev.title} • ${ev.location || ""}${ev.dateISO ? " • " + new Date(ev.dateISO).toLocaleString() : ""
      }`;
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: ev.title, text: message, url });
      } else {
        await navigator.clipboard.writeText(`${message}\n${url}`);
        alert("Link copied to clipboard");
      }
      if (uid && eventId) {
        await setDoc(doc(db, "eventShares", `${eventId}_${uid}_${Date.now()}`), {
          eventId,
          userId: uid,
          photoURL: me?.photoURL ?? null,
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      /* ignore */
    }
  }, [ev, uid, eventId, me]);

  const onRegister = useCallback(() => {
    const url = ev?.registrationUrl;
    if (!url) return;
    try {
      const u = new URL(url);
      window.open(u.toString(), "_blank", "noopener,noreferrer");
    } catch {
      alert("Invalid link");
    }
  }, [ev?.registrationUrl]);

  const toMaps = (q?: string) =>
    q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "#";

  const organizerId = (ev as any)?.organizerId || null;
  const isOrganizer = !!uid && !!organizerId && uid === organizerId;

  /* ---------------- Header like discussion/bonga ---------------- */
  const Header = (
    <div
      className={clsx("border-b sticky top-0 z-50 backdrop-blur")}
      style={{ backgroundColor: "rgba(255,255,255,0.92)", borderColor: EKARI.hair }}
    >
      <div className={clsx(isDesktop ? "h-14 px-4 max-w-[1180px] mx-auto" : "h-14 px-3")}>
        <div className="h-full flex items-center justify-between gap-2">
          <button
            onClick={goBack}
            className="p-2 rounded-xl border transition hover:bg-black/5 focus:outline-none focus:ring-2"
            style={{ borderColor: EKARI.hair, ...ringStyle }}
            aria-label="Go back"
          >
            <ArrowLeft size={18} style={{ color: EKARI.text }} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-black text-[18px] leading-none truncate" style={{ color: EKARI.text }}>
              Event
            </div>
            <div className="text-[11px] mt-0.5 truncate" style={{ color: EKARI.dim }}>
              {ev?.title ?? ""}
            </div>
          </div>

          <div className="w-10" />
        </div>
      </div>
    </div>
  );

  /* ---------------- Content ---------------- */
  const Content = (
    <div className={clsx(isDesktop ? "max-w-[1180px] mx-auto" : "")}>
      {loadingEv ? (
        <div className="flex items-center justify-center py-24" style={{ color: EKARI.dim }}>
          <BouncingBallLoader />
        </div>
      ) : !ev ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-gray-500">Event not found.</div>
        </div>
      ) : (
        <>
          {/* HERO / COVER */}
          <div className={clsx(isDesktop ? "px-4 pt-4" : "")}>
            <div className="relative w-full overflow-hidden rounded-none md:rounded-2xl">
              <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] lg:aspect-[21/9]">
                <Image
                  src={ev.coverUrl || "/placeholder-wide.jpg"}
                  alt={ev.title}
                  fill
                  className="object-cover object-center"
                  sizes="100vw"
                  priority
                />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-black/10" />
              </div>
            </div>
          </div>

          {/* CARD */}
          <div className={clsx(isDesktop ? "px-4 pb-8" : "px-3 pb-8")} style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
            <div className={clsx(isDesktop ? "mt-4" : "relative -mt-6", "rounded-2xl bg-white shadow-sm ring-1 ring-gray-100")}>
              {/* Title & Category */}
              <div className="p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {ev.category && (
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white"
                      style={{ backgroundColor: EKARI.forest }}
                    >
                      {ev.category}
                    </span>
                  )}
                  {ev.tags?.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border"
                      style={{
                        color: EKARI.text,
                        borderColor: EKARI.hair,
                        backgroundColor: "#F9FAFB",
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                  {ev.tags && ev.tags.length > 3 && (
                    <span className="text-[11px] font-semibold text-gray-500">
                      +{ev.tags.length - 3} more
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: EKARI.text }}>
                  {ev.title}
                </h1>

                {/* Meta grid */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {!!ev.dateISO && (
                    <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: EKARI.hair }}>
                      <IoCalendarOutline size={18} color={EKARI.dim} />
                      <div className="text-sm font-semibold" style={{ color: EKARI.text }}>
                        {new Date(ev.dateISO).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {!!ev.location && (
                    <a
                      href={toMaps(ev.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 transition"
                      style={{ borderColor: EKARI.hair }}
                      title="Open in Google Maps"
                    >
                      <IoLocationOutline size={18} color={EKARI.dim} />
                      <div className="text-sm font-semibold" style={{ color: EKARI.text }}>
                        {ev.location}
                      </div>
                    </a>
                  )}

                  {typeof ev.price === "number" && (
                    <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: EKARI.hair }}>
                      <IoCashOutline size={18} color={EKARI.dim} />
                      <div className="text-sm font-semibold" style={{ color: EKARI.text }}>
                        {formatMoney(ev.price, ev.currency)}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: EKARI.hair }}>
                    <div className="flex -space-x-2">
                      {rsvps.slice(0, 6).map((u) => (
                        <div key={u.userId} className="relative w-7 h-7 rounded-full border-2 border-white overflow-hidden">
                          <Image
                            src={u.photoURL || "/avatar-placeholder.png"}
                            alt="avatar"
                            fill
                            className="object-cover"
                            sizes="28px"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="text-sm font-semibold" style={{ color: EKARI.text }}>
                      {counts.rsvps || 0} going
                    </div>

                    {isOrganizer && (
                      <button
                        onClick={() => router.push(`/nexus/event/${eventId}/people`)}
                        className="ml-auto text-xs font-extrabold px-3 py-1.5 rounded-full border hover:bg-gray-50"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                      >
                        See all
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-gray-100" />

              {/* Description */}
              {ev.description && (
                <div className="p-4 sm:p-6">
                  <h2 className="text-base font-black mb-2" style={{ color: EKARI.text }}>
                    About this event
                  </h2>
                  <p className="leading-7 text-[15px]" style={{ color: EKARI.text }}>
                    {ev.description}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="p-4 sm:p-6 pt-2 sm:pt-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="grid grid-cols-4 gap-2 sm:flex sm:gap-2 sm:flex-none">
                    <button
                      onClick={toggleLike}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border"
                      style={{ borderColor: "#E5E7EB", backgroundColor: "#F8FAFC" }}
                    >
                      {liked ? <IoHeart size={18} color="#DC2626" /> : <IoHeartOutline size={18} color={EKARI.text} />}
                      <span className="font-extrabold text-sm" style={{ color: EKARI.text }}>
                        {counts.likes || 0}
                      </span>
                    </button>

                    <button
                      onClick={toggleSave}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border"
                      style={{ borderColor: "#E5E7EB", backgroundColor: "#F8FAFC" }}
                    >
                      {saved ? <IoBookmark size={18} color={EKARI.forest} /> : <IoBookmarkOutline size={18} color={EKARI.text} />}
                      <span className="font-extrabold text-sm" style={{ color: EKARI.text }}>
                        {counts.saves || 0}
                      </span>
                    </button>

                    <button
                      onClick={shareEvent}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border"
                      style={{ borderColor: "#E5E7EB", backgroundColor: "#F8FAFC" }}
                    >
                      <IoShareSocialOutline size={18} color={EKARI.text} />
                      <span className="font-extrabold text-sm" style={{ color: EKARI.text }}>
                        {counts.shares || 0}
                      </span>
                    </button>

                    <button
                      onClick={toggleRsvp}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-white"
                      style={{ backgroundColor: going ? EKARI.forest : EKARI.gold }}
                    >
                      {going ? <IoCheckmarkCircle size={18} color="#fff" /> : <IoCalendar size={18} color="#fff" />}
                      <span className="font-black text-sm">{going ? "Going" : "RSVP"}</span>
                    </button>
                  </div>

                  {!!ev.registrationUrl && !going && (
                    <button
                      onClick={onRegister}
                      className="sm:ml-auto text-sm h-12 w-full sm:w-auto px-3 rounded-xl flex items-center justify-center gap-2 text-white font-black"
                      style={{ backgroundColor: EKARI.gold }}
                    >
                      <IoOpenOutline size={18} color="#fff" />
                      Register
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* bottom breathing room */}
            <div className="h-10" />
          </div>
        </>
      )}
    </div>
  );

  // Loading shell similar to discussion
  if (loadingEv && !ev) {
    return (
      <>
        {isMobile ? (
          <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: EKARI.sand }}>
            <BouncingBallLoader />
          </div>
        ) : (
          <AppShell>
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: EKARI.sand }}>
              <BouncingBallLoader />
            </div>
          </AppShell>
        )}
      </>
    );
  }

  // MOBILE: fixed inset, NO bottom tabs
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: EKARI.sand }}>
        {Header}
        <div className="flex-1 overflow-y-auto overscroll-contain">{Content}</div>
      </div>
    );
  }

  // DESKTOP: AppShell + max width like bonga/discussion
  return (
    <AppShell>
      <div className="min-h-screen w-full" style={{ backgroundColor: EKARI.sand }}>
        {Header}
        {Content}
      </div>
    </AppShell>
  );
}
