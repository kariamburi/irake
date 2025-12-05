"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IoCloudUploadOutline, IoSwapHorizontalOutline, IoTrashOutline,
  IoTimeOutline, IoChatbubbleOutline, IoLockOpenOutline, IoLocationOutline,
  IoMusicalNotesOutline, IoAdd, IoHomeOutline, IoCompassOutline,
  IoChatbubblesOutline, IoChatbubble, IoBookmark, IoArrowRedo, IoBag,
} from "react-icons/io5";

import {
  collection, serverTimestamp, doc, getDoc, updateDoc, setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/app/hooks/useAuth";

//import { createMuxDirectUpload, uploadVideoToMux } from "@/utils/muxUpload";
import HashtagPicker from "@/app/components/HashtagPicker";
import { buildEkariTrending } from "@/utils/ekariTags";
import { useTrendingTags } from "@/app/hooks/useTrendingTags";

// Shared shells
import StudioShell from "../components/StudioShell";
import AppShell from "@/app/components/AppShell";
import dynamic from 'next/dynamic';
import { PickedSound } from "@/app/components/SoundSheetWeb";
import { createPortal } from "react-dom";
// Replace your static imports:
const SoundSheetWeb = dynamic(() => import('@/app/components/SoundSheetWeb'), { ssr: false });
const PreviewMixerCard = dynamic(() => import('@/app/components/PreviewMixerCard'), { ssr: false });
// Sound bottom sheet (web)
//import SoundSheetWeb, { PickedSound } from "@/app/components/SoundSheetWeb";
//import PreviewMixerCard from "@/app/components/PreviewMixerCard";

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

const MAX_VIDEO_SEC = 90;
const MAX_MEDIA_MB = 60;
const DRAFT_KEY = "ekari.createDeed.draft";
const CAPTION_MAX = 150;

/* ---------- Firestore doc shape ---------- */
type DeedDoc = {
  authorId: string;
  caption?: string;
  text?: string;
  tags?: string[];
  visibility?: "public" | "followers" | "private";
  allowComments?: boolean;
  music?: {
    title?: string;
    artist?: string;
    coverUrl?: string;
    soundId?: string;
    source?: "library" | "uploaded" | "external";
    url?: string;
  };
  geo?: { lat: number; lng: number };
  status?: "ready" | "processing" | "uploading" | "failed" | "deleted" | "mixing";
  createdAtMs?: number;
  mediaThumbUrl?: string;
  muxUploadId?: string | null;
  muxPlaybackId?: string | null;
  mediaType?: string;
  media?: Array<{
    kind?: "video" | "image";
    durationSec?: number;
    width?: number;
    height?: number;
    thumbUrl?: string;
    storagePath?: string;
    muxAssetId?: string | null;
    muxPlaybackId?: string | null;
  }>;
  mix?: {
    needsServerMix?: boolean;
    options?: {
      musicGainDb?: number;
      videoGainDb?: number;
      ducking?: boolean;
      duckAmountDb?: number;
      loop?: boolean;
      startOffsetSec?: number;
    };
  };
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
  const editDeedId = search.get("editDeedId");
  const isEditing = !!editDeedId;
  const [mediaKind, setMediaKind] = useState<"video" | "image" | null>(null);
  /* ---------- auth ---------- */
  const { user, loading: authLoading } = useAuth();
  const uid = user?.uid;

  /* ---------- user profile ---------- */
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

  /* ---------- trending ---------- */
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

  /* ---------- media (VIDEO ONLY on web) ---------- */
  const [file, setFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [videoWH, setVideoWH] = useState<{ width?: number; height?: number }>({});

  // Existing (edit)
  const [existing, setExisting] = useState<DeedDoc | null>(null);

  // Cover/thumbnail
  const [coverMs, setCoverMs] = useState<number>(800);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [stripThumbs, setStripThumbs] = useState<string[]>([]);
  const [stripBusy, setStripBusy] = useState(false);

  /* ---------- form ---------- */
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [useGeo, setUseGeo] = useState(false);

  // Sound
  const [musicTitle, setMusicTitle] = useState("");
  const [musicSource, setMusicSource] = useState<"library" | "uploaded" | "external" | undefined>(undefined);
  const [musicUrl, setMusicUrl] = useState("");
  const [localSoundFile, setLocalSoundFile] = useState<File | null>(null);
  const [needsServerMix, setNeedsServerMix] = useState<boolean>(false);
  const [musicCoverUrl, setMusicCoverUrl] = useState<string | undefined>(undefined);
  const [musicSoundId, setMusicSoundId] = useState<string | undefined>(undefined);
  // MIXING state (aligning with mobile)
  const [musicGainDb, setMusicGainDb] = useState<number>(-8);
  const [videoGainDb, setVideoGainDb] = useState<number>(0);
  const [ducking, setDucking] = useState<boolean>(true);
  const [duckAmountDb, setDuckAmountDb] = useState<number>(-12);
  const [loopMusic, setLoopMusic] = useState<boolean>(true);
  const [startOffsetSec, setStartOffsetSec] = useState<number>(0);

  // parity fields not exposed in UI yet (defaults)
  const keepMic = false;
  const micGainDb = 0;

  // optional geo labels (not set on this page; keep undefined)
  const countryName = undefined as string | undefined;
  const countryCode = undefined as string | undefined;
  const countyName = undefined as string | undefined;

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

  const [soundOpen, setSoundOpen] = useState(false);

  // Poster for previews
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

        // Pre-fill UI
        setCaption((data.caption ?? data.text ?? "").toString());
        setVisibility((data.visibility as any) || "public");
        setAllowComments(Boolean(data.allowComments ?? true));
        setMusicTitle(data.music?.title || "");
        if (data.music?.url) setMusicUrl(data.music.url);
        if (data.music?.source) setMusicSource(data.music.source);
        if (data.music?.coverUrl) setMusicCoverUrl(data.music.coverUrl);
        if (data.music?.soundId) setMusicSoundId(data.music.soundId);
        setSelectedTags(Array.isArray(data.tags) ? data.tags : []);

        // Pre-fill mix options if present
        if (data.mix?.options) {
          setMusicGainDb(data.mix.options.musicGainDb ?? -8);
          setVideoGainDb(data.mix.options.videoGainDb ?? 0);
          setDucking(Boolean(data.mix.options.ducking ?? true));
          setDuckAmountDb(data.mix.options.duckAmountDb ?? -12);
          setLoopMusic(Boolean(data.mix.options.loop ?? true));
          setStartOffsetSec(data.mix.options.startOffsetSec ?? 0);
        }

        const m0 = data.media?.[0];
        setMediaKind((m0?.kind as "video" | "image" | undefined) ?? (data.mediaType === "photo" ? "image" : "video"));
        setDurationSec(m0?.durationSec ?? null);
        setVideoWH({ width: m0?.width, height: m0?.height });

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
    if (mb > MAX_MEDIA_MB) { alert(`Max ${MAX_MEDIA_MB} MB. Your file is ~${mb.toFixed(1)} MB.`); return; }
    // if (!f.type.startsWith("video/")) { alert("Please select a video file."); return; }
    // if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (!isVideo && !isImage) { alert("Please select a video or image."); return; }
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    setFile(f);
    const url = URL.createObjectURL(f);
    setMediaUrl(url);
    setProgress(0);
    setErrorMsg("");
    setMediaKind(isVideo ? "video" : "image");
    setThumbDataUrl(null);
    setCoverMs(800);
    setStripThumbs([]);

    try {
      if (isVideo) {
        const meta = await probeVideoMeta(url);
        setDurationSec(Math.round(meta.duration || 0));
        setVideoWH({ width: meta.width, height: meta.height });
        const initialCover = await captureVideoFrame(url, 0.8);
        setThumbDataUrl(initialCover);
        buildStrip(url, Math.max(1, Math.round(meta.duration || 0)));
      } else {
        // Image path
        const meta = await probeImageMeta(url);
        setDurationSec(null);
        setVideoWH({ width: meta.width, height: meta.height });
        setThumbDataUrl(url); // use the image itself as the poster/thumbnail
      }
    } finally {
      setStep(1);
    }
  };
  async function probeImageMeta(src: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img'); // avoid shadowed Image
      img.onload = () => resolve({
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0
      });
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = src;
    });
  }
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
    if (!mediaUrl) return;
    try {
      const dataUrl = await captureVideoFrame(mediaUrl, ms / 1000);
      setThumbDataUrl(dataUrl);
      setCoverMs(ms);
    } catch { }
  };

  const canPost =
    (!!file || isEditing) && !!uid &&
    (mediaKind === "image" || (durationSec ?? 0) <= MAX_VIDEO_SEC);

  const replaceMedia = () => (document.getElementById("file-input-main") as HTMLInputElement)?.click();
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

  /* ---------- storage helpers (PATCHED) ---------- */
  async function uploadResumable(
    blobOrFile: Blob | File,
    path: string,
    onProgress?: (pct: number) => void
  ): Promise<{ downloadURL: string; gsUrl: string; fullPath: string }> {
    const rf = ref(storage, path);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(rf, blobOrFile as any);
      task.on(
        "state_changed",
        (snap) => {
          if (onProgress) {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            onProgress(pct >= 100 ? 99 : pct);
          }
        },
        reject,
        async () => {
          const downloadURL = await getDownloadURL(task.snapshot.ref);
          const bucket = (storage as any)?.app?.options?.storageBucket || "";
          const fullPath = task.snapshot.ref.fullPath;
          const gsUrl = bucket ? `gs://${bucket}/${fullPath}` : fullPath;
          resolve({ downloadURL, gsUrl, fullPath });
        }
      );
    });
  }
  const uploadFileResumable = (
    file: File,
    path: string,
    onProgress?: (pct: number) => void
  ) => uploadResumable(file, path, onProgress);

  /* ---------- save (Create OR Edit) — VIDEO or IMAGE ---------- */
  const saveDeed = async () => {
    if (authLoading) return;

    // guards (parity with mobile)
    if (!uid || !user) {
      setErrorMsg("Please sign in to post.");
      return;
    }

    if (!isEditing && !file) {
      setErrorMsg("Pick a media file and let it load first.");
      setStep?.(0);
      return;
    }

    // Enforce 90s cap for videos
    const MAX_VIDEO_SEC = 90;
    const isVideo = mediaKind === "video";
    const isImage = mediaKind === "image";
    if (isVideo && durationSec && durationSec > MAX_VIDEO_SEC) {
      alert(`Video must be ≤ ${MAX_VIDEO_SEC}s.`);
      setStep?.(1);
      return;
    }

    setBusy(true);
    setErrorMsg("");
    setProgress(0);

    // optional geo
    let geo: { lat: number; lng: number } | undefined;
    try {
      if (useGeo && typeof navigator !== "undefined" && "geolocation" in navigator) {
        await new Promise<void>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            (p) => {
              geo = { lat: p.coords.latitude, lng: p.coords.longitude };
              resolve();
            },
            (e) => reject(e),
            { maximumAge: 60000 }
          )
        );
      }
    } catch {
      /* ignore geo errors */
    }

    // resolve uploaded audio FIRST (so mixer has a URL)
    let resolvedMusicUrl: string | undefined = musicUrl || undefined;
    try {
      if (!resolvedMusicUrl && musicSource === "uploaded" && localSoundFile) {
        const soundPath = `deeds/${uid}/${crypto.randomUUID()}/sound/${localSoundFile.name}`;
        const up = await uploadFileResumable(localSoundFile, soundPath, setProgress);
        resolvedMusicUrl = up.downloadURL;
      }
    } catch (e) {
      console.error("Audio upload failed", e);
    }

    const willServerMix = needsServerMix && (musicTitle || resolvedMusicUrl);

    let deedRef: ReturnType<typeof doc> | null = null;

    try {
      deedRef = isEditing
        ? doc(db, "deeds", editDeedId!)
        : doc(collection(db, "deeds"));
      const deedId = deedRef.id;

      // Only create the placeholder doc on *create*
      if (!isEditing) {
        await setDoc(
          deedRef,
          pruneUndefined({
            authorId: uid,
            authorUsername: userProfile?.handle,
            authorPhotoURL: userProfile?.photoURL,
            status: isVideo ? "uploading" : "processing",
            mediaType: isVideo ? "video" : "photo",
            type: isVideo ? "video" : "photo",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      }

      // =========================
      // VIDEO: Server-mix path
      // =========================
      if (isVideo && file && durationSec && willServerMix) {
        const rawUp = await uploadResumable(
          file,
          `deeds/${uid}/${deedId}/raw.mp4`,
          setProgress
        );

        // thumbnail
        let thumbUrl: string | undefined = undefined;
        if (thumbDataUrl) {
          const tBlob = dataUrlToBlob(thumbDataUrl);
          const tu = await uploadResumable(
            tBlob,
            `deeds/${uid}/${deedId}/thumb.jpg`,
            setProgress
          );
          thumbUrl = tu.downloadURL;
        } else if (file) {
          try {
            const tDataUrl = await generateThumbAtWeb(file, coverMs ?? 800);
            if (tDataUrl) {
              const tBlob = dataUrlToBlob(tDataUrl);
              const tu = await uploadResumable(
                tBlob,
                `deeds/${uid}/${deedId}/thumb.jpg`,
                setProgress
              );
              thumbUrl = tu.downloadURL;
            }
          } catch { }
        }

        const media = [
          pruneUndefined({
            url: rawUp.gsUrl,
            width: videoWH.width,
            height: videoWH.height,
            durationSec,
            thumbUrl,
            coverMs,
            kind: "video" as const,
          }),
        ];

        const payload = pruneUndefined({
          authorId: uid,
          authorUsername: userProfile?.handle,
          authorPhotoURL: userProfile?.photoURL,
          type: "video" as const,
          media,
          caption: caption?.trim() || undefined,
          music:
            musicTitle || resolvedMusicUrl
              ? pruneUndefined({
                title: musicTitle || undefined,
                source: musicSource,
                url: resolvedMusicUrl || undefined,
                coverUrl: musicCoverUrl || undefined,
                soundId: musicSoundId || undefined,
              })
              : undefined,
          tags: mergedTags.length ? mergedTags : undefined,
          visibility,
          allowComments,
          geo,
          countryTag: countryName || undefined,
          countryCode: countryCode || undefined,
          countyTag: countyName || undefined,

          mediaType: "video" as const,
          mediaThumbUrl: thumbUrl,
          text: caption?.trim() || undefined,
          createdAtMs: Date.now(),

          mix: pruneUndefined({
            mode: "video_mix",
            needsServerMix: true,
            keepMic,
            offsetMs: Math.round(startOffsetSec * 1000),
            musicGainDb,
            micGainDb,
            ducking,
            duckAmountDb,
            loop: loopMusic,
          }),

          status: "mixing",                      // ✅ server-mix trigger
          updatedAt: serverTimestamp(),
        });

        await updateDoc(deedRef, payload);
      }

      // =========================
      // IMAGE: direct photo or photo->video mix
      // =========================
      if (isImage && file) {
        const imgUp = await uploadResumable(
          file,
          `deeds/${uid}/${deedRef!.id}/image.jpg`,
          setProgress
        );
        const willPhotoServerMix = needsServerMix && (musicTitle || resolvedMusicUrl);

        const media = [
          pruneUndefined({
            url: willPhotoServerMix ? imgUp.gsUrl : imgUp.downloadURL,
            width: videoWH.width,
            height: videoWH.height,
            thumbUrl: imgUp.downloadURL,
            kind: "image" as const,
          }),
        ];

        const payload = pruneUndefined({
          authorId: uid,
          authorUsername: userProfile?.handle,
          authorPhotoURL: userProfile?.photoURL,
          type: "photo" as const,
          media,
          caption: caption?.trim() || undefined,
          music:
            (musicTitle || resolvedMusicUrl) && willPhotoServerMix
              ? pruneUndefined({
                title: musicTitle || undefined,
                source: musicSource,
                url: resolvedMusicUrl || undefined,
                coverUrl: musicCoverUrl || undefined,
                soundId: musicSoundId || undefined,
              })
              : undefined,
          tags: mergedTags.length ? mergedTags : undefined,
          visibility,
          allowComments,
          geo,

          mediaType: "photo" as const,
          mediaThumbUrl: imgUp.downloadURL,
          text: caption?.trim() || undefined,
          createdAtMs: Date.now(),

          mix: willPhotoServerMix
            ? pruneUndefined({
              mode: "photo_to_video",
              needsServerMix: true,
              keepMic,
              offsetMs: Math.round(startOffsetSec * 1000),
              musicGainDb,
              micGainDb,
              ducking,
              duckAmountDb,
              loop: loopMusic,
            })
            : pruneUndefined({ needsServerMix: false }),

          status: willPhotoServerMix ? "mixing" : "ready",  // ⭐ CHANGED
          updatedAt: serverTimestamp(),
        });

        await updateDoc(deedRef!, payload);

        // Early exit for images
        if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY);
        setProgress(100);
        router.push(`/${userProfile?.handle ?? "me"}/photo/${deedRef!.id}`);
        return;
      }

      // =========================
      // VIDEO: NO MIX — direct Mux
      // =========================
      if (isVideo && file && durationSec && !willServerMix) {
        const { createMuxDirectUpload, uploadVideoToMux } = await import(
          "@/utils/muxUpload"
        );

        const { uploadUrl, uploadId } = await createMuxDirectUpload({
          passthrough: { deedId, uid },
        });

        // if Mux fails to return a URL, bail out cleanly
        if (!uploadUrl || typeof uploadUrl !== "string") {
          console.error("❌ Mux uploadUrl missing:", uploadUrl);
          throw new Error("Failed to generate upload link. Please try again.");
        }

        await updateDoc(deedRef, {
          muxUploadId: uploadId,
          updatedAt: serverTimestamp(),
        });

        await uploadVideoToMux({ file, uploadUrl, onProgress: setProgress });

        let thumbUrl: string | undefined;
        if (thumbDataUrl) {
          const tBlob = dataUrlToBlob(thumbDataUrl);
          const tu = await uploadResumable(
            tBlob,
            `deeds/${uid}/${deedId}/thumb.jpg`,
            setProgress
          );
          thumbUrl = tu.downloadURL;
        }

        const media = [
          pruneUndefined({
            muxUploadId: uploadId,
            muxPlaybackId: null,
            width: videoWH.width,
            height: videoWH.height,
            durationSec,
            thumbUrl,
            coverMs,
            kind: "video" as const,
          }),
        ];

        const payload = pruneUndefined({
          authorId: uid,
          authorUsername: userProfile?.handle,
          authorPhotoURL: userProfile?.photoURL,
          type: "video" as const,
          media,
          caption: caption?.trim() || undefined,
          music:
            musicTitle || resolvedMusicUrl
              ? pruneUndefined({
                title: musicTitle || undefined,
                source: musicSource,
                url: resolvedMusicUrl || undefined,
                coverUrl: musicCoverUrl || undefined,
                soundId: musicSoundId || undefined,
              })
              : undefined,
          tags: mergedTags.length ? mergedTags : undefined,
          visibility,
          allowComments,
          geo,
          countryTag: countryName || undefined,
          countryCode: countryCode || undefined,
          countyTag: countyName || undefined,

          mediaType: "video" as const,
          mediaThumbUrl: thumbUrl,
          text: caption?.trim() || undefined,
          createdAtMs: Date.now(),

          mix: pruneUndefined({
            needsServerMix: false,
            keepMic,
          }),

          // ⭐ IMPORTANT: do NOT set status here.
          // Placeholder doc already has "uploading" / "processing".
          // Mux webhook will flip to "ready".
          updatedAt: serverTimestamp(),
        });

        await updateDoc(deedRef, payload);
      }

      // cleanup + navigate
      if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("pendingDeedId", deedRef!.id);
      }
      setProgress(100);
      router.push(`/${userProfile?.handle}`);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Failed to save your deed.");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 900);
    }
  };

  const coverSec = (coverMs || 0) / 1000;
  const totalSec = durationSec || 1;
  const percent = Math.max(0, Math.min(100, (coverSec / totalSec) * 100));
  // dB <-> linear UI helpers
  const dbToGain01 = (db: number) => Math.max(0, Math.min(2, Math.pow(10, db / 20)));
  const gain01ToDb = (g: number) => 20 * Math.log10(Math.max(0.0001, g));
  const [musicGain01UI, setMusicGain01UI] = useState(dbToGain01(musicGainDb));
  const [videoGain01UI, setVideoGain01UI] = useState(dbToGain01(videoGainDb));
  useEffect(() => { setMusicGain01UI(dbToGain01(musicGainDb)); }, [musicGainDb]);
  useEffect(() => { setVideoGain01UI(dbToGain01(videoGainDb)); }, [videoGainDb]);
  const [localSoundUrl, setLocalSoundUrl] = useState<string | null>(null);
  useEffect(() => {
    if (localSoundFile) {
      const u = URL.createObjectURL(localSoundFile);
      setLocalSoundUrl(u);
      return () => { URL.revokeObjectURL(u); };
    } else {
      setLocalSoundUrl(null);
    }
  }, [localSoundFile]);
  const previewMusicUri = localSoundUrl || (musicUrl || null);
  const previewPhotoUri = (!mediaUrl && posterUrl) ? posterUrl : null;

  /* ---------- render ---------- */
  return (
    <AppShell>
      <StudioShell title={isEditing ? "Edit Post" : "Upload"} ctaHref="/studio/upload" ctaLabel={isEditing ? "New Upload" : "+ Upload"}>
        {/* draft banner (create mode only) */}
        {typeof window === "undefined" ? null : (!isEditing && bannerDraft) && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: EKARI.hair }}>
            <div className="text-sm" style={{ color: EKARI.text }}>A video you were editing wasn’t saved. Continue editing?</div>
            <div className="flex gap-2">
              <button className="rounded-lg border px-3 py-1.5 font-bold" style={{ borderColor: EKARI.hair }} onClick={() => { localStorage.removeItem(DRAFT_KEY); setBannerDraft(false); }}>
                Discard
              </button>
              <button className="rounded-lg px-3 py-1.5 font-bold text-white" style={{ backgroundColor: EKARI.forest }} onClick={() => setBannerDraft(false)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 0: Select */}
        {!isEditing && step === 0 && (
          <div className="rounded-2xl border bg-white" style={{ borderColor: EKARI.hair }}>
            <DropZone onDropFile={onDrop} />
            <div className="px-4 pb-8 pt-6 text-center sm:py-10">
              <input id="file-input-drop" type="file" accept="video/*,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f); }} />
              <button className="mx-auto mt-3 rounded-lg px-5 py-3 text-sm font-bold text-white sm:text-base" style={{ backgroundColor: EKARI.gold }} onClick={() => document.getElementById("file-input-drop")?.click()}>
                Select media
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
                <div className="inline-flex overflow-hidden rounded-full border bg-white/90 backdrop-blur" style={{ borderColor: EKARI.hair }}>
                  {(["feed", "profile", "web"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setPreviewTab(k)}
                      className={["px-4 py-1.5 text-sm font-medium transition", previewTab === k ? "text-white" : "text-black/70 hover:bg-black/5"].join(" ")}
                      style={{ backgroundColor: previewTab === k ? EKARI.forest : "transparent" }}
                    >
                      {k === "feed" ? "Mobile" : k === "profile" ? "Profile" : "Web/TV"}
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
                    <span className="opacity-70 mr-3">Nearby</span>
                    <span className="opacity-70 mr-3">Following</span>
                    <span className="font-semibold">For You</span>
                  </div>
                  <div className="absolute bottom-24 right-2 flex flex-col items-center gap-3 text-white/90">
                    <div className="grid h-9 w-9 overflow-hidden place-items-center rounded-full bg-white/10 backdrop-blur">
                      <Image src={userProfile?.photoURL || "/avatar-placeholder.png"} alt="Profile" width={200} height={200} unoptimized />
                    </div>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur">❤</span>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur"><IoChatbubble size={20} /></span>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur"><IoBookmark size={20} /></span>
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 backdrop-blur"><IoArrowRedo size={20} /></span>
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
                    <div className="mt-2 text-sm font-semibold">{userProfile?.handle ?? "Your handle"}</div>
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
                    <input id="file-input-main" type="file" accept="video/*,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onDrop(f); }} />
                    <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: EKARI.hair }} onClick={replaceMedia}>
                      <IoSwapHorizontalOutline className="inline -mt-0.5 mr-1" /> {file ? "Replace again" : (isEditing ? "Replace video" : "Replace")}
                    </button>
                    {!isEditing && (
                      <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: EKARI.hair, color: EKARI.danger }} onClick={() => { if (confirm("Remove this video?")) clearMedia(); }}>
                        <IoTrashOutline className="inline -mt-0.5 mr-1" /> Remove
                      </button>
                    )}
                  </div>
                </div>

                {(busy || (progress > 0 && progress < 100)) && (
                  <div className="mt-3"><UploadProgress value={progress} /></div>
                )}
              </div>

              {/* Cover selector + Preview Mixer (cover only for video) */}
              <div className="mb-4 rounded-xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                <div className="font-extrabold" style={{ color: EKARI.text }}>Cover</div>

                <div className="mt-3 flex items-start gap-3">
                  {(mediaUrl || previewPhotoUri || previewMusicUri) && (
                    <div className="relative overflow-hidden shrink-0" style={{ borderColor: EKARI.hair }}>
                      <PreviewMixerCard
                        title="Preview"
                        videoUri={mediaKind === "video" ? (mediaUrl || undefined) : undefined}
                        photoUri={mediaKind === "image" ? (mediaUrl || undefined) : undefined}
                        posterUri={posterUrl || undefined}
                        musicUri={previewMusicUri || undefined}
                        musicOffsetMs={Math.round(startOffsetSec * 1000)}
                        musicGain={musicGain01UI}
                        videoGain={videoGain01UI}
                        onOffsetChange={(ms) => setStartOffsetSec(Math.max(0, ms / 1000))}
                        onGainChange={(g01) => { setMusicGainDb(Math.round(gain01ToDb(g01))); setMusicGain01UI(g01); }}
                        onVideoGainChange={(g01) => { setVideoGainDb(Math.round(gain01ToDb(g01))); setVideoGain01UI(g01); }}
                      />
                    </div>
                  )}

                  <div className={`min-w-0 flex-1 ${mediaKind === "image" ? "opacity-60 pointer-events-none" : ""}`}>
                    <div className="mb-2 text-xs" style={{ color: EKARI.dim }}>

                      {mediaKind === "video"
                        ? (file ? "Pick a thumbnail from your video" : "Cover selection is available after you choose a video.")
                        : "Cover timeline is for videos only."}
                    </div>

                    <div className={`flex w-full gap-2 overflow-x-auto ${file && mediaKind === "video" ? "" : "opacity-60 pointer-events-none"}`}>
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

                    {mediaKind === "video" && (
                      <div className="mt-3">
                        <ThemedRange
                          min={0}
                          max={totalSec}
                          step={0.1}
                          value={coverSec}
                          onChange={(v) => setCoverMs(Math.floor(v * 1000))}
                          onCommit={(v) => generateThumbAt(Math.floor(v * 1000))}
                          percent={percent}
                          label={`At ${coverSec.toFixed(1)}s`}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description + Hashtags + Sound + Settings */}
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

                {/* Hashtags */}
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
                  </div>
                </div>

                {/* Sound row */}
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <IoMusicalNotesOutline />
                      <div className="font-extrabold" style={{ color: EKARI.text }}>Sound</div>
                    </div>
                    {musicTitle ? (
                      <span className="text-xs text-gray-600">Selected: <b>{musicTitle}</b></span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSoundOpen(true)}
                      className="rounded-xl border px-3 py-1.5 text-sm font-bold"
                      style={{ borderColor: EKARI.hair }}
                    >
                      + Use Sound
                    </button>
                    {!!musicUrl && <span className="text-xs text-gray-500">URL attached</span>}
                    {!!localSoundFile && <span className="text-xs text-gray-500">Local file ready</span>}
                  </div>

                  {/* Mixing controls */}
                  {(musicTitle || musicUrl || localSoundFile) && (
                    <div className="mt-4 rounded-xl border p-3" style={{ borderColor: EKARI.hair, background: "#FDFDFE" }}>
                      <div className="mb-2 text-sm font-extrabold" style={{ color: EKARI.text }}>Mixing</div>

                      <MixRow
                        label={`Music Gain (${musicGainDb} dB)`}
                        child={
                          <ThemedRange
                            min={-30} max={6} step={1}
                            value={musicGainDb}
                            onChange={setMusicGainDb}
                            percent={toPercent(musicGainDb, -30, 6)}
                          />
                        }
                      />
                      <MixRow
                        label={`Video Gain (${videoGainDb} dB)`}
                        child={
                          <ThemedRange
                            min={-30} max={6} step={1}
                            value={videoGainDb}
                            onChange={setVideoGainDb}
                            percent={toPercent(videoGainDb, -30, 6)}
                          />
                        }
                      />
                      <MixRow
                        label="Ducking"
                        child={<Switch checked={ducking} onChange={() => setDucking(v => !v)} />}
                      />
                      <MixRow
                        label={`Duck Amount (${duckAmountDb} dB)`}
                        hint="How much music reduces under speech"
                        disabled={!ducking}
                        child={
                          <ThemedRange
                            min={-24} max={0} step={1}
                            value={duckAmountDb}
                            onChange={setDuckAmountDb}
                            percent={toPercent(duckAmountDb, -24, 0)}
                            disabled={!ducking}
                          />
                        }
                      />
                      <MixRow
                        label="Loop Music"
                        child={<Switch checked={loopMusic} onChange={() => setLoopMusic(v => !v)} />}
                      />
                      <MixRow
                        label={`Start Offset (${startOffsetSec.toFixed(1)}s)`}
                        hint="Where the music should begin"
                        child={
                          <ThemedRange
                            min={0} max={Math.max(1, durationSec || 1)} step={0.1}
                            value={startOffsetSec}
                            onChange={setStartOffsetSec}
                            percent={toPercent(startOffsetSec, 0, Math.max(1, durationSec || 1))}
                          />
                        }
                      />
                    </div>
                  )}
                </div>

                <SettingsPanel
                  mediaKind={mediaKind}
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
                          JSON.stringify({
                            caption, selectedTags, visibility, allowComments, musicTitle, coverMs,
                            musicGainDb, videoGainDb, ducking, duckAmountDb, loopMusic, startOffsetSec
                          })
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

        {/* Sound bottom sheet overlay */}
        <SoundSheetWeb
          open={soundOpen}
          onClose={() => setSoundOpen(false)}
          onPick={(picked: PickedSound) => {
            if (picked.source === "library") {
              setMusicSource("library");
              setMusicUrl(picked.url || "");
              setMusicTitle(picked.title || "Library sound");
              setLocalSoundFile(null);
              setNeedsServerMix(true);
              setMusicCoverUrl(picked.coverUrl || picked.thumbnailUrl || undefined);
              setMusicSoundId(picked.soundId);
            } else if (picked.source === "external") {
              setMusicSource("external");
              setMusicUrl(picked.url || "");
              setMusicTitle(picked.title || "Linked sound");
              setLocalSoundFile(null);
              setNeedsServerMix(true);
              setMusicCoverUrl(undefined);
              setMusicSoundId(undefined);
            } else if (picked.source === "uploaded") {
              setMusicSource("uploaded");
              setMusicUrl("");
              setMusicTitle(picked.title || "Upload");
              // @ts-ignore - our web sheet passes a File as "file"
              setLocalSoundFile((picked as any).file || null);
              setNeedsServerMix(true);
              setMusicCoverUrl(undefined);
              setMusicSoundId(undefined);
            }
          }}
        />
      </StudioShell>
    </AppShell>
  );
}

