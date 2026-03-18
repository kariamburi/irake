// app/deeds/page/[n]/page.tsx
import HomeFeedClientPage from "@/app/HomeFeedClientPage";
import type { Metadata } from "next";
import { notFound } from "next/navigation";


type Props = {
    params: Promise<{ n: string }>;
};

function toPositivePageNumber(value: string) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { n } = await params;
    const pageNumber = toPositivePageNumber(n);

    if (!pageNumber) {
        return {
            title: "Deeds | ekarihub",
            robots: {
                index: false,
                follow: false,
            },
        };
    }

    return {
        title: pageNumber === 1 ? "Deeds | ekarihub" : `Deeds - Page ${pageNumber} | ekarihub`,
        description:
            pageNumber === 1
                ? "Browse public deeds on ekarihub including agribusiness stories, community updates, farming insights, opportunities, and shared experiences."
                : `Browse public deeds on ekarihub - page ${pageNumber}. Discover agribusiness stories, farming insights, community updates, and opportunities.`,
        alternates: {
            canonical:
                pageNumber === 1 ? "/deeds" : `/deeds/page/${pageNumber}`,
        },
        openGraph: {
            title: pageNumber === 1 ? "Deeds | ekarihub" : `Deeds - Page ${pageNumber} | ekarihub`,
            description:
                pageNumber === 1
                    ? "Browse public deeds on ekarihub including agribusiness stories, community updates, farming insights, opportunities, and shared experiences."
                    : `Browse public deeds on ekarihub - page ${pageNumber}.`,
            url:
                pageNumber === 1
                    ? "https://ekarihub.com/deeds"
                    : `https://ekarihub.com/deeds/page/${pageNumber}`,
            siteName: "ekarihub",
            type: "website",
            images: [
                {
                    url: "/og-image.jpg",
                    width: 1200,
                    height: 630,
                    alt:
                        pageNumber === 1
                            ? "ekarihub deeds"
                            : `ekarihub deeds page ${pageNumber}`,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: pageNumber === 1 ? "Deeds | ekarihub" : `Deeds - Page ${pageNumber} | ekarihub`,
            description:
                pageNumber === 1
                    ? "Browse public deeds on ekarihub."
                    : `Browse public deeds on ekarihub - page ${pageNumber}.`,
            images: ["/og-image.jpg"],
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}

export default async function DeedsPaginatedPage({ params }: Props) {
    const { n } = await params;
    const pageNumber = toPositivePageNumber(n);

    if (!pageNumber) {
        notFound();
    }

    return <HomeFeedClientPage forcedArchivePage={pageNumber} archiveMode="deeds" />;
}