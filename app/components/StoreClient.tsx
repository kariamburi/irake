"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { serverTimestamp, Timestamp, updateDoc, writeBatch } from "firebase/firestore";
import { bumpStoreView, bumpLead } from "@/lib/storeAnalytics";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    startAfter,
    where,
    QueryDocumentSnapshot,
    DocumentData,
    onSnapshot,
    setDoc,
    deleteDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, storage } from "@/lib/firebase";
import AppShell from "@/app/components/AppShell";
import ProductCard from "@/app/components/ProductCard";
import {
    IoChatbubbleEllipsesOutline,
    IoShieldCheckmark,
    IoStar,
    IoRocket,
    IoLockClosedOutline,
    IoLocationOutline,
    IoCallOutline,
    IoGlobeOutline,
    IoLogoWhatsapp,
    IoSparklesOutline,
    IoPeopleOutline,
    IoEyeOutline,
    IoHeartOutline,
    IoStorefrontOutline,
    IoShareSocialOutline,
    IoGridOutline,
    IoSwapVerticalOutline,
    IoFunnelOutline,
    IoTrashOutline,
    IoCameraOutline,
    IoPricetagOutline,
} from "react-icons/io5";
import { useRouter } from "next/navigation";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from "chart.js";

import { Line } from "react-chartjs-2";
import { ref as sRef, getDownloadURL, uploadBytes, deleteObject, listAll } from "firebase/storage";
import OpenInAppBanner from "./OpenInAppBanner";
import SellModal from "./SellModal";

// ✅ REQUIRED (register scales/elements)
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);


const EKARI = {
    forest: "#233F39",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
    gold: "#C79257",
};

type EmbeddedSeller = {
    id?: string;
    verified?: boolean;
    name?: string | null;
    handle?: string | null;
    photoURL?: string | null;
};

type UserDoc = {
    firstName?: string;
    surname?: string;
    handle?: string;
    handleLower?: string;
    photoURL?: string;
    verified?: boolean;
    verification?: { status?: string };

    bio?: string;

    country?: string;
    county?: string;
    location?: {
        lat?: number;
        lng?: number;
        place?: string | null;
    } | null;

    // stats
    followersCount?: number;
    profileViews?: number;
    likes?: number;

    // contacts (optional)
    phone?: string | null;
    whatsapp?: string | null; // can be full number or same as phone
    website?: string | null;
    // ✅ new (brand)
    storeCoverUrl?: string | null;
    storeAccent?: string | null; // optional future
};

type Listing = any;

type TabKey = "all" | "featured" | "boosted";

type StoreInsightsData = {
    storeViews7d: number;
    listingClicks7d: number;
    leads7d: number;
    leadsBreakdown7d: { call: number; whatsapp: number; message: number };
    topListingTitle: string | null;
    topListingViews: number;

    // ✅ advanced
    traffic7d: { market: number; search: number; share: number; profile: number };
    funnel7d: { views: number; clicks: number; leads: number };
};
// ✅ Premium Storefront Hero (Desktop + Mobile)
// Drop this component anywhere inside your StoreClient file (same file is fine).
// Then replace your existing Header JSX with <StorefrontHero ...props />
async function deleteFolderRecursively(folderRef: ReturnType<typeof sRef>) {
    const { items, prefixes } = await listAll(folderRef);

    await Promise.all(
        items.map(async (it) => {
            try {
                await deleteObject(it);
            } catch (e) {
                console.warn("Could not delete file:", it.fullPath, e);
            }
        })
    );

    await Promise.all(prefixes.map((p) => deleteFolderRecursively(p)));
}

async function deleteSubcollection(db: any, parentPath: string, subcol: string) {
    const snap = await getDocs(collection(db, `${parentPath}/${subcol}`));
    if (snap.empty) return;

    const docs = snap.docs;
    const chunkSize = 450;

    for (let i = 0; i < docs.length; i += chunkSize) {
        const batch = writeBatch(db);
        for (const d of docs.slice(i, i + chunkSize)) batch.delete(d.ref);
        await batch.commit();
    }
}

function statusColorClass(p: any) {
    const s = String(p?.status || (p?.sold ? "sold" : "active")).toLowerCase();
    if (s === "sold") return "bg-red-600";
    if (s === "reserved") return "bg-yellow-500";
    if (s === "hidden") return "bg-gray-600";
    return "bg-emerald-600";
}
function StatChip({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black"
            style={{ borderColor: EKARI.hair, background: "white", color: EKARI.text }}
            title={label}
        >
            <span className="opacity-90">{icon}</span>
            <span>{value}</span>
            <span className="font-semibold" style={{ color: EKARI.dim }}>
                {label}
            </span>
        </div>
    );
}

function IconBtn({
    href,
    onClick,
    icon,
    label,
    target,
}: {
    href?: string;
    onClick?: () => void;
    icon: React.ReactNode;
    label: string;
    target?: string;
}) {
    const common =
        "h-11 w-11 rounded-2xl border grid place-items-center transition hover:bg-black/[0.02]";
    const style = { borderColor: EKARI.hair, background: "white", color: EKARI.text };

    if (href) {
        return (
            <a
                href={href}
                onClick={(e) => {
                    if (onClick) {
                        e.preventDefault();
                        onClick();
                    }
                }}
                target={target}
                rel={target ? "noopener noreferrer" : undefined}
                className={common}
                style={style}
                aria-label={label}
                title={label}
            >
                {icon}
            </a>
        );
    }

    return (
        <button onClick={onClick} className={common} style={style} aria-label={label} title={label}>
            {icon}
        </button>
    );
}


// ✅ Add Cover Image Uploader (Premium sellers) for Storefront Hero
// Assumptions (edit if your schema differs):
// - Users doc: users/{uid}
// - Cover image field: users/{uid}.storeCoverUrl (string)
// - Only owner can edit
// - Only premium storefront sellers can edit (your existing isPremiumStore)
// - Upload to Firebase Storage at: storefrontCovers/{uid}/cover.jpg
// - Recommended image: 1600x600 (or similar wide banner)
//
// 1) Ensure you have firebase Storage exported in lib/firebase (storage)
// 2) Paste helpers + component below your imports
// 3) Render <StoreCoverHero ... /> at the top (replace your old header block)


/* ---------------- Helpers ---------------- */

// ✅ Web-only image resize (no expo). Keeps it simple + reliable.
async function resizeImageWeb(file: File, targetW = 1600, targetH = 600, quality = 0.86) {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);

    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");

    // cover-crop
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(targetW / iw, targetH / ih);
    const sw = targetW / scale;
    const sh = targetH / scale;
    const sx = (iw - sw) / 2;
    const sy = (ih - sh) / 2;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

    const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", quality)
    );

    URL.revokeObjectURL(url);
    return blob;
}

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


/* ---------------- Cover Hero ---------------- */

