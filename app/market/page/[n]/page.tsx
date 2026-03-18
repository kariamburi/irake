import type { Metadata } from "next";
import MarketArchivePage, { generateMarketArchiveMetadata } from "../../MarketArchivePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  const page = Number(n);
  return generateMarketArchiveMetadata(page);
}

export default async function MarketPaginatedPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const page = Number(n);

  return <MarketArchivePage page={page} />;
}