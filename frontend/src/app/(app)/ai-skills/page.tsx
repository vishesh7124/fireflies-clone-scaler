import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "AI Skills" };

export default function AiSkillsPage() {
  return (
    <Placeholder
      title="AI Skills"
      note="Discover, enable and run skills over your meetings — Phase 6."
    />
  );
}
