/**
 * Shared placeholder for pages that land in later phases — keeps the shell
 * navigable during review without building empty stubs.
 */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
