// app/nexus/events/EventsArchivePage.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const baseUrl = "https://ekarihub.com";
const PAGE_SIZE = 24;

type CurrencyCode = "KES" | "USD";

type EventArchiveItem = {
    id: string;
    title: string;
    location?: string;
    dateISO?: string;
    price?: number;
    currency?: CurrencyCode;
    category?: string;
    tags?: string[];
    coverUrl?: string;
    description?: string;
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

function safeDescription(input?: string, fallback?: string) {
    const text = String(input || fallback || "").replace(/\s+/g, " ").trim();
    if (!text) return "Discover events on ekarihub.";
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

async function getEventsPage(page: number) {
    const db = getAdminDb();
    const offset = (page - 1) * PAGE_SIZE;

    const totalSnap = await db.collection("events").count().get();
    const total = totalSnap.data().count || 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (page > totalPages && total > 0) {
        return { items: [], total, totalPages };
    }

    let q = db.collection("events").orderBy("dateISO", "desc").limit(PAGE_SIZE);

    if (offset > 0) {
        const beforeSnap = await db
            .collection("events")
            .orderBy("dateISO", "desc")
            .limit(offset)
            .get();

        const lastVisible = beforeSnap.docs[beforeSnap.docs.length - 1];
        if (lastVisible) {
            q = db
                .collection("events")
                .orderBy("dateISO", "desc")
                .startAfter(lastVisible)
                .limit(PAGE_SIZE);
        }
    }

    const snap = await q.get();

    const items: EventArchiveItem[] = snap.docs
        .map((doc) => {
            const d = doc.data() as any;
            const title = String(d?.title || "").trim();
            if (!title) return null;

            return {
                id: doc.id,
                title,
                location: d?.location || "",
                dateISO: d?.dateISO || "",
                price: typeof d?.price === "number" ? d.price : undefined,
                currency: d?.currency === "USD" ? "USD" : "KES",
                category: d?.category || "",
                tags: Array.isArray(d?.tags) ? d.tags.filter(Boolean) : [],
                coverUrl: d?.coverUrl || "",
                description: d?.description || "",
                updatedAt:
                    d?.updatedAt?.toDate?.()?.toISOString?.() ||
                    d?.createdAt?.toDate?.()?.toISOString?.() ||
                    null,
            };
        })
        .filter(Boolean) as EventArchiveItem[];

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

export async function generateEventsArchiveMetadata(page: number): Promise<Metadata> {
    const pagePath = page <= 1 ? "/nexus/events" : `/nexus/events/page/${page}`;
    const canonical = `${baseUrl}${pagePath}`;

    const title =
        page <= 1
            ? "Events | ekarihub"
            : `Events - Page ${page} | ekarihub`;

    const description =
        page <= 1
            ? "Browse upcoming events on ekarihub."
            : `Browse upcoming events on ekarihub - page ${page}.`;

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

export default async function EventsArchivePage({
    page,
}: {
    page: number;
}) {
    if (!Number.isInteger(page) || page < 1) notFound();

    const { items, totalPages, total } = await getEventsPage(page);

    if (page > 1 && items.length === 0) notFound();

    const pagination = buildPagination(page, totalPages);

    return (
        <main className="min-h-screen bg-white">
            <div className="mx-auto max-w-6xl px-4 py-8">
                <header className="mb-8">
                    <div className="text-sm text-gray-500 mb-2">ekarihub Nexus</div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">
                        {page === 1 ? "Events" : `Events - Page ${page}`}
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Discover upcoming events, meetups, launches, and community experiences on ekarihub.
                    </p>
                </header>

                {items.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 p-8 text-gray-600">
                        No events found.
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((event) => {
                                const href = `/nexus/events/${encodeURIComponent(event.id)}`;
                                const desc = safeDescription(
                                    event.description,
                                    `${event.title}${event.location ? ` • ${event.location}` : ""}`
                                );

                                return (
                                    <article
                                        key={event.id}
                                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <Link href={href} className="block">
                                            <div className="relative aspect-[16/10] w-full bg-gray-100">
                                                {event.coverUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={event.coverUrl}
                                                        alt={event.title}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="grid h-full w-full place-items-center text-sm text-gray-400">
                                                        No cover image
                                                    </div>
                                                )}
                                            </div>
                                        </Link>

                                        <div className="p-4">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                {event.category && (
                                                    <span className="rounded-full bg-[#233F39] px-3 py-1 text-[11px] font-bold text-white">
                                                        {event.category}
                                                    </span>
                                                )}
                                                {event.tags?.slice(0, 2).map((tag) => (
                                                    <Link
                                                        key={tag}
                                                        href={`/tag/${encodeURIComponent(tag)}`}
                                                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-semibold text-gray-700"
                                                    >
                                                        #{tag}
                                                    </Link>
                                                ))}
                                            </div>

                                            <h2 className="line-clamp-2 text-lg font-black text-gray-900">
                                                <Link href={href}>{event.title}</Link>
                                            </h2>

                                            <div className="mt-3 space-y-1 text-sm text-gray-600">
                                                {event.dateISO && (
                                                    <div>{new Date(event.dateISO).toLocaleString()}</div>
                                                )}
                                                {event.location && <div>{event.location}</div>}
                                                {typeof event.price === "number" && (
                                                    <div className="font-bold text-gray-900">
                                                        {formatMoney(event.price, event.currency)}
                                                    </div>
                                                )}
                                            </div>

                                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                                                {desc}
                                            </p>

                                            <div className="mt-4">
                                                <Link
                                                    href={href}
                                                    className="inline-flex rounded-xl bg-[#C79257] px-4 py-2 text-sm font-black text-white hover:opacity-90"
                                                >
                                                    View event
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <nav
                            aria-label="Events pagination"
                            className="mt-10 flex flex-wrap items-center justify-center gap-2"
                        >
                            {page > 1 && (
                                <Link
                                    href={page === 2 ? "/nexus/events" : `/nexus/events/page/${page - 1}`}
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Previous
                                </Link>
                            )}

                            {pagination.map((p) => {
                                const href = p === 1 ? "/nexus/events" : `/nexus/events/page/${p}`;
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
                                    href={`/nexus/events/page/${page + 1}`}
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Next
                                </Link>
                            )}
                        </nav>

                        <div className="mt-6 text-center text-sm text-gray-500">
                            {total} event{total === 1 ? "" : "s"} total
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}