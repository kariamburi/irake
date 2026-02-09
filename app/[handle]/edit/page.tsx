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
import { IoArrowBack, IoPencil, IoLockClosed } from "react-icons/io5";
import Cropper from "react-easy-crop";

import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

/* ===================== Brand ===================== */
const EKARI = {
  forest: "#233F39",
  leaf: "#1F3A34",
  gold: "#C79257",
  sand: "#FFFFFF",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  danger: "#B42318",
  subtext: "#5C5B66",
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
export default function EditProfilePage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();

  const isDesktop = useIsDesktop();
  const isMobile = useIsMobile();

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
  const handleConfirmDelete = async () => {
    if (!uid) return;
    setDeleting(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const functions = getFunctions();
      const fn = httpsCallable(functions, "deleteAccountCascade");
      await fn({});

      await auth.signOut();
      router.replace("/");
    } catch (err: any) {
      console.error("Delete account failed", err);
      setErrorMsg(err?.message || "Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  const validWebsite = validateUrl(website || "");

  // ✅ Build the main content once, then wrap it differently for mobile/desktop
  const PageContent = (
    <>
      <div className="w-full min-h-screen px-4 py-4">
        {/* Desktop header only (mobile uses sticky header wrapper) */}
        {isDesktop && (
          <div className="flex h-12 items-center justify-between border-b border-gray-200">
            <button
              onClick={goBack}
              className="p-2 -ml-2 rounded hover:bg-gray-50"
              aria-label="Back"
            >
              <IoArrowBack size={20} />
            </button>
            <div className="font-extrabold text-slate-900">Edit Profile</div>
            <div className="w-8" />
          </div>
        )}

        {profileUpdatedAtText && (
          <p className="mt-2 text-xs text-center text-slate-500">
            Last updated: {profileUpdatedAtText}
          </p>
        )}

        {/* Avatar */}
        <div className="flex flex-col items-center mt-4 mb-2">
          <div className="p-1 rounded-full bg-gradient-to-tr from-[#C79257] to-[#233F39] shadow-sm">
            <div className="p-1 rounded-full bg-white">
              <div
                className="h-26 w-26 relative rounded-full overflow-hidden"
                style={{ height: 104, width: 104 }}
              >
                {photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoURL} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <Image
                    src="/avatar-placeholder.png"
                    alt="avatar"
                    fill
                    className="object-cover"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Change / reset controls */}
          <div className="mt-2 flex flex-col items-center gap-1">
            <label className="text-[#C79257] font-bold underline cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickAvatar}
              />
              Change Photo
            </label>

            <button
              type="button"
              onClick={onResetAvatar}
              disabled={saving || (!photoURL && !initialPhotoURL)}
              className="text-xs text-slate-500 hover:text-rose-500 disabled:opacity-40"
            >
              Reset to default avatar
            </button>
          </div>
        </div>

        {/* Alerts */}
        <div className="mt-3 space-y-2">
          {!!errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}
          {!!successMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {successMsg}
            </div>
          )}
        </div>

        {/* Sections */}
        <div className="mt-5 space-y-6">
          {/* Profile section */}
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
              Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-3">
              <ItemRow
                label="Name"
                value={`${firstName || "-"} ${surname || ""}`.trim() || "-"}
                onEdit={() => setSheet("name")}
              />
              <ItemRow label="Username" value={handle || "-"} locked />
              <ItemRow label="Bio" value={bio || "Add bio"} onEdit={() => setSheet("bio")} />
            </div>
          </section>

          {/* Contact section */}
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
              Contact
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-3">
              <ItemRow
                label="Phone"
                value={phone ? `${phoneVerified ? "✅ " : "⚠️ "}${phone}` : "Add phone"}
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
          </section>

          {/* Preferences section */}
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
              Preferences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-3">
              <ItemRow
                label="Preferred currency"
                value={
                  preferredCurrency
                    ? preferredCurrency === "KES"
                      ? "KES – Kenyan Shilling (M-Pesa available)"
                      : "USD – US Dollar"
                    : "Auto (based on country)"
                }
                onEdit={() => setSheet("currency")}
              />
              <ItemRow
                label="Interests"
                value={areaOfInterest.length ? `${areaOfInterest.length} selected` : "Add interests"}
                onEdit={() => setSheet("interests")}
              />
              <ItemRow
                label="Roles"
                value={roles.length ? `${roles.length} selected` : "Add roles"}
                onEdit={() => setSheet("roles")}
              />
            </div>
          </section>

          {/* Danger zone section */}
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-wide text-rose-600 mb-2">
              Danger zone
            </h2>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 flex flex-col gap-2">
              <div className="text-sm font-semibold text-rose-800">Delete account</div>
              <p className="text-xs text-rose-700 leading-relaxed">
                This will permanently delete your ekarihub account, all your deeds, listings,
                discussions, events any uploaded files. This action cannot be undone.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleting}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete account"}
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* ✅ Mobile safe-area bottom spacer */}
        {isMobile && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
      </div>

      {/* Avatar crop sheet */}
      <BottomSheet open={avatarCropOpen} title="Crop profile photo" onClose={onCancelAvatarCrop}>
        {avatarPreview ? (
          <div className="space-y-4">
            {/* Live circular preview */}
            <div className="flex justify-center mb-1">
              <div className="w-24 h-24 rounded-full border-2 border-[#C79257] shadow-sm overflow-hidden bg-slate-100">
                {avatarPreviewCropped ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreviewCropped}
                    alt="Crop preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="Crop preview"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>

            {/* Main crop area */}
            <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden">
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

            {/* Zoom slider */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: EKARI.forest }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button className="h-10 px-4 rounded-xl border" onClick={onCancelAvatarCrop} disabled={saving}>
                Cancel
              </button>
              <button
                className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold disabled:opacity-60"
                onClick={onConfirmAvatarCrop}
                disabled={saving || !croppedAreaPixels}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No image selected. Choose a photo to crop.</p>
        )}
      </BottomSheet>

      {/* SHEETS */}
      <BottomSheet open={sheet === "name"} title="Edit name" onClose={() => setSheet(null)}>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-slate-800">First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800">Surname</label>
            <input
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              placeholder="Surname"
              className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button
              className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold"
              onClick={async () => {
                await saveField({ firstName, surname });
                setSheet(null);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "bio"} title="Edit bio" onClose={() => setSheet(null)}>
        <div className="space-y-2">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={220}
            placeholder="Tell people about you…"
            className="mt-1 h-32 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
          />
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{bio.length}/220</span>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button
              className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold"
              onClick={async () => {
                await saveField({ bio });
                setSheet(null);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "website"} title="Website URL" onClose={() => setSheet(null)}>
        <div className="space-y-2">
          <input
            value={website || ""}
            onChange={(e: any) => setWebsite(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3"
          />
          {!validWebsite && <p className="text-xs text-rose-600">Invalid URL</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button
              disabled={!validWebsite}
              className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold disabled:opacity-60"
              onClick={async () => {
                await saveField({
                  website: (website || "")?.trim() || null,
                });
                setSheet(null);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "currency"} title="Preferred currency" onClose={() => setSheet(null)}>
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            This will be the default currency for uplifts you make.
          </p>
          <p className="text-xs text-slate-500">
            M-Pesa is only available when donating in{" "}
            <span className="font-semibold">KES</span>.
          </p>

          <div className="mt-3 space-y-2">
            {(["KES", "USD"] as ("KES" | "USD")[]).map((code) => {
              const active = preferredCurrency === code;
              const label = code === "KES" ? "KES – Kenyan Shilling" : "USD – US Dollar";
              const note =
                code === "KES"
                  ? "Best for Kenya-based uplifts (M-Pesa supported)."
                  : "Good for global / international donors.";

              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setPreferredCurrency(code)}
                  className={`w-full flex items-start gap-2 rounded-xl border px-3 py-2 text-left ${active ? "border-[#233F39] bg-[#233F39]/5" : "border-gray-200 bg-white"
                    }`}
                >
                  <div className="mt-1">
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center ${active ? "border-[#233F39]" : "border-gray-300"
                        }`}
                    >
                      {active && <div className="h-2.5 w-2.5 rounded-full bg-[#233F39]" />}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{label}</div>
                    <div className="text-xs text-slate-500">{note}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>
              Cancel
            </button>
            <button
              disabled={!preferredCurrency}
              className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold disabled:opacity-60"
              onClick={async () => {
                if (!preferredCurrency) return;
                await saveField({ preferredCurrency });
                setSheet(null);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "interests"} title="Edit interests" onClose={() => setSheet(null)}>
        {taxonomyLoading && <p className="text-xs text-gray-500 mb-1">Loading interest options…</p>}
        {taxonomyError && <p className="text-xs text-rose-600 mb-1">{taxonomyError}</p>}
        <TagPicker
          label="Interests"
          value={areaOfInterest}
          onChange={setAreaOfInterest}
          options={interestOptions}
          popular={interestOptions}
          max={10}
        />
        <div className="flex justify-end gap-2 pt-3">
          <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <button
            className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold"
            onClick={async () => {
              await saveField({ areaOfInterest });
              setSheet(null);
            }}
          >
            Save
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "roles"} title="Edit roles" onClose={() => setSheet(null)}>
        {taxonomyLoading && <p className="text-xs text-gray-500 mb-1">Loading role options…</p>}
        {taxonomyError && <p className="text-xs text-rose-600 mb-1">{taxonomyError}</p>}
        <TagPicker
          label="Roles"
          value={roles}
          onChange={setRoles}
          options={roleOptions}
          popular={roleOptions}
          max={10}
        />
        <div className="flex justify-end gap-2 pt-3">
          <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>
            Cancel
          </button>
          <button
            className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold"
            onClick={async () => {
              await saveField({ roles });
              setSheet(null);
            }}
          >
            Save
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "phone"} title="Verify & link phone" onClose={() => setSheet(null)}>
        {!smsSent ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Phone number</label>

              <div
                className="mt-1 flex items-center h-11 rounded-xl border bg-[#F6F7FB] px-2 gap-2
            focus-within:border-[rgba(35,63,57,0.7)]
            focus-within:ring-1 focus-within:ring-[rgba(35,63,57,0.6)]"
                style={{ borderColor: EKARI.hair }}
              >
                <CountryPicker value={phoneCountry} onChange={setPhoneCountry} disabled={phoneBusy} />
                <div className="h-6 w-px bg-gray-300" />
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="712345678"
                  maxLength={12}
                  className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                  value={localPhone}
                  onChange={(e) => setLocalPhone(e.target.value.replace(/[^\d]/g, ""))}
                  disabled={phoneBusy}
                />
              </div>

              <div className="mt-1 text-[11px]" style={{ color: EKARI.dim }}>
                Sending to: <span className="font-semibold">{phoneE164 || `${phoneCountry.dial}…`}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>
                Cancel
              </button>
              <button
                disabled={phoneBusy || !validPhoneE164}
                className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold disabled:opacity-60"
                onClick={() => sendSms(phoneE164)}
              >
                {phoneBusy ? "Sending…" : "Send code"}
              </button>
            </div>

            {!!errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Enter verification code</label>
              <input
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                placeholder="6-digit code"
                className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3"
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                className="text-sm underline"
                disabled={phoneBusy}
                onClick={() => {
                  setSmsSent(false);
                  setSmsCode("");
                }}
              >
                Back
              </button>

              <div className="flex gap-2">
                <button
                  disabled={phoneBusy || !validPhoneE164}
                  className="h-10 px-4 rounded-xl border"
                  onClick={() => sendSms(phoneE164)}
                >
                  Resend
                </button>

                <button
                  disabled={phoneBusy || smsCode.length !== 6}
                  className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold disabled:opacity-60"
                  onClick={confirmSms}
                >
                  {phoneBusy ? "Verifying…" : "Verify & Link"}
                </button>
              </div>
            </div>

            {!!errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
          </div>
        )}
      </BottomSheet>


      {/* invisible recaptcha node */}
      <div id="recaptcha-container" />

      {/* Global confirm modal for delete account */}
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

  // ✅ Loading UI (wrapped)
  if (loading) {
    const LoadingBody = (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-[color:var(--ekari-gold,#C79257)]">
          <BouncingBallLoader />
        </div>
      </div>
    );

    if (isMobile) {
      return (
        <div className="fixed inset-0 flex flex-col bg-white">
          <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
            <div
              className="h-14 px-3 flex items-center gap-2"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <button
                onClick={goBack}
                className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
                aria-label="Back"
              >
                <IoArrowBack size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-black" style={{ color: EKARI.text }}>
                  Edit Profile
                </div>
                <div className="truncate text-[11px]" style={{ color: EKARI.subtext }}>
                  {String(params?.handle || "").replace(/^@/, "")}
                </div>
              </div>
              <div className="w-10" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">{LoadingBody}</div>
        </div>
      );
    }

    return <AppShell>{LoadingBody}</AppShell>;
  }

  // ✅ Mobile wrapper: sticky header + scroll area (no AppShell)
  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col bg-white">
        <div className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div
            className="h-14 px-3 flex items-center gap-2"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <button
              onClick={goBack}
              className="h-10 w-10 rounded-full border border-gray-200 grid place-items-center"
              aria-label="Back"
              title="Back"
            >
              <IoArrowBack size={18} />
            </button>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-black" style={{ color: EKARI.text }}>
                Edit Profile
              </div>
              <div className="truncate text-[11px]" style={{ color: EKARI.subtext }}>
                {String(params?.handle || "").replace(/^@/, "")}
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">{PageContent}</div>
      </div>
    );
  }

  // ✅ Desktop wrapper: keep AppShell
  return <AppShell>{PageContent}</AppShell>;
}

/* =========================================================
   ItemRow — card-style row
   ========================================================= */
function ItemRow({
  label,
  value,
  onEdit,
  locked,
}: {
  label: string;
  value: string;
  onEdit?: () => void;
  locked?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-4 flex items-center justify-between hover:border-[#C79257]/70 hover:shadow-md transition-all">
      <div className="pr-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="mt-1 text-sm text-slate-900 font-semibold break-words">
          {value}
        </div>
      </div>
      <div className="shrink-0">
        {locked ? (
          <span className="inline-flex items-center gap-1 text-slate-400 text-xs">
            <IoLockClosed size={14} /> Locked
          </span>
        ) : (
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-slate-800"
          >
            <IoPencil size={14} /> Edit
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   BottomSheet primitive (accessible)
   ========================================================= */
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

  // Avoid SSR document access issues
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Centered dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            className="relative z-[91] w-[92vw] max-w-md md:max-w-lg rounded-2xl bg-white border border-gray-200 shadow-xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ type: "spring", stiffness: 240, damping: 22, mass: 0.7 }}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <div id="sheet-title" className="font-extrabold text-slate-900">
                {title}
              </div>
              <button
                className="px-2 py-1 text-slate-600 hover:text-slate-900"
                onClick={onClose}
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[70vh] md:max-h-[75vh]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* =========================================================
   TagPicker — lightweight multi-select chips with search
   ========================================================= */
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
      .filter((o) => !selected.has(o))
      .filter((o) => o.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, options, selected]);

  const add = (t: string) => {
    if (!canAddMore || selected.has(t)) return;
    onChange([...value, t]);
  };
  const remove = (t: string) => onChange(value.filter((x) => x !== t));
  const toggle = (t: string) => (selected.has(t) ? remove(t) : add(t));

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-slate-900">{label}</span>
        <span className="text-xs text-gray-500">
          {value.length}/{max}
        </span>
      </div>

      {!!value.length && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((t) => (
            <button
              key={t}
              onClick={() => remove(t)}
              className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold"
            >
              {t} ×
            </button>
          ))}
        </div>
      )}

      {!!popular.length && (
        <div className="flex flex-wrap gap-2 mt-3">
          {popular.map((p) => {
            const active = selected.has(p);
            return (
              <button
                key={p}
                onClick={() => toggle(p)}
                disabled={!active && !canAddMore}
                className={`rounded-full px-3 py-2 text-sm font-extrabold border ${active
                  ? "bg-[#233F39] text-white border-[#233F39]"
                  : "bg-white text-slate-900 border-gray-200"
                  }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 border border-gray-200 rounded-xl bg-gray-50 px-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label.toLowerCase()}…`}
          className="h-11 w-full bg-transparent outline-none"
        />
      </div>

      {!!filtered.length && (
        <div className="mt-2 max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white">
          {filtered.map((opt) => (
            <button
              key={opt}
              onClick={() => add(opt)}
              disabled={!canAddMore}
              className="w-full text-left px-3 py-2 hover:bg-gray-50"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
