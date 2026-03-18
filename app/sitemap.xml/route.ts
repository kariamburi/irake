import type { MetadataRoute } from "next";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { AnyARecord } from "dns";

const baseUrl = "https://ekarihub.com";
const TAG_PAGE_SIZE = 24;
const EVENT_PAGE_SIZE = 24;
const DISCUSSION_PAGE_SIZE = 24;
const MARKET_PAGE_SIZE = 24;

function safeDate(value?: string | Date | null) {
  const d = value ? new Date(value) : null;
  return d && !isNaN(d.getTime()) ? d : new Date();
}

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

type PublicHandleRow = {
  handle: string;
  updatedAt?: string | Date | null;
};

type PublicDeedRow = {
  id: string;
  handle: string;
  updatedAt?: string | Date | null;
};

type PublicTagRow = {
  tag: string;
  updatedAt?: string | Date | null;
  totalPages: number;
};

type PublicEventRow = {
  id: string;
  updatedAt?: string | Date | null;
};

type PublicDiscussionRow = {
  id: string;
  updatedAt?: string | Date | null;
};

type PublicMarketRow = {
  id: string;
  updatedAt?: string | Date | null;
};

type PublicMarketCategoryRow = {
  slug: string;
  name: string;
  updatedAt?: string | Date | null;
  totalPages: number;
};
type PublicMarketTypeRow = {
  type: string;
  updatedAt?: string | Date | null;
  totalPages: number;
};
async function getPublicHandles(
  db: FirebaseFirestore.Firestore
): Promise<PublicHandleRow[]> {
  const snap = await db.collection("users").select("handle", "updatedAt").get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() as any;
      const handle = String(data?.handle || "").trim();
      if (!handle) return null;

      return {
        handle,
        updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt || null,
      };
    })
    .filter(Boolean) as PublicHandleRow[];
}

async function getPublicDeeds(
  db: FirebaseFirestore.Firestore
): Promise<PublicDeedRow[]> {
  const snap = await db
    .collection("deeds")
    .where("visibility", "==", "public")
    .where("status", "==", "ready")
    .select("authorUsername", "updatedAt", "createdAt")
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() as any;
      const handle = String(data?.authorUsername || "").trim();
      if (!handle) return null;

      return {
        id: doc.id,
        handle,
        updatedAt:
          data?.updatedAt?.toDate?.() ||
          data?.createdAt?.toDate?.() ||
          data?.updatedAt ||
          data?.createdAt ||
          null,
      };
    })
    .filter(Boolean) as PublicDeedRow[];
}

async function getPublicTags(
  db: FirebaseFirestore.Firestore
): Promise<PublicTagRow[]> {
  const snap = await db
    .collection("deeds")
    .where("visibility", "==", "public")
    .where("status", "==", "ready")
    .select("tags", "updatedAt", "createdAt")
    .get();

  const tagMap = new Map<
    string,
    {
      updatedAt: Date;
      count: number;
    }
  >();

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const rawTags = Array.isArray(data?.tags) ? data.tags : [];
    const updatedAt =
      data?.updatedAt?.toDate?.() ||
      data?.createdAt?.toDate?.() ||
      new Date();

    const normalizedUniqueTags: string[] = Array.from(
      new Set(
        rawTags
          .map((raw: unknown) => String(raw || "").trim())
          .filter((tag: any): tag is string => tag.length > 0)
      )
    );

    for (const tag of normalizedUniqueTags) {
      const prev = tagMap.get(tag);

      if (!prev) {
        tagMap.set(tag, {
          updatedAt,
          count: 1,
        });
      } else {
        tagMap.set(tag, {
          updatedAt: updatedAt > prev.updatedAt ? updatedAt : prev.updatedAt,
          count: prev.count + 1,
        });
      }
    }
  }

  return Array.from(tagMap.entries()).map(([tag, meta]) => ({
    tag,
    updatedAt: meta.updatedAt,
    totalPages: Math.max(1, Math.ceil(meta.count / TAG_PAGE_SIZE)),
  }));
}

async function getPublicEvents(
  db: FirebaseFirestore.Firestore
): Promise<PublicEventRow[]> {
  const snap = await db
    .collection("events")
    .select("updatedAt", "createdAt", "title")
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() as any;
      const title = String(data?.title || "").trim();
      if (!title) return null;

      return {
        id: doc.id,
        updatedAt:
          data?.updatedAt?.toDate?.() ||
          data?.createdAt?.toDate?.() ||
          data?.updatedAt ||
          data?.createdAt ||
          null,
      };
    })
    .filter(Boolean) as PublicEventRow[];
}

async function getPublicDiscussions(
  db: FirebaseFirestore.Firestore
): Promise<PublicDiscussionRow[]> {
  const snap = await db
    .collection("discussions")
    .select("title", "updatedAt", "createdAt")
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() as any;
      const title = String(data?.title || "").trim();
      if (!title) return null;

      return {
        id: doc.id,
        updatedAt:
          data?.updatedAt?.toDate?.() ||
          data?.createdAt?.toDate?.() ||
          data?.updatedAt ||
          data?.createdAt ||
          null,
      };
    })
    .filter(Boolean) as PublicDiscussionRow[];
}

