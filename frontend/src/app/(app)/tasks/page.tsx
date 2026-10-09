import TasksContent from "./tasks-content";

/**
 * Tasks — "All your meeting tasks in one place" (docs/01 §5.5). Fully
 * client-driven (queries + state), so we opt out of Next.js 16's Partial
 * Prerendering "instant navigation" validation.
 */
export const instant = false;

export default function TasksPage() {
  return <TasksContent />;
}
