"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  getAuth,
  onAuthStateChanged,
  linkWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  IoArrowBack,
  IoPencil,
  IoLockClosed,
  IoPersonOutline,
  IoCameraOutline,
  IoCheckmarkCircleOutline,
  IoLinkOutline,
  IoCallOutline,
  IoHeartOutline,
  IoBriefcaseOutline,
  IoCashOutline,
  IoNotificationsOutline,
  IoMailOutline,
  IoShieldCheckmarkOutline,
  IoChevronForward,
  IoInformationCircleOutline,
} from "react-icons/io5";
import Cropper from "react-easy-crop";

import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

/* ===================== Brand ===================== */
const EKARI = {
  forest: "#173C2E",
  leaf: "#214C3A",
  gold: "#F39A22",
  sand: "#F8F7F2",
  paper: "#FBFAF6",
  hair: "#DDD8CC",
  text: "#0F172A",
  dim: "#64748B",
  danger: "#B42318",
  subtext: "#64748B",
};

type GroupConfig = {
  id?: string;
  title: string;
  items: string[];
};
/** ✅ Country list (same style as phone-login) */
const COUNTRIES = [
  // 🌍 Africa
  { code: "KE", dial: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "UG", dial: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "TZ", dial: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "RW", dial: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "BI", dial: "+257", flag: "🇧🇮", name: "Burundi" },
  { code: "ET", dial: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "SO", dial: "+252", flag: "🇸🇴", name: "Somalia" },
  { code: "SS", dial: "+211", flag: "🇸🇸", name: "South Sudan" },
  { code: "SD", dial: "+249", flag: "🇸🇩", name: "Sudan" },
  { code: "NG", dial: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "GH", dial: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "ZA", dial: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "EG", dial: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "DZ", dial: "+213", flag: "🇩🇿", name: "Algeria" },
  { code: "MA", dial: "+212", flag: "🇲🇦", name: "Morocco" },
  { code: "TN", dial: "+216", flag: "🇹🇳", name: "Tunisia" },
  { code: "LY", dial: "+218", flag: "🇱🇾", name: "Libya" },
  { code: "SN", dial: "+221", flag: "🇸🇳", name: "Senegal" },
  { code: "CI", dial: "+225", flag: "🇨🇮", name: "Côte d’Ivoire" },
  { code: "CM", dial: "+237", flag: "🇨🇲", name: "Cameroon" },
  { code: "ZW", dial: "+263", flag: "🇿🇼", name: "Zimbabwe" },
  { code: "ZM", dial: "+260", flag: "🇿🇲", name: "Zambia" },
  { code: "MW", dial: "+265", flag: "🇲🇼", name: "Malawi" },
  { code: "MZ", dial: "+258", flag: "🇲🇿", name: "Mozambique" },

  // 🌎 Americas
  { code: "US", dial: "+1", flag: "🇺🇸", name: "United States" },
  { code: "CA", dial: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "MX", dial: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "BR", dial: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "AR", dial: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "CL", dial: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "CO", dial: "+57", flag: "🇨🇴", name: "Colombia" },

  // 🌍 Europe
  { code: "GB", dial: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "DE", dial: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "FR", dial: "+33", flag: "🇫🇷", name: "France" },
  { code: "IT", dial: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "ES", dial: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "NL", dial: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "SE", dial: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "NO", dial: "+47", flag: "🇳🇴", name: "Norway" },

  // 🌏 Asia
  { code: "IN", dial: "+91", flag: "🇮🇳", name: "India" },
  { code: "PK", dial: "+92", flag: "🇵🇰", name: "Pakistan" },
  { code: "BD", dial: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "CN", dial: "+86", flag: "🇨🇳", name: "China" },
  { code: "JP", dial: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "KR", dial: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "SG", dial: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "AE", dial: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
  { code: "SA", dial: "+966", flag: "🇸🇦", name: "Saudi Arabia" },

  // 🌏 Oceania
  { code: "AU", dial: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "NZ", dial: "+64", flag: "🇳🇿", name: "New Zealand" },
] as const;

type Country = typeof COUNTRIES[number];

const POPULAR = ["KE", "UG", "TZ", "RW", "US", "GB"] as const;

const SORTED_COUNTRIES: Country[] = [
  ...COUNTRIES.filter((c) => (POPULAR as readonly string[]).includes(c.code)),
  ...COUNTRIES.filter((c) => !(POPULAR as readonly string[]).includes(c.code)).sort((a, b) =>
    a.name.localeCompare(b.name)
  ),
];

const flagUrl = (code: string) => `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;

function CountryPicker({
  value,
  onChange,
  disabled,
}: {
  value: Country;
  onChange: (c: Country) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return SORTED_COUNTRIES;
    return SORTED_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.code.toLowerCase().includes(s) ||
        c.dial.includes(s)
    );
  }, [q]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest?.("[data-country-picker-root]")) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" data-country-picker-root>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className="h-9 px-2 rounded-lg hover:bg-black/5 disabled:opacity-60
          inline-flex items-center gap-2 text-sm font-semibold"
      >
        <img
          src={flagUrl(value.code)}
          alt={`${value.name} flag`}
          width={18}
          height={14}
          className="rounded-[2px] border border-black/10"
        />
        <span className="text-slate-900">{value.dial}</span>
        <span className="text-slate-500 hidden sm:inline">• {value.code}</span>
        <svg width="14" height="14" viewBox="0 0 20 20" className="ml-1 opacity-70">
          <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[280px] rounded-xl border border-black/10 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-black/5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search country…"
              className="h-9 w-full rounded-lg border border-black/10 bg-[#F6F7FB] px-3 text-sm outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-auto">
            {filtered.map((c) => {
              const active = c.code === value.code;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                    setQ("");
                  }}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm
                    hover:bg-black/5 ${active ? "bg-black/5" : ""}`}
                >
                  <img
                    src={flagUrl(c.code)}
                    alt=""
                    width={18}
                    height={14}
                    className="rounded-[2px] border border-black/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 truncate">{c.name}</div>
                    <div className="text-xs text-slate-500">
                      {c.dial} • {c.code}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============== Helpers ============== */
const validateUrl = (v: string) =>
  !v ||
  /^https?:\/\/[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:\/?#[\]@!$&'()*+,;=.]+$/.test(
    v.trim()
  );

/** Max avatar size (square) */
const MAX_AVATAR_SIZE = 512;

