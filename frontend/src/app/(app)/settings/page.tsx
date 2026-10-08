import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <Placeholder
      title="Settings"
      note="General, summary template, playback and integrations — Phase 4."
    />
  );
}
