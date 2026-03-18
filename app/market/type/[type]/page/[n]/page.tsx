import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketTypeArchivePage, {
    generateMarketTypeArchiveMetadata,
} from "../../MarketTypeArchivePage";

export const dynamic = "force-dynamic";

function parsePage(n: string) {
    const num = Number(n);
    if (!Number.isInteger(num) || num < 1) return null;
    return num;
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ type: string; n: string }>;
}): Promise<Metadata> {
    const { type, n } = await params;
    const page = parsePage(n);
    if (!page) {
        return {
            title: "Page Not Found | ekarihub",
            robots: { index: false, follow: false },
        };
    }

    return generateMarketTypeArchiveMetadata(type, page);
}

export default async function MarketTypePaginatedPage({
    params,
}: {
    params: Promise<{ type: string; n: string }>;
}) {
    const { type, n } = await params;
    const page = parsePage(n);

    if (!page) notFound();

    return <MarketTypeArchivePage type={type} page={page} />;
}