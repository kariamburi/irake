// app/nexus/events/page/[n]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventsArchivePage, { generateEventsArchiveMetadata } from "../../EventsArchivePage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  const page = Number(n);

  if (!Number.isInteger(page) || page < 1) {
    return {
      title: "Events | ekarihub",
      robots: { index: false, follow: false },
    };
  }

  return generateEventsArchiveMetadata(page);
}

export default async function NexusEventsPageNumber({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const page = Number(n);

  if (!Number.isInteger(page) || page < 1) notFound();

  return <EventsArchivePage page={page} />;
}