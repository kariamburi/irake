"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IoCloudUploadOutline, IoSwapHorizontalOutline, IoTrashOutline,
  IoTimeOutline, IoChatbubbleOutline, IoLockOpenOutline, IoLocationOutline,
  IoMusicalNotesOutline, IoAdd, IoHomeOutline, IoCompassOutline,
  IoChatbubblesOutline, IoPersonCircleOutline,
  IoPeopleOutline,
  IoChatbubble,
  IoBookmarkOutline,
  IoShareOutline,
  IoBookmark,
  IoArrowForward,
  IoArrowRedo,
  IoChevronBack,
} from "react-icons/io5";

import {
  collection, serverTimestamp, doc, getDoc, updateDoc, setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

import { createMuxDirectUpload, uploadVideoToMux } from "@/utils/muxUpload";
import HashtagPicker from "@/app/components/HashtagPicker";
import { buildEkariTrending } from "@/utils/ekariTags";
import { useTrendingTags } from "@/app/hooks/useTrendingTags";

// Shared studio shell (sidebar/topbar)
import StudioShell from "../components/StudioShell";

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

/* ---------- Firestore doc shape used in this page ---------- */
type DeedDoc = {
  authorId: string;
  caption?: string;        // sometimes stored as 'text'
  text?: string;           // legacy caption field
  tags?: string[];
  visibility?: "public" | "followers" | "private";
  allowComments?: boolean;
  music?: { title?: string };
  geo?: { lat: number; lng: number };
  status?: "ready" | "processing" | "uploading" | "failed" | "deleted";
  createdAtMs?: number;
  mediaThumbUrl?: string;
  muxUploadId?: string | null;
  muxPlaybackId?: string | null;
  media?: Array<{
    kind?: "video" | "image";
    durationSec?: number;
    width?: number;
    height?: number;
    thumbUrl?: string;
    storagePath?: string;         // for images
    muxAssetId?: string | null;   // if you store it
    muxPlaybackId?: string | null;
  }>;
};

/* ---------- helpers ---------- */
const pruneUndefined = <T extends Record<string, any>>(obj: T) => {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    const v = (obj as any)[k];
    if (v !== undefined) out[k] = v;
  }
  return out as T;
};
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
const isBlobUrl = (u?: string | null) => !!u && u.startsWith("blob:");
const asArray = (v: unknown): string[] => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
};

