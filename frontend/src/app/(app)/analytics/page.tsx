import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <Placeholder
      title="Analytics"
      note="Conversation intelligence across your meetings — Phase 6."
    />
  );
}
