import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "Voice Agents" };

export default function VoiceAgentsPage() {
  return (
    <Placeholder
      title="Voice Agents"
      note="AI agents that can run calls on your behalf — Phase 6 placeholder."
    />
  );
}
