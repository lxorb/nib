/** The note's own first line, if it would make a sensible filename. Heading
 *  marks and list bullets are dropped, since they are markup rather than title. */
export function nameFromContent(doc: string): string | null {
  const first = doc.split('\n').find((line) => line.trim())
  if (!first) return null

  const text = first
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*>\s*/, '')
    // Everything a filesystem would refuse, plus the separators.
    .replace(/[<>:"/\\|?* -]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')

  return text ? text.slice(0, 60) : null
}