/* ---------- Settings Panel ---------- */
function SettingsPanel({
  visibility, onVisibilityChange,
  allowComments, onAllowCommentsChange,
  useGeo, onToggleGeo,
  durationSec, musicTitle,
  mediaKind,
}: {
  mediaKind: "video" | "image" | null;
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
        hint="Pin device location to this post"
        right={<Switch checked={useGeo} onChange={onToggleGeo} />}
      />

      <Divider />

      <SettingRow
        icon={<IoTimeOutline />}
        title="Duration"
        hint="Limit 90s"
        right={<BadgeMono>{mediaKind === "video" ? formatDuration(durationSec) : "-"}</BadgeMono>}
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

  // (optional) SSR safety for Next.js
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="w-[92%] max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-2 text-sm font-bold text-gray-900">
          {pct < 100 ? "Uploading your deed…" : "Finalizing…"}
        </div>
        <div className="mb-3 text-4xl font-extrabold tracking-tight text-gray-900">
          {pct}%
        </div>
        <UploadProgress value={pct} />
        <div className="mt-3 text-xs text-gray-500">
          {pct < 100 ? "Uploading…" : "Almost done…"}
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ---------- little UI bits for preview ---------- */
function BottomTabsMock({ active = "Home" }: { active?: "Home" | "Mates" | "Create" | "Bonga" | "Profile"; }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black via-black to-transparent" />
      <div className="relative mx-auto max-w-[320px] px-3 pb-2">
        <nav className="flex items-end justify-between text-[10px] text-white/80">
          <TabItem label="Deeds" Icon={IoHomeOutline} active={active === "Home"} />
          <TabItem label="ekariMarket" Icon={IoBag} active={active === "Mates"} />
          <CreateTab />
          <TabItem label="Dive" Icon={IoCompassOutline} active={active === "Bonga"} />
          <TabItem label="Bonga" Icon={IoChatbubblesOutline} active={active === "Profile"} />
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
      className="m-2 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-12 text-center transition sm:px-6 sm:py-16"
      style={{ borderColor: hover ? EKARI.gold : EKARI.hair }}
      onDragOver={(e) => { e.preventDefault(); setHover(true); }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault(); setHover(false);
        const f = e.dataTransfer.files?.[0]; if (f) onDropFile(f);
      }}
    >
      <div className="text-lg font-extrabold sm:text-2xl" style={{ color: EKARI.text }}>Select media (video or photo) to upload</div>
      <div className="mt-2 text-xs sm:text-sm" style={{ color: EKARI.dim }}>Or drag and drop it here</div>
    </div>
  );
}

