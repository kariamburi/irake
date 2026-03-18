// app/market/category/[slug]/page.tsx
import type { Metadata } from "next";
import MarketCategoryArchivePage, {
  generateMarketCategoryMetadata,
} from "./MarketCategoryArchivePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return generateMarketCategoryMetadata(slug, 1);
}

export default async function MarketCategoryRootPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <MarketCategoryArchivePage categorySlug={slug} page={1} />;
}