/**
 * Text with <mark> highlights around every case-insensitive occurrence of
 * the query — used for find-in-transcript and search results.
 */
export function HighlightedText({ text, query }: { text: string; query?: string | null }) {
  if (!query || !query.trim()) return <>{text}</>;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-sm bg-[#f59e0b]/40 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
