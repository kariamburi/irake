// app/nexus/events/page.tsx
import type { Metadata } from "next";
import EventsArchivePage, { generateEventsArchiveMetadata } from "./EventsArchivePage";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return generateEventsArchiveMetadata(1);
}

export default async function NexusEventsPage() {
  return <EventsArchivePage page={1} />;
}