// app/tag/_components/TagArchivePage.tsx
import Link from "next/link";
import type { TagPageResult } from "../_lib/tag-feed";

export default function TagArchivePage({
    tag,
    data,
}: {
    tag: string;
    data: TagPageResult;
}) {
    const { items, total, page, totalPages, hasPrev, hasNext } = data;

    const canonicalBase = `/tag/${encodeURIComponent(tag)}`;
    const prevHref =
        page - 1 <= 1
            ? canonicalBase
            : `${canonicalBase}/page/${page - 1}`;
    const nextHref = `${canonicalBase}/page/${page + 1}`;

    return (
        <main className="min-h-screen bg-white text-gray-900">
            <section className="mx-auto max-w-6xl px-4 py-8">
                <div className="mb-8">
                    <nav className="mb-3 text-sm text-gray-500">
                        <Link href="/" className="hover:text-gray-900">
                            Home
                        </Link>
                        <span className="mx-2">/</span>
                        <span>Tag</span>
                        <span className="mx-2">/</span>
                        <span className="text-gray-900 font-medium">#{tag}</span>
                    </nav>

                    <h1 className="text-3xl font-bold tracking-tight">#{tag}</h1>

                    <p className="mt-2 text-gray-600">
                        {total} public deed{total === 1 ? "" : "s"}
                        {totalPages > 1 ? ` • Page ${page} of ${totalPages}` : ""}
                    </p>
                </div>

                {items.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center">
                        <h2 className="text-lg font-semibold">No public deeds found</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            There are no public deeds currently indexed for #{tag}.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {items.map((item) => {
                                const href = `/${encodeURIComponent(item.handle)}/deed/${encodeURIComponent(item.id)}`;
                                const preview = item.posterUrl || item.mediaUrl || null;

                                return (
                                    <article
                                        key={item.id}
                                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                                    >
                                        <Link href={href} className="block">
                                            <div className="relative aspect-[9/16] bg-gray-100">
                                                {preview ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={preview}
                                                        alt={item.text || `Deed tagged ${tag}`}
                                                        className="h-full w-full object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                                                        No preview
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-4">
                                                <div className="mb-2 text-sm font-semibold text-[#C79257]">
                                                    @{item.handle.replace(/^@/, "")}
                                                </div>
                                                <h2 className="line-clamp-2 text-base font-semibold text-gray-900">
                                                    {item.text || `View deed by @${item.handle.replace(/^@/, "")}`}
                                                </h2>
                                                <p className="mt-3 text-sm text-gray-500">View deed</p>
                                            </div>
                                        </Link>
                                    </article>
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <nav className="mt-10 flex items-center justify-center gap-3">
                                {hasPrev ? (
                                    <Link
                                        href={prevHref}
                                        className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                                    >
                                        Previous
                                    </Link>
                                ) : (
                                    <span className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-400">
                                        Previous
                                    </span>
                                )}

                                <span className="text-sm text-gray-600">
                                    Page {page} of {totalPages}
                                </span>

                                {hasNext ? (
                                    <Link
                                        href={nextHref}
                                        className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                                    >
                                        Next
                                    </Link>
                                ) : (
                                    <span className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-400">
                                        Next
                                    </span>
                                )}
                            </nav>
                        )}
                    </>
                )}
            </section>
        </main>
    );
}