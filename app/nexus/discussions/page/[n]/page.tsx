import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DiscussionsArchivePage, { generateDiscussionsArchiveMetadata } from "../../DiscussionsArchivePage";

type Props = {
  params: Promise<{ page: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await params;
  const pageNum = Number(page);

  if (!Number.isInteger(pageNum) || pageNum < 1) {
    return generateDiscussionsArchiveMetadata(1);
  }

  return generateDiscussionsArchiveMetadata(pageNum);
}

export default async function NexusDiscussionsPaginatedPage({ params }: Props) {
  const { page } = await params;
  const pageNum = Number(page);

  if (!Number.isInteger(pageNum) || pageNum < 1) notFound();

  return <DiscussionsArchivePage page={pageNum} />;
}