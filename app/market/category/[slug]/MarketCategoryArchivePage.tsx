// app/market/category/[slug]/MarketCategoryArchivePage.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const baseUrl = "https://ekarihub.com";
const PAGE_SIZE = 24;

type CurrencyCode = "KES" | "USD";

type MarketArchiveItem = {
    id: string;
    name: string;
    nameSlug?: string;
    price?: number;
    currency?: CurrencyCode;
    category?: string;
    categorySlug?: string;
    type?: string;
    unit?: string;
    imageUrl?: string;
    imageUrls?: string[];
    description?: string | null;
    status?: string;
    sold?: boolean;
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

function safeDescription(input?: string | null, fallback?: string) {
    const text = String(input || fallback || "").replace(/\s+/g, " ").trim();
    if (!text) return "Browse listings in this ekariMarket category.";
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function titleCaseFromSlug(slug: string) {
    return slug
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatMoney(value?: number, currency?: CurrencyCode) {
    if (typeof value !== "number") return "Price on request";

    if (currency === "USD") {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
        }).format(value);
    }

    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 0,
    }).format(value);
}

async function getCategoryPage(categorySlug: string, page: number) {
    const db = getAdminDb();
    const offset = (page - 1) * PAGE_SIZE;

    const totalSnap = await db
        .collection("marketListings")
        .where("status", "==", "active")
        .where("categorySlug", "==", categorySlug)
        .count()
        .get();

    const total = totalSnap.data().count || 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (page > totalPages && total > 0) {
        return {
            items: [],
            total,
            totalPages,
            categoryName: titleCaseFromSlug(categorySlug),
            latestModified: null as string | Date | null,
        };
    }

    let q = db
        .collection("marketListings")
        .where("status", "==", "active")
        .where("categorySlug", "==", categorySlug)
        .orderBy("featured", "desc")
        .orderBy("rankBoost", "desc")
        .orderBy("publishedAt", "desc")
        .limit(PAGE_SIZE);

    if (offset > 0) {
        const beforeSnap = await db
            .collection("marketListings")
            .where("status", "==", "active")
            .where("categorySlug", "==", categorySlug)
            .orderBy("featured", "desc")
            .orderBy("rankBoost", "desc")
            .orderBy("publishedAt", "desc")
            .limit(offset)
            .get();

        const lastVisible = beforeSnap.docs[beforeSnap.docs.length - 1];
        if (lastVisible) {
            q = db
                .collection("marketListings")
                .where("status", "==", "active")
                .where("categorySlug", "==", categorySlug)
                .orderBy("featured", "desc")
                .orderBy("rankBoost", "desc")
                .orderBy("publishedAt", "desc")
                .startAfter(lastVisible)
                .limit(PAGE_SIZE);
        }
    }

    const snap = await q.get();

    const items: MarketArchiveItem[] = snap.docs
        .map((doc) => {
            const d = doc.data() as any;
            const name = String(d?.name || "").trim();
            const status = String(d?.status || "").trim().toLowerCase();

            if (!name || status === "hidden") return null;

            return {
                id: doc.id,
                name,
                nameSlug: d?.nameSlug || "",
                price: typeof d?.price === "number" ? d.price : undefined,
                currency: d?.currency === "USD" ? "USD" : "KES",
                category: d?.category || "",
                categorySlug: d?.categorySlug || "",
                type: d?.type || "",
                unit: d?.unit || "",
                imageUrl: d?.imageUrl || "",
                imageUrls: Array.isArray(d?.imageUrls) ? d.imageUrls.filter(Boolean) : [],
                description: d?.description || "",
                status,
                sold: !!d?.sold,
                updatedAt:
                    d?.updatedAt?.toDate?.()?.toISOString?.() ||
                    d?.publishedAt?.toDate?.()?.toISOString?.() ||
                    d?.createdAt?.toDate?.()?.toISOString?.() ||
                    null,
            };
        })
        .filter(Boolean) as MarketArchiveItem[];

    const categoryName =
        items.find((x) => x.category)?.category || titleCaseFromSlug(categorySlug);

    const latestModified =
        items.length > 0
            ? items.reduce<string | null>((latest, item) => {
                const current = item.updatedAt || null;
                if (!latest) return current;
                if (!current) return latest;
                return new Date(current) > new Date(latest) ? current : latest;
            }, null)
            : null;

    return { items, total, totalPages, categoryName, latestModified };
}

function buildPagination(currentPage: number, totalPages: number) {
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);

    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
        if (i >= 1 && i <= totalPages) pages.add(i);
    }

    return Array.from(pages).sort((a, b) => a - b);
}

export async function generateMarketCategoryMetadata(
    categorySlug: string,
    page: number
): Promise<Metadata> {
    const categoryName = titleCaseFromSlug(categorySlug);

    const pagePath =
        page <= 1
            ? `/market/category/${encodeURIComponent(categorySlug)}`
            : `/market/category/${encodeURIComponent(categorySlug)}/page/${page}`;

    const canonical = `${baseUrl}${pagePath}`;

    const title =
        page <= 1
            ? `${categoryName} | ekariMarket`
            : `${categoryName} - Page ${page} | ekariMarket`;

    const description =
        page <= 1
            ? `Browse ${categoryName} listings on ekariMarket.`
            : `Browse ${categoryName} listings on ekariMarket - page ${page}.`;

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
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}

