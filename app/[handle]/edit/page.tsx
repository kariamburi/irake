"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  query,
  collection,
  where,
  limit,
  getDocs,
  serverTimestamp,
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
import {
  IoArrowBack,
  IoPencil,
  IoLockClosed,
} from "react-icons/io5";
import AppShell from "@/app/components/AppShell";
import BouncingBallLoader from "@/components/ui/TikBallsLoader";

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
  subtext: "#5C6B66",
};

/* ====== Catalogs (aligned with OnboardingWizard) ====== */
const INTERESTS = [
  "Maize", "Tomato", "Potato", "Coffee", "Vegetables", "Fruits", "Dairy", "Beef", "Poultry", "Fish", "Honey", "Forestry", "Flowers", "Cereals",
  "Seeds", "Fertilizers", "Agrochemicals", "Feeds", "Tools", "Machinery", "Irrigation", "Greenhouses",
  "Processing", "Value Addition", "Packaging", "Cold Chain", "Quality Control",
  "Market Linkages", "Export", "Organic", "Traceability", "Compliance",
  "Training", "Extension", "Soil Testing", "Vet Services", "Breeding / AI",
  "Vaccines & Drugs", "Agronomist", "AgriTech", "Farm Apps",
  "Loans", "Insurance", "Microfinance", "Sacco", "Consultancy", "Leasing",
  "Cooperatives", "Transport", "Logistics",
  "Climate Smart", "Resilience", "Water Management",
  "Pests", "Diseases", "Contamination", "Fall Armyworm", "Stem Borer", "Tomato Leafminer (Tuta absoluta)",
  "Maize Lethal Necrosis", "Late Blight", "Bacterial Wilt", "Coffee Rust", "Foot and Mouth", "Newcastle Disease",
  "East Coast Fever", "Mastitis", "Aflatoxin", "Mycotoxins",
];

const ROLES = [
  "Farmer", "Beekeeper", "Horticulturalist", "Livestock Keeper", "Aquaculture", "Forestry",
  "Input Supplier", "Equipment / Machinery Dealer", "Irrigation / Greenhouse Vendor",
  "Veterinarian", "Para-vet", "Breeder / AI", "Agronomist", "Animal Health Distributor",
  "Processor", "Value Adder", "Packer / Packaging", "Cold Storage / Cold Chain",
  "Aggregator", "Cooperative", "Trader", "Exporter", "Retailer",
  "Online Distributor", "Transporter / Logistics",
  "Bank", "Microfinance", "Sacco", "Insurance", "Consultant", "Leasing",
  "Researcher", "Trainer / Extension", "ICT / AgriTech Provider",
  "Government Agency", "Regulator", "Certifier", "NGO / Development Partner",
  "Consumer / Buyer (Household)", "Consumer / Buyer (Institution)", "Export Buyer",
];

