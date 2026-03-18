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
    category?: string;
    categorySlug?: string;
    type?: string;
    price?: number;
    currency?: CurrencyCode;
    rate?: string;
    billingUnit?: string;
    unit?: string;
    typicalPackSize?: string | number | null;
    placeText?: string;
    imageUrl?: string;
    imageUrls?: string[];
    description?: string | null;
    status?: string;
    publishedAt?: string | null;
    updatedAt?: string | null;
};

const TYPE_LABELS: Record<string, string> = {
    product: "Products",
    animal: "Animals & Livestock",
    tree: "Trees & Seedlings",
    lease: "Lease Listings",
    service: "Services",
    arableLand: "Arable Land",
};

const VALID_TYPES = new Set(Object.keys(TYPE_LABELS));

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
    if (!text) return "Browse listings on ekariMarket.";
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function formatMoney(n?: number, currency?: CurrencyCode) {
    if (typeof n !== "number") return "";
    const cur: CurrencyCode = currency === "USD" ? "USD" : "KES";

    if (cur === "USD") {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
        }).format(n);
    }

    return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: "KES",
        maximumFractionDigits: 0,
    }).format(n);
}

function slugToLabel(type: string) {
    return TYPE_LABELS[type] || type;
}

function isAllowedType(type: string) {
    return VALID_TYPES.has(type);
}

async function getMarketTypePage(type: string, page: number) {
    const db = getAdminDb();
    const offset = (page - 1) * PAGE_SIZE;

    const totalSnap = await db
        .collection("marketListings")
        .where("status", "==", "active")
        .where("type", "==", type)
        .count()
        .get();

    const total = totalSnap.data().count || 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (page > totalPages && total > 0) {
        return { items: [], total, totalPages };
    }

    let q = db
        .collection("marketListings")
        .where("status", "==", "active")
        .where("type", "==", type)
        .orderBy("featured", "desc")
        .orderBy("rankBoost", "desc")
        .orderBy("publishedAt", "desc")
        .limit(PAGE_SIZE);

    if (offset > 0) {
        const beforeSnap = await db
            .collection("marketListings")
            .where("status", "==", "active")
            .where("type", "==", type)
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
                .where("type", "==", type)
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
            if (!name) return null;

            return {
                id: doc.id,
                name,
                category: d?.category || "",
                categorySlug: d?.categorySlug || "",
                type: d?.type || "",
                price: typeof d?.price === "number" ? d.price : undefined,
                currency: d?.currency === "USD" ? "USD" : "KES",
                rate: d?.rate ? String(d.rate) : "",
                billingUnit: d?.billingUnit || "",
                unit: d?.unit || "",
                typicalPackSize: d?.typicalPackSize ?? null,
                placeText: d?.place?.text || "",
                imageUrl: d?.imageUrl || "",
                imageUrls: Array.isArray(d?.imageUrls) ? d.imageUrls.filter(Boolean) : [],
                description: d?.description || "",
                status: d?.status || "",
                publishedAt:
                    d?.publishedAt?.toDate?.()?.toISOString?.() ||
                    d?.createdAt?.toDate?.()?.toISOString?.() ||
                    null,
                updatedAt:
                    d?.updatedAt?.toDate?.()?.toISOString?.() ||
                    d?.publishedAt?.toDate?.()?.toISOString?.() ||
                    d?.createdAt?.toDate?.()?.toISOString?.() ||
                    null,
            };
        })
        .filter(Boolean) as MarketArchiveItem[];

    return { items, total, totalPages };
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

export async function generateMarketTypeArchiveMetadata(
    type: string,
    page: number
): Promise<Metadata> {
    if (!isAllowedType(type)) {
        return {
            title: "Market Type Not Found | ekarihub",
            robots: { index: false, follow: false },
        };
    }

    const label = slugToLabel(type);
    const pagePath =
        page <= 1
            ? `/market/type/${encodeURIComponent(type)}`
            : `/market/type/${encodeURIComponent(type)}/page/${page}`;

    const canonical = `${baseUrl}${pagePath}`;

    const title =
        page <= 1
            ? `${label} | ekariMarket`
            : `${label} - Page ${page} | ekariMarket`;

    const description =
        page <= 1
            ? `Browse ${label.toLowerCase()} on ekariMarket.`
            : `Browse ${label.toLowerCase()} on ekariMarket - page ${page}.`;

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
    };
}

