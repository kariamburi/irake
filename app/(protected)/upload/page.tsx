"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  IoCloudUploadOutline,
  IoSwapHorizontalOutline,
  IoTrashOutline,
  IoTimeOutline,
  IoChatbubbleOutline,
  IoLockOpenOutline,
  IoLocationOutline,
  IoMusicalNotesOutline,
  IoMenuOutline,
  IoClose,
  IoAdd,
  IoHomeOutline,
  IoCompassOutline,
  IoChatbubblesOutline,
  IoPersonCircleOutline,
} from "react-icons/io5";

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

import { createMuxDirectUpload, uploadVideoToMux } from "@/utils/muxUpload";
import HashtagPicker from "@/app/components/HashtagPicker";
import { buildEkariTrending } from "@/utils/ekariTags";
import { useTrendingTags } from "@/app/hooks/useTrendingTags";

/* ---------- EkariHub brand ---------- */
const EKARI = {
  forest: "#233F39",
  leaf: "#1F3A34",
  gold: "#C79257",
  sand: "#FFFFFF",
  hair: "#E5E7EB",
  text: "#0F172A",
  dim: "#6B7280",
  danger: "#B42318",
};

const MAX_VIDEO_SEC = 60;
const MAX_MEDIA_MB = 60;
const DRAFT_KEY = "ekari.createDeed.draft";
const CAPTION_MAX = 150;
/* ---------- helpers ---------- */
const pruneUndefined = <T extends Record<string, any>>(obj: T) => {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (v !== undefined) out[k] = v;
  }
  return out as T;
};

const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
const isBlobUrl = (u?: string | null) => !!u && u.startsWith("blob:");

type UserProfileDoc = {
  roles?: string[] | string;
  areaOfInterest?: string[] | string;
  country?: string;
  county?: string;
};

