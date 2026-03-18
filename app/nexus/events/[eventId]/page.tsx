// app/nexus/event/[eventId]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import EventDetailsClient from "./EventDetailsClient";

export const dynamic = "force-dynamic";

const baseUrl = "https://ekarihub.com";

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
  updatedAt?: string | null;
};

function initAdmin() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function getAdminDb() {
  return getFirestore(initAdmin());
}

async function getPublicEventById(eventId: string): Promise<EventItem | null> {
  const db = getAdminDb();
  const snap = await db.collection("events").doc(eventId).get();

  if (!snap.exists) return null;

  const d = snap.data() as any;
  const title = String(d?.title || "").trim();

  if (!title) return null;

  return {
    id: snap.id,
    title,
    location: d?.location || "",
    dateISO: d?.dateISO || "",
    price: typeof d?.price === "number" ? d.price : undefined,
    currency: d?.currency === "USD" ? "USD" : "KES",
    tags: Array.isArray(d?.tags) ? d.tags.filter(Boolean) : [],
    category: d?.category || "",
    coverUrl: d?.coverUrl || "",
    description: d?.description || "",
    registrationUrl: d?.registrationUrl || "",
    stats: d?.stats || {},
    counts: d?.counts || {},
    rsvps: typeof d?.rsvps === "number" ? d.rsvps : undefined,
    updatedAt:
      d?.updatedAt?.toDate?.()?.toISOString?.() ||
      d?.createdAt?.toDate?.()?.toISOString?.() ||
      null,
  };
}

function safeDescription(input?: string, fallback?: string) {
  const text = String(input || fallback || "").replace(/\s+/g, " ").trim();
  if (!text) return "Discover events on ekarihub.";
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  const ev = await getPublicEventById(eventId);

  if (!ev) {
    return {
      title: "Event not found | ekarihub",
      description: "This event could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonical = `${baseUrl}/nexus/event/${encodeURIComponent(eventId)}`;
  const title = `${ev.title} | ekarihub Events`;
  const description = safeDescription(
    ev.description,
    `${ev.title}${ev.location ? ` • ${ev.location}` : ""}`
  );

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "ekarihub",
      type: "website",
      images: ev.coverUrl ? [{ url: ev.coverUrl }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ev.coverUrl ? [ev.coverUrl] : [],
    },
  };
}

function buildEventJsonLd(ev: EventItem, eventId: string) {
  const url = `${baseUrl}/nexus/event/${encodeURIComponent(eventId)}`;

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    description: ev.description || undefined,
    startDate: ev.dateISO || undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: ev.location
      ? {
        "@type": "Place",
        name: ev.location,
        address: ev.location,
      }
      : undefined,
    image: ev.coverUrl ? [ev.coverUrl] : undefined,
    offers:
      typeof ev.price === "number"
        ? {
          "@type": "Offer",
          price: ev.price,
          priceCurrency: ev.currency || "KES",
          url: ev.registrationUrl || url,
          availability: "https://schema.org/InStock",
        }
        : undefined,
    url,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const ev = await getPublicEventById(eventId);

  if (!ev) notFound();

  const jsonLd = buildEventJsonLd(ev, eventId);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <EventDetailsClient eventId={eventId} initialEvent={ev} />
    </>
  );
}