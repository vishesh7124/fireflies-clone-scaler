import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return (
    <Placeholder
      title="Meetings — the Notebook"
      note="Channels rail, filters, and the meetings list land in Phase 2."
    />
  );
}