export default async function MarketTypeArchivePage({
    type,
    page,
}: {
    type: string;
    page: number;
}) {
    if (!Number.isInteger(page) || page < 1) notFound();
    if (!isAllowedType(type)) notFound();

    const label = slugToLabel(type);
    const { items, totalPages, total } = await getMarketTypePage(type, page);

    if (page > 1 && items.length === 0) notFound();

    const pagination = buildPagination(page, totalPages);

    return (
        <main className="min-h-screen bg-white">
            <div className="mx-auto max-w-6xl px-4 py-8">
                <header className="mb-8">
                    <div className="text-sm text-gray-500 mb-2">ekariMarket</div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">
                        {page === 1 ? label : `${label} - Page ${page}`}
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Browse {label.toLowerCase()} listed on ekariMarket.
                    </p>
                </header>

                {items.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 p-8 text-gray-600">
                        No listings found.
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => {
                                const href = `/market/${encodeURIComponent(item.id)}`;
                                const desc = safeDescription(
                                    item.description,
                                    `${item.name}${item.placeText ? ` • ${item.placeText}` : ""}`
                                );

                                const priceText =
                                    item.type === "lease" || item.type === "service"
                                        ? `${item.rate || "-"}${item.billingUnit ? ` / ${item.billingUnit}` : ""}`
                                        : formatMoney(item.price, item.currency);

                                const thumb =
                                    item.imageUrls?.[0] || item.imageUrl || "";

                                return (
                                    <article
                                        key={item.id}
                                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <Link href={href} className="block">
                                            <div className="relative aspect-[16/10] w-full bg-gray-100">
                                                {thumb ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={thumb}
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
                                                <span className="rounded-full bg-[#233F39] px-3 py-1 text-[11px] font-bold text-white">
                                                    {label}
                                                </span>

                                                {item.category && item.categorySlug && (
                                                    <Link
                                                        href={`/market/category/${encodeURIComponent(item.categorySlug)}`}
                                                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-700"
                                                    >
                                                        {item.category}
                                                    </Link>
                                                )}
                                            </div>

                                            <h2 className="line-clamp-2 text-lg font-black text-gray-900">
                                                <Link href={href}>{item.name}</Link>
                                            </h2>

                                            <div className="mt-3 space-y-1 text-sm text-gray-600">
                                                {item.placeText && <div>{item.placeText}</div>}

                                                {item.unit && (
                                                    <div>
                                                        {item.typicalPackSize ? `${item.typicalPackSize} ` : ""}
                                                        {item.unit}
                                                    </div>
                                                )}

                                                <div className="font-bold text-gray-900">
                                                    {priceText}
                                                </div>
                                            </div>

                                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                                                {desc}
                                            </p>

                                            <div className="mt-4">
                                                <Link
                                                    href={href}
                                                    className="inline-flex rounded-xl bg-[#C79257] px-4 py-2 text-sm font-black text-white hover:opacity-90"
                                                >
                                                    View listing
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <nav
                            aria-label={`${label} pagination`}
                            className="mt-10 flex flex-wrap items-center justify-center gap-2"
                        >
                            {page > 1 && (
                                <Link
                                    href={
                                        page === 2
                                            ? `/market/type/${encodeURIComponent(type)}`
                                            : `/market/type/${encodeURIComponent(type)}/page/${page - 1}`
                                    }
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Previous
                                </Link>
                            )}

                            {pagination.map((p) => {
                                const href =
                                    p === 1
                                        ? `/market/type/${encodeURIComponent(type)}`
                                        : `/market/type/${encodeURIComponent(type)}/page/${p}`;

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
                                    href={`/market/type/${encodeURIComponent(type)}/page/${page + 1}`}
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Next
                                </Link>
                            )}
                        </nav>

                        <div className="mt-6 text-center text-sm text-gray-500">
                            {total} listing{total === 1 ? "" : "s"} total
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}