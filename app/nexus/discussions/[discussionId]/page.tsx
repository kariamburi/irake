import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import DiscussionThreadClient from "./DiscussionThreadClient";

export const dynamic = "force-dynamic";

const baseUrl = "https://ekarihub.com";

type DiscussionItem = {
  id: string;
  title: string;
  body?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  category?: string | null;
  tags?: string[];
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

async function getPublicDiscussionById(
  discussionId: string
): Promise<DiscussionItem | null> {
  const db = getAdminDb();
  const snap = await db.collection("discussions").doc(discussionId).get();

  if (!snap.exists) return null;

  const d = snap.data() as any;
  const title = String(d?.title || "").trim();

  if (!title) return null;

  return {
    id: snap.id,
    title,
    body: String(d?.body || "").trim(),
    category: d?.category ? String(d.category).trim() : null,
    tags: Array.isArray(d?.tags)
      ? d.tags.map((x: unknown) => String(x || "").trim()).filter(Boolean)
      : [],
    createdAt:
      d?.createdAt?.toDate?.()?.toISOString?.() ||
      d?.createdAt ||
      null,
    updatedAt:
      d?.updatedAt?.toDate?.()?.toISOString?.() ||
      d?.createdAt?.toDate?.()?.toISOString?.() ||
      d?.updatedAt ||
      d?.createdAt ||
      null,
  };
}

function safeDescription(input?: string, fallback?: string) {
  const text = String(input || fallback || "").replace(/\s+/g, " ").trim();
  if (!text) return "Join the conversation on ekarihub Nexus.";
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ discussionId: string }>;
}): Promise<Metadata> {
  const { discussionId } = await params;
  const discussion = await getPublicDiscussionById(discussionId);

  if (!discussion) {
    return {
      title: "Discussion not found | ekarihub",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `${baseUrl}/nexus/discussions/${encodeURIComponent(
    discussionId
  )}`;

  const title = `${discussion.title} | ekarihub Nexus`;
  const description = safeDescription(
    discussion.body,
    `Join the discussion on ekarihub Nexus: ${discussion.title}`
  );

  return {
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
      type: "article",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

function buildDiscussionJsonLd(
  discussion: DiscussionItem,
  discussionId: string
) {
  const url = `${baseUrl}/nexus/discussions/${encodeURIComponent(discussionId)}`;

  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: discussion.title,
    articleBody: discussion.body || undefined,
    datePublished: discussion.createdAt || undefined,
    dateModified: discussion.updatedAt || discussion.createdAt || undefined,
    url,
    mainEntityOfPage: url,
    keywords: discussion.tags?.length ? discussion.tags.join(", ") : undefined,
    articleSection: discussion.category || "Discussion",
    publisher: {
      "@type": "Organization",
      name: "ekarihub",
      url: baseUrl,
    },
  };
}

export default async function DiscussionPage({
  params,
}: {
  params: Promise<{ discussionId: string }>;
}) {
  const { discussionId } = await params;
  const discussion = await getPublicDiscussionById(discussionId);

  if (!discussion) notFound();

  const jsonLd = buildDiscussionJsonLd(discussion, discussionId);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DiscussionThreadClient
        discussionId={discussionId}
        initialDiscussion={discussion}
      />
    </>
  );
}