/** helper: Firebase URL detector */
const isFirebaseUrl = (u?: string | null) =>
  !!u &&
  (u.startsWith("gs://") || u.includes("firebasestorage.googleapis.com"));
async function softDeleteMyAccountWeb() {
  const functions = getFunctions();
  const fn = httpsCallable(functions, "softDeleteAccount");
  await fn({});
}
/** Responsive helpers */
function useMediaQuery(queryStr: string) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
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

/** Canvas crop + downscale to max 512x512 */
async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });

  const cropW = pixelCrop.width;
  const cropH = pixelCrop.height;

  const maxDim = Math.max(cropW, cropH);
  const scale = maxDim > MAX_AVATAR_SIZE ? MAX_AVATAR_SIZE / maxDim : 1;

  const targetW = Math.round(cropW * scale);
  const targetH = Math.round(cropH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetW,
    targetH
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas is empty"));
      },
      "image/jpeg",
      0.9
    );
  });
}

const INTERESTS_FALLBACK = null;

/* =========================================================
   PAGE (/[handle]/edit)
   ========================================================= */

function SafeProfileAvatar({
  src,
  alt,
  size = 104,
}: {
  src?: string | null;
  alt: string;
  size?: number;
}) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  const hasImage =
    !!src?.trim() && !failed;

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full bg-[#E8ECE8]"
      style={{
        width: size,
        height: size,
      }}
      aria-label={alt}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src || ""}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-[#E8ECE8] text-[#173C2E]">
          <IoPersonOutline
            style={{
              width: size * 0.44,
              height: size * 0.44,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function EditProfilePage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();
  const [allowPushNotifications, setAllowPushNotifications] = useState(true);
  const [allowEmailNotifications, setAllowEmailNotifications] = useState(true);
  const goBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  const db = getFirestore();
  const storage = getStorage();
  const auth = getAuth();
  // ✅ Phone UI (country + local) like phone-login
  const [phoneCountry, setPhoneCountry] = useState<Country>(() => {
    const def = SORTED_COUNTRIES.find((c) => c.code === "KE") ?? SORTED_COUNTRIES[0];
    return def;
  });
  const [localPhone, setLocalPhone] = useState("");

  const phoneE164 = useMemo(() => {
    const digits = (localPhone || "").replace(/[^\d]/g, "");
    if (!digits) return "";
    return `${phoneCountry.dial}${digits}`;
  }, [phoneCountry, localPhone]);

  const validPhoneE164 = useMemo(() => /^\+\d{8,15}$/.test(phoneE164), [phoneE164]);

  // ---------- Top-level state ----------
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [profileUpdatedAtText, setProfileUpdatedAtText] = useState<string | null>(
    null
  );

  const [uid, setUid] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);

  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [initialPhotoURL, setInitialPhotoURL] = useState<string | null>(null);

  const [areaOfInterest, setAreaOfInterest] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  // 🔹 Dynamic taxonomy options for TagPicker
  const [interestOptions, setInterestOptions] = useState<string[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [taxonomyLoading, setTaxonomyLoading] = useState<boolean>(true);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

  type SheetKind =
    | null
    | "name"
    | "bio"
    | "website"
    | "phone"
    | "interests"
    | "roles"
    | "currency";
  const [sheet, setSheet] = useState<SheetKind>(null);

  // 🔹 NEW: preferred currency + country
  const [preferredCurrency, setPreferredCurrency] = useState<"KES" | "USD" | null>(
    null
  );
  const [countryCode, setCountryCode] = useState<string | null>(null);
  // ✅ Initialize picker from stored phone if possible
  // phone link state
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const confirmationResultRef =
    useRef<
      ReturnType<typeof linkWithPhoneNumber> extends Promise<infer T> ? T : any | null
    >(null);
  const recaptchaRef = useRef<any>(null);

  // Delete account state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ---------- Avatar crop state ----------
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null); // original object URL
  const [avatarCropOpen, setAvatarCropOpen] = useState(false);

  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any | null>(null);

  const [avatarPreviewCropped, setAvatarPreviewCropped] = useState<string | null>(
    null
  ); // circle preview URL

  // ---------- Load taxonomy (interests & roles) from Firestore (grouped + fallback) ----------
  useEffect(() => {
    let cancelled = false;

    async function loadTaxonomy() {
      try {
        setTaxonomyLoading(true);
        setTaxonomyError(null);

        // 1) Try grouped catalogs: interest_groups & role_groups
        const igSnap = await getDocs(
          query(collection(db, "interest_groups"), orderBy("order", "asc"))
        );
        const rgSnap = await getDocs(
          query(collection(db, "role_groups"), orderBy("order", "asc"))
        );

        if (cancelled) return;

        const ig: GroupConfig[] = igSnap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              title: data.title ?? d.id,
              items: Array.isArray(data.items) ? data.items : [],
            };
          })
          .filter((g) => g.items.length);

        const rg: GroupConfig[] = rgSnap.docs
          .map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              title: data.title ?? d.id,
              items: Array.isArray(data.items) ? data.items : [],
            };
          })
          .filter((g) => g.items.length);

        let interestFlat = ig.flatMap((g) => g.items);
        let roleFlat = rg.flatMap((g) => g.items);

        // 2) If grouped catalogs are empty, fall back to taxonomy/master
        if (!interestFlat.length || !roleFlat.length) {
          const taxSnap = await getDoc(doc(db, "taxonomy", "master"));
          if (taxSnap.exists()) {
            const data = taxSnap.data() as any;

            if (!interestFlat.length && Array.isArray(data.interests)) {
              interestFlat = data.interests;
            }

            if (!roleFlat.length && Array.isArray(data.roles)) {
              roleFlat = data.roles;
            }
          }
        }

        setInterestOptions(Array.from(new Set(interestFlat)));
        setRoleOptions(Array.from(new Set(roleFlat)));
      } catch (e: any) {
        if (!cancelled) {
          setTaxonomyError("Could not load interests & roles.");
          setInterestOptions([]);
          setRoleOptions([]);
        }
      } finally {
        if (!cancelled) setTaxonomyLoading(false);
      }
    }

    void loadTaxonomy();
    return () => {
      cancelled = true;
    };
  }, [db]);

  // ---------- Load current user + guard by route handle ----------
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setLoading(false);
        return;
      }
      setUid(u.uid);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        if (snap.exists()) {
          const d: any = snap.data();
          setFirstName(d.firstName || "");
          setSurname(d.surname || "");
          setHandle(d.handle || "");
          setBio(d.bio || "");
          setPhotoURL(d.photoURL || null);
          setInitialPhotoURL(d.photoURL || null);
          setAreaOfInterest(Array.isArray(d.areaOfInterest) ? d.areaOfInterest : []);
          setRoles(Array.isArray(d.roles) ? d.roles : []);
          setWebsite(d.website ?? null);
          setPhone(d.phone ?? u.phoneNumber ?? null);
          // ✅ Initialize picker from stored phone if possible
          const existing = String(d.phone ?? u.phoneNumber ?? "").trim();
          if (existing.startsWith("+")) {
            // match longest dial code first
            const sortedByDialLen = [...SORTED_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
            const hit = sortedByDialLen.find((c) => existing.startsWith(c.dial));
            if (hit) {
              setPhoneCountry(hit);
              setLocalPhone(existing.slice(hit.dial.length).replace(/[^\d]/g, ""));
            } else {
              // fallback: keep KE, just strip +
              setLocalPhone(existing.replace(/[^\d]/g, "").replace(/^254/, "")); // safe-ish fallback
            }
          } else {
            setLocalPhone(existing.replace(/[^\d]/g, ""));
          }

          setPhoneVerified(!!d.phoneVerified || !!u.phoneNumber);
          setCountryCode(d.countryCode ?? null);
          setAllowPushNotifications(d.allowPushNotifications !== false);
          setAllowEmailNotifications(d.allowEmailNotifications !== false);
          const fromDoc = d.preferredCurrency as "KES" | "USD" | undefined;
          const fallback = (d.countryCode === "KE" ? "KES" : "USD") as "KES" | "USD";
          setPreferredCurrency(fromDoc ?? fallback);

          // last updated text
          const ts = d.updatedAt || d.createdAt;
          if (ts?.toDate) {
            const date = ts.toDate() as Date;
            setProfileUpdatedAtText(
              `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
            );
          } else {
            setProfileUpdatedAtText(null);
          }

          const routeH = (params?.handle || "")
            .toString()
            .replace(/^@/, "")
            .toLowerCase();
          const myH = (d.handleLower || (d.handle || "").replace(/^@/, "").toLowerCase());
          if (routeH && myH && routeH !== myH) {
            router.replace(`/${myH}/edit`);
          }
        }
      } finally {
        setLoading(false);
      }
    });
    return off;
  }, [auth, db, params?.handle, router]);

  // ---------- Avatar picking (web) ----------
  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;

    // reset input so the same file can be picked again
    e.currentTarget.value = "";

    // Create a local preview URL and open cropper sheet
    const url = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreview(url);
    setAvatarPreviewCropped(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setAvatarCropOpen(true);
  };

  const saveField = async (patch: Record<string, any>) => {
    if (!uid) return;
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await updateDoc(doc(db, "users", uid), {
        ...patch,
        updatedAt: serverTimestamp(),
      });
      setSuccessMsg("Changes saved.");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };
  const saveNotificationSetting = async (
    key: "allowPushNotifications" | "allowEmailNotifications",
    value: boolean
  ) => {
    if (!uid) return;

    if (key === "allowPushNotifications") {
      setAllowPushNotifications(value);
    } else {
      setAllowEmailNotifications(value);
    }

    await saveField({ [key]: value });
  };
  // cleanup util for temporary avatar previews
  const cleanupAvatarPreview = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (avatarPreviewCropped) URL.revokeObjectURL(avatarPreviewCropped);
    setAvatarPreview(null);
    setAvatarPreviewCropped(null);
    setAvatarFile(null);
  };

  const onCancelAvatarCrop = () => {
    cleanupAvatarPreview();
    setAvatarCropOpen(false);
  };

  const onConfirmAvatarCrop = async () => {
    if (!uid || !avatarPreview || !croppedAreaPixels) return;
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const croppedBlob = await getCroppedImageBlob(avatarPreview, croppedAreaPixels);

      const filename = avatarFile?.name || "avatar.jpg";
      const rf = sRef(storage, `avatars/${uid}/${Date.now()}-${filename}`);

      await uploadBytes(rf, croppedBlob);
      const url = await getDownloadURL(rf);

      // 1) Update local UI state
      setPhotoURL(url);

      // 2) Delete old avatar file from Storage (if it was Firebase)
      if (initialPhotoURL && initialPhotoURL !== url && isFirebaseUrl(initialPhotoURL)) {
        try {
          await deleteObject(sRef(storage, initialPhotoURL));
        } catch {
          // ignore storage delete failure
        }
      }

      // 3) Persist new photo URL to Firestore users collection
      try {
        await updateDoc(doc(db, "users", uid), {
          photoURL: url,
          updatedAt: serverTimestamp(),
        });
        setSuccessMsg("Profile photo updated.");
        setTimeout(() => setSuccessMsg(""), 3500);
      } catch (e: any) {
        console.error("Failed to update user photoURL:", e);
        setErrorMsg(e?.message || "Photo changed locally but could not save to profile.");
      }

      setInitialPhotoURL(url);
      setAvatarCropOpen(false);
      cleanupAvatarPreview();
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not upload avatar.");
    } finally {
      setSaving(false);
    }
  };

  // Reset avatar to default placeholder
  const onResetAvatar = async () => {
    if (!uid) return;
    if (!window.confirm("Reset profile photo to default?")) return;

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (initialPhotoURL && isFirebaseUrl(initialPhotoURL)) {
        try {
          await deleteObject(sRef(storage, initialPhotoURL));
        } catch {
          // ignore delete errors
        }
      }

      await updateDoc(doc(db, "users", uid), {
        photoURL: null,
        updatedAt: serverTimestamp(),
      });

      setPhotoURL(null);
      setInitialPhotoURL(null);
      setSuccessMsg("Avatar reset to default.");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not reset avatar.");
    } finally {
      setSaving(false);
    }
  };

  // react-easy-crop: when crop is finished, compute preview circle
  const handleCropComplete = useCallback(
    async (_: any, croppedPixels: any) => {
      setCroppedAreaPixels(croppedPixels);
      if (!avatarPreview) return;
      try {
        const blob = await getCroppedImageBlob(avatarPreview, croppedPixels);
        const url = URL.createObjectURL(blob);
        setAvatarPreviewCropped((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        // ignore preview errors
      }
    },
    [avatarPreview]
  );

  // ---------- Phone link (web SDK with invisible Recaptcha) ----------
  const ensureRecaptcha = () => {
    if (recaptchaRef.current) return true;
    try {
      const node =
        document.getElementById("recaptcha-container") ||
        (() => {
          const div = document.createElement("div");
          div.id = "recaptcha-container";
          div.style.position = "fixed";
          div.style.bottom = "-10000px";
          document.body.appendChild(div);
          return div;
        })();

      // @ts-ignore
      recaptchaRef.current = new RecaptchaVerifier(getAuth(), node, {
        size: "invisible",
      });
      return true;
    } catch {
      return false;
    }
  };

  const sendSms = async (e164: string) => {
    if (!uid) return;

    if (!/^\+\d{8,15}$/.test(e164)) {
      setErrorMsg("That phone number looks invalid. Check the country code and number.");
      return;
    }

    setPhoneBusy(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      ensureRecaptcha();
      const conf = await linkWithPhoneNumber(
        getAuth().currentUser!,
        e164,
        recaptchaRef.current
      );

      confirmationResultRef.current = conf;

      // keep phone state in sync
      setPhone(e164);
      setSmsSent(true);
    } catch (err: any) {
      // use the same clean mapping you have in phone-login if you want
      setErrorMsg(err?.message || "Could not send code");
    } finally {
      setPhoneBusy(false);
    }
  };


  const confirmSms = async () => {
    if (!confirmationResultRef.current) return;

    setPhoneBusy(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await confirmationResultRef.current.confirm(smsCode);

      // ✅ save verified phone + country
      await saveField({
        phone: phoneE164,
        phoneVerified: true,
        countryCode: phoneCountry.code,
      });

      setPhone(phoneE164);
      setPhoneVerified(true);
      setCountryCode(phoneCountry.code);

      setSheet(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Invalid code");
    } finally {
      setPhoneBusy(false);
    }
  };


  // ---------- Delete account (calls backend cloud function) ----------
  // ---------- Delete account (soft delete via cloud function) ----------
  const handleConfirmDelete = async () => {
    if (!uid) return;

    setDeleting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await softDeleteMyAccountWeb();
      await auth.signOut();
      router.replace("/");
    } catch (err: any) {
      console.error("Soft delete account failed", err);
      setErrorMsg(err?.message || "Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };
  const validWebsite = validateUrl(website || "");

  const displayName =
    `${firstName || ""} ${surname || ""}`.trim() ||
    handle ||
    "ekarihub member";

  const profileCompletion = useMemo(() => {
    const checks = [
      {
        label: "Profile photo",
        complete: !!photoURL,
      },
      {
        label: "Name",
        complete: !!firstName.trim() || !!surname.trim(),
      },
      {
        label: "Bio",
        complete: bio.trim().length >= 20,
      },
      {
        label: "Phone",
        complete: !!phone && phoneVerified,
      },
      {
        label: "Website",
        complete: !!website?.trim(),
      },
      {
        label: "Interests",
        complete: areaOfInterest.length > 0,
      },
      {
        label: "Roles",
        complete: roles.length > 0,
      },
    ];

    const completed = checks.filter((item) => item.complete).length;

    return {
      checks,
      completed,
      total: checks.length,
      percentage: Math.round((completed / checks.length) * 100),
    };
  }, [
    photoURL,
    firstName,
    surname,
    bio,
    phone,
    phoneVerified,
    website,
    areaOfInterest,
    roles,
  ]);

  // ✅ Build the main content once, then wrap it differently for mobile/desktop
  const PageContent = (
    <>
      <div className="flex w-full flex-col bg-[#F8F7F2]">
        {/* HERO */}
        <motion.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          className="relative overflow-hidden bg-[#173C2E] text-white"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.6) 18px 19px)",
            }}
          />

          <div className="relative mx-auto max-w-[1180px] px-4 py-5 md:px-6 md:py-6">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={goBack}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white transition hover:bg-white/[0.11] active:scale-95"
                aria-label="Back"
              >
                <IoArrowBack size={19} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                  Profile settings
                </div>

                <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-[24px] font-black tracking-[-0.035em] md:text-[28px]">
                      Edit profile
                    </h1>

                    <p className="mt-1 text-[11px] font-medium text-white/50 md:text-[12px]">
                      {handle ? (handle.startsWith("@") ? handle : `@${handle}`) : "Your ekarihub profile"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/${encodeURIComponent(
                          String(handle || params?.handle || "").replace(/^@/, "")
                        )}`
                      )
                    }
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-[10px] font-black text-white transition hover:bg-white/[0.11]"
                  >
                    View profile
                    <IoChevronForward size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.header>

        <main className="flex-1 bg-[#F8F7F2]">
          <div className="mx-auto grid max-w-[1180px] gap-5 px-3 py-4 sm:px-4 md:px-6 md:py-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
            <section className="min-w-0 space-y-4">
              {/* PROFILE IDENTITY */}
              <motion.section
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
              >
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                  <div className="relative">
                    <div className="rounded-full bg-gradient-to-br from-[#F39A22] to-[#173C2E] p-[3px] shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                      <div className="rounded-full bg-[#FBFAF6] p-[3px]">
                        <SafeProfileAvatar
                          src={photoURL}
                          alt={displayName}
                          size={104}
                        />
                      </div>
                    </div>

                    <label
                      className="absolute bottom-0 right-0 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-[3px] border-[#FBFAF6] bg-[#173C2E] text-white shadow-lg transition hover:scale-105 hover:bg-[#214C3A]"
                      title="Change profile photo"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onPickAvatar}
                      />
                      <IoCameraOutline size={16} />
                    </label>
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h2 className="truncate text-[18px] font-black tracking-[-0.025em] text-slate-900">
                      {displayName}
                    </h2>

                    <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
                      {handle ? (handle.startsWith("@") ? handle : `@${handle}`) : "Username unavailable"}
                    </p>

                    <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                      <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#173C2E] px-3 text-[10px] font-black text-white transition hover:bg-[#214C3A]">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={onPickAvatar}
                        />
                        <IoCameraOutline size={13} />
                        Change photo
                      </label>

                      <button
                        type="button"
                        onClick={onResetAvatar}
                        disabled={saving || (!photoURL && !initialPhotoURL)}
                        className="h-9 rounded-xl border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-slate-600 transition hover:bg-[#F3F1EB] hover:text-rose-600 disabled:opacity-40"
                      >
                        Reset photo
                      </button>
                    </div>

                    {profileUpdatedAtText ? (
                      <p className="mt-2 text-[9px] font-medium text-slate-400">
                        Last updated: {profileUpdatedAtText}
                      </p>
                    ) : null}
                  </div>
                </div>
              </motion.section>

              {/* ALERTS */}
              <AnimatePresence mode="popLayout">
                {errorMsg ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] font-semibold text-rose-700"
                  >
                    {errorMsg}
                  </motion.div>
                ) : null}

                {successMsg ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-semibold text-emerald-700"
                  >
                    {successMsg}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* PROFILE */}
              <SettingsSection
                title="Profile"
                subtitle="How people identify and understand you on ekarihub."
                icon={<IoPersonOutline size={17} />}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <ItemRow
                    label="Name"
                    value={`${firstName || "-"} ${surname || ""}`.trim() || "-"}
                    onEdit={() => setSheet("name")}
                  />

                  <ItemRow
                    label="Username"
                    value={handle || "-"}
                    locked
                  />

                  <div className="md:col-span-2">
                    <ItemRow
                      label="Bio"
                      value={bio || "Add bio"}
                      onEdit={() => setSheet("bio")}
                    />
                  </div>
                </div>
              </SettingsSection>

              {/* CONTACT */}
              <SettingsSection
                title="Contact"
                subtitle="Manage your verified contact information and public web link."
                icon={<IoCallOutline size={17} />}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <ItemRow
                    label="Phone"
                    value={phone ? `${phoneVerified ? "Verified · " : "Unverified · "}${phone}` : "Add phone"}
                    status={phone ? (phoneVerified ? "success" : "warning") : undefined}
                    onEdit={() => {
                      setSmsSent(false);
                      setSmsCode("");
                      confirmationResultRef.current = null;
                      setErrorMsg("");
                      setSheet("phone");
                    }}
                  />

                  <ItemRow
                    label="Website"
                    value={website || "Add website"}
                    onEdit={() => setSheet("website")}
                  />
                </div>
              </SettingsSection>

              {/* INTERESTS + ROLES */}
              <SettingsSection
                title="Identity & discovery"
                subtitle="Help ekarihub understand what you care about and how you participate."
                icon={<IoHeartOutline size={17} />}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <ItemRow
                    label="Interests"
                    value={
                      areaOfInterest.length
                        ? `${areaOfInterest.length} selected`
                        : "Add interests"
                    }
                    onEdit={() => setSheet("interests")}
                  />

                  <ItemRow
                    label="Roles"
                    value={
                      roles.length
                        ? `${roles.length} selected`
                        : "Add roles"
                    }
                    onEdit={() => setSheet("roles")}
                  />
                </div>
              </SettingsSection>

              {/* PREFERENCES */}
              <SettingsSection
                title="Preferences"
                subtitle="Control currency and the notifications you receive."
                icon={<IoCashOutline size={17} />}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <ItemRow
                    label="Preferred currency"
                    value={
                      preferredCurrency
                        ? preferredCurrency === "KES"
                          ? "KES · Kenyan Shilling"
                          : "USD · US Dollar"
                        : "Auto based on country"
                    }
                    onEdit={() => setSheet("currency")}
                  />

                  <ToggleItemRow
                    label="Push notifications"
                    value="Likes, comments, messages and updates"
                    checked={allowPushNotifications}
                    icon={<IoNotificationsOutline size={15} />}
                    onChange={(value) =>
                      saveNotificationSetting(
                        "allowPushNotifications",
                        value
                      )
                    }
                  />

                  <ToggleItemRow
                    label="Email notifications"
                    value="Receive important alerts by email"
                    checked={allowEmailNotifications}
                    icon={<IoMailOutline size={15} />}
                    onChange={(value) =>
                      saveNotificationSetting(
                        "allowEmailNotifications",
                        value
                      )
                    }
                  />
                </div>
              </SettingsSection>

              {/* DANGER ZONE */}
              <motion.section
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.06 }}
                className="rounded-[18px] border border-rose-200 bg-rose-50 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-xl">
                    <div className="text-[10px] font-black uppercase tracking-[0.09em] text-rose-600">
                      Danger zone
                    </div>

                    <h3 className="mt-1 text-[14px] font-black text-rose-900">
                      Delete account
                    </h3>

                    <p className="mt-1 text-[10px] font-medium leading-5 text-rose-700">
                      This permanently removes your ekarihub profile, deeds, listings, discussions, events and uploaded files. This action cannot be undone.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={deleting}
                    className="h-10 shrink-0 rounded-xl bg-rose-600 px-4 text-[10px] font-black text-white transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {deleting ? "Deleting…" : "Delete account"}
                  </button>
                </div>
              </motion.section>

              {isMobile ? (
                <div
                  style={{
                    height: "env(safe-area-inset-bottom)",
                  }}
                />
              ) : null}
            </section>

            {/* RIGHT RAIL */}
            <motion.aside
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.24, delay: 0.04, ease: "easeOut" }}
              className="hidden space-y-3 xl:sticky xl:top-4 xl:block"
            >
              <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                <div className="flex items-center gap-3">
                  <SafeProfileAvatar
                    src={photoURL}
                    alt={displayName}
                    size={52}
                  />

                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-black text-slate-900">
                      {displayName}
                    </div>

                    <div className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">
                      {handle ? (handle.startsWith("@") ? handle : `@${handle}`) : "Profile"}
                    </div>
                  </div>
                </div>

                {bio ? (
                  <p className="mt-3 line-clamp-3 text-[10px] font-medium leading-4 text-slate-500">
                    {bio}
                  </p>
                ) : null}

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/${encodeURIComponent(
                        String(handle || params?.handle || "").replace(/^@/, "")
                      )}`
                    )
                  }
                  className="mt-3 flex h-9 w-full items-center justify-between rounded-xl border border-[#D9D3C7] bg-white px-3 text-[10px] font-black text-[#173C2E] transition hover:bg-[#EEF3EE]"
                >
                  View public profile
                  <IoChevronForward size={13} />
                </button>
              </section>

              <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                  Profile completeness
                </div>

                <div className="mt-1 text-[26px] font-black tracking-[-0.04em] text-[#173C2E]">
                  {profileCompletion.percentage}%
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EAE6DD]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${profileCompletion.percentage}%`,
                    }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="h-full rounded-full bg-[#173C2E]"
                  />
                </div>

                <p className="mt-2 text-[9px] font-semibold text-slate-400">
                  {profileCompletion.completed} of {profileCompletion.total} profile areas complete
                </p>

                <div className="mt-3 space-y-1.5">
                  {profileCompletion.checks.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 text-[10px]"
                    >
                      <span
                        className={[
                          "grid h-4 w-4 shrink-0 place-items-center rounded-full",
                          item.complete
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-400",
                        ].join(" ")}
                      >
                        {item.complete ? (
                          <IoCheckmarkCircleOutline size={10} />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>

                      <span
                        className={
                          item.complete
                            ? "font-semibold text-slate-600"
                            : "font-semibold text-slate-400"
                        }
                      >
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                <div className="flex items-start gap-3">
                  <span
                    className={[
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                      phoneVerified
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                    ].join(" ")}
                  >
                    <IoShieldCheckmarkOutline size={17} />
                  </span>

                  <div>
                    <div className="text-[12px] font-black text-slate-800">
                      Account security
                    </div>

                    <p className="mt-1 text-[10px] font-medium leading-4 text-slate-400">
                      {phoneVerified
                        ? "Your phone number is verified."
                        : "Verify your phone number to strengthen account recovery and trust."}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.03)]">
                <div className="text-[10px] font-black uppercase tracking-[0.09em] text-slate-400">
                  Quick links
                </div>

                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/${encodeURIComponent(
                          String(handle || params?.handle || "").replace(/^@/, "")
                        )}/connections`
                      )
                    }
                    className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                  >
                    Connections
                    <IoChevronForward size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/account/verification")}
                    className="flex h-9 w-full items-center justify-between rounded-xl px-2.5 text-left text-[10px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
                  >
                    Verification
                    <IoChevronForward size={13} />
                  </button>
                </div>
              </section>
            </motion.aside>
          </div>
        </main>
      </div>

      {/* Avatar crop sheet */}
      <BottomSheet
        open={avatarCropOpen}
        title="Crop profile photo"
        onClose={onCancelAvatarCrop}
      >
        {avatarPreview ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="h-24 w-24 overflow-hidden rounded-full border-[3px] border-[#F39A22] bg-slate-100 shadow-sm">
                {avatarPreviewCropped ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreviewCropped}
                    alt="Crop preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="Crop preview"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            </div>

            <div className="relative aspect-square w-full overflow-hidden rounded-[16px] bg-black">
              <Cropper
                image={avatarPreview}
                crop={crop}
                zoom={zoom}
                aspect={1}
                showGrid={false}
                cropShape="round"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-600">
                Zoom
              </label>

              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(event) =>
                  setZoom(Number(event.target.value))
                }
                className="w-full"
                style={{ accentColor: EKARI.forest }}
              />
            </div>

            <SheetActions
              onCancel={onCancelAvatarCrop}
              onSave={onConfirmAvatarCrop}
              saveText={saving ? "Saving…" : "Save photo"}
              disabled={saving || !croppedAreaPixels}
            />
          </div>
        ) : (
          <p className="text-[11px] font-medium text-slate-500">
            No image selected. Choose a photo to crop.
          </p>
        )}
      </BottomSheet>

      {/* NAME */}
      <BottomSheet
        open={sheet === "name"}
        title="Edit name"
        onClose={() => setSheet(null)}
      >
        <div className="space-y-3">
          <FieldLabel label="First name">
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="First name"
              className="h-11 w-full rounded-xl border border-[#D9D3C7] bg-white px-3 text-sm outline-none transition focus:border-[#173C2E]/45"
            />
          </FieldLabel>

          <FieldLabel label="Surname">
            <input
              value={surname}
              onChange={(event) => setSurname(event.target.value)}
              placeholder="Surname"
              className="h-11 w-full rounded-xl border border-[#D9D3C7] bg-white px-3 text-sm outline-none transition focus:border-[#173C2E]/45"
            />
          </FieldLabel>

          <SheetActions
            onCancel={() => setSheet(null)}
            onSave={async () => {
              await saveField({ firstName, surname });
              setSheet(null);
            }}
          />
        </div>
      </BottomSheet>

      {/* BIO */}
      <BottomSheet
        open={sheet === "bio"}
        title="Edit bio"
        onClose={() => setSheet(null)}
      >
        <div className="space-y-2">
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={220}
            placeholder="Tell people about you…"
            className="h-32 w-full resize-none rounded-xl border border-[#D9D3C7] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#173C2E]/45"
          />

          <div className="text-right text-[9px] font-semibold text-slate-400">
            {bio.length}/220
          </div>

          <SheetActions
            onCancel={() => setSheet(null)}
            onSave={async () => {
              await saveField({ bio });
              setSheet(null);
            }}
          />
        </div>
      </BottomSheet>

      {/* WEBSITE */}
      <BottomSheet
        open={sheet === "website"}
        title="Website URL"
        onClose={() => setSheet(null)}
      >
        <div className="space-y-2">
          <FieldLabel label="Website">
            <div className="flex h-11 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-3">
              <IoLinkOutline size={14} className="text-slate-400" />

              <input
                value={website || ""}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://example.com"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </FieldLabel>

          {!validWebsite ? (
            <p className="text-[10px] font-semibold text-rose-600">
              Enter a valid website URL.
            </p>
          ) : null}

          <SheetActions
            onCancel={() => setSheet(null)}
            disabled={!validWebsite}
            onSave={async () => {
              await saveField({
                website: (website || "").trim() || null,
              });
              setSheet(null);
            }}
          />
        </div>
      </BottomSheet>

      {/* CURRENCY */}
      <BottomSheet
        open={sheet === "currency"}
        title="Preferred currency"
        onClose={() => setSheet(null)}
      >
        <div className="space-y-3">
          <p className="text-[10px] font-medium leading-4 text-slate-500">
            This is the default currency for uplifts you make. M-Pesa is available when using KES.
          </p>

          <div className="space-y-2">
            {(["KES", "USD"] as ("KES" | "USD")[]).map((code) => {
              const active = preferredCurrency === code;

              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPreferredCurrency(code)}
                  className={[
                    "flex w-full items-start gap-3 rounded-[14px] border px-3 py-3 text-left transition",
                    active
                      ? "border-[#173C2E] bg-[#EEF3EE]"
                      : "border-[#D9D3C7] bg-white hover:bg-[#F8F7F2]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                      active
                        ? "border-[#173C2E]"
                        : "border-slate-300",
                    ].join(" ")}
                  >
                    {active ? (
                      <span className="h-2 w-2 rounded-full bg-[#173C2E]" />
                    ) : null}
                  </span>

                  <div>
                    <div className="text-[11px] font-black text-slate-800">
                      {code === "KES"
                        ? "KES · Kenyan Shilling"
                        : "USD · US Dollar"}
                    </div>

                    <div className="mt-0.5 text-[9px] font-medium leading-4 text-slate-400">
                      {code === "KES"
                        ? "Recommended for Kenya-based activity and M-Pesa."
                        : "Useful for global and international activity."}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <SheetActions
            onCancel={() => setSheet(null)}
            disabled={!preferredCurrency}
            onSave={async () => {
              if (!preferredCurrency) return;
              await saveField({ preferredCurrency });
              setSheet(null);
            }}
          />
        </div>
      </BottomSheet>

      {/* INTERESTS */}
      <BottomSheet
        open={sheet === "interests"}
        title="Edit interests"
        onClose={() => setSheet(null)}
      >
        {taxonomyLoading ? (
          <p className="mb-2 text-[10px] font-semibold text-slate-400">
            Loading interest options…
          </p>
        ) : null}

        {taxonomyError ? (
          <p className="mb-2 text-[10px] font-semibold text-rose-600">
            {taxonomyError}
          </p>
        ) : null}

        <TagPicker
          label="Interests"
          value={areaOfInterest}
          onChange={setAreaOfInterest}
          options={interestOptions}
          popular={interestOptions}
          max={10}
        />

        <SheetActions
          className="mt-4"
          onCancel={() => setSheet(null)}
          onSave={async () => {
            await saveField({ areaOfInterest });
            setSheet(null);
          }}
        />
      </BottomSheet>

      {/* ROLES */}
      <BottomSheet
        open={sheet === "roles"}
        title="Edit roles"
        onClose={() => setSheet(null)}
      >
        {taxonomyLoading ? (
          <p className="mb-2 text-[10px] font-semibold text-slate-400">
            Loading role options…
          </p>
        ) : null}

        {taxonomyError ? (
          <p className="mb-2 text-[10px] font-semibold text-rose-600">
            {taxonomyError}
          </p>
        ) : null}

        <TagPicker
          label="Roles"
          value={roles}
          onChange={setRoles}
          options={roleOptions}
          popular={roleOptions}
          max={10}
        />

        <SheetActions
          className="mt-4"
          onCancel={() => setSheet(null)}
          onSave={async () => {
            await saveField({ roles });
            setSheet(null);
          }}
        />
      </BottomSheet>

      {/* PHONE */}
      <BottomSheet
        open={sheet === "phone"}
        title="Verify & link phone"
        onClose={() => setSheet(null)}
      >
        {!smsSent ? (
          <div className="space-y-3">
            <FieldLabel label="Phone number">
              <div className="flex h-11 items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-2 transition focus-within:border-[#173C2E]/45">
                <CountryPicker
                  value={phoneCountry}
                  onChange={setPhoneCountry}
                  disabled={phoneBusy}
                />

                <div className="h-6 w-px bg-[#E2DED5]" />

                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="712345678"
                  maxLength={12}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  value={localPhone}
                  onChange={(event) =>
                    setLocalPhone(
                      event.target.value.replace(/[^\d]/g, "")
                    )
                  }
                  disabled={phoneBusy}
                />
              </div>
            </FieldLabel>

            <div className="text-[9px] font-medium text-slate-400">
              Sending to:{" "}
              <span className="font-black text-slate-600">
                {phoneE164 || `${phoneCountry.dial}…`}
              </span>
            </div>

            <SheetActions
              onCancel={() => setSheet(null)}
              disabled={phoneBusy || !validPhoneE164}
              saveText={phoneBusy ? "Sending…" : "Send code"}
              onSave={() => sendSms(phoneE164)}
            />

            {errorMsg ? (
              <p className="text-[10px] font-semibold text-rose-600">
                {errorMsg}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <FieldLabel label="Verification code">
              <input
                value={smsCode}
                onChange={(event) =>
                  setSmsCode(
                    event.target.value.replace(/[^\d]/g, "").slice(0, 6)
                  )
                }
                placeholder="6-digit code"
                className="h-11 w-full rounded-xl border border-[#D9D3C7] bg-white px-3 text-sm font-bold tracking-[0.2em] outline-none transition focus:border-[#173C2E]/45"
              />
            </FieldLabel>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={phoneBusy}
                onClick={() => {
                  setSmsSent(false);
                  setSmsCode("");
                }}
                className="text-[10px] font-black text-slate-500 hover:text-[#173C2E]"
              >
                Change number
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={phoneBusy || !validPhoneE164}
                  onClick={() => sendSms(phoneE164)}
                  className="h-10 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-slate-600 transition hover:bg-[#F3F1EB] disabled:opacity-50"
                >
                  Resend
                </button>

                <button
                  type="button"
                  disabled={phoneBusy || smsCode.length !== 6}
                  onClick={confirmSms}
                  className="h-10 rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:bg-[#214C3A] disabled:opacity-50"
                >
                  {phoneBusy ? "Verifying…" : "Verify & link"}
                </button>
              </div>
            </div>

            {errorMsg ? (
              <p className="text-[10px] font-semibold text-rose-600">
                {errorMsg}
              </p>
            ) : null}
          </div>
        )}
      </BottomSheet>

      <div id="recaptcha-container" />

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Permanently delete your ekarihub account?"
        message="This will delete your profile, deeds, listings, discussions, events and any uploaded files. This cannot be undone."
        confirmText={deleting ? "Deleting…" : "Yes, delete everything"}
        cancelText="Cancel"
        onCancel={() => {
          if (!deleting) setConfirmDeleteOpen(false);
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  );

  // ✅ Loading UI
  if (loading) {
    const LoadingBody = (
      <div className="grid min-h-[100svh] place-items-center bg-[#F8F7F2]">
        <div className="text-center">
          <BouncingBallLoader />
          <p className="mt-3 text-[10px] font-semibold text-slate-400">
            Loading profile settings…
          </p>
        </div>
      </div>
    );

    return isMobile ? (
      LoadingBody
    ) : (
      <AppShell>{LoadingBody}</AppShell>
    );
  }

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#F8F7F2]"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
      >
        {PageContent}
      </div>
    );
  }

  return (
    <AppShell>
      <div
        className="h-full overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#F8F7F2]"
        style={{
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
      >
        {PageContent}
      </div>
    </AppShell>
  );
}

function SettingsSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-[18px] border border-[#DDD8CC] bg-[#FBFAF6] p-4 shadow-[0_10px_28px_rgba(15,23,42,0.025)] sm:p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#E8ECE8] text-[#173C2E]">
          {icon}
        </span>

        <div>
          <h2 className="text-[13px] font-black text-slate-900">
            {title}
          </h2>

          <p className="mt-0.5 text-[9px] font-medium leading-4 text-slate-400">
            {subtitle}
          </p>
        </div>
      </div>

      {children}
    </motion.section>
  );
}

function ToggleItemRow({
  label,
  value,
  checked,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  checked: boolean;
  icon?: React.ReactNode;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-[76px] items-center justify-between gap-3 rounded-[14px] border border-[#E4DED2] bg-white px-3.5 py-3 transition hover:border-[#CFC8BB]">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 text-[#F39A22]">
            {icon}
          </span>
        ) : null}

        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
            {label}
          </div>

          <div className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
            {value}
          </div>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative h-[28px] w-[50px] shrink-0 rounded-full",
          "border transition-all duration-300 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#173C2E]/25",
          "active:scale-[0.98]",
          checked
            ? "border-[#173C2E] bg-[#173C2E]"
            : "border-[#D5D9D6] bg-[#E7EAE8]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white",
            "shadow-[0_2px_6px_rgba(15,23,42,0.20)]",
            "transition-all duration-300 ease-out",
            checked ? "left-[26px]" : "left-[3px]",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function ItemRow({
  label,
  value,
  onEdit,
  locked,
  status,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  locked?: boolean;
  status?: "success" | "warning";
}) {
  return (
    <div className="flex min-h-[76px] items-center justify-between gap-3 rounded-[14px] border border-[#E4DED2] bg-white px-3.5 py-3 transition hover:border-[#CFC8BB]">
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-2">
          <div className="text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">
            {label}
          </div>

          {status ? (
            <span
              className={[
                "h-2 w-2 rounded-full",
                status === "success"
                  ? "bg-emerald-500"
                  : "bg-amber-500",
              ].join(" ")}
            />
          ) : null}
        </div>

        <div className="mt-1 break-words text-[11px] font-black leading-5 text-slate-700">
          {value}
        </div>
      </div>

      <div className="shrink-0">
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-[#F3F1EB] px-2.5 py-1.5 text-[9px] font-black text-slate-400">
            <IoLockClosed size={11} />
            Locked
          </span>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D9D3C7] bg-white px-2.5 text-[9px] font-black text-slate-600 transition hover:bg-[#EEF3EE] hover:text-[#173C2E]"
          >
            <IoPencil size={11} />
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function SheetActions({
  onCancel,
  onSave,
  saveText = "Save",
  disabled = false,
  className = "",
}: {
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  saveText?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={["flex justify-end gap-2 pt-1", className].join(" ")}>
      <button
        type="button"
        onClick={onCancel}
        className="h-10 rounded-xl border border-[#D9D3C7] bg-white px-4 text-[10px] font-black text-slate-600 transition hover:bg-[#F3F1EB]"
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={() => void onSave()}
        disabled={disabled}
        className="h-10 rounded-xl bg-[#173C2E] px-4 text-[10px] font-black text-white transition hover:bg-[#214C3A] disabled:opacity-50"
      >
        {saveText}
      </button>
    </div>
  );
}

function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-3">
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            className="relative z-[91] w-full max-w-lg overflow-hidden rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] shadow-[0_24px_70px_rgba(0,0,0,0.22)]"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 24,
              mass: 0.7,
            }}
          >
            <div className="flex items-center justify-between border-b border-[#E4DED2] px-4 py-3.5">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.08em] text-[#F39A22]">
                  Profile settings
                </div>

                <div
                  id="sheet-title"
                  className="mt-0.5 text-[14px] font-black text-slate-900"
                >
                  {title}
                </div>
              </div>

              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#D9D3C7] bg-white text-slate-500 transition hover:bg-[#F3F1EB] hover:text-slate-900"
                onClick={onClose}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-4">
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

function TagPicker({
  label,
  value,
  onChange,
  options,
  popular = [],
  max = 8,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  popular?: string[];
  max?: number;
}) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const canAddMore = value.length < max;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return [] as string[];

    return options
      .filter((option) => !selected.has(option))
      .filter((option) => option.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, options, selected]);

  const add = (tag: string) => {
    if (!canAddMore || selected.has(tag)) return;
    onChange([...value, tag]);
  };

  const remove = (tag: string) =>
    onChange(value.filter((item) => item !== tag));

  const toggle = (tag: string) =>
    selected.has(tag) ? remove(tag) : add(tag);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-slate-800">
          {label}
        </span>

        <span className="text-[9px] font-semibold text-slate-400">
          {value.length}/{max}
        </span>
      </div>

      {value.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => remove(tag)}
              className="rounded-full bg-[#173C2E] px-2.5 py-1 text-[9px] font-black text-white"
            >
              {tag} ×
            </button>
          ))}
        </div>
      ) : null}

      {popular.length ? (
        <div className="mt-3 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {popular.map((tag) => {
            const active = selected.has(tag);

            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                disabled={!active && !canAddMore}
                className={[
                  "rounded-full border px-2.5 py-1.5 text-[9px] font-black transition",
                  active
                    ? "border-[#173C2E] bg-[#173C2E] text-white"
                    : "border-[#D9D3C7] bg-white text-slate-600 hover:bg-[#F3F1EB]",
                ].join(" ")}
              >
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 flex h-11 items-center rounded-xl border border-[#D9D3C7] bg-white px-3 transition focus-within:border-[#173C2E]/45">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>

      {filtered.length ? (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[#D9D3C7] bg-white">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => add(option)}
              disabled={!canAddMore}
              className="w-full border-b border-[#EEEAE2] px-3 py-2.5 text-left text-[10px] font-semibold text-slate-600 transition last:border-b-0 hover:bg-[#F8F7F2]"
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}