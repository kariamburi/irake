import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const baseUrl = "https://ekarihub.com";
const PAGE_SIZE = 24;

type DiscussionArchiveItem = {
    id: string;
    title: string;
    body?: string;
    category?: string;
    tags?: string[];
    updatedAt?: string | null;
    createdAt?: string | null;
    repliesCount?: number;
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
    const text = String(input || fallback || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!text) return "Browse discussions on ekarihub Nexus.";
    return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function formatDate(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
}

async function getDiscussionsPage(page: number) {
    const db = getAdminDb();
    const offset = (page - 1) * PAGE_SIZE;

    const totalSnap = await db.collection("discussions").count().get();
    const total = totalSnap.data().count || 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (page > totalPages && total > 0) {
        return { items: [], total, totalPages };
    }

    let q = db
        .collection("discussions")
        .orderBy("updatedAt", "desc")
        .limit(PAGE_SIZE);

    if (offset > 0) {
        const beforeSnap = await db
            .collection("discussions")
            .orderBy("updatedAt", "desc")
            .limit(offset)
            .get();

        const lastVisible = beforeSnap.docs[beforeSnap.docs.length - 1];
        if (lastVisible) {
            q = db
                .collection("discussions")
                .orderBy("updatedAt", "desc")
                .startAfter(lastVisible)
                .limit(PAGE_SIZE);
        }
    }

    const snap = await q.get();

    const items: DiscussionArchiveItem[] = snap.docs
        .map((doc) => {
            const d = doc.data() as any;
            const title = String(d?.title || "").trim();
            if (!title) return null;

            const body = String(d?.body || "").trim();

            return {
                id: doc.id,
                title,
                body,
                category: String(d?.category || "").trim(),
                tags: Array.isArray(d?.tags)
                    ? d.tags.map((tag: unknown) => String(tag || "").trim()).filter(Boolean)
                    : [],
                repliesCount:
                    typeof d?.repliesCount === "number"
                        ? d.repliesCount
                        : typeof d?.counts?.replies === "number"
                            ? d.counts.replies
                            : typeof d?.replyCount === "number"
                                ? d.replyCount
                                : 0,
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
        })
        .filter(Boolean) as DiscussionArchiveItem[];

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

export async function generateDiscussionsArchiveMetadata(
    page: number
): Promise<Metadata> {
    const pagePath =
        page <= 1 ? "/nexus/discussions" : `/nexus/discussions/page/${page}`;

    const canonical = `${baseUrl}${pagePath}`;

    const title =
        page <= 1
            ? "Discussions | ekarihub Nexus"
            : `Discussions - Page ${page} | ekarihub Nexus`;

    const description =
        page <= 1
            ? "Browse public discussions, questions, and community conversations on ekarihub Nexus."
            : `Browse public discussions on ekarihub Nexus - page ${page}.`;

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

export default async function DiscussionsArchivePage({
    page,
}: {
    page: number;
}) {
    if (!Number.isInteger(page) || page < 1) notFound();

    const { items, totalPages, total } = await getDiscussionsPage(page);

    if (page > 1 && items.length === 0) notFound();

    const pagination = buildPagination(page, totalPages);

    return (
        <main className="min-h-screen bg-white">
            <div className="mx-auto max-w-6xl px-4 py-8">
                <header className="mb-8">
                    <div className="text-sm text-gray-500 mb-2">ekarihub Nexus</div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">
                        {page === 1 ? "Discussions" : `Discussions - Page ${page}`}
                    </h1>
                    <p className="mt-2 text-gray-600">
                        Browse public discussions, questions, insights, and community conversations on ekarihub.
                    </p>
                </header>

                {items.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 p-8 text-gray-600">
                        No discussions found.
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {items.map((discussion) => {
                                const href = `/nexus/discussion/${encodeURIComponent(discussion.id)}`;
                                const desc = safeDescription(
                                    discussion.body,
                                    `Join the discussion: ${discussion.title}`
                                );

                                return (
                                    <article
                                        key={discussion.id}
                                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                    >
                                        <div className="mb-3 flex flex-wrap items-center gap-2">
                                            {discussion.category && (
                                                <span className="rounded-full bg-[#233F39] px-3 py-1 text-[11px] font-bold text-white">
                                                    {discussion.category}
                                                </span>
                                            )}

                                            {discussion.tags?.slice(0, 2).map((tag) => (
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
                                            <Link href={href}>{discussion.title}</Link>
                                        </h2>

                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                            {discussion.updatedAt && (
                                                <span>{formatDate(discussion.updatedAt)}</span>
                                            )}

                                            <span className="font-semibold text-gray-700">
                                                {discussion.repliesCount || 0} repl
                                                {(discussion.repliesCount || 0) === 1 ? "y" : "ies"}
                                            </span>
                                        </div>

                                        <p className="mt-3 line-clamp-4 text-sm leading-6 text-gray-600">
                                            {desc}
                                        </p>

                                        <div className="mt-4">
                                            <Link
                                                href={href}
                                                className="inline-flex rounded-xl bg-[#C79257] px-4 py-2 text-sm font-black text-white hover:opacity-90"
                                            >
                                                View discussion
                                            </Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <nav
                            aria-label="Discussions pagination"
                            className="mt-10 flex flex-wrap items-center justify-center gap-2"
                        >
                            {page > 1 && (
                                <Link
                                    href={
                                        page === 2
                                            ? "/nexus/discussions"
                                            : `/nexus/discussions/page/${page - 1}`
                                    }
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Previous
                                </Link>
                            )}

                            {pagination.map((p) => {
                                const href =
                                    p === 1
                                        ? "/nexus/discussions"
                                        : `/nexus/discussions/page/${p}`;
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
                                    href={`/nexus/discussions/page/${page + 1}`}
                                    className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                                >
                                    Next
                                </Link>
                            )}
                        </nav>

                        <div className="mt-6 text-center text-sm text-gray-500">
                            {total} discussion{total === 1 ? "" : "s"} total
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}