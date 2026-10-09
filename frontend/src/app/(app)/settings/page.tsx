import SettingsContent from "./settings-content";

/**
 * Settings — the real app's persisted settings (docs/01 §5.7). Fully
 * client-driven, so we opt out of Next.js 16's PPR instant-navigation
 * validation.
 */
export const instant = false;

export default function SettingsPage() {
  return <SettingsContent />;
}