export function StoreCoverHero({
    sellerId,
    userDoc,
    displayName,
    photoURL,
    showVerified,
    isOwner,
    isPremiumStore,
    isFollowing,
    onToggleFollow,
    onMessage,
    onShare,
    onCall,
    onWhatsApp,
    onWebsite,
    onSellPress,
    locationText,
}: {
    sellerId: string;
    userDoc: UserDoc | null;
    displayName: string;
    photoURL: string;
    showVerified: boolean;
    isOwner: boolean;
    isPremiumStore: boolean;

    isFollowing: boolean | null;
    onToggleFollow: () => void;
    onMessage: () => void;
    onShare: () => void;
    onSellPress: () => void;
    onCall?: () => void;
    onWhatsApp?: () => void;
    onWebsite?: () => void;

    locationText?: string | null;
}) {
    const auth = getAuth();
    const me = auth.currentUser?.uid || null;

    const [uploading, setUploading] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);

    const canEditCover = isOwner && isPremiumStore;

    const phone = cleanPhone(userDoc?.phone || null);
    const wa = toWhatsAppLink(userDoc?.whatsapp || userDoc?.phone || null);
    const website = toWebsiteLink(userDoc?.website || null);
    const coverUrl =
        (userDoc as any)?.storeCoverUrl ||
        "/store-cover-default.jpg"; // ✅ add a simple default image in /public or keep null

    async function handlePickCover(file: File) {
        setErr(null);
        setUploading(true);
        try {
            // ✅ resize/crop to banner
            const blob = await resizeImageWeb(file, 1600, 600, 0.86);

            // ✅ upload
            const path = `storefrontCovers/${sellerId}/cover.jpg`;
            const storageRef = sRef(storage, path);
            await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
            const url = await getDownloadURL(storageRef);

            // ✅ save to users doc
            await setDoc(
                doc(db, "users", sellerId),
                { storeCoverUrl: url, updatedAt: new Date() as any },
                { merge: true }
            );
        } catch (e: any) {
            console.error(e);
            setErr(e?.message || "Failed to upload cover");
        } finally {
            setUploading(false);
        }
    }

    async function handleRemoveCover() {
        // keep simple: just clear the field (optional: delete from storage too)
        setUploading(true);
        setErr(null);
        try {
            await setDoc(
                doc(db, "users", sellerId),
                { storeCoverUrl: null, updatedAt: new Date() as any },
                { merge: true }
            );
        } catch (e: any) {
            setErr(e?.message || "Failed to remove cover");
        } finally {
            setUploading(false);
        }
    }

    return (
        <section className="relative">
            {/* Cover */}
            <div
                className="relative overflow-hidden rounded-0 lg:rounded-3xl border bg-gray-100"
                style={{ borderColor: EKARI.hair }}
            >
                <div className="relative h-[220px] md:h-[240px] w-full">

                    <Image
                        src={coverUrl}
                        alt="Store cover"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 1024px"
                        priority
                    />
                    {/* overlay gradient for premium vibe */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

                    {/* edit controls */}
                    {canEditCover && (
                        <div className="absolute right-3 top-3 flex items-center gap-2">
                            <label
                                className={clsx(
                                    "inline-flex items-center gap-2 rounded-full px-3 h-9 text-xs font-black cursor-pointer",
                                    uploading ? "opacity-70 cursor-not-allowed" : "hover:opacity-95"
                                )}
                                style={{
                                    background: "rgba(255,255,255,0.92)",
                                    color: EKARI.text,
                                    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                                }}
                            >
                                <IoCameraOutline size={16} />
                                <span className="hidden sm:inline">{uploading ? "Uploading…" : "Change cover"}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={uploading}
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handlePickCover(f);
                                        e.currentTarget.value = "";
                                    }}
                                />
                            </label>

                            <button
                                type="button"
                                onClick={handleRemoveCover}
                                disabled={uploading}
                                className={clsx(
                                    "inline-flex items-center justify-center rounded-full h-9 w-9",
                                    uploading ? "opacity-70" : "hover:opacity-95"
                                )}
                                style={{
                                    background: "rgba(255,255,255,0.92)",
                                    color: EKARI.text,
                                    boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
                                }}
                                title="Remove cover"
                            >
                                <IoTrashOutline size={16} />
                            </button>
                        </div>
                    )}

                    {/* bottom meta row */}
                    <div className="absolute left-0 right-0 bottom-0 px-4 pb-4">
                        <div className="flex flex-col md:flex-row md:items-end gap-3">

                            {/* Avatar */}
                            <div className="relative h-16 w-16 md:h-20 md:w-20 rounded-2xl overflow-hidden border-2 border-white bg-gray-200 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
                                <Image src={photoURL} alt="Seller" fill className="object-cover" sizes="80px" />
                            </div>

                            {/* Name + badges */}
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-white text-lg md:text-2xl font-black truncate max-w-[72vw] md:max-w-none">

                                        {displayName}
                                    </h1>

                                    {showVerified && (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black bg-white/15 text-white border border-white/25">
                                            <IoShieldCheckmark size={14} />
                                            Verified
                                        </span>
                                    )}

                                    {isPremiumStore && (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black bg-amber-300/20 text-amber-100 border border-amber-200/25">
                                            <IoSparklesOutline size={14} />
                                            Premium Store
                                        </span>
                                    )}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <p className="text-white/80 text-xs font-bold">
                                        {normalizeHandle(userDoc?.handle) || "@seller"}
                                    </p>

                                    {locationText ? (
                                        <p className="text-white/80 text-xs inline-flex items-center gap-1">
                                            <IoLocationOutline size={13} />
                                            <span className="truncate">{locationText}</span>
                                        </p>
                                    ) : null}
                                </div>

                                {err && (
                                    <div className="mt-2 text-[11px] font-bold text-red-100 bg-red-500/20 inline-block px-3 py-1 rounded-full border border-red-200/20">
                                        {err}
                                    </div>
                                )}
                            </div>

                            {/* Right actions (desktop) */}
                            <div className="hidden md:flex items-center gap-2">
                                {/* follow */}
                                {me && me !== sellerId ? (
                                    <button
                                        onClick={onToggleFollow}
                                        className={clsx(
                                            "h-10 px-4 rounded-2xl font-black text-sm border",
                                            isFollowing ? "bg-white/90" : "bg-white/15 text-white"
                                        )}
                                        style={{
                                            borderColor: "rgba(255,255,255,0.25)",
                                            color: isFollowing ? EKARI.text : "white",
                                            backdropFilter: "blur(10px)",
                                        }}
                                    >
                                        {isFollowing ? "Following" : "Follow"}
                                    </button>
                                ) : null}

                                {!isOwner && (<button
                                    onClick={onMessage}
                                    className="h-10 px-4 rounded-2xl font-black text-sm text-white inline-flex items-center gap-2"
                                    style={{ backgroundColor: EKARI.forest }}
                                >
                                    <IoChatbubbleEllipsesOutline size={18} />
                                    Message
                                </button>)}
                                {isOwner && (
                                    <button
                                        onClick={onSellPress}
                                        className="h-10 px-4 rounded-2xl font-black text-sm text-white inline-flex items-center gap-2"
                                        style={{ backgroundColor: EKARI.gold }}
                                    >
                                        <IoPricetagOutline size={18} />
                                        Sell / Lease
                                    </button>

                                )}
                                <button
                                    onClick={onShare}
                                    className="h-10 px-4 rounded-2xl font-black text-sm border bg-white/90 hover:bg-white"
                                    style={{ borderColor: "rgba(255,255,255,0.25)", color: EKARI.text }}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <IoShareSocialOutline size={18} />
                                        Share
                                    </span>
                                </button>
                            </div>
                        </div>


                    </div>
                </div>
            </div>
            {/* ✅ BELOW cover: mobile-safe stats + contacts (no overlap) */}
            <div className="mt-3 rounded-3xl border bg-white p-3 md:p-4"
                style={{ borderColor: EKARI.hair }}>
                {/* Stats */}
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black border"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}>
                        <IoPeopleOutline size={14} />
                        {nfmt(Number(userDoc?.followersCount ?? 0))} <span style={{ color: EKARI.dim }}>followers</span>
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black border"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}>
                        <IoEyeOutline size={14} />
                        {nfmt(Number(userDoc?.profileViews ?? 0))} <span style={{ color: EKARI.dim }}>views</span>
                    </span>

                    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black border"
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}>
                        <IoHeartOutline size={14} />
                        {nfmt(Number(userDoc?.likes ?? 0))} <span style={{ color: EKARI.dim }}>likes</span>
                    </span>
                </div>

                {/* Contacts (mobile grid, desktop row) */}
                {(phone || wa || website) && (
                    <div className="mt-3 grid grid-cols-3 gap-2 md:flex md:items-center">
                        {phone && (
                            <button
                                type="button"
                                onClick={onCall}
                                className="h-10 px-2 rounded-2xl border font-black text-xs inline-flex items-center justify-center gap-2"
                                style={{ borderColor: EKARI.hair, color: EKARI.text, background: "white" }}
                            >
                                <IoCallOutline size={14} /> Call
                            </button>
                        )}
                        {wa && (
                            <button
                                type="button"
                                onClick={onWhatsApp}
                                className="h-10 px-2 rounded-2xl border font-black text-xs inline-flex items-center justify-center gap-2"
                                style={{ borderColor: EKARI.hair, color: EKARI.text, background: "white" }}
                            >
                                <IoLogoWhatsapp size={14} /> WhatsApp
                            </button>
                        )}
                        {website && (
                            <button
                                type="button"
                                onClick={onWebsite}
                                className="h-10 px-2 rounded-2xl border font-black text-xs inline-flex items-center justify-center gap-2"
                                style={{ borderColor: EKARI.hair, color: EKARI.text, background: "white" }}
                            >
                                <IoGlobeOutline size={14} /> Website
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile actions row */}
            <div className="mt-3 md:hidden flex gap-2">
                {me && me !== sellerId ? (
                    <button
                        onClick={onToggleFollow}
                        className={clsx(
                            "flex-1 h-11 rounded-2xl font-black border",
                            isFollowing ? "bg-white" : "bg-white"
                        )}
                        style={{ borderColor: EKARI.hair, color: EKARI.text }}
                    >
                        {isFollowing ? "Following" : "Follow"}
                    </button>
                ) : null}

                {!isOwner && (<button
                    onClick={onMessage}
                    className="flex-1 h-11 rounded-2xl font-black text-white inline-flex items-center justify-center gap-2"
                    style={{ backgroundColor: EKARI.forest }}
                >
                    <IoChatbubbleEllipsesOutline size={18} />
                    Message
                </button>)}
                {isOwner && (
                    <button
                        onClick={onSellPress}
                        className="h-10 px-4 rounded-2xl font-black text-sm text-white inline-flex items-center gap-2"
                        style={{ backgroundColor: EKARI.gold }}
                    >
                        <IoPricetagOutline size={18} />
                        Sell / Lease
                    </button>

                )}
                <button
                    onClick={onShare}
                    className="h-11 px-4 rounded-2xl font-black border bg-white inline-flex items-center justify-center gap-2"
                    style={{ borderColor: EKARI.hair, color: EKARI.text }}
                >
                    <IoShareSocialOutline size={18} />
                </button>
            </div>
        </section>
    );
}

export function StorefrontHero({
    sellerId,
    loading,
    displayName,
    handleText,
    photoURL,
    showVerified,
    isPremiumStore,
    locationText,
    bioText,

    followersCount,
    profileViews,
    likes,

    isOwner,
    me,
    isFollowing,
    onToggleFollow,

    onContactSeller,
    onShareStore,

    phone,
    wa,
    website,

    // Optional: a cover url for personalization later (can pass null)
    coverUrl,
}: {
    sellerId: string;
    loading: boolean;
    displayName: string;
    handleText: string;
    photoURL: string;

    showVerified: boolean;
    isPremiumStore: boolean;

    locationText: string | null;
    bioText: string | null;

    followersCount: number;
    profileViews: number;
    likes: number;

    isOwner: boolean;
    me: string | null;
    isFollowing: boolean | null;
    onToggleFollow: () => void;

    onContactSeller: () => void;
    onShareStore: () => void;

    phone: string | null;
    wa: string | null;
    website: string | null;

    coverUrl?: string | null;
}) {
    const title = loading ? "Loading store…" : displayName;

    const heroBg = coverUrl
        ? `url(${coverUrl})`
        : "radial-gradient(900px circle at 10% 10%, rgba(199,146,87,0.20), transparent 45%), radial-gradient(800px circle at 85% 30%, rgba(35,63,57,0.20), transparent 55%), linear-gradient(135deg, rgba(35,63,57,0.10), rgba(255,255,255,1))";

    return (
        <section className="mb-5">
            <div className="max-w-5xl mx-auto px-4">
                {/* Hero card */}
                <div
                    className="relative overflow-hidden rounded-[28px] border bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)]"
                    style={{ borderColor: EKARI.hair }}
                >
                    {/* Cover */}
                    <div
                        className={clsx("relative h-[190px] md:h-[210px]")}
                        style={{
                            backgroundImage: coverUrl ? heroBg : undefined,
                            background: coverUrl ? undefined : (heroBg as any),
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                        }}
                    >
                        {/* darken if image cover */}
                        {coverUrl && <div className="absolute inset-0 bg-black/25" />}

                        {/* floating chips top-left */}
                        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                            {showVerified && (
                                <span
                                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black border"
                                    style={{
                                        borderColor: "rgba(255,255,255,0.35)",
                                        background: "rgba(255,255,255,0.18)",
                                        color: "white",
                                        backdropFilter: "blur(10px)",
                                    }}
                                    title="Verified seller"
                                >
                                    <IoShieldCheckmark size={14} /> Verified
                                </span>
                            )}

                            {isPremiumStore && (
                                <span
                                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black"
                                    style={{
                                        background: "rgba(199,146,87,0.22)",
                                        color: "white",
                                        border: "1px solid rgba(255,255,255,0.25)",
                                        backdropFilter: "blur(10px)",
                                    }}
                                    title="Premium Storefront"
                                >
                                    <IoSparklesOutline size={14} /> Premium Store
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="relative px-4 pb-4 md:px-6 md:pb-6">
                        {/* Avatar + headline row */}
                        <div className="-mt-10 md:-mt-12 flex items-end gap-4">
                            <div
                                className="relative h-20 w-20 md:h-24 md:w-24 rounded-3xl overflow-hidden border bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)]"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <Image src={photoURL} alt="Seller" fill className="object-cover" sizes="96px" />
                            </div>

                            <div className="min-w-0 flex-1 pb-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1
                                        className="min-w-0 truncate text-xl md:text-2xl font-black"
                                        style={{ color: EKARI.text }}
                                    >
                                        {title}
                                    </h1>
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="text-xs font-bold" style={{ color: EKARI.dim }}>
                                        {handleText}
                                    </span>

                                    {locationText && (
                                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: EKARI.dim }}>
                                            <IoLocationOutline size={13} />
                                            <span className="truncate">{locationText}</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Desktop actions */}
                            <div className="hidden md:flex items-center gap-2 pb-1">
                                {/* follow */}
                                {me && !isOwner ? (
                                    <button
                                        onClick={onToggleFollow}
                                        className={clsx(
                                            "h-11 px-5 rounded-2xl font-black text-sm transition",
                                            isFollowing ? "border bg-white hover:bg-black/[0.02]" : "text-white"
                                        )}
                                        style={
                                            isFollowing
                                                ? { borderColor: EKARI.hair, color: EKARI.text }
                                                : { backgroundColor: EKARI.gold, color: "white" }
                                        }
                                        title={isFollowing ? "Unfollow" : "Follow"}
                                    >
                                        {isFollowing ? "Following" : "Follow"}
                                    </button>
                                ) : (
                                    <button
                                        disabled
                                        className="h-11 px-5 rounded-2xl font-black border text-sm opacity-70"
                                        style={{ borderColor: EKARI.hair, background: "white", color: EKARI.text }}
                                        title={isOwner ? "This is you" : "Sign in to follow"}
                                    >
                                        {isOwner ? "You" : "Follow"}
                                    </button>
                                )}

                                {/* message */}
                                <button
                                    onClick={onContactSeller}
                                    className="h-11 px-5 rounded-2xl font-black text-sm text-white inline-flex items-center gap-2 disabled:opacity-60"
                                    style={{ backgroundColor: EKARI.forest }}
                                    disabled={isOwner}
                                    title={isOwner ? "This is you" : "Contact seller"}
                                >
                                    <IoChatbubbleEllipsesOutline size={18} />
                                    Message
                                </button>

                                {/* share */}
                                <IconBtn
                                    onClick={onShareStore}
                                    icon={<IoShareSocialOutline size={18} />}
                                    label="Share store"
                                />
                            </div>
                        </div>

                        {/* Bio */}
                        {bioText && (
                            <p className="mt-3 text-sm leading-6 md:max-w-3xl" style={{ color: EKARI.text }}>
                                {bioText}
                            </p>
                        )}

                        {/* Stats + contact row */}
                        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap gap-2">
                                <StatChip icon={<IoPeopleOutline size={13} />} label="Followers" value={nfmt(followersCount)} />
                                <StatChip icon={<IoEyeOutline size={13} />} label="Views" value={nfmt(profileViews)} />
                                <StatChip icon={<IoHeartOutline size={13} />} label="Likes" value={nfmt(likes)} />
                            </div>

                            {/* contact shortcuts */}
                            <div className="flex items-center gap-2">
                                {phone && (
                                    <IconBtn
                                        href={`tel:${phone}`}
                                        icon={<IoCallOutline size={18} />}
                                        label="Call"
                                    />
                                )}
                                {wa && (
                                    <IconBtn
                                        href={wa}
                                        icon={<IoLogoWhatsapp size={18} />}
                                        label="WhatsApp"
                                        target="_blank"
                                    />
                                )}
                                {website && (
                                    <IconBtn
                                        href={website}
                                        icon={<IoGlobeOutline size={18} />}
                                        label="Website"
                                        target="_blank"
                                    />
                                )}

                                <Link
                                    href="/market"
                                    className="ml-1 text-sm font-black underline"
                                    style={{ color: EKARI.forest }}
                                    title="Back to Market"
                                >
                                    Market
                                </Link>
                            </div>
                        </div>

                        {/* Mobile action bar */}
                        <div className="mt-4 md:hidden">
                            <div
                                className="rounded-3xl border p-3 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                                style={{ borderColor: EKARI.hair }}
                            >
                                <div className="grid grid-cols-4 gap-2">
                                    {/* Follow */}
                                    {me && !isOwner ? (
                                        <button
                                            onClick={onToggleFollow}
                                            className={clsx(
                                                "col-span-2 h-11 rounded-2xl font-black text-sm transition",
                                                isFollowing ? "border bg-white hover:bg-black/[0.02]" : "text-white"
                                            )}
                                            style={
                                                isFollowing
                                                    ? { borderColor: EKARI.hair, color: EKARI.text }
                                                    : { backgroundColor: EKARI.gold, color: "white" }
                                            }
                                            title={isFollowing ? "Unfollow" : "Follow"}
                                        >
                                            {isFollowing ? "Following" : "Follow"}
                                        </button>
                                    ) : (
                                        <button
                                            disabled
                                            className="col-span-2 h-11 rounded-2xl font-black border text-sm opacity-70"
                                            style={{ borderColor: EKARI.hair, background: "white", color: EKARI.text }}
                                            title={isOwner ? "This is you" : "Sign in to follow"}
                                        >
                                            {isOwner ? "You" : "Follow"}
                                        </button>
                                    )}

                                    {/* Share */}
                                    <button
                                        onClick={onShareStore}
                                        className="h-11 rounded-2xl border grid place-items-center hover:bg-black/[0.02]"
                                        style={{ borderColor: EKARI.hair, background: "white", color: EKARI.text }}
                                        aria-label="Share store"
                                        title="Share store"
                                    >
                                        <IoShareSocialOutline size={18} />
                                    </button>

                                    {/* Message */}
                                    <button
                                        onClick={onContactSeller}
                                        className="h-11 rounded-2xl font-black text-sm text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
                                        style={{ backgroundColor: EKARI.forest }}
                                        disabled={isOwner}
                                        title={isOwner ? "This is you" : "Contact seller"}
                                    >
                                        <IoChatbubbleEllipsesOutline size={18} />
                                    </button>
                                </div>

                                {(phone || wa || website) && (
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="text-xs font-bold" style={{ color: EKARI.dim }}>
                                            Quick contacts
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {phone && (
                                                <a
                                                    href={`tel:${phone}`}
                                                    className="text-xs font-black underline"
                                                    style={{ color: EKARI.text }}
                                                >
                                                    Call
                                                </a>
                                            )}
                                            {wa && (
                                                <a
                                                    href={wa}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-black underline"
                                                    style={{ color: EKARI.text }}
                                                >
                                                    WhatsApp
                                                </a>
                                            )}
                                            {website && (
                                                <a
                                                    href={website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-black underline"
                                                    style={{ color: EKARI.text }}
                                                >
                                                    Website
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Optional: subtle “brand strip” */}
                        <div className="mt-4 flex items-center justify-between text-[11px]" style={{ color: EKARI.dim }}>
                            <span>
                                Powered by <span className="font-black" style={{ color: EKARI.text }}>ekarihub</span>
                            </span>
                            <span className="font-semibold">
                                Store ID: <span className="font-mono">{sellerId.slice(0, 8)}…</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
// ✅ Premium Storefront Segmented Tabs + Catalog Header + Sort
// 1) Paste these components below your StorefrontHero (same file ok)
// 2) Replace your old tabs row + add CatalogHeader above the grid
// 3) Add `sort` state + apply the sorting before rendering

const EKARI2 = {
    forest: "#233F39",
    text: "#0F172A",
    dim: "#6B7280",
    hair: "#E5E7EB",
    gold: "#C79257",
    soft: "rgba(35,63,57,0.08)",
};

type SortKey =
    | "newest"
    | "price_low"
    | "price_high"
    | "most_viewed"
    | "most_liked";

function SegmentedTabs({
    value,
    onChange,
    counts,
}: {
    value: TabKey;
    onChange: (k: TabKey) => void;
    counts: { all: number; featured: number; boosted: number };
}) {
    const Tab = ({
        k,
        label,
        icon,
        count,
    }: {
        k: TabKey;
        label: string;
        icon: React.ReactNode;
        count: number;
    }) => {
        const active = value === k;
        return (
            <button
                type="button"
                onClick={() => onChange(k)}
                className={clsx(
                    "relative flex-1 h-10 rounded-2xl text-xs font-black transition",
                    active ? "text-white" : "text-slate-900 hover:bg-black/[0.03]"
                )}
                style={{
                    backgroundColor: active ? EKARI2.forest : "transparent",
                }}
            >
                <span className="inline-flex items-center gap-2 justify-center w-full">
                    <span className={clsx("inline-flex items-center gap-1.5")}>
                        {icon}
                        {label}
                    </span>
                    <span
                        className={clsx(
                            "ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-black",
                            active ? "bg-white/20 text-white" : "bg-black/[0.06] text-slate-800"
                        )}
                    >
                        {count}
                    </span>
                </span>
            </button>
        );
    };

    return (
        <div
            className="w-full rounded-[22px] border bg-white p-1 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
            style={{ borderColor: EKARI2.hair }}
        >
            <div className="flex gap-1">
                <Tab
                    k="all"
                    label="All"
                    icon={<IoGridOutline size={14} />}
                    count={counts.all}
                />
                <Tab
                    k="featured"
                    label="Featured"
                    icon={<IoStar size={14} />}
                    count={counts.featured}
                />
                <Tab
                    k="boosted"
                    label="Boosted"
                    icon={<IoRocket size={14} />}
                    count={counts.boosted}
                />
            </div>
        </div>
    );
}

function SortSelect({
    value,
    onChange,
}: {
    value: SortKey;
    onChange: (v: SortKey) => void;
}) {
    return (
        <label
            className="inline-flex items-center gap-2 rounded-2xl border bg-white px-3 h-10 text-xs font-black shadow-sm"
            style={{ borderColor: EKARI2.hair, color: EKARI2.text }}
            title="Sort listings"
        >
            <IoSwapVerticalOutline size={16} style={{ color: EKARI2.dim }} />
            <select
                className="bg-transparent outline-none text-xs font-black cursor-pointer"
                value={value}
                onChange={(e) => onChange(e.target.value as SortKey)}
                style={{ color: EKARI2.text }}
            >
                <option value="newest">Newest</option>
                <option value="price_low">Price: Low → High</option>
                <option value="price_high">Price: High → Low</option>
                <option value="most_viewed">Most viewed</option>
                <option value="most_liked">Most liked</option>
            </select>
        </label>
    );
}

export function CatalogHeader({
    title = "Catalog",
    subtitle,
    tab,
    sort,
    onSortChange,
    rightSlot,
}: {
    title?: string;
    subtitle?: string;
    tab: TabKey;
    sort: SortKey;
    onSortChange: (v: SortKey) => void;
    rightSlot?: React.ReactNode;
}) {
    const tabLabel =
        tab === "all" ? "All items" : tab === "featured" ? "Featured picks" : "Boosted items";

    return (
        <div className="mb-3">
            <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-base md:text-lg font-black" style={{ color: EKARI2.text }}>
                            {title}
                        </h2>
                        <span
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black"
                            style={{ background: EKARI2.soft, color: EKARI2.forest }}
                        >
                            <IoFunnelOutline size={13} />
                            {tabLabel}
                        </span>
                    </div>

                    <p className="mt-1 text-sm" style={{ color: EKARI2.dim }}>
                        {subtitle || "Browse this seller’s active listings."}
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <SortSelect value={sort} onChange={onSortChange} />
                    {rightSlot}
                </div>
            </div>
        </div>
    );
}

function safeNameFromUser(u: UserDoc | null) {
    if (!u) return null;
    const full = [u.firstName, u.surname].filter(Boolean).join(" ").trim();
    return full || null;
}

function makeThreadId(a: string, b: string) {
    return [a, b].sort().join("_");
}

function isFeaturedActive(p: any) {
    const untilMs = p?.featuredUntil?.toMillis?.() ?? 0;
    return p?.featured === true && untilMs > Date.now();
}

function isBoostedActive(p: any) {
    const untilMs = p?.boostedUntil?.toMillis?.() ?? 0;
    return untilMs > Date.now();
}

function normalizeHandle(h?: string | null) {
    const raw = (h || "").trim();
    if (!raw) return null;
    return raw.startsWith("@") ? raw : `@${raw}`;
}

function nfmt(n: number) {
    const x = Number(n || 0);
    if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (x >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(x);
}

function cleanPhone(p?: string | null) {
    return (p || "").replace(/\s+/g, "").trim();
}

function toWhatsAppLink(raw?: string | null) {
    const phone = cleanPhone(raw);
    if (!phone) return null;

    let normalized = phone.replace(/^\+/, "");
    if (normalized.startsWith("0")) normalized = "254" + normalized.slice(1);
    if (!/^\d{10,15}$/.test(normalized)) return null;

    return `https://wa.me/${normalized}`;
}
function dayLabelFromAny(dayStart: any) {
    try {
        const d =
            dayStart?.toDate?.() ||
            (typeof dayStart === "number" ? new Date(dayStart) : null) ||
            (dayStart instanceof Date ? dayStart : null);
        if (!d) return "";
        return d.toLocaleDateString(undefined, { weekday: "short" }); // Mon, Tue...
    } catch {
        return "";
    }
}

function toWebsiteLink(raw?: string | null) {
    const s = (raw || "").trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
}

type InsightsTier = "locked" | "basic" | "advanced";

type SellerEntitlements = {
    storefront: boolean; // sellerPlan.storefront
    analyticsBasic: boolean; // from subscription
    analyticsAdvanced: boolean; // from subscription
};

/**
 * ✅ Listings only decide if storefront is allowed (paywalled).
 * ❗ Analytics tiers should be subscription-based (NOT listing snapshot-based),
 * otherwise you can never reliably flip to advanced.
 */
function resolveStorefrontFromListings(listings: any[]): boolean {
    return listings.some((p) => p?.sellerPlan?.storefront === true || p?.storefrontEligible === true);
}

function computeInsightsTier(e: SellerEntitlements): InsightsTier {
    if (!e.storefront) return "locked";
    if (e.analyticsAdvanced) return "advanced";
    // storefront alone unlocks basic shell (as you designed)
    return "basic";
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
    const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
    const escape = (v: any) => {
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
    };

    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function InsightCard({
    title,
    value,
    subtitle,
}: {
    title: string;
    value: string;
    subtitle?: string;
}) {
    return (
        <div className="rounded-2xl border p-4 bg-white" style={{ borderColor: EKARI.hair }}>
            <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
                {title}
            </div>
            <div className="mt-1 text-2xl font-black" style={{ color: EKARI.text }}>
                {value}
            </div>
            {subtitle && (
                <div className="mt-1 text-xs" style={{ color: EKARI.dim }}>
                    {subtitle}
                </div>
            )}
        </div>
    );
}

function StoreInsights({ tier, onUpgrade, data, onExportCsv, onExportSummary, dailyRows }: {
    tier: InsightsTier;
    onUpgrade: () => void;
    data: StoreInsightsData;
    onExportCsv: () => void;
    onExportSummary: () => void;
    dailyRows: any[];
}) {

    const headerBadge =
        tier === "advanced"
            ? { text: "Advanced", bg: "rgba(35,63,57,0.10)", fg: EKARI.forest }
            : tier === "basic"
                ? { text: "Basic", bg: "rgba(199,146,87,0.12)", fg: EKARI.gold }
                : { text: "Locked", bg: "rgba(15,23,42,0.06)", fg: EKARI.dim };

    const locked = tier === "locked";
    const totalTraffic =
        data.traffic7d.market + data.traffic7d.search + data.traffic7d.share + data.traffic7d.profile;

    const pct = (n: number) => (totalTraffic ? Math.round((n / totalTraffic) * 100) : 0);

    const views = data.funnel7d.views || 0;
    const clicks = data.funnel7d.clicks || 0;
    const leads = data.funnel7d.leads || 0;

    const ctr = views ? Math.round((clicks / views) * 100) : 0;
    const lcr = clicks ? Math.round((leads / clicks) * 100) : 0;
    const labels = (dailyRows || []).map((r) => dayLabelFromAny(r.dayStart));

    const viewsSeries = (dailyRows || []).map((r) => Number(r.storeViews || 0));
    const clicksSeries = (dailyRows || []).map((r) => Number(r.listingClicks || 0));
    const leadsSeries = (dailyRows || []).map((r) => Number(r.leadsTotal || 0));

    const weeklyTrendData = useMemo(() => ({
        labels,
        datasets: [
            {
                label: "Views",
                data: viewsSeries,
                borderColor: "#233F39",
                backgroundColor: "rgba(35,63,57,0.15)",
                tension: 0.35,
            },
            {
                label: "Clicks",
                data: clicksSeries,
                borderColor: "#C79257",
                backgroundColor: "rgba(199,146,87,0.15)",
                tension: 0.35,
            },
            {
                label: "Leads",
                data: leadsSeries,
                borderColor: "#4B82F0",
                backgroundColor: "rgba(75,130,240,0.15)",
                tension: 0.35,
            },
        ],
    }), [labels, viewsSeries, clicksSeries, leadsSeries]);
    const trafficTrendData = useMemo(() => ({
        labels,
        datasets: [
            {
                label: "Market",
                data: (dailyRows || []).map(r => Number(r.srcMarketViews || 0)),
                borderColor: "#233F39",
                backgroundColor: "rgba(35,63,57,0.15)",
                tension: 0.35,
            },
            {
                label: "Search",
                data: (dailyRows || []).map(r => Number(r.srcSearchViews || 0)),
                borderColor: "#C79257",
                backgroundColor: "rgba(199,146,87,0.15)",
                tension: 0.35,
            },
            {
                label: "Share",
                data: (dailyRows || []).map(r => Number(r.srcShareViews || 0)),
                borderColor: "#4B82F0",
                backgroundColor: "rgba(75,130,240,0.15)",
                tension: 0.35,
            },
            {
                label: "Profile",
                data: (dailyRows || []).map(r => Number(r.srcProfileViews || 0)),
                borderColor: "#8B5CF6",
                backgroundColor: "rgba(139,92,246,0.15)",
                tension: 0.35,
            },
        ],
    }), [dailyRows, labels]);


    const weeklyTrendOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true },
            tooltip: { enabled: true },
        },
        scales: {
            y: { beginAtZero: true },
        },
    }), []);


    return (
        <section className="mb-6">
            <div className="rounded-3xl lg:rounded-3xl border bg-[#FAFAFA] overflow-hidden" style={{ borderColor: EKARI.hair }}>
                <div className="p-2 lg:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-black" style={{ color: EKARI.text }}>
                            Store Insights
                        </h2>
                        <span
                            className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black"
                            style={{ background: headerBadge.bg, color: headerBadge.fg }}
                        >
                            {headerBadge.text}
                        </span>

                        <div className="ml-auto flex items-center gap-2">
                            {tier !== "advanced" && (
                                <button
                                    onClick={onUpgrade}
                                    className="h-9 px-3 rounded-xl font-black text-xs text-white"
                                    style={{ backgroundColor: EKARI.gold }}
                                >
                                    Upgrade for insights
                                </button>
                            )}
                        </div>
                    </div>

                    <p className="mt-1 text-sm" style={{ color: EKARI.dim }}>
                        Track how shoppers discover your store.
                    </p>

                    {/* LOCKED STATE */}
                    {locked ? (
                        <div className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <IoLockClosedOutline size={18} style={{ color: EKARI.dim }} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black" style={{ color: EKARI.text }}>
                                        Insights locked
                                    </div>
                                    <div className="mt-1 text-sm" style={{ color: EKARI.dim }}>
                                        Enable a Dedicated Storefront plan to unlock Store Insights.
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <div
                                            className="rounded-full border px-3 py-1 text-[11px] font-black"
                                            style={{ borderColor: EKARI.hair, color: EKARI.dim }}
                                        >
                                            Views • —
                                        </div>
                                        <div
                                            className="rounded-full border px-3 py-1 text-[11px] font-black"
                                            style={{ borderColor: EKARI.hair, color: EKARI.dim }}
                                        >
                                            Clicks • —
                                        </div>
                                        <div
                                            className="rounded-full border px-3 py-1 text-[11px] font-black"
                                            style={{ borderColor: EKARI.hair, color: EKARI.dim }}
                                        >
                                            Leads • —
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* BASIC + ADVANCED GRID */}
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <InsightCard title="Store views (7d)" value={nfmt(data.storeViews7d)} subtitle="Last 7 days" />
                                <InsightCard title="Listing clicks (7d)" value={nfmt(data.listingClicks7d)} subtitle="Last 7 days" />
                                <InsightCard
                                    title="Leads (7d)"
                                    value={nfmt(data.leads7d)}
                                    subtitle={`Calls ${nfmt(data.leadsBreakdown7d.call)} • WhatsApp ${nfmt(
                                        data.leadsBreakdown7d.whatsapp
                                    )} • Messages ${nfmt(data.leadsBreakdown7d.message)}`}
                                />
                                <InsightCard
                                    title="Top listing"
                                    value={data.topListingTitle ? data.topListingTitle : "—"}
                                    subtitle={data.topListingTitle ? `${nfmt(data.topListingViews)} views` : "No data yet"}
                                />
                            </div>

                            {/* ADVANCED EXTRA ROW */}
                            {tier === "advanced" && (
                                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                                    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                                        <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
                                            Traffic sources (7d)
                                        </div>

                                        <div className="mt-3 space-y-2 text-sm" style={{ color: EKARI.text }}>
                                            <div className="flex justify-between">
                                                <span style={{ color: EKARI.dim }}>Market</span>
                                                <span className="font-black">
                                                    {nfmt(data.traffic7d.market)} ({pct(data.traffic7d.market)}%)
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span style={{ color: EKARI.dim }}>Search</span>
                                                <span className="font-black">
                                                    {nfmt(data.traffic7d.search)} ({pct(data.traffic7d.search)}%)
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span style={{ color: EKARI.dim }}>Share links</span>
                                                <span className="font-black">
                                                    {nfmt(data.traffic7d.share)} ({pct(data.traffic7d.share)}%)
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span style={{ color: EKARI.dim }}>Profile</span>
                                                <span className="font-black">
                                                    {nfmt(data.traffic7d.profile)} ({pct(data.traffic7d.profile)}%)
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                                            Total {nfmt(totalTraffic)} views
                                        </div>


                                        <div className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                                            Weekly trend (last 7 days)
                                        </div>
                                        <div className="mt-3 h-40">
                                            <Line data={trafficTrendData} options={weeklyTrendOptions} />
                                        </div>
                                    </div>

                                    {/* ✅ FIXED: removed accidental double wrapper */}
                                    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                                        <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
                                            Conversion (7d)
                                        </div>

                                        <div className="mt-3 space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span style={{ color: EKARI.dim }}>Views</span>
                                                <span className="font-black" style={{ color: EKARI.text }}>
                                                    {nfmt(views)}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span style={{ color: EKARI.dim }}>Clicks</span>
                                                <span className="font-black" style={{ color: EKARI.text }}>
                                                    {nfmt(clicks)} <span style={{ color: EKARI.dim }}>({ctr}% CTR)</span>
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span style={{ color: EKARI.dim }}>Leads</span>
                                                <span className="font-black" style={{ color: EKARI.text }}>
                                                    {nfmt(leads)} <span style={{ color: EKARI.dim }}>({lcr}% from clicks)</span>
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                                            CTR = clicks ÷ views • Lead rate = leads ÷ clicks
                                        </div>
                                        <div className="mt-3 h-40">
                                            <Line data={weeklyTrendData} options={weeklyTrendOptions} />
                                        </div>

                                    </div>

                                    <div className="rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                                        <div className="text-xs font-extrabold" style={{ color: EKARI.dim }}>
                                            Exports & reports
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <button
                                                onClick={onExportCsv}
                                                className="h-9 px-3 rounded-xl border text-xs font-black"
                                                style={{ borderColor: EKARI.hair, color: EKARI.text, background: "white" }}
                                            >
                                                Export CSV
                                            </button>

                                            <button
                                                onClick={onExportSummary}
                                                className="h-9 px-3 rounded-xl border text-xs font-black"
                                                style={{ borderColor: EKARI.hair, color: EKARI.text, background: "white" }}
                                            >
                                                Download summary
                                            </button>
                                        </div>
                                        <div className="mt-2 text-xs" style={{ color: EKARI.dim }}>
                                            (Available with advanced analytics)
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* BASIC FOOTER */}
                            {tier === "basic" && (
                                <div className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: EKARI.hair }}>
                                    <div className="text-sm font-extrabold" style={{ color: EKARI.text }}>
                                        Upgrade to Advanced Analytics
                                    </div>
                                    <div className="mt-1 text-sm" style={{ color: EKARI.dim }}>
                                        Unlock traffic sources, conversion funnel, exports and weekly reports.
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}

export default function StoreClient({ sellerId }: { sellerId: string }) {
    const auth = getAuth();
    const router = useRouter();

    const [insights, setInsights] = useState<StoreInsightsData>({
        storeViews7d: 0,
        listingClicks7d: 0,
        leads7d: 0,
        leadsBreakdown7d: { call: 0, whatsapp: 0, message: 0 },
        topListingTitle: null,
        topListingViews: 0,
        traffic7d: { market: 0, search: 0, share: 0, profile: 0 },
        funnel7d: { views: 0, clicks: 0, leads: 0 },
    });
    const [sellOpen, setSellOpen] = useState(false);

    const [sellerSnap, setSellerSnap] = useState<EmbeddedSeller | null>(null);
    const [userDoc, setUserDoc] = useState<UserDoc | null>(null);

    const [items, setItems] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);

    const [tab, setTab] = useState<TabKey>("all");

    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [dailyRows, setDailyRows] = useState<any[]>([]);

    const [storefrontAllowed, setStorefrontAllowed] = useState<boolean>(false);

    /**
     * ✅ entitlements storefront comes from listings (storefrontEligible / sellerPlan.storefront)
     * ✅ analyticsBasic/Advanced comes from subscription doc (sellerSubscriptions/{sellerId})
     */
    const [entitlements, setEntitlements] = useState<SellerEntitlements>({
        storefront: false,
        analyticsBasic: false,
        analyticsAdvanced: false,
    });
    const onCreated = useCallback(
        (p: any) => {
            // setItems((prev) => {
            //  const next = applyClientFilters([p, ...prev]);
            //  if (sort === "priceAsc") return next.sort((a, b) => (a.price || 0) - (b.price || 0));
            //   if (sort === "priceDesc") return next.sort((a, b) => (b.price || 0) - (a.price || 0));
            //  return next;
            //});
        },
        []
    );
    const onSellPress = useCallback(async () => {
        setSellOpen(true);
    }, []);

    // 1) Add state:
    const [sort, setSort] = useState<SortKey>("newest");

    // 2) Compute tab counts (use your `items` array):
    const counts = useMemo(() => {
        const all = items.length;
        const featured = items.filter(isFeaturedActive).length;
        const boosted = items.filter(isBoostedActive).length;
        return { all, featured, boosted };
    }, [items]);

    // Follow state
    const me = auth.currentUser?.uid || null;
    const [isFollowing, setIsFollowing] = useState<boolean | null>(null);

    const displayName = useMemo(() => {
        return (
            sellerSnap?.name ||
            safeNameFromUser(userDoc) ||
            normalizeHandle(userDoc?.handle) ||
            normalizeHandle(sellerSnap?.handle) ||
            "Store"
        );
    }, [sellerSnap, userDoc]);

    const photoURL = useMemo(() => {
        return sellerSnap?.photoURL || userDoc?.photoURL || "/avatar-placeholder.png";
    }, [sellerSnap, userDoc]);

    const showVerified = useMemo(() => {
        const embedded = sellerSnap?.verified === true;
        const userApproved = String(userDoc?.verification?.status || "").toLowerCase() === "approved";
        const userFlag = userDoc?.verified === true;
        return embedded || userApproved || userFlag;
    }, [sellerSnap, userDoc]);

    const handleText = useMemo(() => {
        return normalizeHandle(userDoc?.handle) || normalizeHandle(sellerSnap?.handle) || "@seller";
    }, [sellerSnap, userDoc]);

    const locationText = useMemo(() => {
        const place = userDoc?.location?.place?.trim?.() || "";
        const county = (userDoc?.county || "").trim();
        const country = (userDoc?.country || "").trim();
        if (place) return place;
        const parts = [county, country].filter(Boolean);
        return parts.length ? parts.join(", ") : null;
    }, [userDoc]);

    const bioText = useMemo(() => {
        const b = (userDoc?.bio || "").trim();
        return b.length ? b : null;
    }, [userDoc]);

    const followersCount = Number(userDoc?.followersCount ?? 0);
    const profileViews = Number(userDoc?.profileViews ?? 0);
    const likes = Number(userDoc?.likes ?? 0);

    async function fetchListingsPage(after?: QueryDocumentSnapshot<DocumentData> | null) {
        const base1 = query(
            collection(db, "marketListings"),
            where("ownerId", "==", sellerId),
            ...(isOwner ? [] : [where("status", "==", "active")]),
            orderBy("publishedAt", "desc"),
            limit(24)
        );

        const q1 = after ? query(base1, startAfter(after)) : base1;
        const snap1 = await getDocs(q1);
        if (!snap1.empty) return snap1;

        const base2 = query(
            collection(db, "marketListings"),
            where("seller.id", "==", sellerId),
            ...(isOwner ? [] : [where("status", "==", "active")]),
            orderBy("publishedAt", "desc"),
            limit(24)
        );

        const q2 = after ? query(base2, startAfter(after)) : base2;
        return await getDocs(q2);
    }
    const isOwner = auth.currentUser?.uid === sellerId;
    const updateListingStatus = async (p: any, status: "active" | "sold" | "reserved" | "hidden") => {
        if (!isOwner) return;

        try {
            await updateDoc(doc(db, "marketListings", p.id), {
                status,
                sold: status === "sold",
                updatedAt: serverTimestamp(),
            });

            // optimistic local update (keeps UI snappy)
            setItems((prev) =>
                prev.map((x: any) => (x.id === p.id ? { ...x, status, sold: status === "sold" } : x))
            );
        } catch (e: any) {
            console.error(e);
            window.alert(e?.message || "We couldn't update the listing status. Try again.");
        }
    };

    const deleteListing = async (p: any) => {
        if (!isOwner) return;

        const ok = window.confirm(
            "Delete this listing?\n\nThis will permanently remove the listing and its images. This cannot be undone."
        );
        if (!ok) return;

        try {
            // ✅ Storage cleanup (adjust path to match YOUR uploader)
            // You earlier used: products/${sellerId}/${listingId}/images
            const imagesFolder = sRef(storage, `products/${sellerId}/${p.id}/images`);
            try {
                await deleteFolderRecursively(imagesFolder);
            } catch (e) {
                console.warn("Images cleanup issue:", e);
            }

            // ✅ Optional: delete subcollections if you have them
            // parentPath must match the doc path you are deleting
            const parentPath = `users/${sellerId}/marketListings/${p.id}`; // ❗ only if that's your structure
            // If your reviews are under marketListings/{id}/reviews, then use:
            // const parentPath = `marketListings/${p.id}`;

            // If you DO have reviews:
            // await deleteSubcollection(db, `marketListings/${p.id}`, "reviews");

            await deleteDoc(doc(db, "marketListings", p.id));

            // local remove
            setItems((prev) => prev.filter((x: any) => x.id !== p.id));
        } catch (e: any) {
            console.error(e);
            window.alert(e?.message || "Delete failed. Please try again.");
        }
    };
    // ✅ Premium pill (separate from Verified)
    const isPremiumStore = useMemo(() => {
        return items.some((p) => p?.sellerPlan?.storefront === true || p?.storefrontEligible === true);
    }, [items]);

    // ✅ Follow listener
    useEffect(() => {
        if (!me || !sellerId || me === sellerId) {
            setIsFollowing(null);
            return;
        }
        const id = `${me}_${sellerId}`;
        const ref = doc(db, "follows", id);
        const unsub = onSnapshot(ref, (s) => setIsFollowing(s.exists()));
        return () => unsub();
    }, [me, sellerId]);

    const toggleFollow = async () => {
        if (!me || !sellerId || me === sellerId) return;
        const id = `${me}_${sellerId}`;
        const ref = doc(db, "follows", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            await deleteDoc(ref);
        } else {
            await setDoc(ref, {
                followerId: me,
                followingId: sellerId,
                createdAt: Date.now(),
            });
        }
    };

    /**
     * ✅ Initial load listings + storefrontAllowed from listings
     */
    useEffect(() => {
        let alive = true;

        (async () => {
            setLoading(true);
            setItems([]);
            setLastDoc(null);
            setHasMore(true);
            setSellerSnap(null);
            setUserDoc(null);
            setStorefrontAllowed(false);
            setTab("all");

            try {
                // Always fetch user doc
                const uRef = doc(db, "users", sellerId);
                const uSnap = await getDoc(uRef);
                if (alive && uSnap.exists()) setUserDoc(uSnap.data() as any);

                // Load first page
                const snap = await fetchListingsPage(null);
                if (!alive) return;

                const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
                setItems(list);
                setLastDoc(snap.docs[snap.docs.length - 1] || null);
                setHasMore(snap.docs.length >= 24);

                // embedded seller (nice-to-have)
                const firstSeller: EmbeddedSeller | null = (list?.[0]?.seller as any) || null;
                if (firstSeller?.id) setSellerSnap(firstSeller);

                const storefront = resolveStorefrontFromListings(list);
                setStorefrontAllowed(storefront);

                // ✅ ONLY storefront comes from listings now
                setEntitlements((prev) => ({
                    ...prev,
                    storefront,
                }));
            } finally {
                if (alive) setLoading(false);
            }
        })();

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sellerId]);
    const onShareStore = async () => {
        try {
            const origin =
                typeof window !== "undefined" ? window.location.origin : "https://ekarihub.com";

            // shared link should always tag src=share
            const url = `${origin}/store/${encodeURIComponent(sellerId)}?src=share`;

            const title = `${displayName || "Store"} on ekarihub`;
            const text = `Check out ${displayName || "this store"} on ekarihub`;

            // ✅ Web Share API (mobile)
            if (typeof navigator !== "undefined" && (navigator as any).share) {
                await (navigator as any).share({ title, text, url });
                return;
            }

            // ✅ Fallback: copy to clipboard
            if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(url);
                window.alert("Store link copied!");
                return;
            }

            // ✅ Last resort
            window.prompt("Copy store link:", url);
        } catch (e) {
            console.error("Share failed:", e);
        }
    };
    const loadMore = async () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);

        try {
            const snap = await fetchListingsPage(lastDoc);
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

            setItems((prev) => {
                const seen = new Set(prev.map((x: any) => x.id));
                const merged = [...prev];
                for (const it of list) if (!seen.has(it.id)) merged.push(it);
                return merged;
            });

            setLastDoc(snap.docs[snap.docs.length - 1] || lastDoc);
            setHasMore(snap.docs.length >= 24);

            // Update storefront allowed based on new items too
            const nextStorefront = resolveStorefrontFromListings(list);
            setStorefrontAllowed((prevAllowed) => prevAllowed || nextStorefront);
            setEntitlements((prev) => ({ ...prev, storefront: prev.storefront || nextStorefront }));
        } finally {
            setLoadingMore(false);
        }
    };

    /**
     * ✅ SUBSCRIPTION listener (fix: robust field reading + sets analytics flags)
     * Looks at:
     *  - status: active | trialing
     *  - currentPeriodEnd OR current_period_end OR endAt (Timestamp)
     *  - entitlements.analyticsLevel OR analyticsLevel
     */
    useEffect(() => {
        if (!sellerId) return;

        const ref = doc(db, "sellerSubscriptions", sellerId);

        return onSnapshot(ref, (snap) => {
            if (!snap.exists()) {
                setEntitlements((prev) => ({
                    ...prev,
                    analyticsBasic: false,
                    analyticsAdvanced: false,
                }));
                return;
            }

            const sub: any = snap.data();

            const status = String(sub?.status || "").toLowerCase().trim();
            const statusOk = ["active", "trialing"].includes(status);

            const endMs =
                sub?.currentPeriodEnd?.toMillis?.() ??
                sub?.current_period_end?.toMillis?.() ??
                sub?.endAt?.toMillis?.() ??
                0;

            const active = statusOk && endMs > Date.now();

            const level = String(
                sub?.entitlements?.analyticsLevel ??
                sub?.entitlements?.analytics_level ??
                sub?.analyticsLevel ??
                ""
            )
                .toLowerCase()
                .trim();

            const analyticsAdvanced = active && level === "advanced";
            const analyticsBasic = active && (level === "basic" || level === "advanced");

            setEntitlements((prev) => ({
                ...prev,
                analyticsBasic,
                analyticsAdvanced,
            }));
        });
    }, [sellerId]);

    const insightsTier = useMemo(() => computeInsightsTier(entitlements), [entitlements]);

    const filteredItems = useMemo(() => {
        if (tab === "all") return items;
        if (tab === "featured") return items.filter(isFeaturedActive);
        return items.filter(isBoostedActive);
    }, [items, tab]);

    const onContactSeller = () => {
        const meUid = auth.currentUser?.uid;
        if (!meUid) {
            window.location.href = "/login";
            return;
        }
        if (meUid === sellerId) return;

        const threadId = makeThreadId(meUid, sellerId);
        const qs = new URLSearchParams();
        qs.set("peerId", sellerId);
        qs.set("peerName", displayName || "Seller");
        if (photoURL) qs.set("peerPhotoURL", photoURL);
        if (handleText) qs.set("peerHandle", handleText);

        bumpLead({ sellerId, listingId: null, kind: "message" }).catch(() => { });
        window.location.href = `/bonga/${encodeURIComponent(threadId)}?${qs.toString()}`;
    };

    // Contact option links (only show if exists)
    const phone = cleanPhone(userDoc?.phone || null);
    const wa = toWhatsAppLink(userDoc?.whatsapp || userDoc?.phone || null);
    const website = toWebsiteLink(userDoc?.website || null);
    const isDesktop = useIsDesktop();
    // ✅ Deep link + "Open in App" banner
    const srcParam = useMemo(() => {
        if (typeof window === "undefined") return "profile" as const;
        const s = new URLSearchParams(window.location.search).get("src");
        return s === "market" || s === "search" || s === "share" || s === "profile" || s === "mystore" ? s : "profile";
    }, []);

    const webUrl = useMemo(() => {
        if (typeof window !== "undefined") return window.location.href;
        return `https://ekarihub.com/store/${encodeURIComponent(sellerId)}?src=${encodeURIComponent(srcParam)}`;
    }, [sellerId, srcParam]);

    // Match your RN linking config (recommended route: ekarihub:///store/:sellerId)
    const appUrl = useMemo(() => {
        return `ekarihub:///store/${encodeURIComponent(sellerId)}?src=${encodeURIComponent(srcParam)}`;
    }, [sellerId, srcParam]);


    // 4) Apply sorting AFTER filtering:
    const sortedFilteredItems = useMemo(() => {
        const arr = [...filteredItems];

        const getPrice = (p: any) => {
            // adapt to your schema: p.price or p.amount or p.priceMajor etc
            const n = Number(p?.price ?? p?.amount ?? 0);
            return Number.isFinite(n) ? n : 0;
        };

        const getViews = (p: any) => Number(p?.stats?.views ?? 0);
        const getLikes = (p: any) => Number(p?.stats?.likes ?? 0);

        switch (sort) {
            case "newest":
                // you already orderBy publishedAt desc, so this is mainly for future-proofing:
                arr.sort((a: any, b: any) => {
                    const am = a?.publishedAt?.toMillis?.() ?? a?.publishedAt ?? 0;
                    const bm = b?.publishedAt?.toMillis?.() ?? b?.publishedAt ?? 0;
                    return bm - am;
                });
                break;
            case "price_low":
                arr.sort((a: any, b: any) => getPrice(a) - getPrice(b));
                break;
            case "price_high":
                arr.sort((a: any, b: any) => getPrice(b) - getPrice(a));
                break;
            case "most_viewed":
                arr.sort((a: any, b: any) => getViews(b) - getViews(a));
                break;
            case "most_liked":
                arr.sort((a: any, b: any) => getLikes(b) - getLikes(a));
                break;
        }

        return arr;
    }, [filteredItems, sort]);

    /**
     * ✅ Store view bump (only once, using ?src=...)
     */
    useEffect(() => {
        if (!sellerId || !storefrontAllowed) return;

        if (typeof window !== "undefined") {
            const src = new URLSearchParams(window.location.search).get("src");

            if (src === "mystore") return;

            const v =
                src === "market" || src === "search" || src === "share" || src === "profile"
                    ? src
                    : "profile";

            bumpStoreView(sellerId, v).catch(() => { });
        }
    }, [sellerId, storefrontAllowed]);

    /**
     * ✅ Daily stats listener (7d rollup) for basic+advanced
     */
    useEffect(() => {
        if (!sellerId) return;
        if (insightsTier === "locked") return;

        const since = new Date();
        since.setDate(since.getDate() - 6);
        since.setHours(0, 0, 0, 0);

        const qDaily = query(
            collection(db, "storeDailyStats"),
            where("sellerId", "==", sellerId),
            where("dayStart", ">=", Timestamp.fromDate(since)),
            orderBy("dayStart", "asc"),
            limit(7)
        );

        const unsub = onSnapshot(qDaily, (snap) => {
            let storeViews7d = 0;
            let listingClicks7d = 0;
            let leads7d = 0;

            let call = 0;
            let whatsapp = 0;
            let message = 0;

            let market = 0,
                search = 0,
                share = 0,
                profile = 0;

            snap.docs.forEach((d) => {
                const x = d.data() as any;
                storeViews7d += Number(x.storeViews || 0);
                listingClicks7d += Number(x.listingClicks || 0);
                leads7d += Number(x.leadsTotal || 0);

                call += Number(x.leadsCall || 0);
                whatsapp += Number(x.leadsWhatsApp || 0);
                message += Number(x.leadsMessage || 0);

                market += Number(x.srcMarketViews || 0);
                search += Number(x.srcSearchViews || 0);
                share += Number(x.srcShareViews || 0);
                profile += Number(x.srcProfileViews || 0);
            });

            setInsights((prev) => ({
                ...prev,
                storeViews7d,
                listingClicks7d,
                leads7d,
                leadsBreakdown7d: { call, whatsapp, message },

                traffic7d: { market, search, share, profile },
                funnel7d: { views: storeViews7d, clicks: listingClicks7d, leads: leads7d },
            }));

            setDailyRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
        });

        return () => unsub();
    }, [sellerId, insightsTier]);

    /**
     * ✅ Top listing (by stats.views)
     */
    useEffect(() => {
        if (!sellerId) return;
        if (!storefrontAllowed) return;

        (async () => {
            const tryOwner = query(
                collection(db, "marketListings"),
                where("ownerId", "==", sellerId),
                where("status", "==", "active"),
                orderBy("stats.views", "desc"),
                limit(1)
            );

            let snap = await getDocs(tryOwner);

            if (snap.empty) {
                const trySeller = query(
                    collection(db, "marketListings"),
                    where("seller.id", "==", sellerId),
                    where("status", "==", "active"),
                    orderBy("stats.views", "desc"),
                    limit(1)
                );
                snap = await getDocs(trySeller);
            }

            if (snap.empty) {
                setInsights((prev) => ({ ...prev, topListingTitle: null, topListingViews: 0 }));
                return;
            }

            const data = snap.docs[0].data() as any;
            setInsights((prev) => ({
                ...prev,
                topListingTitle: data?.name || data?.title || "Top listing",
                topListingViews: Number(data?.stats?.views || 0),
            }));
        })().catch((e) => console.error("Top listing query failed:", e));
    }, [sellerId, storefrontAllowed]);

    const TabBtn = ({ k, label, icon }: { k: TabKey; label: string; icon: React.ReactNode }) => (
        <button
            onClick={() => setTab(k)}
            className={clsx(
                "h-9 px-3 rounded-full border text-xs font-black inline-flex items-center gap-1.5 transition",
                tab === k ? "bg-black/[0.04]" : "bg-white hover:bg-black/[0.02]"
            )}
            style={{ borderColor: EKARI.hair, color: EKARI.text }}
        >
            {icon}
            {label}
        </button>
    );


    const Page = (
        <main className="min-h-screen w-full bg-white">
            {/* ✅ Open in app banner (usually show on mobile web only) */}
            {!isDesktop && (<OpenInAppBanner
                webUrl={webUrl}
                appUrl={appUrl}
                title="Open this store in ekarihub"
                subtitle="Faster loading, messaging, and full features."
                playStoreUrl="https://play.google.com/store/apps/details?id=com.ekarihub.app"
                appStoreUrl="https://apps.apple.com" // replace when ready
            />)}
            {/* Header */}
            <div className="border-b" style={{ borderColor: EKARI.hair }}>


                <StoreCoverHero
                    sellerId={sellerId}
                    userDoc={userDoc}
                    displayName={displayName}
                    photoURL={photoURL}
                    showVerified={showVerified}
                    isOwner={isOwner}
                    isPremiumStore={isPremiumStore}
                    isFollowing={isFollowing}
                    onToggleFollow={toggleFollow}
                    onMessage={onContactSeller}
                    onShare={onShareStore}
                    onSellPress={onSellPress}
                    onCall={
                        phone
                            ? async () => {
                                try {
                                    await bumpLead({ sellerId, kind: "call" });
                                } finally {
                                    window.location.href = `tel:${phone}`;
                                }
                            }
                            : undefined
                    }
                    onWhatsApp={
                        wa
                            ? () => {
                                bumpLead({ sellerId, kind: "whatsapp" }).catch(() => { });
                                window.open(wa, "_blank");
                            }
                            : undefined
                    }
                    onWebsite={
                        website
                            ? () => window.open(website, "_blank")
                            : undefined
                    }
                    locationText={locationText}
                />


                {/* Tabs */}
                <div className="max-w-5xl mx-auto px-4 mt-2 md:mt-3 mb-5">
                    <SegmentedTabs value={tab} onChange={setTab} counts={counts} />
                </div>


            </div>

            {/* Body */}
            <div className="max-w-5xl mx-auto px-4 py-5">
                {loading ? (
                    <div className="text-sm" style={{ color: EKARI.dim }}>
                        Loading listings…
                    </div>
                ) : !storefrontAllowed ? (
                    <div className="rounded-2xl border p-5 bg-[#FAFAFA]" style={{ borderColor: EKARI.hair }}>
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                                <IoLockClosedOutline size={18} style={{ color: EKARI.dim }} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-black" style={{ color: EKARI.text }}>
                                    Storefront locked
                                </h2>
                                <p className="text-sm mt-1" style={{ color: EKARI.dim }}>
                                    This seller hasn’t enabled a Dedicated Storefront on their plan yet.
                                </p>
                                <div className="mt-3">
                                    <Link href="/market" className="text-sm font-black underline" style={{ color: EKARI.forest }}>
                                        Browse the market instead
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-sm" style={{ color: EKARI.dim }}>
                        {tab === "all"
                            ? "No active listings yet."
                            : tab === "featured"
                                ? "No featured listings right now."
                                : "No boosted listings right now."}
                    </div>
                ) : (
                    <>

                        <CatalogHeader
                            tab={tab}
                            sort={sort}
                            onSortChange={setSort}
                            subtitle={
                                tab === "all"
                                    ? "All active items from this store."
                                    : tab === "featured"
                                        ? "Highlighted items with premium exposure."
                                        : "Boosted items currently getting more reach."
                            }
                        />



                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-1">
                            {sortedFilteredItems.map((p: any) => {
                                const status = String(p?.status || (p?.sold ? "sold" : "active")).toLowerCase();

                                return (
                                    <div key={p.id} className="space-y-2">
                                        <div className="relative">
                                            <ProductCard p={p} />

                                            {/* optional status badge (owner + visitors can see) */}
                                            <div
                                                className={`absolute left-2 top-2 ${statusColorClass(p)} text-white text-[11px] font-black h-6 px-2 rounded-full flex items-center`}
                                            >
                                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                            </div>
                                        </div>

                                        {/* ✅ OWNER CONTROLS (only owner sees) */}
                                        {isOwner && (
                                            <div className="flex flex-wrap gap-2">
                                                {status !== "active" && (
                                                    <button
                                                        onClick={() => updateListingStatus(p, "active")}
                                                        className="px-2 py-1 rounded-md bg-emerald-700 text-white text-xs font-black hover:opacity-90"
                                                    >
                                                        Activate
                                                    </button>
                                                )}

                                                {status !== "sold" && (
                                                    <button
                                                        onClick={() => updateListingStatus(p, "sold")}
                                                        className="px-2 py-1 rounded-md bg-amber-600 text-white text-xs font-black hover:opacity-90"
                                                    >
                                                        Sold
                                                    </button>
                                                )}

                                                {status !== "reserved" && (
                                                    <button
                                                        onClick={() => updateListingStatus(p, "reserved")}
                                                        className="px-2 py-1 rounded-md bg-yellow-500 text-white text-xs font-black hover:opacity-90"
                                                    >
                                                        Reserve
                                                    </button>
                                                )}

                                                {status !== "hidden" && (
                                                    <button
                                                        onClick={() => updateListingStatus(p, "hidden")}
                                                        className="px-2 py-1 rounded-md bg-gray-600 text-white text-xs font-black hover:opacity-90"
                                                    >
                                                        Hide
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => deleteListing(p)}
                                                    className="px-2 py-1 rounded-md bg-red-600 text-white text-xs font-black hover:opacity-90"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 flex justify-center">
                            {hasMore && tab === "all" ? (
                                <button
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className={clsx(
                                        "h-11 px-5 rounded-xl font-black border transition",
                                        loadingMore ? "opacity-60 cursor-not-allowed" : "hover:bg-black/[0.03]"
                                    )}
                                    style={{ borderColor: EKARI.hair, color: EKARI.text, background: "white" }}
                                >
                                    {loadingMore ? "Loading…" : "Load more"}
                                </button>
                            ) : (
                                <div className="text-xs" style={{ color: EKARI.dim }}>
                                    {tab === "all" ? "End of listings." : "Tip: switch to All to load more."}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {isOwner && (<> {/* ✅ Insights section */}
                <div className="max-w-5xl mx-auto px-4">
                    <StoreInsights
                        tier={insightsTier}
                        data={insights}
                        dailyRows={dailyRows}
                        onUpgrade={() => router.push("/seller/dashboard")}
                        onExportCsv={() => {
                            downloadCSV(`store-${sellerId}-daily-stats.csv`, dailyRows);
                        }}
                        onExportSummary={() => {
                            downloadCSV(`store-${sellerId}-summary.csv`, [
                                {
                                    sellerId,
                                    storeViews7d: insights.storeViews7d,
                                    listingClicks7d: insights.listingClicks7d,
                                    leads7d: insights.leads7d,
                                    topListingTitle: insights.topListingTitle,
                                    topListingViews: insights.topListingViews,
                                    ...insights.traffic7d,
                                },
                            ]);
                        }}
                    />
                </div>
            </>)}
            {/* Guest-only premium badge */}
            {!isOwner && isPremiumStore && (
                <div
                    className="max-w-5xl mx-auto px-4 mb-4 rounded-2xl border bg-[#FFFBF3] p-4 flex items-start gap-3"
                    style={{ borderColor: EKARI.hair }}
                >
                    <div className="mt-0.5">
                        <IoStorefrontOutline size={18} style={{ color: EKARI.gold }} />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-black" style={{ color: EKARI.text }}>
                            This store is premium
                        </div>
                        <div className="mt-0.5 text-sm" style={{ color: EKARI.dim }}>
                            Dedicated Storefront sellers often respond faster and keep listings updated.
                        </div>
                    </div>
                </div>
            )}
            <SellModal open={sellOpen} onClose={() => setSellOpen(false)} onCreated={onCreated} />
        </main>
    );

    return isDesktop ? <AppShell>{Page}</AppShell> : Page;

}
