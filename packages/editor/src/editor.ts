import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection, dropCursor, highlightActiveLine, keymap } from '@codemirror/view'
import { imageHandling, imageResolver, type ImageSink } from './images'
import { nibKeymap } from './keymap'
import { nibMarkdownExtensions } from './markdown/extensions'
import { modeExtensions } from './modes'
import { nibHighlightStyle, nibTheme } from './theme'

export interface EditorOptions {
  parent: HTMLElement
  doc?: string
  onChange?: (doc: string) => void
  /** Called when an image is pasted or dropped; returns the path to insert. */
  onImage?: ImageSink
  /** Maps a document-relative image path to a URL the view can load. */
  resolveImage?: (src: string) => string
}

export function createEditor({
  parent,
  doc = '',
  onChange,
  onImage,
  resolveImage,
}: EditorOptions): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        EditorView.lineWrapping,
        // The writing surface carries Typora's `#write` id, so Typora themes
        // that target `#write` style our editor directly.
        EditorView.contentAttributes.of({ id: 'write', spellcheck: 'true' }),
        markdown({
          base: markdownLanguage,
          codeLanguages: languages,
          extensions: nibMarkdownExtensions,
        }),
        syntaxHighlighting(nibHighlightStyle),
        modeExtensions(),
        ...(onImage ? [imageHandling(onImage)] : []),
        ...(resolveImage ? [imageResolver.of(resolveImage)] : []),
        nibTheme,
        keymap.of([
          // Markdown bindings come first so they win over the defaults.
          ...nibKeymap,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange?.(update.state.doc.toString())
        }),
      ],
    }),
  })
}
