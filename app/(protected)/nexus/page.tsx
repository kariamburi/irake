"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  PropsWithChildren,
  ReactNode,
} from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  startAfter,
  getDocs,
  where,
  DocumentData,
  QueryDocumentSnapshot,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  getFirestore,
} from "firebase/firestore";
import { ref as sRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import {
  IoAdd,
  IoChatbubblesOutline,
  IoChatbubbleEllipsesOutline,
  IoCalendarOutline,
  IoLocationOutline,
  IoSearch,
  IoCloseCircle,
  IoCompassOutline,
  IoTimeOutline,
  IoReload,
  IoClose,
  IoImageOutline,
  IoPricetagsOutline,
  IoCashOutline,
  IoHomeOutline,
  IoCartOutline,
  IoChevronForward,
  IoInformationCircleOutline,
  IoPersonCircleOutline,
  IoNotificationsOutline,
  IoMenu,
  IoSparklesOutline,
} from "react-icons/io5";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import AppShell from "@/app/components/AppShell";
import { createPortal } from "react-dom";
import { useAuth } from "@/app/hooks/useAuth";

// Hashtag picker + suggestions
import HashtagPicker from "@/app/components/HashtagPicker";
import { useInitEkariTags } from "@/app/hooks/useInitEkariTags";
import { useTrendingTags } from "@/app/hooks/useTrendingTags";
import { buildEkariTrending } from "@/utils/ekariTags";
import { usePathname } from "next/navigation";
import { useInboxTotalsWeb } from "@/hooks/useInboxTotalsWeb";
import { cacheEvent } from "@/lib/eventCache";
import { cacheDiscussion } from "@/lib/discussionCache";

/* ---------- Theme ---------- */
const EKARI = {
  forest: "#233F39",
  gold: "#C79257",
  sand: "#FFFFFF",
  text: "#0F172A",
  dim: "#6B7280",
  hair: "#E5E7EB",
};
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

/* ---------- Responsive helpers ---------- */
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
function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- Types ---------- */
type DiveTab = "events" | "discussions";
type EventCategory = "Workshop" | "Fair" | "Training" | "Meetup" | "Other";
type DiscCategory =
  | "General"
  | "Seeds"
  | "Soil"
  | "Equipment"
  | "Market"
  | "Regulations"
  | "Other";

type CurrencyCode = "KES" | "USD";

type EventItem = {
  id: string;
  title: string;
  dateISO?: string;
  location?: string;
  coverUrl?: string;
  author?: any;
  authorBadge?: any;
  createdAt?: any;
  price?: number | null;
  currency?: CurrencyCode;
  registrationUrl?: string | null;
  category?: EventCategory;
  tags?: string[];
  description?: string | null;
};

type DiscussionItem = {
  id: string;
  title: string;
  body?: string;
  authorId?: string;
  author?: any;
  authorBadge?: any;
  createdAt?: any;
  repliesCount?: number;
  category?: DiscCategory;
  tags?: string[];
  published?: boolean;
};

/* ---------- Filters ---------- */
const EVENT_FILTERS: Array<EventCategory | "All"> = [
  "All",
  "Workshop",
  "Training",
  "Fair",
  "Meetup",
  "Other",
];
const DISC_FILTERS: Array<DiscCategory | "All"> = [
  "All",
  "General",
  "Seeds",
  "Soil",
  "Equipment",
  "Market",
  "Regulations",
  "Other",
];

/* ---------- Hashtag helpers ---------- */
const asArray = (v: unknown): string[] => {
  if (!v) return [];
  if (Array.isArray(v))
    return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

/* ---------- Hashtag suggestions hook ---------- */
function useHashtagSuggestions(uid: string | null) {
  const [profile, setProfile] = useState<any | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }

    (async () => {
      try {
        const uRef = doc(db, "users", uid);
        const snap = await getDoc(uRef);
        setProfile(snap.exists() ? (snap.data() as any) : null);
      } catch {
        setProfile(null);
      }
    })();
  }, [uid]);

  const userRoles = asArray(profile?.roles);
  const userInterests = asArray(profile?.areaOfInterest);
  const userCountry = profile?.country || "kenya";
  const userCounty = profile?.county || undefined;

  const { list: liveTrending, meta, loading } = useTrendingTags();

  const trending = useMemo(() => {
    const base = buildEkariTrending({
      country: userCountry,
      county: userCounty,
      profile: {
        country: userCountry,
        roles: userRoles,
        areaOfInterest: userInterests,
      },
      crops: userInterests,
      limit: 800,
    });
    const merged = [...(liveTrending || []), ...base];
    return Array.from(new Set(merged));
  }, [liveTrending, userCountry, userCounty, userRoles, userInterests]);

  return {
    loading,
    trending,
    trendingMeta: meta,
  };
}

