// app/tag/[tag]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TagArchivePage from "../_components/TagArchivePage";
import {
  BASE_URL,
  getPublicDeedsByTagPage,
  normalizeTag,
} from "../_lib/tag-feed";

type TagPageParams = {
  params: Promise<{
    tag: string;
  }>;
};

export async function generateMetadata({ params }: TagPageParams): Promise<Metadata> {
  const { tag: rawTag } = await params;
  const tag = normalizeTag(rawTag);

  if (!tag) {
    return {
      title: "Tag not found | ekarihub",
      robots: { index: false, follow: false },
    };
  }

  const data = await getPublicDeedsByTagPage(tag, 1);

  const title = `#${tag} deeds | ekarihub`;
  const description =
    data.total > 0
      ? `Browse public deeds tagged with #${tag} on ekarihub.`
      : `Explore content tagged with #${tag} on ekarihub.`;

  const canonical = `${BASE_URL}/tag/${encodeURIComponent(tag)}`;
  const ogImage =
    data.items[0]?.posterUrl || data.items[0]?.mediaUrl || `${BASE_URL}/og-image.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical,
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

export default async function TagPage({ params }: TagPageParams) {
  const { tag: rawTag } = await params;
  const tag = normalizeTag(rawTag);

  if (!tag) notFound();

  const data = await getPublicDeedsByTagPage(tag, 1);

  return <TagArchivePage tag={tag} data={data} />;
}