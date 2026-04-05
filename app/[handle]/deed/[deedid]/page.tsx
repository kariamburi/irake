import type { Metadata } from "next";
import AuthorDeedPageClient from "./AuthorDeedPageClient";


type PageProps = {
    params: Promise<{
        handle: string;
        deedid: string;
    }>;
    searchParams?: Promise<{
        startDeedId?: string;
    }>;
};

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { handle, deedid } = await params;
    const cleanHandle = decodeURIComponent(handle ?? "").replace(/^@/, "");

    return {
        title: `@${cleanHandle} deed | ekarihub`,
        description: "Watch this deed and browse more deeds from this creator on ekarihub.",
        alternates: {
            canonical: `/${cleanHandle}/deed/${deedid}`,
        },
        openGraph: {
            title: `@${cleanHandle} deed | ekarihub`,
            description: "Watch this deed and browse more deeds from this creator on ekarihub.",
            url: `https://ekarihub.com/${cleanHandle}/deed/${deedid}`,
            siteName: "ekarihub",
            type: "website",
            images: [
                {
                    url: "/og-image.jpg",
                    width: 1200,
                    height: 630,
                    alt: "ekarihub deed",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: `@${cleanHandle} deed | ekarihub`,
            description: "Watch this deed and browse more deeds from this creator on ekarihub.",
            images: ["/og-image.jpg"],
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}

export default async function HandleDeedPage({ params, searchParams }: PageProps) {
    const { handle, deedid } = await params;
    const resolvedSearch = (await searchParams) ?? {};

    return (
        <AuthorDeedPageClient
            handle={decodeURIComponent(handle)}
            deedId={decodeURIComponent(deedid)}
            startDeedId={resolvedSearch.startDeedId ? decodeURIComponent(resolvedSearch.startDeedId) : undefined}
        />
    );
}