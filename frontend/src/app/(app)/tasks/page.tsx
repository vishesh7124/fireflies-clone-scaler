import type { Metadata } from "next";
import { Placeholder } from "@/components/layout/placeholder";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <Placeholder
      title="All your meeting tasks in one place"
      note="Manage, assign and update all your meeting tasks here — Phase 4."
    />
  );
}
