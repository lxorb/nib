import type { Extension } from '@codemirror/state'
import { blockDecorations } from './blocks'
import { livePreviewDecorations } from './decorate'

/** Hides markdown syntax until the caret enters the construct that owns it.
 *  The document text is never rewritten — only what you see changes. */
export function livePreview(): Extension {
  return [livePreviewDecorations, blockDecorations]
}

export { blockDecorations, livePreviewDecorations }