/* ---------- page ---------- */
export default function UploadPage() {
  const router = useRouter();
  const search = useSearchParams();
  const editDeedId = search.get("editDeedId");             // <— EDIT MODE if present
  const isEditing = !!editDeedId;

  /* ---------- auth (SSR-safe) ---------- */
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid;

  /* ---------- user profile (Firestore) ---------- */
  const [userProfile, setUserProfile] = useState<any | null>(null);

  useEffect(() => {
    if (!uid) { setUserProfile(null); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        setUserProfile(snap.exists() ? (snap.data() as any) : null);
      } catch { setUserProfile(null); }
    })();
  }, [uid]);

  const userRoles = asArray(userProfile?.roles);
  const userInterests = asArray(userProfile?.areaOfInterest);
  const userCountry = userProfile?.country || "kenya";
  const userCounty = userProfile?.county || undefined;

  /* ---------- trending suggestions (HOOK INSIDE COMPONENT) ---------- */
  const { list: liveTrending, meta: liveTrendingMeta } = useTrendingTags();
  const trending = useMemo(() => {
    const base = buildEkariTrending({
      country: userCountry,
      county: userCounty,
      profile: { country: userCountry, roles: userRoles, areaOfInterest: userInterests },
      crops: userInterests,
      limit: 48,
    });
    const merged = [...(liveTrending || []).slice(0, 48), ...base];
    return Array.from(new Set(merged)).slice(0, 48);
  }, [liveTrending, userCountry, userCounty, userRoles, userInterests]);

  /* ---------- steps ---------- */
  const [step, setStep] = useState<0 | 1>(isEditing ? 1 : 0);
  const [previewTab, setPreviewTab] = useState<"feed" | "profile" | "web">("feed");

  /* ---------- media ---------- */
  const [file, setFile] = useState<File | null>(null);                // new file (when replacing)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);      // blob preview for new file
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [videoWH, setVideoWH] = useState<{ width?: number; height?: number }>({});

  // Existing (edit)
  const [existing, setExisting] = useState<DeedDoc | null>(null);

  // Cover/thumbnail (only generated if we have a local video file)
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

  /* ---------- tags ---------- */
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tagsFromCaption = useMemo(() => (
    (caption.match(/#([A-Za-z0-9_]{2,30})/g) || []).map((s) => s.slice(1).toLowerCase())
  ), [caption]);
  const mergedTags = useMemo(() => (
    Array.from(new Set([...selectedTags.map((t) => t.toLowerCase()), ...tagsFromCaption]))
  ), [selectedTags, tagsFromCaption]);

  /* ---------- ui ---------- */
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [bannerDraft, setBannerDraft] = useState(false);

  // poster used in previews (prefer new thumb if any; otherwise existing doc thumb; otherwise blob url; otherwise placeholder)
  const posterUrl =
    thumbDataUrl ??
    existing?.media?.[0]?.thumbUrl ??
    existing?.mediaThumbUrl ??
    mediaUrl ??
    "/video-placeholder.jpg";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isEditing) setBannerDraft(!!localStorage.getItem(DRAFT_KEY) && step === 0 && !file);
  }, [step, file, isEditing]);

  /* ---------- LOAD for EDIT ---------- */
  useEffect(() => {
    if (!isEditing || !uid || !editDeedId) return;
    (async () => {
      try {
        const dref = doc(db, "deeds", editDeedId);
        const snap = await getDoc(dref);
        if (!snap.exists()) throw new Error("Post not found");
        const data = snap.data() as DeedDoc;
        if (data.authorId !== uid) throw new Error("You do not have permission to edit this post.");

        setExisting(data);

        // Pre-fill UI from existing doc
        setCaption((data.caption ?? data.text ?? "").toString());
        setVisibility((data.visibility as any) || "public");
        setAllowComments(Boolean(data.allowComments ?? true));
        setMusicTitle(data.music?.title || "");
        setSelectedTags(Array.isArray(data.tags) ? data.tags : []);

        // Meta for info
        const m0 = data.media?.[0];
        setDurationSec(m0?.durationSec ?? null);
        setVideoWH({ width: m0?.width, height: m0?.height });

        // In edit mode we usually don't have the original video file locally,
        // so we CANNOT generate new frames from it unless user replaces the file.
        setStripThumbs([]);
        setThumbDataUrl(null);
        setCoverMs(800);
        setStep(1);
      } catch (e: any) {
        console.error(e);
        setErrorMsg(e?.message || "Could not load the post for editing.");
      }
    })();
  }, [isEditing, uid, editDeedId]);

  /* ---------- file select / drop ---------- */
  const onDrop = async (f: File) => {
    if (!f) return;
    const mb = f.size / (1024 * 1024);
    if (mb > MAX_MEDIA_MB) {
      alert(`Max ${MAX_MEDIA_MB} MB. Your file is ~${mb.toFixed(1)} MB.`);
      return;
    }
    if (!f.type.startsWith("video/")) { alert("Please select a video file."); return; }
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);

    setFile(f);
    const url = URL.createObjectURL(f);
    setMediaUrl(url);
    setProgress(0);
    setErrorMsg("");

    setThumbDataUrl(null);
    setCoverMs(800);
    setStripThumbs([]);

    try {
      const meta = await probeVideoMeta(url);
      setDurationSec(Math.round(meta.duration || 0));
      setVideoWH({ width: meta.width, height: meta.height });
      const initialCover = await captureVideoFrame(url, 0.8);
      setThumbDataUrl(initialCover);
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
    } catch { setStripThumbs([]); } finally { setStripBusy(false); }
  };

  const generateThumbAt = async (ms: number) => {
    if (!mediaUrl) return; // only works for newly selected files
    try {
      const dataUrl = await captureVideoFrame(mediaUrl, ms / 1000);
      setThumbDataUrl(dataUrl);
      setCoverMs(ms);
    } catch { }
  };

  const canPost =
    (!!file || isEditing) && !!uid && (durationSec ?? 0) <= MAX_VIDEO_SEC;

  const replaceMedia = () => (document.getElementById("file-input") as HTMLInputElement)?.click();
  const clearMedia = () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setFile(null); setMediaUrl(null); setDurationSec(existing?.media?.[0]?.durationSec ?? null);
    setVideoWH({ width: existing?.media?.[0]?.width, height: existing?.media?.[0]?.height });
    setThumbDataUrl(null); setStripThumbs([]); setCoverMs(800);
    if (!isEditing) setStep(0);
  };

  /* ---------- geo ---------- */
  const requestGeo = async () => {
    try {
      if (!("geolocation" in navigator)) { setUseGeo(false); setErrorMsg("Location not supported on this device."); return; }
      if (!useGeo) {
        await new Promise<void>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            () => resolve(), () => reject(), { maximumAge: 60000 }
          )
        );
      }
      setUseGeo((v) => !v);
    } catch { setUseGeo(false); setErrorMsg("Location permission denied."); }
  };

  /* ---------- storage helper (for cover upload) ---------- */
  const uploadResumable = async (blob: Blob, path: string): Promise<string> => {
    const rf = ref(storage, path);
    return new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(rf, blob);
      task.on("state_changed", undefined, (err) => reject(err), async () => resolve(await getDownloadURL(task.snapshot.ref)));
    });
  };

  /* ---------- save (Create OR Edit) ---------- */
  const saveDeed = async () => {
    if (authLoading) return;
    if (!uid || !user) { setErrorMsg("Please sign in to post."); return; }
    if (durationSec && durationSec > MAX_VIDEO_SEC) { alert(`Video must be ≤ ${MAX_VIDEO_SEC}s.`); return; }

    setBusy(true); setErrorMsg(""); setProgress(0);

    // compute optional geo (only toggled at save time)
    let geo: { lat: number; lng: number } | undefined;
    try {
      if (useGeo && "geolocation" in navigator) {
        await new Promise<void>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            (p) => { geo = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(); },
            (e) => reject(e)
          )
        );
      }

      if (!isEditing) {
        /** ---------------- CREATE NEW DEED ---------------- */
        if (!file || !durationSec) return;

        // 0) placeholder doc
        const deedRef = doc(collection(db, "deeds"));
        const deedId = deedRef.id;
        await setDoc(deedRef, {
          authorId: uid, status: "uploading", mediaType: "video",
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });

        // 1) Mux direct upload
        const { uploadUrl, uploadId } = await createMuxDirectUpload({ passthrough: { deedId, uid } });
        await updateDoc(deedRef, { muxUploadId: uploadId, updatedAt: serverTimestamp() });

        // 2) Browser → Mux
        await uploadVideoToMux({ file, uploadUrl, onProgress: setProgress });

        // 3) Optional cover to Storage
        let thumbUrl: string | undefined;
        if (thumbDataUrl) {
          const tBlob = dataUrlToBlob(thumbDataUrl);
          thumbUrl = await uploadResumable(tBlob, `deeds/${uid}/${deedId}/thumb.jpg`);
        }

        // 4) Final Firestore payload
        const media = [pruneUndefined({
          muxUploadId: uploadId, muxPlaybackId: null, width: videoWH.width, height: videoWH.height,
          durationSec, thumbUrl, coverMs,
          kind: "video" as const,
        })];

        const payload = pruneUndefined({
          authorId: uid,
          type: "video" as const,
          media,
          caption: caption.trim() || undefined,
          music: musicTitle ? { title: musicTitle } : undefined,
          tags: mergedTags.length ? mergedTags : undefined,
          visibility,
          allowComments,
          geo,
          watermarkApplied: false,
          stats: { likes: 0, comments: 0, shares: 0, views: 0 },

          mediaType: "video" as const,
          mediaThumbUrl: thumbUrl,
          text: caption?.trim() || undefined,
          createdAtMs: Date.now(),

          muxUploadId: uploadId,
          status: "processing",
          updatedAt: serverTimestamp(),
        });

        await updateDoc(deedRef, payload);

        if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY);
        setProgress(100);
        router.push(`/${userProfile.handle}/video/${deedId}`);
        return;
      }

      /** ---------------- EDIT EXISTING DEED ---------------- */
      if (!editDeedId) throw new Error("Missing editDeedId.");
      const deedRef = doc(db, "deeds", editDeedId);

      let mediaPatch: any = undefined;
      let thumbUrl: string | undefined;

      // If user picked a NEW file, we upload to Mux and optionally upload a NEW cover.
      if (file) {
        if (!durationSec) throw new Error("Missing duration for new file.");

        // Create Mux direct upload
        const { uploadUrl, uploadId } = await createMuxDirectUpload({ passthrough: { deedId: editDeedId, uid } });
        await updateDoc(deedRef, { muxUploadId: uploadId, updatedAt: serverTimestamp() });

        // Upload file to Mux
        alert(uploadUrl);
        await uploadVideoToMux({ file, uploadUrl, onProgress: setProgress });

        // Upload cover if generated
        if (thumbDataUrl) {
          const tBlob = dataUrlToBlob(thumbDataUrl);
          thumbUrl = await uploadResumable(tBlob, `deeds/${uid}/${editDeedId}/thumb.jpg`);
        }

        mediaPatch = [pruneUndefined({
          kind: "video" as const,
          muxUploadId: uploadId,
          muxPlaybackId: null,            // webhook should fill later
          durationSec,
          width: videoWH.width,
          height: videoWH.height,
          thumbUrl,
          coverMs,
        })];
      } else {
        // No new file: keep existing video; allow metadata updates only.
        thumbUrl = undefined; // unchanged
      }

      // Build edit payload
      const payload = pruneUndefined({
        caption: caption.trim() || undefined,
        text: caption?.trim() || undefined,               // for legacy readers
        tags: mergedTags.length ? mergedTags : [],
        visibility,
        allowComments,
        music: musicTitle ? { title: musicTitle } : undefined,
        geo,                                              // optional toggle
        ...(thumbUrl ? { mediaThumbUrl: thumbUrl } : {}), // only if new cover uploaded
        ...(mediaPatch ? { media: mediaPatch, status: "processing" as const } : {}), // reset to processing when replaced
        updatedAt: serverTimestamp(),
      });

      await updateDoc(deedRef, payload);

      setProgress(100);
      router.push(`/${userProfile.handle}/video/${editDeedId}`);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Failed to save changes.");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 900);
    }
  };
  const coverSec = (coverMs || 0) / 1000;
  const totalSec = durationSec || 1;
  const percent =
    Math.max(0, Math.min(100, (coverSec / totalSec) * 100));
  /* ---------- render ---------- */
  return (
    <StudioShell title={isEditing ? "Edit Post" : "Upload"} ctaHref="/studio/upload" ctaLabel={isEditing ? "New Upload" : "+ Upload"}>
      {/* draft banner (create mode only) */}

      {typeof window === "undefined" ? null : (!isEditing && bannerDraft) && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: EKARI.hair }}>
          <div className="text-sm" style={{ color: EKARI.text }}>A video you were editing wasn’t saved. Continue editing?</div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border px-3 py-1.5 font-bold"
              style={{ borderColor: EKARI.hair }}
              onClick={() => { localStorage.removeItem(DRAFT_KEY); setBannerDraft(false); }}
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

      {/* STEP 0: Select (create only) */}
      {!isEditing && step === 0 && (
        <div className="rounded-2xl border bg-white" style={{ borderColor: EKARI.hair }}>
          <DropZone onDropFile={onDrop} />
          <div className="px-4 pb-8 pt-6 text-center sm:py-10">
            <input
              id="file-input"
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f); }}
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
      {step === 1 && (isEditing || mediaUrl) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[600px,1fr]">
          {/* PREVIEW COLUMN */}
          <div className="order-1 lg:order-2">
            {/* tabs */}
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

            {/* FEED */}
            {previewTab === "feed" && (
              <div className="relative mx-auto aspect-[9/16] w-full overflow-hidden rounded-2xl border bg-black shadow-[0_8px_30px_rgba(0,0,0,.12)] lg:max-h-[98vh] lg:max-w-[320px]" style={{ borderColor: EKARI.hair }}>
                {isBlobUrl(posterUrl)
                  ? <img src={posterUrl!} alt="Video thumbnail" className="absolute inset-0 h-full w-full object-cover" />
                  : <Image src={posterUrl} alt="Video thumbnail" fill className="object-cover" unoptimized />}
                <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 text-xs text-white/90">
                  <span className="opacity-70 mr-3">Following</span>
                  <span className="font-semibold">For You</span>
                </div>
                <div className="absolute bottom-24 right-2 flex flex-col items-center gap-3 text-white/90">
                  <div className="grid h-9 w-9 overflow-hidden place-items-center rounded-full bg-white/10 backdrop-blur">
                    <Image src={userProfile?.photoURL || "/avatar-placeholder.png"} alt="Profile" width={200} height={200} unoptimized />
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur">❤</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur"> <IoChatbubble size={20} /></span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur"> <IoBookmark size={20} /></span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur"> <IoArrowRedo size={20} /></span>

                </div>
                <div className="absolute inset-x-0 bottom-14 p-3">
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

                {/* bottom mobile tabs mock */}
                <BottomTabsMock active="Home" />
              </div>
            )}

            {/* PROFILE */}
            {previewTab === "profile" && (
              <div className="relative mx-auto w/full max-w-[360px] overflow-hidden rounded-2xl border bg-white shadow-[0_8px_30px_rgba(0,0,0,.06)]" style={{ borderColor: EKARI.hair }}>
                <div className="px-4 pt-4 text-center">
                  <div className="mx-auto h-12 w-12 overflow-hidden rounded-full bg-gray-100">
                    <Image src={userProfile?.photoURL || "/avatar-placeholder.png"} alt="Profile" width={200} height={200} unoptimized />
                  </div>
                  <div className="mt-2 text-sm font-semibold">@{userProfile?.handle ?? "Your handle"}</div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Following {userProfile?.followingCount || 0} • Followers {userProfile?.followerCount || 0} • Deeds • Likes {userProfile?.likes || 0}
                  </div>
                </div>

                <div className="mt-3 flex justify-center gap-6 text-xs text-gray-600">
                  <span className="font-medium">▦</span><span>↻</span><span>🔖</span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-0.5 bg-black/5 p-0.5">
                  <div className="relative aspect-square overflow-hidden">
                    {isBlobUrl(posterUrl)
                      ? <img src={posterUrl!} alt="Grid tile" className="absolute inset-0 h-full w-full object-cover" />
                      : <Image src={posterUrl} alt="Grid tile" fill className="object-cover" unoptimized />}
                    <div className="absolute bottom-1 left-1 inline-flex items-center rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                      <IoTimeOutline className="mr-1" />
                      {formatDuration(durationSec || 0)}
                    </div>
                  </div>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="relative aspect-square overflow-hidden">
                      <div className="h-full w-full bg-gray-200" />
                    </div>
                  ))}
                </div>
                <div className="h-3" />
              </div>
            )}

            {/* WEB/TV */}
            {previewTab === "web" && (
              <div className="relative mx-auto aspect-video w/full max-w-3xl overflow-hidden rounded-2xl border bg-black shadow-[0_8px_30px_rgba(0,0,0,.12)]" style={{ borderColor: EKARI.hair }}>
                {isBlobUrl(posterUrl)
                  ? <img src={posterUrl!} alt="Web/TV preview" className="absolute inset-0 h-full w-full object-contain" />
                  : <Image src={posterUrl} alt="Web/TV preview" fill className="object-contain" unoptimized />}
                <div className="absolute right-3 top-1/2 hidden -translate-y-1/2 flex-col items-center gap-3 text-white/90 sm:flex">
                  <div className="grid h-9 w-9 overflow-hidden place-items-center rounded-full bg-white/10 backdrop-blur">
                    <Image src={userProfile?.photoURL || "/avatar-placeholder.png"} alt="Profile" width={200} height={200} unoptimized />
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">❤</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">💬</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">↗</span>
                </div>
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
              {file ? "The chosen cover will be used as the video thumbnail." : (isEditing ? "Existing thumbnail is shown. To pick a new cover, replace the video file." : "The chosen cover will be used as the video thumbnail.")}
            </div>
          </div>

          {/* DETAILS COLUMN */}
          <div className="order-2 lg:order-1">
            <div className="mb-4 rounded-xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-bold" style={{ color: EKARI.text }}>
                  {isEditing ? "Editing post" : (file?.name || "New upload")}
                  <span className="text-xs font-normal" style={{ color: EKARI.dim }}>
                    {" "}
                    {file ? `(${(file.size / (1024 * 1024)).toFixed(2)}MB)` : ""} • {videoWH.width ?? "—"}×{videoWH.height ?? "—"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    id="file-input"
                    type="file"
                    accept="video/*"
                    hidden
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f); }}
                  />
                  <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: EKARI.hair }} onClick={replaceMedia}>
                    <IoSwapHorizontalOutline className="inline -mt-0.5 mr-1" /> {file ? "Replace again" : (isEditing ? "Replace video" : "Replace")}
                  </button>
                  {!isEditing && (
                    <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: EKARI.hair, color: EKARI.danger }}
                      onClick={() => { if (confirm("Remove this video?")) clearMedia(); }}>
                      <IoTrashOutline className="inline -mt-0.5 mr-1" /> Remove
                    </button>
                  )}
                </div>
              </div>

              {(busy || (progress > 0 && progress < 100)) && (
                <div className="mt-3"><UploadProgress value={progress} /></div>
              )}
            </div>

            {/* Cover selector */}
            <div className="mb-4 rounded-xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
              <div className="font-extrabold" style={{ color: EKARI.text }}>Cover</div>

              <div className="mt-3 flex items-start gap-3">
                <div className="relative w-24 sm:w-28 overflow-hidden rounded-lg border bg-black shrink-0 aspect-[9/16]" style={{ borderColor: EKARI.hair }}>
                  <img src={posterUrl} alt="cover" className="absolute inset-0 h-full w-full object-cover" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 text-xs" style={{ color: EKARI.dim }}>
                    {file ? "Pick a thumbnail from your video" : "Cover selection is available after you choose a new video."}
                  </div>
                  <div className={`flex w-full gap-2 overflow-x-auto ${file ? "" : "opacity-60 pointer-events-none"}`}>
                    {stripBusy && <div className="text-xs" style={{ color: EKARI.dim }}>Generating previews…</div>}
                    {stripThumbs.map((u, idx) => {
                      const tMs = durationSec && stripThumbs.length ? Math.floor(((idx + 1) / (stripThumbs.length + 1)) * durationSec * 1000) : 0;
                      const isActive = Math.abs((coverMs ?? 0) - tMs) < 450;
                      return (
                        <button key={`${u}-${idx}`} onClick={() => generateThumbAt(tMs)}
                          className="relative h-20 w-14 sm:h-24 sm:w-16 rounded-md overflow-hidden border"
                          style={{ borderColor: isActive ? EKARI.gold : EKARI.hair, borderWidth: isActive ? 2 : 1 }}
                          title={`${(tMs / 1000).toFixed(1)}s`}
                        >
                          <img src={u} alt="frame" className="h-full w-full object-cover" />
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3">
                    <input
                      type="range"
                      min={0}
                      max={totalSec}
                      step={0.1}
                      value={coverSec}
                      onChange={(e) =>
                        setCoverMs(Math.floor(Number(e.target.value) * 1000))
                      }
                      onMouseUp={(e) =>
                        generateThumbAt(Math.floor(Number((e.target as HTMLInputElement).value) * 1000))
                      }
                      onTouchEnd={(e) =>
                        generateThumbAt(Math.floor(Number((e.target as HTMLInputElement).value) * 1000))
                      }
                      disabled={!file}
                      // Track: left = primary, right = hair
                      style={{
                        background: `linear-gradient(to right, ${EKARI.forest} 0% ${percent}%, ${EKARI.hair} ${percent}% 100%)`,
                      }}
                      className={[
                        "w-full h-2 rounded-full appearance-none cursor-pointer outline-none",
                        "disabled:opacity-50",
                        // remove native track look
                        "[&::-webkit-slider-runnable-track]:appearance-none",
                        // Thumb (WebKit)
                        "[&::-webkit-slider-thumb]:appearance-none",
                        "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
                        "[&::-webkit-slider-thumb]:rounded-full",
                        "[&::-webkit-slider-thumb]:bg-[#C79257]", // EKARI.primary
                        "[&::-webkit-slider-thumb]:border-2",
                        "[&::-webkit-slider-thumb]:border-white",
                        "[&::-webkit-slider-thumb]:shadow",
                        // Thumb (Firefox)
                        "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4",
                        "[&::-moz-range-thumb]:rounded-full",
                        "[&::-moz-range-thumb]:bg-[#C79257]", // EKARI.primary
                        "[&::-moz-range-thumb]:border-2",
                        "[&::-moz-range-thumb]:border-white",
                        // Track (Firefox) — use transparent so our inline background shows
                        "[&::-moz-range-track]:bg-transparent",
                      ].join(" ")}
                    />
                    <div className="mt-1 text-xs" style={{ color: EKARI.forest }}>
                      At {coverSec.toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Description + Settings */}
            <div className="rounded-xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
              <div className="font-extrabold" style={{ color: EKARI.text }}>Description</div>

              <div className="mt-2">
                <textarea
                  className="w-full rounded-xl border p-3 text-sm"
                  style={{ borderColor: EKARI.hair, backgroundColor: "#F6F7FB", color: EKARI.text }}
                  rows={5} placeholder="Say something…"
                  value={caption}
                  maxLength={CAPTION_MAX}
                  onChange={(e) => {
                    const v = e.target.value ?? "";
                    setCaption(v.length > CAPTION_MAX ? v.slice(0, CAPTION_MAX) : v);
                  }}
                  aria-describedby="caption-counter"
                />
                <div id="caption-counter" className="mt-1 flex items-center justify-between text-xs" style={{ color: EKARI.dim }}>
                  <span>Max {CAPTION_MAX} characters</span>
                  <span style={{ color: (CAPTION_MAX - (caption?.length ?? 0)) <= 20 ? EKARI.text : EKARI.dim, fontWeight: 700 }}>
                    {(CAPTION_MAX - (caption?.length ?? 0))} left
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1">
                <div>
                  <div className="font-extrabold" style={{ color: EKARI.text }}>Hashtags</div>
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
                  {!!mergedTags.length && (
                    <div className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                      Will attach: {mergedTags.map((t) => `#${t}`).join(" · ")}
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
                {!isEditing && (
                  <button
                    className="rounded-xl border px-4 py-2 font-bold"
                    style={{ borderColor: EKARI.hair }}
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      localStorage.setItem(
                        DRAFT_KEY,
                        JSON.stringify({ caption, selectedTags, visibility, allowComments, musicTitle, coverMs })
                      );
                      alert("Draft saved.");
                    }}
                  >
                    Save draft
                  </button>
                )}
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-bold text-white disabled:opacity-60"
                  style={{ backgroundColor: EKARI.gold }}
                  disabled={!canPost || busy}
                  onClick={saveDeed}
                >
                  <IoCloudUploadOutline />
                  {busy
                    ? (isEditing ? `Saving… ${Math.round(progress)}%` : `Uploading… ${Math.round(progress)}%`)
                    : (isEditing ? "Save changes" : "Post")}
                </button>
              </div>

              {!!errorMsg && (
                <div className="mt-3 text-sm" style={{ color: EKARI.danger }}>{errorMsg}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <UploadModal open={busy || (progress > 0 && progress < 100)} progress={progress} />
    </StudioShell>
  );
}

/* ---------- Settings Panel ---------- */
function SettingsPanel({
  visibility, onVisibilityChange,
  allowComments, onAllowCommentsChange,
  useGeo, onToggleGeo,
  durationSec, musicTitle,
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
    <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-[0_8px_24px_-12px_rgba(16,24,40,0.12)]" style={{ borderColor: EKARI.hair }}>
      <div className="border-b px-4 py-3" style={{ borderColor: EKARI.hair }}>
        <div className="text-base font-extrabold" style={{ color: EKARI.text }}>Settings</div>
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
function SettingRow({ icon, title, hint, right }: { icon: React.ReactNode; title: string; hint?: string; right?: React.ReactNode; }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 transition hover:bg-[#FAFAFB]" role="group">
      <div className="min-w-0 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: EKARI.hair, backgroundColor: "#F2F5F4", color: EKARI.text }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="leading-5 font-extrabold" style={{ color: EKARI.text }}>{title}</div>
          {hint ? <div className="text-xs leading-4" style={{ color: EKARI.dim }}>{hint}</div> : null}
        </div>
      </div>
      <div className="ml-4">{right}</div>
    </div>
  );
}
function Divider() { return <div className="h-px w-full" style={{ backgroundColor: EKARI.hair }} />; }
function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition outline-none ring-0 focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ backgroundColor: checked ? EKARI.forest : "#D1D5DB", boxShadow: "0 0 0 1px rgba(0,0,0,0.02)" }}>
      <span className="inline-block h-5 w-5 transform rounded-full bg-white transition" style={{ transform: `translateX(${checked ? "22px" : "2px"})` }} />
    </button>
  );
}
function Select({ value, onChange, options }: { value: string; onChange: React.ChangeEventHandler<HTMLSelectElement>; options: { label: string; value: string }[]; }) {
  return (
    <div className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: EKARI.hair, background: "#fff" }}>
      <select value={value} onChange={onChange} className="bg-transparent text-sm font-bold outline-none" style={{ color: EKARI.text }}>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}
function UploadProgress({ value, compact = false }: { value: number; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={compact ? "h-1 rounded" : "h-2 rounded"} style={{ backgroundColor: "#f3f4f6" }}>
        <div className={compact ? "h-1 rounded" : "h-2 rounded"} style={{ width: `${pct}%`, transition: "width .25s ease", background: `linear-gradient(90deg, ${EKARI.gold}, ${EKARI.forest})` }} />
      </div>
      {!compact && <div className="mt-1 text-right text-xs font-semibold" style={{ color: EKARI.dim }}>{pct}%</div>}
    </div>
  );
}
function BadgeMono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold ${className}`} style={{ borderColor: EKARI.hair, background: "#F9FAFB", color: EKARI.text }} title={typeof children === "string" ? children : undefined}>
      {children}
    </span>
  );
}
function UploadModal({ open, progress }: { open: boolean; progress: number }) {
  if (!open) return null;
  const pct = Math.max(0, Math.min(100, Math.round(progress || 0)));

  return (
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="w-[92%] max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-2 text-sm font-bold text-gray-900">{pct < 100 ? "Uploading your deed…" : "Finalizing…"}</div>
        <div className="mb-3 text-4xl font-extrabold tracking-tight text-gray-900">
          {pct}%
        </div>
        <UploadProgress value={pct} />
        <div className="mt-3 text-xs text-gray-500">
          {pct < 100 ? "Uploading…" : "Almost done…"}
        </div>
      </div>
    </div>
  );
}

/* ---------- little UI bits for preview ---------- */
function BottomTabsMock({ active = "Home" }: { active?: "Home" | "Mates" | "Create" | "Bonga" | "Profile"; }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black via-black to-transparent" />
      <div className="relative mx-auto max-w-[320px] px-3 pb-2">
        <nav className="flex items-end justify-between text-[10px] text-white/80">
          <TabItem label="Home" Icon={IoHomeOutline} active={active === "Home"} />
          <TabItem label="Mates" Icon={IoPeopleOutline} active={active === "Mates"} />
          <CreateTab />
          <TabItem label="Bonga" Icon={IoChatbubblesOutline} active={active === "Bonga"} />
          <TabItem label="Profile" Icon={IoPersonCircleOutline} active={active === "Profile"} />
        </nav>
      </div>
    </div>
  );
}
function TabItem({ label, Icon, active }: { label: string; Icon: React.ComponentType<{ size?: number; className?: string }>; active?: boolean; }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon size={22} className={active ? "text-white" : "text-white/70"} />
      <span className={`font-semibold ${active ? "text-white" : "text-white/70"}`}>{label}</span>
    </div>
  );
}
function CreateTab() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative grid h-9 w-9 place-items-center rounded-lg">
        <div className="absolute inset-0 rounded-lg bg-white" />
        <IoAdd size={20} className="relative text-black" />
      </div>
    </div>
  );
}
function DropZone({ onDropFile }: { onDropFile: (f: File) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="mt-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-12 text-center transition sm:px-6 sm:py-16"
      style={{ borderColor: hover ? EKARI.gold : EKARI.hair }}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault(); setHover(false);
        const f = e.dataTransfer.files?.[0]; if (f) onDropFile(f);
      }}
    >
      <div className="text-lg font-extrabold sm:text-2xl" style={{ color: EKARI.text }}>Select video to upload</div>
      <div className="mt-2 text-xs sm:text-sm" style={{ color: EKARI.dim }}>Or drag and drop it here</div>
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
    v.onloadedmetadata = () => { resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration || 0 }); v.src = ""; };
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
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No canvas context");
        ctx.drawImage(v, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(dataUrl);
      } catch (e) { reject(e); } finally {
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
    const fn = () => { el.removeEventListener(ev, fn); resolve(); };
    el.addEventListener(ev, fn, { once: true });
  });
}
function dataUrlToBlob(dataUrl: string): Blob {
  const [prefix, data] = dataUrl.split(",");
  const mime = prefix.match(/data:(.*);base64/)?.[1] || "image/jpeg";
  const bin = atob(data); const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}
