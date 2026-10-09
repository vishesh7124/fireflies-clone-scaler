import UploadsContent from "./uploads-content";

/**
 * Uploads — replicates the real app's Uploads page (upload.png). Fully
 * client-driven (file uploads + drag-drop + queue), so we opt out of
 * Next.js 16's Partial Prerendering "instant navigation" validation.
 */
export const instant = false;

export default function UploadsPage() {
  return <UploadsContent />;
}