async function getPublicMarketListings(
  db: FirebaseFirestore.Firestore
): Promise<PublicMarketRow[]> {
  const snap = await db
    .collection("marketListings")
    .select("name", "status", "updatedAt", "createdAt", "publishedAt")
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data() as any;
      const name = String(data?.name || "").trim();
      const status = String(data?.status || "active").trim().toLowerCase();

      if (!name) return null;
      if (status === "hidden") return null;

      return {
        id: doc.id,
        updatedAt:
          data?.updatedAt?.toDate?.() ||
          data?.publishedAt?.toDate?.() ||
          data?.createdAt?.toDate?.() ||
          data?.updatedAt ||
          data?.publishedAt ||
          data?.createdAt ||
          null,
      };
    })
    .filter(Boolean) as PublicMarketRow[];
}

async function getPublicMarketCategories(
  db: FirebaseFirestore.Firestore
): Promise<PublicMarketCategoryRow[]> {
  const snap = await db
    .collection("marketListings")
    .where("status", "==", "active")
    .select("category", "categorySlug", "updatedAt", "publishedAt", "createdAt")
    .get();

  const map = new Map<
    string,
    {
      name: string;
      updatedAt: Date;
      count: number;
    }
  >();

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const slug = String(data?.categorySlug || "").trim();
    const name = String(data?.category || "").trim();

    if (!slug || !name) continue;

    const updatedAt =
      data?.updatedAt?.toDate?.() ||
      data?.publishedAt?.toDate?.() ||
      data?.createdAt?.toDate?.() ||
      new Date();

    const prev = map.get(slug);

    if (!prev) {
      map.set(slug, {
        name,
        updatedAt,
        count: 1,
      });
    } else {
      map.set(slug, {
        name: prev.name || name,
        updatedAt: updatedAt > prev.updatedAt ? updatedAt : prev.updatedAt,
        count: prev.count + 1,
      });
    }
  }

  return Array.from(map.entries()).map(([slug, meta]) => ({
    slug,
    name: meta.name,
    updatedAt: meta.updatedAt,
    totalPages: Math.max(1, Math.ceil(meta.count / MARKET_PAGE_SIZE)),
  }));
}
async function getPublicMarketTypes(
  db: FirebaseFirestore.Firestore
): Promise<PublicMarketTypeRow[]> {
  const snap = await db
    .collection("marketListings")
    .where("status", "==", "active")
    .select("type", "updatedAt", "publishedAt", "createdAt")
    .get();

  const map = new Map<string, { updatedAt: Date; count: number }>();

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const type = String(data?.type || "").trim();
    if (!type) continue;

    const updatedAt =
      data?.updatedAt?.toDate?.() ||
      data?.publishedAt?.toDate?.() ||
      data?.createdAt?.toDate?.() ||
      new Date();

    const prev = map.get(type);
    if (!prev) {
      map.set(type, { updatedAt, count: 1 });
    } else {
      map.set(type, {
        updatedAt: updatedAt > prev.updatedAt ? updatedAt : prev.updatedAt,
        count: prev.count + 1,
      });
    }
  }

  return Array.from(map.entries()).map(([type, meta]) => ({
    type,
    updatedAt: meta.updatedAt,
    totalPages: Math.max(1, Math.ceil(meta.count / 24)),
  }));
}
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const app = initAdmin();
  const db = getFirestore(app);

  const [
    publicHandles,
    publicDeeds,
    publicTags,
    publicEvents,
    publicDiscussions,
    publicMarketListings,
    publicMarketCategories,
    publicMarketTypes,

  ] = await Promise.all([
    getPublicHandles(db),
    getPublicDeeds(db),
    getPublicTags(db),
    getPublicEvents(db),
    getPublicDiscussions(db),
    getPublicMarketListings(db),
    getPublicMarketCategories(db),
    getPublicMarketTypes(db),
  ]);

  const totalEventPages = Math.max(
    1,
    Math.ceil(publicEvents.length / EVENT_PAGE_SIZE)
  );

  const totalDiscussionPages = Math.max(
    1,
    Math.ceil(publicDiscussions.length / DISCUSSION_PAGE_SIZE)
  );

  const totalMarketPages = Math.max(
    1,
    Math.ceil(publicMarketListings.length / MARKET_PAGE_SIZE)
  );

  const latestEventModified =
    publicEvents.length > 0
      ? publicEvents.reduce<Date>((latest, item) => {
        const current = safeDate(item.updatedAt);
        return current > latest ? current : latest;
      }, new Date(0))
      : new Date();

  const latestDiscussionModified =
    publicDiscussions.length > 0
      ? publicDiscussions.reduce<Date>((latest, item) => {
        const current = safeDate(item.updatedAt);
        return current > latest ? current : latest;
      }, new Date(0))
      : new Date();

  const latestMarketModified =
    publicMarketListings.length > 0
      ? publicMarketListings.reduce<Date>((latest, item) => {
        const current = safeDate(item.updatedAt);
        return current > latest ? current : latest;
      }, new Date(0))
      : new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/deeds`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/market`,
      lastModified: latestMarketModified,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/careers`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/leadership`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/policy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/nexus/events`,
      lastModified: latestEventModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/nexus/discussions`,
      lastModified: latestDiscussionModified,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const handlePages: MetadataRoute.Sitemap = publicHandles.map((item) => ({
    url: `${baseUrl}/${encodeURIComponent(item.handle)}`,
    lastModified: safeDate(item.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const deedPages: MetadataRoute.Sitemap = publicDeeds.map((item) => ({
    url: `${baseUrl}/${encodeURIComponent(item.handle)}/deed/${encodeURIComponent(item.id)}`,
    lastModified: safeDate(item.updatedAt),
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  const marketPages: MetadataRoute.Sitemap = publicMarketListings.map((item) => ({
    url: `${baseUrl}/market/${encodeURIComponent(item.id)}`,
    lastModified: safeDate(item.updatedAt),
    changeFrequency: "weekly",
    priority: 0.85,
  }));

  const paginatedMarketPages: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(0, totalMarketPages - 1) },
    (_, i) => {
      const page = i + 2;
      return {
        url: `${baseUrl}/market/page/${page}`,
        lastModified: latestMarketModified,
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    }
  );

  const marketCategoryPages: MetadataRoute.Sitemap = publicMarketCategories.flatMap((item) => {
    const firstPage = {
      url: `${baseUrl}/market/category/${encodeURIComponent(item.slug)}`,
      lastModified: safeDate(item.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.85,
    };

    const paginated = Array.from(
      { length: Math.max(0, item.totalPages - 1) },
      (_, i) => ({
        url: `${baseUrl}/market/category/${encodeURIComponent(item.slug)}/page/${i + 2}`,
        lastModified: safeDate(item.updatedAt),
        changeFrequency: "daily" as const,
        priority: 0.75,
      })
    );

    return [firstPage, ...paginated];
  });
  const marketTypePages: MetadataRoute.Sitemap = publicMarketTypes.flatMap((item) => {
    const firstPage = {
      url: `${baseUrl}/market/type/${encodeURIComponent(item.type)}`,
      lastModified: safeDate(item.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.85,
    };

    const paginated = Array.from(
      { length: Math.max(0, item.totalPages - 1) },
      (_, i) => ({
        url: `${baseUrl}/market/type/${encodeURIComponent(item.type)}/page/${i + 2}`,
        lastModified: safeDate(item.updatedAt),
        changeFrequency: "daily" as const,
        priority: 0.75,
      })
    );

    return [firstPage, ...paginated];
  });
  const eventPages: MetadataRoute.Sitemap = publicEvents.map((item) => ({
    url: `${baseUrl}/nexus/event/${encodeURIComponent(item.id)}`,
    lastModified: safeDate(item.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const paginatedEventPages: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(0, totalEventPages - 1) },
    (_, i) => {
      const page = i + 2;
      return {
        url: `${baseUrl}/nexus/events/page/${page}`,
        lastModified: latestEventModified,
        changeFrequency: "daily" as const,
        priority: 0.75,
      };
    }
  );

  const discussionPages: MetadataRoute.Sitemap = publicDiscussions.map((item) => ({
    url: `${baseUrl}/nexus/discussions/${encodeURIComponent(item.id)}`,
    lastModified: safeDate(item.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const paginatedDiscussionPages: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(0, totalDiscussionPages - 1) },
    (_, i) => {
      const page = i + 2;
      return {
        url: `${baseUrl}/nexus/discussions/page/${page}`,
        lastModified: latestDiscussionModified,
        changeFrequency: "daily" as const,
        priority: 0.75,
      };
    }
  );

  const tagPages: MetadataRoute.Sitemap = publicTags.flatMap((item) => {
    const firstPage = {
      url: `${baseUrl}/tag/${encodeURIComponent(item.tag)}`,
      lastModified: safeDate(item.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.85,
    };

    const paginated = Array.from(
      { length: Math.max(0, item.totalPages - 1) },
      (_, i) => ({
        url: `${baseUrl}/tag/${encodeURIComponent(item.tag)}/page/${i + 2}`,
        lastModified: safeDate(item.updatedAt),
        changeFrequency: "daily" as const,
        priority: 0.75,
      })
    );

    return [firstPage, ...paginated];
  });

  return [
    ...staticPages,
    ...handlePages,
    ...deedPages,
    ...marketPages,
    ...paginatedMarketPages,
    ...marketCategoryPages,
    ...eventPages,
    ...paginatedEventPages,
    ...discussionPages,
    ...paginatedDiscussionPages,
    ...tagPages,
    ...marketTypePages,
  ];
}