/* ============== Helpers ============== */
const validateUrl = (v: string) =>
  !v || /^https?:\/\/[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:\/?#[\]@!$&'()*+,;=.]+$/.test(v.trim());

/* =========================================================
   PAGE (/[handle]/edit) — Professional UI with per-field sheets
   - Handle is READ-ONLY now
   - Each field shows an Edit button that opens a bottom sheet
   ========================================================= */
export default function EditProfilePage() {
  const params = useParams<{ handle: string }>();
  const router = useRouter();

  const db = getFirestore();
  const storage = getStorage();
  const auth = getAuth();

  // ---------- Top-level state ----------
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  type SheetKind = null | "name" | "bio" | "website" | "phone" | "interests" | "roles";
  const [sheet, setSheet] = useState<SheetKind>(null);

  // phone link state
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const confirmationResultRef = useRef<ReturnType<typeof linkWithPhoneNumber> extends Promise<infer T> ? T : any | null>(null);
  const recaptchaRef = useRef<any>(null);

  // ---------- Load current user + guard by route handle ----------
  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return; }
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
          setPhoneVerified(!!d.phoneVerified || !!u.phoneNumber);

          const routeH = (params?.handle || "").toString().replace(/^@/, "").toLowerCase();
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
    setSaving(true);
    setErrorMsg("");
    try {
      const rf = sRef(storage, `avatars/${uid}/${Date.now()}-${file.name}`);
      await uploadBytes(rf, file);
      const url = await getDownloadURL(rf);
      setPhotoURL(url);
      if (initialPhotoURL && initialPhotoURL !== url && isFirebaseUrl(initialPhotoURL)) {
        try { await deleteObject(sRef(storage, initialPhotoURL)); } catch { }
      }
      setInitialPhotoURL(url);
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not upload avatar.");
    } finally {
      setSaving(false);
      e.currentTarget.value = "";
    }
  };

  const isFirebaseUrl = (u?: string | null) => !!u && (u.startsWith("gs://") || u.includes("firebasestorage.googleapis.com"));

  const saveField = async (patch: Record<string, any>) => {
    if (!uid) return;
    setSaving(true);
    setErrorMsg("");
    try {
      await updateDoc(doc(db, "users", uid), { ...patch, updatedAt: serverTimestamp() });
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Phone link (web SDK with invisible Recaptcha) ----------
  const ensureRecaptcha = () => {
    if (recaptchaRef.current) return true;
    try {
      const node = document.getElementById("recaptcha-container") || (() => {
        const div = document.createElement("div");
        div.id = "recaptcha-container"; div.style.position = "fixed"; div.style.bottom = "-10000px"; document.body.appendChild(div); return div;
      })();
      // @ts-ignore
      recaptchaRef.current = new RecaptchaVerifier(getAuth(), node, { size: "invisible" });
      return true;
    } catch { return false; }
  };

  const sendSms = async (raw: string) => {
    if (!uid) return;
    const e164 = raw.startsWith("+") ? raw : `+${raw}`;
    if (!/^\+\d{8,15}$/.test(e164)) { setErrorMsg("Invalid phone number"); return; }
    setPhoneBusy(true);
    setErrorMsg("");
    try {
      ensureRecaptcha();
      // @ts-ignore
      const conf = await linkWithPhoneNumber(getAuth().currentUser!, e164, recaptchaRef.current);
      confirmationResultRef.current = conf;
      setSmsSent(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "Could not send code");
    } finally {
      setPhoneBusy(false);
    }
  };

  const confirmSms = async () => {
    if (!confirmationResultRef.current) return;
    setPhoneBusy(true);
    setErrorMsg("");
    try {
      await confirmationResultRef.current.confirm(smsCode);
      await saveField({ phone, phoneVerified: true });
      setPhoneVerified(true);
      setSheet(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Invalid code");
    } finally {
      setPhoneBusy(false);
    }
  };

  // ---------- UI ----------
  if (loading) {
    return (<AppShell>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-[color:var(--ekari-gold,#C79257)]"><BouncingBallLoader /></div>
      </div></AppShell>
    );
  }

  const validWebsite = validateUrl(website || "");

  return (
    <AppShell>
      <div className="w-full px-4 py-4">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-gray-200">
          <button onClick={() => router.back()} className="p-2 -ml-2 rounded hover:bg-gray-50" aria-label="Back">
            <IoArrowBack size={20} />
          </button>
          <div className="font-extrabold text-slate-900">Edit Profile</div>
          <div className="w-8" />
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center mt-4 mb-2">
          <div className="p-1 rounded-full bg-gradient-to-tr from-[#C79257] to-[#233F39] shadow-sm">
            <div className="p-1 rounded-full bg-white">
              <div className="h-26 w-26 relative rounded-full overflow-hidden" style={{ height: 104, width: 104 }}>
                {photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoURL} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <Image src="/avatar-placeholder.png" alt="avatar" fill className="object-cover" />
                )}
              </div>
            </div>
          </div>
          <label className="mt-2 text-[#C79257] font-bold underline cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
            Change Photo
          </label>
        </div>

        {/* Read-only fields with Edit actions */}
        <div className="mt-4 divide-y rounded-2xl border bg-white shadow-sm overflow-hidden">
          <ItemRow label="Name" value={`${firstName || "-"} ${surname || ""}`.trim() || "-"} onEdit={() => setSheet("name")} />
          <ItemRow label="Username" value={handle || "-"} locked />
          <ItemRow label="Bio" value={bio || "Add bio"} onEdit={() => setSheet("bio")} />
          <ItemRow label="Phone" value={phone ? `${phoneVerified ? "✅ " : "⚠️ "}${phone}` : "Add phone"} onEdit={() => setSheet("phone")} />
          <ItemRow label="Website" value={website || "Add website"} onEdit={() => setSheet("website")} />
          <ItemRow label="Interests" value={areaOfInterest.length ? `${areaOfInterest.length} selected` : "Add interests"} onEdit={() => setSheet("interests")} />
          <ItemRow label="Roles" value={roles.length ? `${roles.length} selected` : "Add roles"} onEdit={() => setSheet("roles")} />
        </div>

        {!!errorMsg && <p className="text-center text-rose-600 mt-3">{errorMsg}</p>}


      </div>

      {/* SHEETS */}
      <BottomSheet open={sheet === "name"} title="Edit name" onClose={() => setSheet(null)}>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-slate-800">First name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-800">Surname</label>
            <input value={surname} onChange={(e) => setSurname(e.target.value)} placeholder="Surname" className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>Cancel</button>
            <button className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold" onClick={async () => { await saveField({ firstName, surname }); setSheet(null); }}>Save</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "bio"} title="Edit bio" onClose={() => setSheet(null)}>
        <div className="space-y-2">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={220} placeholder="Tell people about you…" className="mt-1 h-32 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2" />
          <div className="flex items-center justify-between text-xs text-gray-500"><span>{bio.length}/220</span></div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>Cancel</button>
            <button className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold" onClick={async () => { await saveField({ bio }); setSheet(null); }}>Save</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "website"} title="Website URL" onClose={() => setSheet(null)}>
        <div className="space-y-2">
          <input value={website || ""} onChange={(e) => setWebsite(e.target.value)} placeholder="https://example.com" className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3" />
          {!validWebsite && <p className="text-xs text-rose-600">Invalid URL</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>Cancel</button>
            <button disabled={!validWebsite} className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold disabled:opacity-60" onClick={async () => { await saveField({ website: (website || "")?.trim() || null }); setSheet(null); }}>Save</button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "interests"} title="Edit interests" onClose={() => setSheet(null)}>
        <TagPicker label="Interests" value={areaOfInterest} onChange={setAreaOfInterest} options={INTERESTS} popular={INTERESTS.slice(0, 12)} max={8} />
        <div className="flex justify-end gap-2 pt-3">
          <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>Cancel</button>
          <button className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold" onClick={async () => { await saveField({ areaOfInterest }); setSheet(null); }}>Save</button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "roles"} title="Edit roles" onClose={() => setSheet(null)}>
        <TagPicker label="Roles" value={roles} onChange={setRoles} options={ROLES} popular={ROLES.slice(0, 12)} max={5} />
        <div className="flex justify-end gap-2 pt-3">
          <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>Cancel</button>
          <button className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold" onClick={async () => { await saveField({ roles }); setSheet(null); }}>Save</button>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "phone"} title="Verify & link phone" onClose={() => setSheet(null)}>
        {!smsSent ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Your phone number</label>
              <input value={phone || ""} onChange={(e) => setPhone(e.target.value)} placeholder="+2547XXXXXXXX" className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3" />
            </div>
            <div className="flex justify-end gap-2">
              <button className="h-10 px-4 rounded-xl border" onClick={() => setSheet(null)}>Cancel</button>
              <button disabled={phoneBusy} className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold disabled:opacity-60" onClick={() => sendSms(phone || "")}>
                {phoneBusy ? "Sending…" : "Send code"}
              </button>
            </div>
            {!!errorMsg && <p className="text-xs text-rose-600">{errorMsg}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Enter verification code</label>
              <input value={smsCode} onChange={(e) => setSmsCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="6-digit code" className="mt-1 h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3" />
            </div>
            <div className="flex justify-between items-center">
              <button className="text-sm underline" disabled={phoneBusy} onClick={() => { setSmsSent(false); setSmsCode(""); }}>Back</button>
              <div className="flex gap-2">
                <button disabled={phoneBusy} className="h-10 px-4 rounded-xl border" onClick={() => sendSms(phone || "")}>Resend</button>
                <button disabled={phoneBusy || smsCode.length !== 6} className="h-10 px-4 rounded-xl bg-[#C79257] text-white font-bold disabled:opacity-60" onClick={confirmSms}>
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
    </AppShell>
  );
}

/* =========================================================
   ItemRow — compact modern row with trailing Edit
   ========================================================= */
function ItemRow({ label, value, onEdit, locked }: { label: string; value: string; onEdit?: () => void; locked?: boolean; }) {
  return (
    <div className="flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors">
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-slate-900 font-semibold break-words">{value}</div>
      </div>
      <div>
        {locked ? (
          <span className="inline-flex items-center gap-1 text-slate-400 text-sm"><IoLockClosed /> Locked</span>
        ) : (
          <button onClick={onEdit} className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-bold">
            <IoPencil /> Edit
          </button>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   BottomSheet primitive (accessible)
   ========================================================= */
function BottomSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:right-0 md:left-auto md:w-[480px] md:rounded-l-2xl bg-white border-t md:border-l border-gray-200 rounded-t-2xl shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="font-extrabold text-slate-900">{title}</div>
          <button className="px-2 py-1 text-slate-600" onClick={onClose}>✕</button>
        </div>
        <div className="p-4 overflow-auto max-h-[70vh] md:max-h-[80vh]">{children}</div>
      </div>
    </div>
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
    return options.filter(o => !selected.has(o)).filter(o => o.toLowerCase().includes(q)).slice(0, 12);
  }, [query, options, selected]);

  const add = (t: string) => { if (!canAddMore || selected.has(t)) return; onChange([...value, t]); };
  const remove = (t: string) => onChange(value.filter(x => x !== t));
  const toggle = (t: string) => (selected.has(t) ? remove(t) : add(t));

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-extrabold text-slate-900">{label}</span>
        <span className="text-xs text-gray-500">{value.length}/{max}</span>
      </div>

      {!!value.length && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map(t => (
            <button key={t} onClick={() => remove(t)} className="rounded-full border border-gray-200 px-3 py-1 text-sm font-semibold">
              {t} ×
            </button>
          ))}
        </div>
      )}

      {!!popular.length && (
        <div className="flex flex-wrap gap-2 mt-3">
          {popular.map(p => {
            const active = selected.has(p);
            return (
              <button key={p} onClick={() => toggle(p)} disabled={!active && !canAddMore}
                className={`rounded-full px-3 py-2 text-sm font-extrabold border ${active ? "bg-[#233F39] text-white border-[#233F39]" : "bg-white text-slate-900 border-gray-200"}`}>
                {p}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 border border-gray-200 rounded-xl bg-gray-50 px-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} className="h-11 w-full bg-transparent outline-none" />
      </div>

      {!!filtered.length && (
        <div className="mt-2 max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white">
          {filtered.map(opt => (
            <button key={opt} onClick={() => add(opt)} disabled={!canAddMore} className="w-full text-left px-3 py-2 hover:bg-gray-50">
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
