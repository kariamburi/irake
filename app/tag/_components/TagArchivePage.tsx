// app/tag/_components/TagArchivePage.tsx

import Link from "next/link";
import {
    IoArrowBackOutline,
    IoArrowForwardOutline,
    IoChevronForwardOutline,
    IoDocumentTextOutline,
    IoHomeOutline,
    IoPricetagOutline,
    IoSparklesOutline,
} from "react-icons/io5";

import type { TagPageResult } from "../_lib/tag-feed";

const EKARI = {
    forest: "#173C2E",
    leaf: "#214C3A",
    gold: "#F39A22",
    page: "#F8F7F2",
    surface: "#FBFAF6",
    border: "#DDD8CC",
    text: "#0F172A",
    dim: "#64748B",
};

export default function TagArchivePage({
    tag,
    data,
}: {
    tag: string;
    data: TagPageResult;
}) {
    const {
        items,
        total,
        page,
        totalPages,
        hasPrev,
        hasNext,
    } = data;

    const cleanTag = tag.replace(/^#/, "");
    const canonicalBase = `/tag/${encodeURIComponent(cleanTag)}`;

    const prevHref =
        page - 1 <= 1
            ? canonicalBase
            : `${canonicalBase}/page/${page - 1}`;

    const nextHref =
        `${canonicalBase}/page/${page + 1}`;

    return (
        <main className="min-h-[100svh] w-full max-w-full overflow-x-clip bg-[#F8F7F2]">
            {/* =========================================================
                FULL-WIDTH TAG HERO
            ========================================================= */}
            <section className="relative overflow-hidden border-b border-[#DDD8CC] bg-[#173C2E] text-white">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.045]"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(45deg, transparent 0 17px, rgba(255,255,255,.75) 18px 19px)",
                    }}
                />

                <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/[0.035]" />
                <div className="pointer-events-none absolute -bottom-28 left-[34%] h-72 w-72 rounded-full bg-[#F39A22]/[0.08]" />

                <div className="relative mx-auto w-full max-w-[1280px] px-5 py-9 sm:px-7 md:py-12 lg:px-8">
                    {/* Breadcrumb */}
                    <nav
                        aria-label="Breadcrumb"
                        className="flex flex-wrap items-center gap-1.5 text-[8px] font-black text-white/40"
                    >
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 transition hover:text-white"
                        >
                            <IoHomeOutline size={11} />
                            Home
                        </Link>

                        <IoChevronForwardOutline
                            size={10}
                            className="text-white/20"
                        />

                        <span>Tag</span>

                        <IoChevronForwardOutline
                            size={10}
                            className="text-white/20"
                        />

                        <span className="text-white/75">
                            #{cleanTag}
                        </span>
                    </nav>

                    <div className="mt-5 max-w-[820px]">
                        <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                                <IoPricetagOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Tag archive
                            </span>

                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-white/70">
                                <IoSparklesOutline
                                    size={12}
                                    className="text-[#F39A22]"
                                />
                                Public deeds
                            </span>
                        </div>

                        <div className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-[#F39A22]">
                            Explore this topic
                        </div>

                        <h1 className="mt-1 break-words text-[32px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[40px] lg:text-[50px]">
                            #{cleanTag}
                        </h1>

                        <p className="mt-4 max-w-2xl text-[11px] font-medium leading-5 text-white/55 sm:text-[12px] md:leading-6">
                            Discover public deeds, ideas and community activity connected to this tag.
                        </p>

                        <div className="mt-5 flex flex-wrap gap-2">
                            <StatPill
                                label={`${total} public deed${total === 1 ? "" : "s"}`}
                            />

                            {totalPages > 1 ? (
                                <StatPill
                                    label={`Page ${page} of ${totalPages}`}
                                />
                            ) : null}
                        </div>
                    </div>
                </div>
            </section>

            {/* =========================================================
                CONTENT
            ========================================================= */}
            <section className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 md:py-8 lg:px-8">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="text-[8px] font-black uppercase tracking-[0.1em] text-[#F39A22]">
                            Community activity
                        </div>

                        <h2 className="mt-1 text-[20px] font-black tracking-[-0.03em] text-slate-900">
                            Deeds tagged #{cleanTag}
                        </h2>

                        <p className="mt-1 text-[9px] font-medium text-slate-400">
                            Browse public posts associated with this topic.
                        </p>
                    </div>

                    <Link
                        href="/search"
                        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-[11px] border border-[#DDD8CC] bg-[#FBFAF6] px-3 text-[8px] font-black text-[#173C2E] transition hover:bg-white"
                    >
                        Explore more
                        <IoArrowForwardOutline size={11} />
                    </Link>
                </div>

                {items.length === 0 ? (
                    <div className="rounded-[20px] border border-[#DDD8CC] bg-[#FBFAF6] px-5 py-10 text-center shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-[#E8ECE8] text-[#173C2E]">
                            <IoDocumentTextOutline size={20} />
                        </div>

                        <h2 className="mt-4 text-[13px] font-black text-slate-800">
                            No public deeds found
                        </h2>

                        <p className="mx-auto mt-2 max-w-md text-[9px] font-medium leading-4 text-slate-400">
                            There are no public deeds currently indexed for #{cleanTag}.
                        </p>

                        <Link
                            href="/"
                            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-[11px] bg-[#173C2E] px-3.5 text-[8px] font-black text-white transition hover:bg-[#214C3A]"
                        >
                            Explore ekarihub
                            <IoArrowForwardOutline size={11} />
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {items.map((item) => {
                                const href =
                                    `/${encodeURIComponent(
                                        item.handle
                                    )}/deed/${encodeURIComponent(
                                        item.id
                                    )}`;

                                const preview =
                                    item.posterUrl ||
                                    item.mediaUrl ||
                                    null;

                                const cleanHandle =
                                    item.handle.replace(/^@/, "");

                                return (
                                    <article
                                        key={item.id}
                                        className={[
                                            "group overflow-hidden rounded-[18px]",
                                            "border border-[#DDD8CC] bg-[#FBFAF6]",
                                            "shadow-[0_8px_24px_rgba(15,23,42,0.03)]",
                                            "transition-all duration-200",
                                            "hover:border-[#CFC7B8]",
                                            "hover:bg-white",
                                            "hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]",
                                        ].join(" ")}
                                    >
                                        <Link
                                            href={href}
                                            className="block"
                                        >
                                            <div className="relative aspect-[9/16] overflow-hidden bg-[#ECE9E2]">
                                                {preview ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={preview}
                                                        alt={
                                                            item.text ||
                                                            `Deed tagged ${cleanTag}`
                                                        }
                                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                                                        <IoDocumentTextOutline
                                                            size={24}
                                                        />
                                                        <span className="text-[8px] font-black">
                                                            No preview
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent px-3 pb-3 pt-16">
                                                    <div className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-1 text-[7px] font-black text-white/80 backdrop-blur-sm">
                                                        <IoPricetagOutline
                                                            size={10}
                                                            className="text-[#F39A22]"
                                                        />
                                                        #{cleanTag}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4">
                                                <div className="text-[9px] font-black text-[#F39A22]">
                                                    @{cleanHandle}
                                                </div>

                                                <h2 className="mt-1.5 line-clamp-2 text-[11px] font-black leading-4 text-slate-800">
                                                    {item.text ||
                                                        `View deed by @${cleanHandle}`}
                                                </h2>

                                                <div className="mt-3 flex items-center justify-between gap-2">
                                                    <span className="text-[8px] font-semibold text-slate-400">
                                                        View deed
                                                    </span>

                                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[#E8ECE8] text-[#173C2E] transition group-hover:bg-[#173C2E] group-hover:text-white">
                                                        <IoArrowForwardOutline
                                                            size={12}
                                                        />
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    </article>
                                );
                            })}
                        </div>

                        {totalPages > 1 ? (
                            <nav
                                aria-label="Tag pagination"
                                className="mt-8 flex flex-wrap items-center justify-center gap-2"
                            >
                                {hasPrev ? (
                                    <Link
                                        href={prevHref}
                                        className="inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-[#DDD8CC] bg-[#FBFAF6] px-4 text-[8px] font-black text-[#173C2E] transition hover:bg-white"
                                    >
                                        <IoArrowBackOutline size={11} />
                                        Previous
                                    </Link>
                                ) : (
                                    <span className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-[12px] border border-[#E5E0D6] bg-[#F3F1EB] px-4 text-[8px] font-black text-slate-300">
                                        <IoArrowBackOutline size={11} />
                                        Previous
                                    </span>
                                )}

                                <span className="inline-flex h-10 items-center rounded-[12px] bg-[#E8ECE8] px-4 text-[8px] font-black text-[#173C2E]">
                                    Page {page} of {totalPages}
                                </span>

                                {hasNext ? (
                                    <Link
                                        href={nextHref}
                                        className="inline-flex h-10 items-center gap-1.5 rounded-[12px] bg-[#173C2E] px-4 text-[8px] font-black text-white transition hover:bg-[#214C3A]"
                                    >
                                        Next
                                        <IoArrowForwardOutline size={11} />
                                    </Link>
                                ) : (
                                    <span className="inline-flex h-10 cursor-not-allowed items-center gap-1.5 rounded-[12px] border border-[#E5E0D6] bg-[#F3F1EB] px-4 text-[8px] font-black text-slate-300">
                                        Next
                                        <IoArrowForwardOutline size={11} />
                                    </span>
                                )}
                            </nav>
                        ) : null}
                    </>
                )}
            </section>
        </main>
    );
}

function StatPill({
    label,
}: {
    label: string;
}) {
    return (
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[8px] font-black text-white/60">
            {label}
        </span>
    );
}