/* ============================== */
/* Centered Modal Primitive       */
/* ============================== */
function BottomSheet({
  open,
  onClose,
  children,
  title,
  footer,
}: PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
}>) {
  const [mounted, setMounted] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) setSheetVisible(true);
    else setSheetVisible(false);
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-label="Close modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={[
          "relative w-full max-w-2xl rounded-3xl border bg-white shadow-xl",
          "flex flex-col max-h-[90vh] px-4 pt-3 pb-4",
          "transition-all duration-200 transform",
          sheetVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-3 scale-95",
        ].join(" ")}
        style={{ borderColor: EKARI.hair }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {title && (
              <h3 className="text-base font-black" style={{ color: EKARI.text }}>
                {title}
              </h3>
            )}
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border bg-white hover:bg-gray-50"
            style={{ borderColor: EKARI.hair }}
          >
            <IoClose />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 mt-1 space-y-3">
          {children}
        </div>

        {footer && (
          <div className="mt-3 border-t pt-3" style={{ borderColor: EKARI.hair }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ============================== */
/* Banner Uploader (Pro)          */
/* ============================== */
function formatBytes(bytes: number) {
  if (!bytes && bytes !== 0) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    sizes.length - 1
  );
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function BannerUploader({
  previewUrl,
  onPick,
  onRemove,
  ekari,
  accept = "image/*",
  maxSizeMB = 5,
}: {
  previewUrl: string | null;
  onPick: (file: File, objectUrl: string) => void;
  onRemove: () => void;
  ekari: typeof EKARI;
  accept?: string;
  maxSizeMB?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const maxBytes = maxSizeMB * 1024 * 1024;

  const choose = () => inputRef.current?.click();

  const handleFiles = (files?: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
    if (f.size > maxBytes) {
      alert(
        `Max file size is ${maxSizeMB}MB (you chose ${formatBytes(f.size)}).`
      );
      return;
    }
    const url = URL.createObjectURL(f);
    onPick(f, url);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-extrabold" style={{ color: ekari.dim }}>
          Banner image
        </div>
        <div className="text-[11px]" style={{ color: ekari.dim }}>
          Recommended: 16:9 • ≥ 1280×720 • JPG/PNG • ≤ {maxSizeMB}MB
        </div>
      </div>

      {!previewUrl ? (
        <div
          role="button"
          tabIndex={0}
          onClick={choose}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && choose()}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed bg-[#F9FAFB] transition
            ${dragOver
              ? "border-[--ekari-forest] ring-2 ring-[--ekari-forest]/10"
              : "border-gray-200"
            }`}
          style={{ ["--ekari-forest" as any]: ekari.forest }}
        >
          <div className="px-5 py-8 text-center">
            <div
              className="mx-auto mb-3 h-12 w-12 rounded-full grid place-items-center border bg-white"
              style={{ borderColor: ekari.hair }}
            >
              <IoImageOutline className="opacity-70" />
            </div>
            <div className="font-bold" style={{ color: ekari.text }}>
              Add banner image
            </div>
            <p className="text-xs mt-1" style={{ color: ekari.dim }}>
              Drag & drop, or click to browse
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={choose}
                className="rounded-xl px-4 h-10 font-bold text-white"
                style={{ background: ekari.forest }}
              >
                Choose image
              </button>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      ) : (
        <div
          className="relative rounded-2xl overflow-hidden border bg-black aspect-[16/9]"
          style={{ borderColor: ekari.hair }}
        >
          {/* @ts-ignore */}
          <Image
            src={previewUrl}
            alt="Event banner preview"
            fill
            className="object-cover"
            unoptimized
          />

          <div className="absolute top-0 left-0 right-0 p-2 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent">
            <span className="text-[11px] font-bold text-white/90 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur">
              16:9 recommended
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 flex gap-2 justify-end bg-gradient-to-t from-black/45 to-transparent">
            <button
              type="button"
              onClick={choose}
              className="h-9 px-3 rounded-lg font-bold text-sm text-white/95 hover:text-white bg-white/10 hover:bg-white/15 backdrop-blur"
            >
              Change
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="h-9 px-3 rounded-lg font-bold text-sm text-white/95 hover:text-white bg-white/10 hover:bg-white/15 backdrop-blur"
            >
              Remove
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px]" style={{ color: ekari.dim }}>
          Tip: landscape images look best. Avoid heavy text on the banner.
        </span>
        <button
          type="button"
          onClick={() => alert("Coming soon: in-app cropping")}
          className="text-[11px] font-bold underline underline-offset-2 hover:opacity-80"
          style={{ color: ekari.text }}
        >
          Crop?
        </button>
      </div>
    </div>
  );
}

/* ============================== */
/* Money helper                   */
/* ============================== */
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

/* ============================== */
/* Event Create Form (Sheet)      */
/* ============================== */
function EventForm({
  onDone,
  provideFooter,
}: {
  onDone: () => void;
  provideFooter: (node: ReactNode) => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const { loading, trending, trendingMeta } = useHashtagSuggestions(uid);

  type Step = 0 | 1 | 2;
  const [step, setStep] = useState<Step>(0);

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [dateISO, setDateISO] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<EventCategory>("Workshop");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("KES");
  const [registrationUrl, setRegistrationUrl] = useState("");
  const [description, setDescription] = useState("");

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const handlePickBanner = (file: File, url: string) => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(url);
  };
  const handleRemoveBanner = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview(null);
  };

  const [eventTags, setEventTags] = useState<string[]>([]);

  const captionTags = useMemo(() => {
    const text = `${title}\n${description}`;
    return (text.match(/#([A-Za-z0-9_]{2,30})/g) || []).map((s) =>
      s.slice(1).toLowerCase()
    );
  }, [title, description]);

  const mergedTags = useMemo(
    () => Array.from(new Set([...eventTags.map((t) => t.toLowerCase()), ...captionTags])),
    [eventTags, captionTags]
  );

  const dateHint = useMemo(() => {
    if (!dateISO) return "";
    const d = new Date(dateISO);
    return Number.isNaN(d.getTime())
      ? ""
      : `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
  }, [dateISO]);

  const [userProfile, setUserProfile] = useState<any | null>(null);
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const uRef = doc(db, "users", uid);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          const data = uSnap.data() as any;
          setUserProfile(data);
          const pref = data?.preferredCurrency;
          if (pref === "USD" || pref === "KES") setCurrency(pref);
        }
      } catch { }
    })();
  }, [uid]);

  const canNextFromBasics = useMemo(() => {
    if (!title.trim()) return false;
    if (dateISO) {
      const d = new Date(dateISO);
      if (Number.isNaN(d.getTime())) return false;
      if (Date.now() > d.getTime()) return false;
    }
    return true;
  }, [title, dateISO]);

  const canNextFromTags = mergedTags.length > 0;

  const save = useCallback(async () => {
    if (!uid) {
      alert("Please sign in to create an event.");
      return;
    }
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    try {
      setSaving(true);
      const refDoc = doc(collection(db, "events"));
      let coverUrl: string | null = null;

      if (coverFile) {
        const storageRef = sRef(storage, `events/${uid}/${refDoc.id}/cover.jpg`);
        await uploadBytes(storageRef, coverFile, {
          contentType: coverFile.type || "image/jpeg",
        });
        coverUrl = await getDownloadURL(storageRef);
      }

      const priceNum =
        price && /[0-9]/.test(price)
          ? Number(price.replace(/[^\d.]/g, ""))
          : null;
      const badge = buildAuthorBadge(userProfile);
      await setDoc(refDoc, {
        title: title.trim(),
        dateISO: dateISO || null,
        location: location || null,
        coverUrl,
        organizerId: uid,
        author: {
          id: uid,
          name: userProfile?.firstName + " " + userProfile?.surname,
          handle: userProfile?.handle ?? null,
          photoURL: userProfile?.photoURL ?? null,
        },
        authorBadge: badge,
        createdAt: serverTimestamp(),
        price: priceNum,
        currency: priceNum ? currency : null,
        registrationUrl: registrationUrl || null,
        category,
        tags: mergedTags,
        description: description.trim() || null,
        visibility: "public",
      });

      setSaving(false);
      onDone();
    } catch (e: any) {
      console.error(e);
      setSaving(false);
      alert(`Failed to create event: ${e?.message || "Try again"}`);
    }
  }, [
    uid,
    title,
    dateISO,
    location,
    coverFile,
    price,
    currency,
    registrationUrl,
    category,
    mergedTags,
    description,
    onDone,
  ]);

  const totalSteps = 3;
  const nextStep: Record<Step, Step> = { 0: 1, 1: 2, 2: 2 };
  const prevStep: Record<Step, Step> = { 0: 0, 1: 0, 2: 1 };
  const goNext = () => setStep((s) => nextStep[s]);
  const goBack = () => setStep((s) => prevStep[s]);

  useEffect(() => {
    if (step === 0) {
      provideFooter(
        <div className="flex gap-2">
          <button
            onClick={onDone}
            className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
          >
            Cancel
          </button>
          <button
            onClick={goNext}
            disabled={!canNextFromBasics}
            className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
            style={{ background: EKARI.gold }}
          >
            Next
          </button>
        </div>
      );
    } else if (step === 1) {
      provideFooter(
        <div className="flex gap-2">
          <button
            onClick={goBack}
            className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
          >
            Back
          </button>
          <button
            onClick={goNext}
            disabled={!canNextFromTags}
            className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
            style={{ background: EKARI.gold }}
          >
            Next
          </button>
        </div>
      );
    } else {
      provideFooter(
        <div className="flex gap-2">
          <button
            onClick={goBack}
            className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            disabled={saving}
          >
            Back
          </button>
          <button
            onClick={save}
            className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
            style={{ background: EKARI.gold }}
            disabled={saving}
          >
            {saving ? "Saving…" : "Publish Event"}
          </button>
        </div>
      );
    }
  }, [
    step,
    canNextFromBasics,
    canNextFromTags,
    save,
    onDone,
    saving,
    provideFooter,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
            Step
          </span>
          <span className="text-xs font-black" style={{ color: EKARI.text }}>
            {step + 1}/{totalSteps}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${step >= i ? "bg-[--ekari-forest]" : "bg-gray-300"
                }`}
              style={{ ["--ekari-forest" as any]: EKARI.forest }}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <input
            placeholder="Event title"
            className="h-11 w-full rounded-xl border px-3 text-sm bg-white"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="datetime-local"
              className="h-11 rounded-xl border px-3 text-sm"
              style={{ borderColor: EKARI.hair, color: EKARI.text }}
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
            />
            <input
              placeholder="Location"
              className="h-11 rounded-xl border px-3 text-sm"
              style={{ borderColor: EKARI.hair, color: EKARI.text }}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {!!dateISO && (
            <div
              className="flex items-center gap-2 rounded-xl border px-3 py-2 bg-[#F9FAFB]"
              style={{ borderColor: EKARI.hair }}
            >
              <IoTimeOutline color={EKARI.dim} />
              <div className="text-sm">
                <span className="font-bold mr-1" style={{ color: EKARI.dim }}>
                  Selected:
                </span>
                <span className="font-extrabold" style={{ color: EKARI.text }}>
                  {dateHint}
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
              Category
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["Workshop", "Training", "Fair", "Meetup", "Other"] as EventCategory[]).map(
                (c) => {
                  const active = c === category;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className="h-8 rounded-full px-3 border text-xs font-bold"
                      style={{
                        borderColor: active ? EKARI.forest : "#eee",
                        background: active ? EKARI.forest : "#f5f5f5",
                        color: active ? "#fff" : EKARI.text,
                      }}
                    >
                      {c}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 text-sm font-extrabold"
            style={{ color: EKARI.text }}
          >
            <IoPricetagsOutline /> Select tags
          </div>

          <div className="relative overflow-visible pb-24">
            <HashtagPicker
              value={eventTags}
              onChange={setEventTags}
              ekari={EKARI}
              trending={trending}
              trendingMeta={trendingMeta}
              max={10}
              showCounter
              placeholder={
                loading
                  ? "Loading suggestions…"
                  : "Type # to add… e.g. #maize #irrigation"
              }
            />
          </div>

          <p className="text-xs" style={{ color: EKARI.dim }}>
            Tip: you can also type <span className="font-bold">#tags</span> in
            your title/description—we’ll auto-pick them.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <input
                placeholder={currency === "KES" ? "Price (optional, KSh)" : "Price (optional, USD)"}
                className="h-11 w-full rounded-xl border px-3 text-sm"
                style={{ borderColor: EKARI.hair, color: EKARI.text }}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="shrink-0">
              <div
                className="inline-flex rounded-full bg-[#F3F4F6] p-1 border"
                style={{ borderColor: EKARI.hair }}
              >
                {(["KES", "USD"] as CurrencyCode[]).map((c) => {
                  const active = c === currency;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className={cn(
                        "px-3 h-7 rounded-full text-[11px] font-bold",
                        active ? "bg-white shadow-sm" : "bg-transparent"
                      )}
                      style={{ color: active ? EKARI.forest : EKARI.dim }}
                    >
                      {c === "KES" ? "KSh" : "USD"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <input
            placeholder="Registration link (optional)"
            className="h-11 w-full rounded-xl border px-3 text-sm"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            value={registrationUrl}
            onChange={(e) => setRegistrationUrl(e.target.value)}
            autoCapitalize="none"
          />
          <textarea
            placeholder="Description (optional)"
            rows={5}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <BannerUploader
            previewUrl={coverPreview}
            onPick={handlePickBanner}
            onRemove={handleRemoveBanner}
            ekari={EKARI}
          />
        </div>
      )}
    </div>
  );
}

/* ============================== */
/* Discussion Create Form (Sheet) */
/* ============================== */
type AuthorBadge = {
  verificationStatus?: "approved" | "pending" | "rejected" | "none";
  verificationType?: "individual" | "business" | "company" | "organization";
  verificationRoleLabel?: string | null;
  verificationOrganizationName?: string | null;
};

function pruneUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  Object.keys(obj).forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

function buildAuthorBadge(userProfile: any): AuthorBadge | undefined {
  if (!userProfile) return undefined;

  // Adjust these mappings to match your real user doc shape
  const status =
    userProfile?.verification?.status || // you already use this in SellModal
    userProfile?.verified?.status ||
    userProfile?.verificationStatus ||
    (userProfile?.verified ? "approved" : "none");

  const type =
    userProfile?.verification?.type ||
    userProfile?.verified?.type ||
    userProfile?.verificationType ||
    "individual";

  const roleLabel =
    userProfile?.verification?.roleLabel ||
    userProfile?.verified?.roleLabel ||
    userProfile?.verificationRoleLabel ||
    userProfile?.roleLabel ||
    null;

  const orgName =
    userProfile?.verification?.organizationName ||
    userProfile?.verified?.organizationName ||
    userProfile?.verificationOrganizationName ||
    null;

  return pruneUndefined({
    verificationStatus: (status || "none") as AuthorBadge["verificationStatus"],
    verificationType: (type || "individual") as AuthorBadge["verificationType"],
    verificationRoleLabel: roleLabel ? String(roleLabel).trim() : null,
    verificationOrganizationName: orgName ? String(orgName).trim() : null,
  }) as AuthorBadge;
}
function DiscussionForm({
  onDone,
  provideFooter,
}: {
  onDone: () => void;
  provideFooter: (node: ReactNode) => void;
}) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<DiscCategory>("General");

  const { loading, trending, trendingMeta } = useHashtagSuggestions(uid);

  const [tags, setTags] = useState<string[]>([]);
  type Step = 0 | 1;
  const [step, setStep] = useState<Step>(0);
  const totalSteps = 2;

  const canNextFromBasics = title.trim().length > 0;

  const captionTags = useMemo(() => {
    const text = `${title}\n${body}`;
    return (text.match(/#([A-Za-z0-9_]{2,30})/g) || []).map((s) =>
      s.slice(1).toLowerCase()
    );
  }, [title, body]);

  const mergedTags = useMemo(
    () => Array.from(new Set([...tags.map((t) => t.toLowerCase()), ...captionTags])),
    [tags, captionTags]
  );

  const canPublish = mergedTags.length > 0;
  const [userProfile, setUserProfile] = useState<any | null>(null);
  useEffect(() => {

    if (!user) return;

    const db = getFirestore();
    (async () => {
      try {
        const uRef = doc(db, "users", user.uid);
        const uSnap = await getDoc(uRef);
        if (uSnap.exists()) {
          const data = uSnap.data() as any;
          setUserProfile(data);
        }
      } catch (e) {
        console.warn("Failed to load user profile for trending tags", e);
      }
    })();
  }, []);
  const save = useCallback(async () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }
    if (!uid) {
      alert("Please sign in to start a discussion.");
      return;
    }

    try {
      setSaving(true);
      const refDoc = doc(collection(db, "discussions"));
      const badge = buildAuthorBadge(userProfile);
      await setDoc(refDoc, {
        title: title.trim(),
        body: body.trim() || null,
        authorId: uid,
        author: {
          id: uid,
          name: userProfile?.firstName + " " + userProfile?.surname,
          handle: userProfile?.handle ?? null,
          photoURL: userProfile?.photoURL ?? null,
        },
        authorBadge: badge,
        createdAt: serverTimestamp(),
        repliesCount: 0,
        category,
        tags: mergedTags,
        published: true,
      });

      setSaving(false);
      onDone();
    } catch (e: any) {
      console.error(e);
      setSaving(false);
      alert(`Failed to start discussion: ${e?.message || "Try again"}`);
    }
  }, [title, body, uid, category, mergedTags, onDone]);

  const goNext = () => setStep(1);
  const goBack = () => setStep(0);

  useEffect(() => {
    if (step === 0) {
      provideFooter(
        <div className="flex gap-2">
          <button
            onClick={onDone}
            className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={goNext}
            disabled={!canNextFromBasics || saving}
            className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
            style={{ background: EKARI.gold }}
          >
            Next
          </button>
        </div>
      );
    } else {
      provideFooter(
        <div className="flex gap-2">
          <button
            onClick={goBack}
            className="h-11 px-4 rounded-xl border font-bold bg-white flex-1"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            disabled={saving}
          >
            Back
          </button>
          <button
            onClick={save}
            disabled={!canPublish || saving}
            className="h-11 px-4 rounded-xl font-bold text-white disabled:opacity-60 flex-1"
            style={{ background: EKARI.gold }}
          >
            {saving ? "Posting…" : "Start Discussion"}
          </button>
        </div>
      );
    }
  }, [
    step,
    saving,
    canNextFromBasics,
    canPublish,
    onDone,
    provideFooter,
    save,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
            Step
          </span>
          <span className="text-xs font-black" style={{ color: EKARI.text }}>
            {step + 1}/{totalSteps}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full ${step >= i ? "bg-[--ekari-forest]" : "bg-gray-300"
                }`}
              style={{ ["--ekari-forest" as any]: EKARI.forest }}
            />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <input
            placeholder="Discussion title"
            className="h-11 w-full rounded-xl border px-3 text-sm bg-white"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div>
            <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
              Category
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                ["General", "Seeds", "Soil", "Equipment", "Market", "Regulations", "Other"] as DiscCategory[]
              ).map((c) => {
                const active = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className="h-8 rounded-full px-3 border text-xs font-bold"
                    style={{
                      borderColor: active ? EKARI.forest : "#eee",
                      background: active ? EKARI.forest : "#f5f5f5",
                      color: active ? "#fff" : EKARI.text,
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <textarea
            placeholder="Describe your topic (optional)"
            rows={6}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <div
            className="flex items-center gap-2 text-sm font-extrabold"
            style={{ color: EKARI.text }}
          >
            <IoPricetagsOutline /> Select tags
          </div>

          <div className="relative overflow-visible pb-24">
            <HashtagPicker
              value={tags}
              onChange={setTags}
              ekari={EKARI}
              trending={trending}
              trendingMeta={trendingMeta}
              max={10}
              showCounter
              placeholder={
                loading
                  ? "Loading suggestions…"
                  : "Type # to add… e.g. #market #seedlings"
              }
            />
          </div>

          <p className="text-xs" style={{ color: EKARI.dim }}>
            Add at least one tag so others can find your topic.
          </p>
        </div>
      )}
    </div>
  );
}

/* ============================== */
/* Mobile bottom tabs (LIGHT)     */
/* ============================== */
function MobileBottomTabs({ onCreate }: { onCreate: () => void }) {
  const TabBtn = ({
    label,
    icon,
    href,
    active,
  }: {
    label: string;
    icon: React.ReactNode;
    href: string;
    active?: boolean;
  }) => (
    <Link
      href={href}
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
    </Link>
  );

  const isNexusActive = true; // because this file is /nexus/page.tsx

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
        <TabBtn label="Deeds" icon={<IoHomeOutline size={20} />} href="/" />
        <TabBtn label="ekariMarket" icon={<IoCartOutline size={20} />} href="/market" />

        <button
          onClick={onCreate}
          className="h-12 w-16 rounded-2xl grid place-items-center shadow-lg"
          style={{ backgroundColor: EKARI.gold }}
          aria-label="Create"
        >
          <IoAdd size={26} color="#111827" />
        </button>

        <TabBtn
          label="Nexus"
          icon={<IoCompassOutline size={20} />}
          href="/nexus"
          active={isNexusActive}
        />
        <TabBtn label="Bonga" icon={<IoChatbubblesOutline size={20} />} href="/bonga" />
      </div>
    </div>
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
/* ============================== */
/* Main Page                      */
/* ============================== */
export default function DivePage() {
  useInitEkariTags();

  const isMobile = useIsMobile();
  const isDesktop = useIsDesktop();

  const [active, setActive] = useState<DiveTab>("events");
  const [queryInput, setQueryInput] = useState("");
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState<EventCategory | "All">("All");
  const [discFilter, setDiscFilter] = useState<DiscCategory | "All">("All");

  /* Search debounce */
  useEffect(() => {
    const t = setTimeout(() => setQ(queryInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [queryInput]);

  /* Firestore state */
  const [events, setEvents] = useState<EventItem[]>([]);
  const [discs, setDiscs] = useState<DiscussionItem[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingDiscs, setLoadingDiscs] = useState(true);
  const [pagingEvents, setPagingEvents] = useState(false);
  const [pagingDiscs, setPagingDiscs] = useState(false);

  const eventsAfter = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const discsAfter = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const { user } = useAuth();
  const uid = user?.uid;

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

  const loadEvents = useCallback(() => {
    setLoadingEvents(true);
    const qRef = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(20));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EventItem[];
        setEvents(rows);
        eventsAfter.current = snap.docs[snap.docs.length - 1] || null;
        setLoadingEvents(false);
      },
      () => {
        setEvents([]);
        eventsAfter.current = null;
        setLoadingEvents(false);
      }
    );
    return unsub;
  }, []);

  const loadDiscs = useCallback(() => {
    setLoadingDiscs(true);
    const qRef = query(
      collection(db, "discussions"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DiscussionItem[];
        setDiscs(rows);
        discsAfter.current = snap.docs[snap.docs.length - 1] || null;
        setLoadingDiscs(false);
      },
      () => {
        setDiscs([]);
        discsAfter.current = null;
        setLoadingDiscs(false);
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    const u1 = loadEvents();
    const u2 = loadDiscs();
    return () => {
      u1?.();
      u2?.();
    };
  }, [loadEvents, loadDiscs]);

  const loadMoreEvents = useCallback(async () => {
    if (pagingEvents || !eventsAfter.current) return;
    setPagingEvents(true);
    try {
      const qRef = query(
        collection(db, "events"),
        orderBy("createdAt", "desc"),
        startAfter(eventsAfter.current),
        limit(20)
      );
      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as EventItem[];
      setEvents((prev) => [...prev, ...rows]);
      eventsAfter.current = snap.docs[snap.docs.length - 1] || null;
    } finally {
      setPagingEvents(false);
    }
  }, [pagingEvents]);

  const loadMoreDiscs = useCallback(async () => {
    if (pagingDiscs || !discsAfter.current) return;
    setPagingDiscs(true);
    try {
      const qRef = query(
        collection(db, "discussions"),
        where("published", "==", true),
        orderBy("createdAt", "desc"),
        startAfter(discsAfter.current),
        limit(20)
      );
      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DiscussionItem[];
      setDiscs((prev) => [...prev, ...rows]);
      discsAfter.current = snap.docs[snap.docs.length - 1] || null;
    } finally {
      setPagingDiscs(false);
    }
  }, [pagingDiscs]);

  const filteredEvents = useMemo(() => {
    const list = eventFilter === "All" ? events : events.filter((e) => e.category === eventFilter);
    if (!q) return list;
    return list.filter((e) => {
      const t = `${e.title || ""} ${e.location || ""} ${e.description || ""}`.toLowerCase();
      const tags = (e.tags || []).join(" ").toLowerCase();
      return t.includes(q) || tags.includes(q);
    });
  }, [events, eventFilter, q]);

  const filteredDiscs = useMemo(() => {
    const list = discFilter === "All" ? discs : discs.filter((d) => d.category === discFilter);
    if (!q) return list;
    return list.filter((d) => {
      const t = `${d.title || ""} ${d.body || ""}`.toLowerCase();
      const tags = (d.tags || []).join(" ").toLowerCase();
      return t.includes(q) || tags.includes(q);
    });
  }, [discs, discFilter, q]);

  /* ---------- BottomSheet state ---------- */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetFooter, setSheetFooter] = useState<ReactNode>(null);
  const provideFooter = useCallback((node: ReactNode) => setSheetFooter(node), []);

  const ringStyle = { ["--tw-ring-color" as any]: EKARI.forest } as React.CSSProperties;

  const Controls = (
    <div className="w-full">
      <div className="px-3 py-3 flex items-center gap-2">

        <div
          className="flex-1 h-10 rounded-full bg-white px-3 flex items-center gap-2 focus-within:ring-2"
          style={{ border: `1px solid ${EKARI.hair}`, ...ringStyle }}
        >

          <IoSearch size={18} style={{ color: EKARI.dim }} />
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={active === "events" ? "Search events…" : "Search discussions…"}
            className="flex-1 outline-none bg-transparent"
            style={{ color: EKARI.text }}
          />
          {!!queryInput && (
            <button onClick={() => setQueryInput("")} aria-label="Clear search">
              <IoCloseCircle size={18} style={{ color: EKARI.dim }} />
            </button>
          )}
        </div>

        <button
          onClick={() => (active === "events" ? loadEvents() : loadDiscs())}
          className="h-10 w-10 grid place-items-center rounded-full hover:bg-black/[0.03] focus:ring-2"
          style={{ border: `1px solid ${EKARI.hair}`, ...ringStyle }}
          aria-label="Refresh"
        >
          <IoReload size={18} style={{ color: EKARI.text }} />
        </button>
      </div>

      <div className="px-3 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActive("events")}
            className={cn(
              "flex-1 py-2 rounded-full font-bold border transition",
              active === "events" ? "text-white" : "text-gray-800 hover:bg-gray-50"
            )}
            style={{
              backgroundColor: active === "events" ? EKARI.forest : "transparent",
              borderColor: active === "events" ? EKARI.forest : EKARI.hair,
            }}
          >
            Events
          </button>
          <button
            onClick={() => setActive("discussions")}
            className={cn(
              "flex-1 py-2 rounded-full font-bold border transition",
              active === "discussions" ? "text-white" : "text-gray-800 hover:bg-gray-50"
            )}
            style={{
              backgroundColor: active === "discussions" ? EKARI.forest : "transparent",
              borderColor: active === "discussions" ? EKARI.forest : EKARI.hair,
            }}
          >
            Discussions
          </button>
        </div>
      </div>

      <div className="px-3 pb-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2">
          {(active === "events" ? EVENT_FILTERS : DISC_FILTERS).map((c) => {
            const isActive =
              active === "events" ? eventFilter === c : discFilter === c;
            return (
              <button
                key={c}
                onClick={() =>
                  active === "events"
                    ? setEventFilter(c as EventCategory | "All")
                    : setDiscFilter(c as DiscCategory | "All")
                }
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-bold border transition",
                  isActive ? "text-white" : "text-gray-800 hover:bg-gray-50"
                )}
                style={{
                  backgroundColor: isActive ? EKARI.forest : "transparent",
                  borderColor: isActive ? EKARI.forest : EKARI.hair,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const EventsGrid = (
    <>
      {loadingEvents ? (
        <div className="py-12 flex justify-center">
          <BouncingBallLoader />
        </div>
      ) : filteredEvents.length > 0 ? (
        <>
          <div
            className={cn(
              "grid gap-3",
              isMobile
                ? "grid-cols-2 px-3"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}
          >
            {filteredEvents.map((e) => (
              <Link
                href={`/nexus/event/${e.id}`}
                onClick={() => cacheEvent(e)}   // ✅ store full event object
                key={e.id}
                className="block border rounded-xl overflow-hidden bg-white hover:shadow-md transition"
                style={{ borderColor: EKARI.hair }}
              >
                <div className="relative w-full aspect-[16/9] bg-black">
                  {e.coverUrl ? (
                    <Image
                      src={e.coverUrl}
                      alt={e.title}
                      fill
                      className="object-contain p-2"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1440px) 33vw, 25vw"
                      priority={false}
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-xs text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="font-extrabold text-gray-900 line-clamp-2">
                    {e.title}
                  </h3>

                  {e.location && (
                    <p className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                      <IoLocationOutline size={14} /> {e.location}
                    </p>
                  )}

                  {e.dateISO && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <IoCalendarOutline size={12} />
                      {new Date(e.dateISO).toLocaleDateString()}
                    </p>
                  )}

                  {e.price ? (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <IoCashOutline size={16} style={{ color: EKARI.dim }} />
                      {formatMoney(e.price, e.currency)}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>

          {eventsAfter.current && (
            <div className="text-center mt-6">
              <button
                onClick={loadMoreEvents}
                disabled={pagingEvents}
                className="px-4 py-2 rounded-lg text-white font-black hover:opacity-90 disabled:opacity-60 focus:ring-2"
                style={{ backgroundColor: EKARI.forest, ...ringStyle }}
              >
                {pagingEvents ? <BouncingBallLoader /> : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500 py-12 px-3">
          No events {q ? "matching your search." : "yet."}
        </div>
      )}
    </>
  );

  const DiscussionsList = (
    <>
      {loadingDiscs ? (
        <div className="py-12 flex justify-center">
          <BouncingBallLoader />
        </div>
      ) : filteredDiscs.length > 0 ? (
        <>
          <div className={cn("grid gap-3", isMobile ? "px-3" : "")}>
            {filteredDiscs.map((d) => (
              <Link
                href={`/nexus/discussion/${d.id}`}
                onClick={() => cacheDiscussion(d)}   // ✅ add this
                key={d.id}
                className="block border rounded-xl bg-white p-3 hover:shadow-md transition"
                style={{ borderColor: EKARI.hair }}
              >
                <div className="flex items-start gap-2">
                  <IoChatbubblesOutline
                    style={{ color: EKARI.forest }}
                    className="mt-1"
                    size={16}
                  />
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-gray-900 line-clamp-2">
                      {d.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <IoTimeOutline size={12} />
                      {d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : ""}
                      <IoChatbubbleEllipsesOutline size={12} />
                      {(d.repliesCount ?? 0).toString()} Answers
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {discsAfter.current && (
            <div className="text-center mt-6">
              <button
                onClick={loadMoreDiscs}
                disabled={pagingDiscs}
                className="px-4 py-2 rounded-lg text-white font-black hover:opacity-90 disabled:opacity-60 focus:ring-2"
                style={{ backgroundColor: EKARI.forest, ...ringStyle }}
              >
                {pagingDiscs ? <BouncingBallLoader /> : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500 py-12 px-3">
          No discussions {q ? "matching your search." : "yet."}
        </div>
      )}
    </>
  );

  /* ---------------- mobile shell (like MarketPage) ---------------- */
  if (isMobile) {
    return (
      <>
        <div className="fixed inset-0 bg-white">
          <div
            className="sticky top-0 z-50 border-b"
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              borderColor: EKARI.hair,
            }}
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
                <IoCompassOutline size={20} style={{ color: EKARI.text }} />
                <div className="font-black text-base" style={{ color: EKARI.text }}>
                  Nexus
                </div>
              </div>

              <button
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black focus:ring-2"
                style={{
                  background: "white",
                  border: `1px solid ${EKARI.gold}`,
                  color: EKARI.gold,
                  ...ringStyle,
                }}
              >
                <IoAdd size={16} />
                {active === "events" ? "Create" : "Start"}
              </button>
            </div>

            {Controls}
          </div>

          <div style={{ paddingBottom: "calc(84px + env(safe-area-inset-bottom))" }}>
            {active === "events" ? EventsGrid : DiscussionsList}
          </div>

          <MobileBottomTabs onCreate={() => setSheetOpen(true)} />
          <SideMenuSheet
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onNavigate={navigateFromMenu}
            items={fullMenu}
          />

        </div>

        <BottomSheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            setSheetFooter(null);
          }}
          title={active === "events" ? "Create Event" : "Start Discussion"}
          footer={sheetFooter}
        >
          {active === "events" ? (
            <EventForm
              onDone={() => {
                setSheetOpen(false);
                setSheetFooter(null);
              }}
              provideFooter={provideFooter}
            />
          ) : (
            <DiscussionForm
              onDone={() => {
                setSheetOpen(false);
                setSheetFooter(null);
              }}
              provideFooter={provideFooter}
            />
          )}
        </BottomSheet>
      </>
    );
  }

  /* ---------------- desktop shell ---------------- */
  return (
    <AppShell>
      <div className="min-h-screen w-full">
        <div
          className="sticky top-0 z-10 backdrop-blur border-b"
          style={{
            backgroundColor: "rgba(255,255,255,0.92)",
            borderColor: EKARI.hair,
          }}
        >
          <div className="h-14 px-4 max-w-[1180px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IoCompassOutline size={22} style={{ color: EKARI.text }} />
              <div className="font-black text-lg" style={{ color: EKARI.text }}>
                Nexus
              </div>
            </div>

            <button
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition focus:ring-2"
              style={{
                border: `1px solid ${EKARI.gold}`,
                color: EKARI.gold,
                ...ringStyle,
              }}
            >
              <IoAdd size={18} />
              <span>{active === "events" ? "Create Event" : "Start Discussion"}</span>
            </button>
          </div>

          <div className="max-w-[1180px] mx-auto">{Controls}</div>
        </div>

        <div className="max-w-[1180px] mx-auto px-4 pt-3 pb-24">
          {active === "events" ? EventsGrid : DiscussionsList}
        </div>

        <BottomSheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
            setSheetFooter(null);
          }}
          title={active === "events" ? "Create Event" : "Start Discussion"}
          footer={sheetFooter}
        >
          {active === "events" ? (
            <EventForm
              onDone={() => {
                setSheetOpen(false);
                setSheetFooter(null);
              }}
              provideFooter={provideFooter}
            />
          ) : (
            <DiscussionForm
              onDone={() => {
                setSheetOpen(false);
                setSheetFooter(null);
              }}
              provideFooter={provideFooter}
            />
          )}
        </BottomSheet>
      </div>
    </AppShell>
  );
}
