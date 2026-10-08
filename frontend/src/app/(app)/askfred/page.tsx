import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "AskFred" };

export default function AskFredPage() {
  return (
    <Placeholder
      title="Hi VISHESH, how can I help today?"
      note="AskFred chat with citations across your meetings — Phase 4."
    />
  );
}
