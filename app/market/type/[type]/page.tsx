import type { Metadata } from "next";
import MarketTypeArchivePage, {
    generateMarketTypeArchiveMetadata,
} from "./MarketTypeArchivePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ type: string }>;
}): Promise<Metadata> {
    const { type } = await params;
    return generateMarketTypeArchiveMetadata(type, 1);
}

export default async function MarketTypePage({
    params,
}: {
    params: Promise<{ type: string }>;
}) {
    const { type } = await params;
    return <MarketTypeArchivePage type={type} page={1} />;
}