function buildCategoryJsonLd(categorySlug: string, categoryName: string, page: number) {
    const url =
        page <= 1
            ? `${baseUrl}/market/category/${encodeURIComponent(categorySlug)}`
            : `${baseUrl}/market/category/${encodeURIComponent(categorySlug)}/page/${page}`;

    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: page <= 1 ? `${categoryName} | ekariMarket` : `${categoryName} - Page ${page} | ekariMarket`,
        description: `Browse ${categoryName} listings on ekariMarket.`,
        url,
        isPartOf: {
            "@type": "WebSite",
            name: "ekarihub",
            url: baseUrl,
        },
    };
}

export default async function MarketCategoryArchivePage({
    categorySlug,
    page,
}: {
    categorySlug: string;
    page: number;
}) {
    if (!categorySlug || !Number.isInteger(page) || page < 1) notFound();

    const { items, total, totalPages, categoryName } = await getCategoryPage(categorySlug, page);

    if (page > 1 && items.length === 0) notFound();
    if (page === 1 && total === 0) notFound();

    const pagination = buildPagination(page, totalPages);
    const jsonLd = buildCategoryJsonLd(categorySlug, categoryName, page);

    return (
        <main className="min-h-screen bg-white">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <div className="mx-auto max-w-6xl px-4 py-8">
                <header className="mb-8">
                    <div className="text-sm text-gray-500 mb-2">ekarihub Marketplace</div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">
                        {page === 1 ? categoryName : `${categoryName} - Page ${page}`}
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Browse {categoryName} listings on ekariMarket.
                    </p>
                </header>

                {items.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 p-8 text-gray-600">
                        No listings found in this category.
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => {
                                const href = `/market/${encodeURIComponent(item.id)}`;
                                const image = item.imageUrls?.[0] || item.imageUrl || "";
                                const desc = safeDescription(
                                    item.description,
                                    `${item.name}${item.category ? ` • ${item.category}` : ""}`
                                );

                                return (
                                    <article
                                        key={item.id}
                                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <Link href={href} className="block">
                                            <div className="relative aspect-[16/10] w-full bg-gray-100">
                                                {image ? (
                                                    <img
                                                        src={image}
                                                        alt={item.name}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="grid h-full w-full place-items-center text-sm text-gray-400">
                                                        No image
                                                    </div>
                                                )}
                                            </div>
                                        </Link>

                                        <div className="p-4">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                {item.category && (
                                                    <span className="rounded-full bg-[#233F39] px-3 py-1 text-[11px] font-bold text-white">
                                                        {item.category}
                                                    </span>
                                                )}
                                                {item.type && (
                                                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-700">
                                                        {item.type}
                                                    </span>
                                                )}
                                            </div>

                                            <h2 className="line-clamp-2 text-lg font-black text-gray-900">
                                                <Link href={href}>{item.name}</Link>
                                            </h2>

                                            <div className="mt-3 text-sm font-bold text-gray-900">
                                                {formatMoney(item.price, item.currency)}
                                            </div>

                                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                                                {desc}
                                            </p>

                                            <div className="mt-4">
                                                <Link
                                                    href={href}
                                                    className="inline-flex rounded-xl bg-[#C79257] px-4 py-2 text-sm font-black text-white hover:opacity-90"
                                                >
                                                    View product
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <nav
                            aria-label="Category pagination"
                            className="mt-10 flex flex-wrap items-center justify-center gap-2"
                        >
                            {page > 1 && (
                                <Link
                                    href={
                                        page === 2
                                            ? `/market/category/${encodeURIComponent(categorySlug)}`
                                            : `/market/category/${encodeURIComponent(categorySlug)}/page/${page - 1}`
                                    }
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Previous
                                </Link>
                            )}

                            {pagination.map((p) => {
                                const href =
                                    p === 1
                                        ? `/market/category/${encodeURIComponent(categorySlug)}`
                                        : `/market/category/${encodeURIComponent(categorySlug)}/page/${p}`;

                                const active = p === page;

                                return (
                                    <Link
                                        key={p}
                                        href={href}
                                        aria-current={active ? "page" : undefined}
                                        className={
                                            active
                                                ? "rounded-xl bg-[#233F39] px-4 py-2 text-sm font-black text-white"
                                                : "rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                        }
                                    >
                                        {p}
                                    </Link>
                                );
                            })}

                            {page < totalPages && (
                                <Link
                                    href={`/market/category/${encodeURIComponent(categorySlug)}/page/${page + 1}`}
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Next
                                </Link>
                            )}
                        </nav>

                        <div className="mt-6 text-center text-sm text-gray-500">
                            {total} listing{total === 1 ? "" : "s"} in {categoryName}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}