/* ---------- page ---------- */
export default function UploadPage() {
  const router = useRouter();

  /* ---------- auth (SSR-safe) ---------- */
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid;

  /* ---------- user profile (Firestore) ---------- */
  const [userProfile, setUserProfile] = useState<any | null>(null);

  useEffect(() => {
    if (!uid) {
      setUserProfile(null);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          setUserProfile(snap.data() as any);
        } else {
          setUserProfile(null);
        }
      } catch {
        setUserProfile(null);
      }
    })();
  }, [uid]);

  const asArray = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof v === "string")
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    return [];
  };

  const userRoles = asArray(userProfile?.roles);
  const userInterests = asArray(userProfile?.areaOfInterest);
  const userCountry = userProfile?.country || "kenya"; // default to Kenya unless you store country
  const userCounty = userProfile?.county || undefined;

  /* ---------- responsive nav ---------- */
  const [navOpen, setNavOpen] = useState(false);

  /* ---------- steps ---------- */
  const [step, setStep] = useState<0 | 1>(0);
  const [previewTab, setPreviewTab] = useState<"feed" | "profile" | "web">("feed");

  /* ---------- media ---------- */
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null); // object URL for preview
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [videoWH, setVideoWH] = useState<{ width?: number; height?: number }>({});

  // Cover/thumbnail generation
  const [coverMs, setCoverMs] = useState<number>(800);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [stripThumbs, setStripThumbs] = useState<string[]>([]);
  const [stripBusy, setStripBusy] = useState(false);

  /* ---------- form ---------- */
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [useGeo, setUseGeo] = useState(false);
  const [musicTitle, setMusicTitle] = useState("");

  /* ---------- ui ---------- */
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [bannerDraft, setBannerDraft] = useState(false);

  // poster to show in previews
  const posterUrl = thumbDataUrl ?? mediaUrl ?? "/video-placeholder.jpg";

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBannerDraft(!!localStorage.getItem(DRAFT_KEY) && step === 0 && !file);
  }, [step, file]);

  /* ---------- file select / drop ---------- */
  const onDrop = async (f: File) => {
    if (!f) return;
    const mb = f.size / (1024 * 1024);
    if (mb > MAX_MEDIA_MB) {
      alert(`Max ${MAX_MEDIA_MB} MB. Your file is ~${mb.toFixed(1)} MB.`);
      return;
    }
    if (!f.type.startsWith("video/")) {
      alert("Please select a video file.");
      return;
    }
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);

    setFile(f);
    const url = URL.createObjectURL(f);
    setMediaUrl(url);
    setProgress(0);
    setErrorMsg("");

    setThumbDataUrl(null);
    setCoverMs(800);
    setStripThumbs([]);

    // basic metadata (duration, width/height)
    try {
      const meta = await probeVideoMeta(url);
      setDurationSec(Math.round(meta.duration || 0));
      setVideoWH({ width: meta.width, height: meta.height });
      // default cover at ~0.8s
      const initialCover = await captureVideoFrame(url, 0.8);
      setThumbDataUrl(initialCover);
      // build strip async
      buildStrip(url, Math.max(1, Math.round(meta.duration || 0)));
    } finally {
      setStep(1);
    }
  };

  const buildStrip = async (url: string, durSec: number) => {
    setStripBusy(true);
    try {
      const frames = 8;
      const gap = durSec / (frames + 1);
      const out: string[] = [];
      for (let i = 1; i <= frames; i++) {
        const sec = i * gap;
        const dataUrl = await captureVideoFrame(url, sec);
        out.push(dataUrl);
      }
      setStripThumbs(out);
    } catch {
      setStripThumbs([]);
    } finally {
      setStripBusy(false);
    }
  };

  const generateThumbAt = async (ms: number) => {
    if (!mediaUrl) return;
    try {
      const dataUrl = await captureVideoFrame(mediaUrl, ms / 1000);
      setThumbDataUrl(dataUrl);
      setCoverMs(ms);
    } catch {
      // ignore
    }
  };

  /* ---------- tags ---------- */
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // extract #tags from caption
  const tagsFromCaption = useMemo(() => {
    return (caption.match(/#([A-Za-z0-9_]{2,30})/g) || [])
      .map((s) => s.slice(1).toLowerCase());
  }, [caption]);

  // final tags used by saveDeed payload
  const tags = useMemo(() => {
    return Array.from(new Set([...selectedTags.map((t) => t.toLowerCase()), ...tagsFromCaption]));
  }, [selectedTags, tagsFromCaption]);

  /* ---------- trending suggestions: live + taxonomy ---------- */
  const { list: liveTrending, meta: liveTrendingMeta } = useTrendingTags();

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
      limit: 48,
    });
    return uniq([...((liveTrending || []) as string[]).slice(0, 48), ...base]).slice(0, 48);
  }, [liveTrending, userCountry, userCounty, userRoles, userInterests]);

  const canPost = !!file && !!uid && (durationSec ?? 0) <= MAX_VIDEO_SEC;

  const replaceMedia = () => (document.getElementById("file-input") as HTMLInputElement)?.click();
  const clearMedia = () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setFile(null);
    setMediaUrl(null);
    setDurationSec(null);
    setVideoWH({});
    setThumbDataUrl(null);
    setStripThumbs([]);
    setCoverMs(800);
    setStep(0);
  };

  /* ---------- geo ---------- */
  const requestGeo = async () => {
    try {
      if (!("geolocation" in navigator)) {
        setUseGeo(false);
        setErrorMsg("Location not supported on this device.");
        return;
      }
      if (!useGeo) {
        await new Promise<void>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            () => reject(),
            { maximumAge: 60000 }
          )
        );
      }
      setUseGeo((v) => !v);
    } catch {
      setUseGeo(false);
      setErrorMsg("Location permission denied.");
    }
  };

  /* ---------- storage helper (for cover upload) ---------- */
  const uploadResumable = async (blob: Blob, path: string): Promise<string> => {
    const rf = ref(storage, path);
    return new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(rf, blob);
      task.on(
        "state_changed",
        undefined,
        (err) => reject(err),
        async () => resolve(await getDownloadURL(task.snapshot.ref))
      );
    });
  };

  /* ---------- save (MUX direct upload + optional cover upload) ---------- */
  const saveDeed = async () => {
    if (authLoading) return; // wait until we know
    if (!uid || !user) {
      setErrorMsg("Please sign in to post.");
      return;
    }
    if (!file || !durationSec) return;
    if (durationSec > MAX_VIDEO_SEC) {
      alert(`Video must be ≤ ${MAX_VIDEO_SEC}s.`);
      return;
    }

    setBusy(true);
    setErrorMsg("");
    setProgress(0);

    try {
      // optional geo
      let geo: { lat: number; lng: number } | undefined;
      if (useGeo && "geolocation" in navigator) {
        await new Promise<void>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            (p) => {
              geo = { lat: p.coords.latitude, lng: p.coords.longitude };
              resolve();
            },
            (e) => reject(e)
          )
        );
      }

      const id = uuid();

      // 1) Ask your server for a Mux direct upload URL
      const { uploadUrl, uploadId } = await createMuxDirectUpload({
        passthrough: { deedId: id, uid },
      });

      // 2) Browser → Mux (tus), show progress
      await uploadVideoToMux({ file, uploadUrl, onProgress: setProgress });

      // 3) If user selected a cover, upload to Firebase Storage
      let thumbUrl: string | undefined;
      if (thumbDataUrl) {
        const tBlob = dataUrlToBlob(thumbDataUrl);
        thumbUrl = await uploadResumable(tBlob, `deeds/${uid}/${id}/thumb.jpg`);
      }

      // 4) Save Firestore doc
      const media = [
        pruneUndefined({
          muxUploadId: uploadId,
          muxPlaybackId: null, // will be set by webhook when asset ready
          width: videoWH.width,
          height: videoWH.height,
          durationSec,
          thumbUrl, // chosen cover
          coverMs, // where the frame came from
        }),
      ];

      const payload = pruneUndefined({
        authorId: uid,
        type: "video" as const,
        media,
        caption: caption.trim() || undefined,
        music: musicTitle ? { title: musicTitle } : undefined,
        tags: tags.length ? tags : undefined,
        visibility,
        allowComments,
        geo,
        watermarkApplied: false,
        stats: { likes: 0, comments: 0, shares: 0, views: 0 },

        // feed fields
        mediaType: "video" as const,
        mediaThumbUrl: thumbUrl, // optional feed thumb
        text: caption?.trim() || undefined,
        createdAtMs: Date.now(),

        muxUploadId: uploadId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const docRef = await addDoc(collection(db, "deeds"), payload);

      if (typeof window !== "undefined") {
        localStorage.removeItem(DRAFT_KEY);
      }
      setProgress(100);
      router.push(`/deeds/${docRef.id}`);
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to save your video.");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 900);
    }
  };
  function BottomTabsMock({
    active = "Deeds",
    ekari = { hair: "#E5E7EB", text: "#0F172A", forest: "#233F39", gold: "#C79257", dim: "#6B7280" },
  }: {
    active?: "Deeds" | "Dive" | "Create" | "Bonga" | "Profile";
    ekari?: { hair: string; text: string; forest: string; gold: string; dim: string };
  }) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
        {/* subtle gradient so text stays readable over video */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black via-black to-transparent" />
        <div className="relative mx-auto max-w-[320px] px-3 pb-2">
          <nav className="flex items-end justify-between text-[10px] text-white/80">
            <TabItem label="Deeds" Icon={IoHomeOutline} active={active === "Deeds"} />
            <TabItem label="Dive" Icon={IoCompassOutline} active={active === "Dive"} />
            <CreateTab />
            <TabItem label="Bonga" Icon={IoChatbubblesOutline} active={active === "Bonga"} />
            <TabItem label="Profile" Icon={IoPersonCircleOutline} active={active === "Profile"} />
          </nav>
        </div>
      </div>
    );
  }

  function TabItem({
    label,
    Icon,
    active,
  }: {
    label: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    active?: boolean;
  }) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <Icon size={22} className={active ? "text-white" : "text-white/70"} />
        <span className={`font-semibold ${active ? "text-white" : "text-white/70"}`}>{label}</span>
      </div>
    );
  }

  /* Center “Create +” with a white block + black plus (TikTok-ish) */
  function CreateTab() {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="relative grid h-9 w-9 place-items-center rounded-lg">
          {/* white block */}
          <div className="absolute inset-0 rounded-lg bg-white" />
          {/* black plus */}
          <IoAdd size={20} className="relative text-black" />
        </div>

      </div>
    );
  }
  /* ---------- render ---------- */

  return (
    <div className="min-h-screen" style={{ backgroundColor: EKARI.sand }}>
      {/* Mobile top bar */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between border-b bg-white px-3 py-3 lg:hidden"
        style={{ borderColor: EKARI.hair }}
      >
        <button
          aria-label="Open menu"
          onClick={() => setNavOpen(true)}
          className="rounded-md p-2"
          style={{ color: EKARI.text }}
        >
          <IoMenuOutline size={22} />
        </button>
        <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
          EkariHub • Upload
        </div>
        <button
          className="rounded-lg px-3 py-2 text-xs font-bold text-white"
          style={{ backgroundColor: EKARI.gold }}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          + Upload
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr]">
        {/* Sidebar (desktop) */}
        <aside className="hidden border-r px-4 py-4 lg:block" style={{ borderColor: EKARI.hair }}>
          <button
            className="w-full rounded-xl px-4 py-3 font-bold text-white"
            style={{ backgroundColor: EKARI.gold }}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            + Upload
          </button>

          <nav className="mt-6 text-sm">
            <Section title="MANAGE">
              <Item>Home</Item>
              <Item>Posts</Item>
              <Item>Analytics</Item>
              <Item>Comments</Item>
            </Section>
            <Section title="TOOLS">
              <Item>Inspiration</Item>
              <Item>Creator Academy</Item>
              <Item>Unlimited Sounds</Item>
            </Section>
            <Section title="OTHERS">
              <Item>Feedback</Item>
            </Section>
          </nav>
        </aside>

        {/* Slide-in Mobile Sidebar */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-[78%] max-w-[320px] bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: EKARI.hair }}>
                <div className="font-extrabold" style={{ color: EKARI.text }}>
                  Menu
                </div>
                <button aria-label="Close menu" onClick={() => setNavOpen(false)} className="rounded-md p-1.5">
                  <IoClose size={20} />
                </button>
              </div>
              <div className="p-4">
                <button
                  className="w-full rounded-xl px-4 py-3 font-bold text-white"
                  style={{ backgroundColor: EKARI.gold }}
                  onClick={() => {
                    setNavOpen(false);
                    document.getElementById("file-input")?.click();
                  }}
                >
                  + Upload
                </button>

                <nav className="mt-6 text-sm">
                  <Section title="MANAGE">
                    <Item>Home</Item>
                    <Item>Posts</Item>
                    <Item>Analytics</Item>
                    <Item>Comments</Item>
                  </Section>
                  <Section title="TOOLS">
                    <Item>Inspiration</Item>
                    <Item>Creator Academy</Item>
                    <Item>Unlimited Sounds</Item>
                  </Section>
                  <Section title="OTHERS">
                    <Item>Feedback</Item>
                  </Section>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Main */}
        <main className="p-4 sm:p-6">
          {typeof window !== "undefined" && bannerDraft && (
            <div
              className="mb-4 flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: EKARI.hair }}
            >
              <div className="text-sm" style={{ color: EKARI.text }}>
                A video you were editing wasn’t saved. Continue editing?
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-lg border px-3 py-1.5 font-bold"
                  style={{ borderColor: EKARI.hair }}
                  onClick={() => {
                    localStorage.removeItem(DRAFT_KEY);
                    setBannerDraft(false);
                  }}
                >
                  Discard
                </button>
                <button
                  className="rounded-lg px-3 py-1.5 font-bold text-white"
                  style={{ backgroundColor: EKARI.forest }}
                  onClick={() => setBannerDraft(false)}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 0: Select */}
          {step === 0 && (
            <div className="rounded-2xl border bg-white" style={{ borderColor: EKARI.hair }}>
              <DropZone onDropFile={onDrop} />
              <div className="px-4 pb-8 pt-6 text-center sm:py-10">
                <input
                  id="file-input"
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onDrop(f);
                  }}
                />
                <button
                  className="mx-auto mt-3 rounded-lg px-5 py-3 text-sm font-bold text-white sm:text-base"
                  style={{ backgroundColor: EKARI.gold }}
                  onClick={() => document.getElementById("file-input")?.click()}
                >
                  Select video
                </button>
              </div>
            </div>
          )}

          {/* STEP 1: Details */}
          {step === 1 && mediaUrl && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[600px,1fr]">
              {/* Phone preview first on mobile */}
              <div className="order-1 lg:order-2">
                {/* Segmented control */}
                <div className="mb-3 flex justify-center">
                  <div className="inline-flex overflow-hidden rounded-full border bg-white/90 backdrop-blur">
                    {(["feed", "profile", "web"] as const).map((k) => (
                      <button
                        key={k}
                        onClick={() => setPreviewTab(k)}
                        className={[
                          "px-4 py-1.5 text-sm font-medium transition",
                          previewTab === k ? "bg-[#233F39] text-white" : "text-black/70 hover:bg-black/5",
                        ].join(" ")}
                      >
                        {k === "feed" ? "Deed" : k === "profile" ? "Profile" : "Web/TV"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FEED (mobile phone) */}
                {previewTab === "feed" && (
                  <div
                    className="
      relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-2xl
      border bg-black shadow-[0_8px_30px_rgba(0,0,0,.12)] lg:max-h-[98vh] lg:max-w-[320px]
    "
                    style={{ borderColor: EKARI.hair }}
                  >
                    {/* Thumbnail */}
                    {isBlobUrl(posterUrl) ? (
                      <img src={posterUrl!} alt="Video thumbnail" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <Image src={posterUrl} alt="Video thumbnail" fill className="object-cover" />
                    )}

                    {/* Top tabs (Following / Deeds) */}
                    <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 text-xs text-white/90">
                      <span className="opacity-70 mr-3">Following</span>
                      <span className="font-semibold">Deeds</span>
                    </div>

                    {/* Right rail */}
                    <div className="absolute bottom-24 right-2 flex flex-col items-center gap-3 text-white/90">
                      <div className="grid h-9 w-9 overflow-hidden place-items-center rounded-full bg-white/10 backdrop-blur" >
                        <Image src={userProfile?.photoURL} alt="Profile" width={200} height={200} />
                      </div>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur">❤</span>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur">💬</span>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur">↗</span>
                    </div>

                    {/* Bottom meta + pills + gradient */}
                    <div className="absolute inset-x-0 bottom-14 p-3"> {/* <- lift a bit so it doesn’t clash with tabs */}
                      <div className="pointer-events-none absolute inset-x-0 -bottom-2 h-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="relative z-10 text-white">
                        <div className="text-sm font-semibold whitespace-normal break-words max-h-28 overflow-y-auto pr-10">
                          {caption}
                        </div>
                        <div className="mt-1 flex items-center text-[11px] text-white/85">
                          <IoMusicalNotesOutline className="mr-1" />
                          {musicTitle || "Original sound"}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px]">
                          <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5">
                            <IoTimeOutline className="mr-1" />
                            {formatDuration(durationSec || 0)}
                          </span>
                        </div>
                        {(busy || (progress > 0 && progress < 100)) && (
                          <div className="mt-2">
                            <UploadProgress value={progress} compact />
                            <div className="mt-1 text-right text-[10px] text-white/80">{Math.round(progress)}%</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* NEW: bottom mobile tabs preview */}
                    <BottomTabsMock active="Deeds" />
                  </div>
                )}

                {/* PROFILE (grid preview) */}
                {previewTab === "profile" && (
                  <div
                    className="
                      relative mx-auto w/full max-w-[360px] overflow-hidden rounded-2xl border bg-white
                      shadow-[0_8px_30px_rgba(0,0,0,.06)]
                    "
                    style={{ borderColor: EKARI.hair }}
                  >
                    {/* Header mock */}
                    <div className="px-4 pt-4 text-center">
                      <div className="mx-auto h-12 w-12 overflow-hidden rounded-full bg-gray-100" >
                        <Image src={userProfile?.photoURL} alt="Profile" width={200} height={200} />
                      </div>
                      <div className="mt-2 text-sm font-semibold">@{userProfile?.handle ?? "Your handle"}</div>
                      <div className="mt-1 text-[11px] text-gray-500">Following {userProfile?.followingCount || 0} • Followers {userProfile?.followerCount || 0} • Deeds • Likes {userProfile?.likes || 0}</div>
                    </div>

                    {/* Tabs mock */}
                    <div className="mt-3 flex justify-center gap-6 text-xs text-gray-600">
                      <span className="font-medium">▦</span>
                      <span>↻</span>
                      <span>🔖</span>
                    </div>

                    {/* Grid */}
                    <div className="mt-3 grid grid-cols-3 gap-0.5 bg-black/5 p-0.5">
                      {/* Current video tile */}
                      <div className="relative aspect-square overflow-hidden">
                        {isBlobUrl(posterUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={posterUrl!} alt="Grid tile" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <Image src={posterUrl} alt="Grid tile" fill className="object-cover" />
                        )}
                        {/* duration badge */}
                        <div className="absolute bottom-1 left-1 inline-flex items-center rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                          <IoTimeOutline className="mr-1" />
                          {formatDuration(durationSec || 0)}
                        </div>
                      </div>
                      {/* Placeholder tiles */}
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="relative aspect-square overflow-hidden">
                          <div className="h-full w-full bg-gray-200" />
                        </div>
                      ))}
                    </div>
                    <div className="h-3" />
                  </div>
                )}

                {/* WEB/TV (16:9 letterboxed) */}
                {previewTab === "web" && (
                  <div
                    className="
                      relative mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border bg-black
                      shadow-[0_8px_30px_rgba(0,0,0,.12)]
                    "
                    style={{ borderColor: EKARI.hair }}
                  >
                    {isBlobUrl(posterUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={posterUrl!} alt="Web/TV preview" className="absolute inset-0 h-full w-full object-contain" />
                    ) : (
                      <Image src={posterUrl} alt="Web/TV preview" fill className="object-contain" />
                    )}

                    {/* Right rail (smaller) */}
                    <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 text-white/90 sm:flex">
                      <div className="grid h-9 w-9 overflow-hidden place-items-center rounded-full bg-white/10 backdrop-blur" >
                        <Image src={userProfile?.photoURL} alt="Profile" width={200} height={200} />
                      </div>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">❤</span>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">💬</span>
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">↗</span>
                    </div>

                    {/* Bottom meta */}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="relative z-10 text-white">
                        <div className="line-clamp-1 text-sm font-semibold">{caption}</div>
                        <div className="mt-1 flex items-center text-[11px] text-white/85">
                          <IoMusicalNotesOutline className="mr-1" />
                          {musicTitle || "Original sound"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-center text-xs" style={{ color: EKARI.dim }}>
                  The chosen cover will be used as the video thumbnail.
                </div>
              </div>

              {/* Details column */}
              <div className="order-2 lg:order-1">
                <div className="mb-4 rounded-xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-bold" style={{ color: EKARI.text }}>
                      {file?.name}{" "}
                      <span className="text-xs font-normal" style={{ color: EKARI.dim }}>
                        {file ? `(${(file.size / (1024 * 1024)).toFixed(2)}MB)` : ""} • {videoWH.width ?? "—"}×
                        {videoWH.height ?? "—"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg border px-3 py-1.5 text-sm"
                        style={{ borderColor: EKARI.hair }}
                        onClick={replaceMedia}
                      >
                        <IoSwapHorizontalOutline className="inline -mt-0.5 mr-1" />
                        Replace
                      </button>
                      <button
                        className="rounded-lg border px-3 py-1.5 text-sm"
                        style={{ borderColor: EKARI.hair, color: EKARI.danger }}
                        onClick={() => {
                          if (confirm("Remove this video?")) clearMedia();
                        }}
                      >
                        <IoTrashOutline className="inline -mt-0.5 mr-1" />
                        Remove
                      </button>
                    </div>
                  </div>

                  {(busy || (progress > 0 && progress < 100)) && (
                    <div className="mt-3">
                      <UploadProgress value={progress} />
                    </div>
                  )}
                </div>

                {/* Cover selector */}
                <div className="mb-4 rounded-xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                  <div className="font-extrabold" style={{ color: EKARI.text }}>
                    Cover
                  </div>

                  <div className="mt-3 flex items-start gap-3">
                    <div
                      className="relative w-24 sm:w-28 overflow-hidden rounded-lg border bg-black shrink-0 aspect-[9/16]"
                      style={{ borderColor: EKARI.hair }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbDataUrl || mediaUrl || "/video-placeholder.jpg"}
                        alt="cover"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 text-xs" style={{ color: EKARI.dim }}>
                        Pick a thumbnail from your video
                      </div>
                      <div className="flex w-full gap-2 overflow-x-auto">
                        {stripBusy && (
                          <div className="text-xs" style={{ color: EKARI.dim }}>
                            Generating previews…
                          </div>
                        )}
                        {stripThumbs.map((u, idx) => {
                          const tMs =
                            durationSec && stripThumbs.length
                              ? Math.floor(((idx + 1) / (stripThumbs.length + 1)) * durationSec * 1000)
                              : 0;
                          const isActive = Math.abs((coverMs ?? 0) - tMs) < 450;
                          return (
                            <button
                              key={`${u}-${idx}`}
                              onClick={() => generateThumbAt(tMs)}
                              className="relative h-20 w-14 sm:h-24 sm:w-16 rounded-md overflow-hidden border"
                              style={{ borderColor: isActive ? EKARI.gold : EKARI.hair, borderWidth: isActive ? 2 : 1 }}
                              title={`${(tMs / 1000).toFixed(1)}s`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={u} alt="frame" className="h-full w-full object-cover" />
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3">
                        <input
                          type="range"
                          min={0}
                          max={durationSec || 1}
                          step={0.1}
                          value={(coverMs || 0) / 1000}
                          onChange={(e) => setCoverMs(Math.floor(Number(e.target.value) * 1000))}
                          onMouseUp={(e) =>
                            generateThumbAt(Math.floor(Number((e.target as HTMLInputElement).value) * 1000))
                          }
                          onTouchEnd={(e) =>
                            generateThumbAt(Math.floor(Number((e.target as HTMLInputElement).value) * 1000))
                          }
                          className="w-full"
                        />
                        <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                          At {(coverMs / 1000).toFixed(1)}s
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description + Settings */}
                <div className="rounded-xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                  <div className="font-extrabold" style={{ color: EKARI.text }}>
                    Description
                  </div>

                  <div className="mt-2">
                    <textarea
                      className="w-full rounded-xl border p-3 text-sm"
                      style={{ borderColor: EKARI.hair, backgroundColor: "#F6F7FB", color: EKARI.text }}
                      rows={5}
                      placeholder="Say something…"
                      value={caption}
                      maxLength={CAPTION_MAX}                     // browser-enforced limit
                      onChange={(e) => {
                        const v = e.target.value ?? "";
                        // extra safety: ensure we never exceed the cap
                        setCaption(v.length > CAPTION_MAX ? v.slice(0, CAPTION_MAX) : v);
                      }}
                      aria-describedby="caption-counter"
                    />
                    <div
                      id="caption-counter"
                      className="mt-1 flex items-center justify-between text-xs"
                      style={{ color: EKARI.dim }}
                    >
                      <span>Max {CAPTION_MAX} characters</span>
                      <span
                        // turn a bit darker as we get close to the limit (optional)
                        style={{
                          color: (CAPTION_MAX - (caption?.length ?? 0)) <= 20 ? EKARI.text : EKARI.dim,
                          fontWeight: 700,
                        }}
                      >
                        {(CAPTION_MAX - (caption?.length ?? 0))} left
                      </span>
                    </div>
                  </div>


                  <div className="mt-4 grid grid-cols-1">
                    <div>
                      <div className="font-extrabold" style={{ color: EKARI.text }}>
                        Hashtags
                      </div>
                      <HashtagPicker
                        value={selectedTags}
                        onChange={setSelectedTags}
                        ekari={EKARI}
                        trending={trending}
                        trendingMeta={liveTrendingMeta}
                        max={10}
                        showCounter
                        placeholder="Type # to search… e.g. #agribusiness"
                      />
                      {!!tags.length && (
                        <div className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                          Will attach: {tags.map((t) => `#${t}`).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>

                  <SettingsPanel
                    visibility={visibility}
                    onVisibilityChange={(v) => setVisibility(v)}
                    allowComments={allowComments}
                    onAllowCommentsChange={() => setAllowComments((v) => !v)}
                    useGeo={useGeo}
                    onToggleGeo={requestGeo}
                    durationSec={durationSec ?? 0}
                    musicTitle={musicTitle}
                  />

                  {/* Footer actions */}
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      className="rounded-xl border px-4 py-2 font-bold"
                      style={{ borderColor: EKARI.hair }}
                      onClick={() => {
                        if (typeof window === "undefined") return;
                        // Note: don't store object URLs (mediaUrl won't survive reload)
                        localStorage.setItem(
                          DRAFT_KEY,
                          JSON.stringify({
                            caption,
                            selectedTags,
                            visibility,
                            allowComments,
                            musicTitle,
                            coverMs,
                          })
                        );
                        alert("Draft saved.");
                      }}
                    >
                      Save draft
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-bold text-white disabled:opacity-60"
                      style={{ backgroundColor: EKARI.gold }}
                      disabled={!canPost || busy}
                      onClick={saveDeed}
                    >
                      <IoCloudUploadOutline />
                      {busy ? `Uploading… ${Math.round(progress)}%` : "Post"}
                    </button>
                  </div>

                  {!!errorMsg && (
                    <div className="mt-3 text-sm" style={{ color: EKARI.danger }}>
                      {errorMsg}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------- Settings Panel ---------- */
function SettingsPanel({
  visibility,
  onVisibilityChange,
  allowComments,
  onAllowCommentsChange,
  useGeo,
  onToggleGeo,
  durationSec,
  musicTitle,
}: {
  visibility: "public" | "followers" | "private";
  onVisibilityChange: (v: "public" | "followers" | "private") => void;
  allowComments: boolean;
  onAllowCommentsChange: () => void;
  useGeo: boolean;
  onToggleGeo: () => void;
  durationSec: number;
  musicTitle?: string;
}) {
  return (
    <div
      className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.12)]"
      style={{ borderColor: EKARI.hair }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: EKARI.hair }}>
        <div className="text-base font-extrabold" style={{ color: EKARI.text }}>
          Settings
        </div>
      </div>

      <SettingRow
        icon={<IoLockOpenOutline />}
        title="Visibility"
        hint="Who can view this post"
        right={
          <Select
            value={visibility}
            onChange={(e) => onVisibilityChange(e.target.value as any)}
            options={[
              { label: "Public", value: "public" },
              { label: "Followers", value: "followers" },
              { label: "Private", value: "private" },
            ]}
          />
        }
      />

      <Divider />

      <SettingRow
        icon={<IoChatbubbleOutline />}
        title="Comments"
        hint="Allow viewers to comment"
        right={<Switch checked={allowComments} onChange={onAllowCommentsChange} />}
      />

      <Divider />

      <SettingRow
        icon={<IoLocationOutline />}
        title="Location"
        hint="Attach device location to this post"
        right={<Switch checked={useGeo} onChange={onToggleGeo} />}
      />

      <Divider />

      <SettingRow
        icon={<IoTimeOutline />}
        title="Duration"
        hint="Limit 60s"
        right={<BadgeMono>{formatDuration(durationSec)}</BadgeMono>}
      />

      {musicTitle ? (
        <>
          <Divider />
          <SettingRow
            icon={<IoMusicalNotesOutline />}
            title="Music"
            hint="Track used in this post"
            right={<BadgeMono className="max-w-[200px] truncate">{musicTitle}</BadgeMono>}
          />
        </>
      ) : null}
    </div>
  );
}

/* ---------- Primitives ---------- */
function SettingRow({
  icon,
  title,
  hint,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 transition hover:bg-[#FAFAFB]" role="group">
      <div className="min-w-0 flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: EKARI.hair, backgroundColor: "#F2F5F4", color: EKARI.text }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="leading-5 font-extrabold" style={{ color: EKARI.text }}>
            {title}
          </div>
          {hint ? (
            <div className="text-xs leading-4" style={{ color: EKARI.dim }}>
              {hint}
            </div>
          ) : null}
        </div>
      </div>
      <div className="ml-4">{right}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full" style={{ backgroundColor: EKARI.hair }} />;
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition outline-none ring-0 focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: checked ? EKARI.forest : "#D1D5DB",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.02)",
      }}
    >
      <span
        className="inline-block h-5 w-5 transform rounded-full bg-white transition"
        style={{ transform: `translateX(${checked ? "22px" : "2px"})` }}
      />
    </button>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: EKARI.hair, background: "#fff" }}>
      <select value={value} onChange={onChange} className="bg-transparent text-sm font-bold outline-none" style={{ color: EKARI.text }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function UploadProgress({ value, compact = false }: { value: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={compact ? "h-1 rounded" : "h-2 rounded"} style={{ backgroundColor: "#f3f4f6" }}>
        <div
          className={compact ? "h-1 rounded" : "h-2 rounded"}
          style={{
            width: `${pct}%`,
            transition: "width .25s ease",
            background: `linear-gradient(90deg, ${EKARI.gold}, ${EKARI.forest})`,
          }}
        />
      </div>
      {!compact && (
        <div className="mt-1 text-right text-xs font-semibold" style={{ color: EKARI.dim }}>
          {pct}%
        </div>
      )}
    </div>
  );
}

function BadgeMono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold ${className}`}
      style={{ borderColor: EKARI.hair, background: "#F9FAFB", color: EKARI.text }}
      title={typeof children === "string" ? children : undefined}
    >
      {children}
    </span>
  );
}

/* ---------- small UI bits ---------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="px-2 text-[11px] font-bold tracking-wider" style={{ color: EKARI.dim }}>
        {title}
      </div>
      <div className="mt-2 flex flex-col">{children}</div>
    </div>
  );
}
function Item({ children }: { children: React.ReactNode }) {
  return (
    <button className="w-full rounded-md px-2 py-2 text-left font-medium hover:bg-gray-50" style={{ color: EKARI.text }}>
      {children}
    </button>
  );
}
function DropZone({ onDropFile }: { onDropFile: (f: File) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-12 text-center transition sm:px-6 sm:py-16"
      style={{ borderColor: hover ? EKARI.gold : EKARI.hair }}
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDropFile(f);
      }}
    >
      <div className="text-lg font-extrabold sm:text-2xl" style={{ color: EKARI.text }}>
        Select video to upload
      </div>
      <div className="mt-2 text-xs sm:text-sm" style={{ color: EKARI.dim }}>
        Or drag and drop it here
      </div>
    </div>
  );
}

/* ---------- browser media helpers ---------- */
function formatDuration(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

async function probeVideoMeta(src: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = src;
    v.muted = true;
    v.onloadedmetadata = () => {
      resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration || 0 });
      v.src = "";
    };
    v.onerror = () => reject(new Error("Could not load video"));
  });
}

async function captureVideoFrame(src: string, atSec: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.src = src;
    v.preload = "auto";
    v.muted = true;

    const handleError = () => reject(new Error("Could not capture frame"));

    const onReady = async () => {
      try {
        await once(v, "loadeddata");
        if (Math.abs(v.currentTime - atSec) > 0.01) {
          v.currentTime = Math.max(0.01, atSec);
          await once(v, "seeked");
        }
        const canvas = document.createElement("canvas");
        const w = v.videoWidth || 720;
        const h = v.videoHeight || 1280;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No canvas context");
        ctx.drawImage(v, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      } finally {
        v.removeEventListener("error", handleError);
        v.src = "";
      }
    };

    v.addEventListener("error", handleError);
    v.addEventListener("loadedmetadata", onReady, { once: true });
  });
}

function once(el: HTMLMediaElement, ev: keyof HTMLMediaElementEventMap) {
  return new Promise<void>((resolve) => {
    const fn = () => {
      el.removeEventListener(ev, fn);
      resolve();
    };
    el.addEventListener(ev, fn, { once: true });
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [prefix, data] = dataUrl.split(",");
  const mime = prefix.match(/data:(.*);base64/)?.[1] || "image/jpeg";
  const bin = atob(data);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}
