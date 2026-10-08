import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <Placeholder
      title="Integrations"
      note="Zoom, Google Meet, Slack, CRM… all coming soon (mocked section)."
    />
  );
}
