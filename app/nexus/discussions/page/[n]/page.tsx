import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscussionsArchivePage, {
  generateDiscussionsArchiveMetadata,
} from "../../DiscussionsArchivePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  const page = Number(n);

  if (!Number.isInteger(page) || page < 2) {
    return {
      title: "Discussions | ekarihub Nexus",
      robots: { index: false, follow: false },
    };
  }

  return generateDiscussionsArchiveMetadata(page);
}

export default async function DiscussionsArchivePaginatedPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const page = Number(n);

  if (!Number.isInteger(page) || page < 2) notFound();

  return <DiscussionsArchivePage page={page} />;
}