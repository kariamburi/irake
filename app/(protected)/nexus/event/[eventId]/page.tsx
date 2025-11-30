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
  IoArrowBack,
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
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

export const dynamic = "force-dynamic";

/* 👇 NEW: currency type */
type CurrencyCode = "KES" | "USD";

type EventItem = {
  id: string;
  title: string;
  location?: string;
  dateISO?: string;
  price?: number;
  currency?: CurrencyCode; // 👈 NEW: stored from create form
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
};

/* 👇 UPDATED: formatMoney now respects currency */
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

  // Default KES
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
};

export default function EventDetailsPage() {
  const router = useRouter();
  const params = useParams() as Record<string, string | string[]>;
  const eventId = Array.isArray(params?.eventId)
    ? params.eventId[0]
    : (params?.eventId as string | undefined);

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

  // Event + counts (supports stats/counts + top-level rsvps)
  useEffect(() => {
    if (!eventId) {
      setLoadingEv(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "events", eventId),
      (snap) => {
        const exists = snap.exists();
        const data = (exists ? (snap.data() as EventItem) : (null as any)) || {};
        const stats = (data.stats || data.counts || {}) as any;
        setCounts({
          likes: Number(stats.likes ?? 0),
          saves: Number(stats.saves ?? 0),
          shares: Number(stats.shares ?? 0),
          rsvps: Number(stats.rsvps ?? data.rsvps ?? 0),
        });
        setEv(exists ? { id: snap.id, ...data } : null);
        setLoadingEv(false);
      },
      (err) => {
        console.error("Firestore error loading event:", err?.code, err?.message);
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
    const message = `${ev.title} • ${ev.location || ""} ${ev.dateISO ? "• " + new Date(ev.dateISO).toLocaleString() : ""
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
        await setDoc(
          doc(db, "eventShares", `${eventId}_${uid}_${Date.now()}`),
          {
            eventId,
            userId: uid,
            photoURL: me?.photoURL ?? null,
            createdAt: serverTimestamp(),
          }
        );
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
    q
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
      : "#";

  return (
    <AppShell>
      <div className="min-h-screen w-full bg-white">
        {/* Header */}
        <div className="h-12 border-b border-gray-200 px-3 flex items-center justify-between sticky top-0 bg-white z-10">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full flex items-center justify-center border border-gray-200"
            aria-label="Back"
            title="Back"
          >
            <IoArrowBack size={18} color={EKARI.text} />
          </button>
          <div className="text-[18px] font-black" style={{ color: EKARI.text }}>
            Event
          </div>
          <div className="w-10" />
        </div>

        {/* Body */}
        {loadingEv ? (
          <div className="flex items-center justify-center py-24">
            <BouncingBallLoader />
          </div>
        ) : !ev ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-gray-500">Event not found.</div>
          </div>
        ) : (
          <>
            {/* HERO / COVER */}
            <div className="relative w-full overflow-hidden rounded-none md:rounded-b-2xl">
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

            {/* CARD */}
            <div className="mx-auto w-full max-w-4xl px-3">
              <div className="relative -mt-6 md:-mt-10 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
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

                  <h1
                    className="text-2xl sm:text-3xl font-black tracking-tight"
                    style={{ color: EKARI.text }}
                  >
                    {ev.title}
                  </h1>

                  {/* Meta grid */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {!!ev.dateISO && (
                      <div
                        className="flex items-center gap-2 rounded-xl border px-3 py-2"
                        style={{ borderColor: EKARI.hair }}
                      >
                        <IoCalendarOutline size={18} color={EKARI.dim} />
                        <div
                          className="text-sm font-semibold"
                          style={{ color: EKARI.text }}
                        >
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
                        <div
                          className="text-sm font-semibold"
                          style={{ color: EKARI.text }}
                        >
                          {ev.location}
                        </div>
                      </a>
                    )}
                    {typeof ev.price === "number" && (
                      <div
                        className="flex items-center gap-2 rounded-xl border px-3 py-2"
                        style={{ borderColor: EKARI.hair }}
                      >
                        <IoCashOutline size={18} color={EKARI.dim} />
                        <div
                          className="text-sm font-semibold"
                          style={{ color: EKARI.text }}
                        >
                          {/* 👇 NOW RESPECTS SAVED CURRENCY */}
                          {formatMoney(ev.price, ev.currency)}
                        </div>
                      </div>
                    )}
                    <div
                      className="flex items-center gap-2 rounded-xl border px-3 py-2"
                      style={{ borderColor: EKARI.hair }}
                    >
                      <div className="flex -space-x-2">
                        {rsvps.slice(0, 6).map((u) => (
                          <div
                            key={u.userId}
                            className="relative w-7 h-7 rounded-full border-2 border-white overflow-hidden"
                          >
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
                      <div
                        className="text-sm font-semibold"
                        style={{ color: EKARI.text }}
                      >
                        {counts.rsvps || 0} going
                      </div>
                      <button
                        onClick={() =>
                          router.push(`/nexus/event/${eventId}/people`)
                        }
                        className="ml-auto text-xs font-extrabold px-3 py-1.5 rounded-full border hover:bg-gray-50"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                      >
                        See all
                      </button>
                    </div>
                  </div>
                </div>

                {/* Separator */}
                <div className="h-px w-full bg-gray-100" />

                {/* Description */}
                {ev.description && (
                  <div className="p-4 sm:p-6">
                    <h2
                      className="text-base font-black mb-2"
                      style={{ color: EKARI.text }}
                    >
                      About this event
                    </h2>
                    <p
                      className="leading-7 text-[15px]"
                      style={{ color: EKARI.text }}
                    >
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
                        style={{
                          borderColor: "#E5E7EB",
                          backgroundColor: "#F8FAFC",
                        }}
                      >
                        {liked ? (
                          <IoHeart size={18} color="#DC2626" />
                        ) : (
                          <IoHeartOutline size={18} color={EKARI.text} />
                        )}
                        <span
                          className="font-extrabold text-sm"
                          style={{ color: EKARI.text }}
                        >
                          {counts.likes || 0}
                        </span>
                      </button>

                      <button
                        onClick={toggleSave}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border"
                        style={{
                          borderColor: "#E5E7EB",
                          backgroundColor: "#F8FAFC",
                        }}
                      >
                        {saved ? (
                          <IoBookmark size={18} color={EKARI.forest} />
                        ) : (
                          <IoBookmarkOutline
                            size={18}
                            color={EKARI.text}
                          />
                        )}
                        <span
                          className="font-extrabold text-sm"
                          style={{ color: EKARI.text }}
                        >
                          {counts.saves || 0}
                        </span>
                      </button>

                      <button
                        onClick={shareEvent}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border"
                        style={{
                          borderColor: "#E5E7EB",
                          backgroundColor: "#F8FAFC",
                        }}
                      >
                        <IoShareSocialOutline
                          size={18}
                          color={EKARI.text}
                        />
                        <span
                          className="font-extrabold text-sm"
                          style={{ color: EKARI.text }}
                        >
                          {counts.shares || 0}
                        </span>
                      </button>

                      <button
                        onClick={toggleRsvp}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-white"
                        style={{
                          backgroundColor: going
                            ? EKARI.forest
                            : EKARI.gold,
                        }}
                      >
                        {going ? (
                          <IoCheckmarkCircle size={18} color="#fff" />
                        ) : (
                          <IoCalendar size={18} color="#fff" />
                        )}
                        <span className="font-black text-sm">
                          {going ? "Going" : "RSVP"}
                        </span>
                      </button>
                    </div>

                    {!!ev.registrationUrl && !going && (
                      <button
                        onClick={onRegister}
                        className="sm:ml-auto h-12 w-full sm:w-auto rounded-xl flex items-center justify-center gap-2 text-white font-black"
                        style={{ backgroundColor: EKARI.gold }}
                      >
                        <IoOpenOutline size={18} color="#fff" />
                        Register
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* subtle bottom space */}
              <div className="h-10" />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