/* ---------- mixing UI helpers ---------- */
function MixRow({ label, hint, child, disabled }: { label: string; hint?: string; child: React.ReactNode; disabled?: boolean; }) {
  return (
    <div className={`mt-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="mb-1 text-xs font-bold" style={{ color: EKARI.text }}>{label}</div>
      {hint && <div className="mb-1 text-[11px]" style={{ color: EKARI.dim }}>{hint}</div>}
      <div>{child}</div>
    </div>
  );
}
function ThemedRange({
  min, max, step = 1, value, onChange, onCommit, percent, disabled,
  label,
}: {
  min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  percent: number; disabled?: boolean; label?: string;
}) {
  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        disabled={disabled}
        className={[
          "w-full h-2 rounded-full appearance-none cursor-pointer outline-none",
          "disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-0",
          "[&::-webkit-slider-runnable-track]:appearance-none",
          "[&::-moz-range-track]:appearance-none",
          "[&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
          "[&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white",
          "[&::-webkit-slider-thumb]:shadow",
          "[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4",
          "[&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white",
        ].join(" ")}
        style={{
          background: `linear-gradient(to right, ${EKARI.forest} 0% ${percent}%, ${EKARI.hair} ${percent}% 100%)`,
        } as React.CSSProperties}
      />
      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb { background: ${EKARI.gold}; }
        input[type="range"]::-moz-range-thumb { background: ${EKARI.gold}; }
        input[type="range"]:focus-visible { box-shadow: 0 0 0 2px ${EKARI.forest}33; }
      `}</style>
      {label && <div className="mt-1 text-xs font-bold" style={{ color: EKARI.forest }}>{label}</div>}
    </div>
  );
}
function toPercent(val: number, min: number, max: number) {
  if (max <= min) return 0;
  const p = ((val - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, p));
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

// Generate a thumbnail from a File at timeMs (ms)
async function generateThumbAtWeb(file: File, timeMs: number): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const dataUrl = await captureVideoFrame(url, Math.max(0, (timeMs ?? 800) / 1000));
    return dataUrl;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
