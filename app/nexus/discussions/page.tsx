// app/nexus/events/page.tsx
import type { Metadata } from "next";
import DiscussionsArchivePage, { generateDiscussionsArchiveMetadata } from "./DiscussionsArchivePage";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateDiscussionsArchiveMetadata(1);
}

export default async function NexusEventsPage() {
  return <DiscussionsArchivePage page={1} />;
}