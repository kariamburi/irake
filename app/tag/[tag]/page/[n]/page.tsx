// app/tag/[tag]/page/[n]/page.tsx
import TagArchivePage from "@/app/tag/_components/TagArchivePage";
import { BASE_URL, getPublicDeedsByTagPage, normalizeTag } from "@/app/tag/_lib/tag-feed";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

type TagPaginationParams = {
  params: Promise<{
    tag: string;
    n: string;
  }>;
};

function parsePageNumber(raw: string) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export async function generateMetadata({
  params,
}: TagPaginationParams): Promise<Metadata> {
  const { tag: rawTag, n: rawPage } = await params;
  const tag = normalizeTag(rawTag);
  const page = parsePageNumber(rawPage);

  if (!tag || !page) {
    return {
      title: "Page not found | ekarihub",
      robots: { index: false, follow: false },
    };
  }

  if (page === 1) {
    return {
      title: `#${tag} deeds | ekarihub`,
      alternates: {
        canonical: `${BASE_URL}/tag/${encodeURIComponent(tag)}`,
      },
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const data = await getPublicDeedsByTagPage(tag, page);

  if (data.total > 0 && page > data.totalPages) {
    return {
      title: "Page not found | ekarihub",
      robots: { index: false, follow: false },
    };
  }

  const title = `#${tag} deeds - Page ${page} | ekarihub`;
  const description = `Browse page ${page} of public deeds tagged with #${tag} on ekarihub.`;
  const canonical = `${BASE_URL}/tag/${encodeURIComponent(tag)}/page/${page}`;
  const ogImage =
    data.items[0]?.posterUrl || data.items[0]?.mediaUrl || `${BASE_URL}/og-image.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "ekarihub",
      type: "website",
      images: ogImage ? [{ url: ogImage }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
  };
}

export default async function TagPaginationPage({ params }: TagPaginationParams) {
  const { tag: rawTag, n: rawPage } = await params;
  const tag = normalizeTag(rawTag);
  const page = parsePageNumber(rawPage);

  if (!tag || !page) notFound();

  if (page === 1) {
    redirect(`/tag/${encodeURIComponent(tag)}`);
  }

  const data = await getPublicDeedsByTagPage(tag, page);

  if (data.total > 0 && page > data.totalPages) {
    notFound();
  }

  if (data.total === 0 && page > 1) {
    notFound();
  }

  return <TagArchivePage tag={tag} data={data} />;
}