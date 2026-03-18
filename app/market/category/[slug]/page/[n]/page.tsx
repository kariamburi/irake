// app/market/category/[slug]/page/[n]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketCategoryArchivePage, {
  generateMarketCategoryMetadata,
} from "../../../[slug]/MarketCategoryArchivePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}): Promise<Metadata> {
  const { slug, n } = await params;
  const page = Number(n);

  if (!Number.isInteger(page) || page < 2) {
    return {
      title: "Page not found | ekariMarket",
      robots: { index: false, follow: false },
    };
  }

  return generateMarketCategoryMetadata(slug, page);
}

export default async function MarketCategoryPaginationPage({
  params,
}: {
  params: Promise<{ slug: string; n: string }>;
}) {
  const { slug, n } = await params;
  const page = Number(n);

  if (!Number.isInteger(page) || page < 2) notFound();

  return <MarketCategoryArchivePage categorySlug={slug} page={page} />;
}