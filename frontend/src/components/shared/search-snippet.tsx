/** Render only known mark delimiters, never uploaded HTML. React escapes content. */
export function SearchSnippet({ text }: { text: string }) {
  const decode = (value: string) => value.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (entity) => ({
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'",
  })[entity] ?? entity);
  return <>{text.split(/(<mark>[\s\S]*?<\/mark>)/g).map((part, i) =>
    part.startsWith("<mark>") && part.endsWith("</mark>") ?
      <mark key={i}>{decode(part.slice(6, -7))}</mark> : <span key={i}>{decode(part)}</span>,
  )}</>;
}
