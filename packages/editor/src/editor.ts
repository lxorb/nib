import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { EditorView, drawSelection, dropCursor, highlightActiveLine, keymap } from '@codemirror/view'
import { livePreview } from './live-preview'
import { nibHighlightStyle, nibTheme } from './theme'

export interface EditorOptions {
  parent: HTMLElement
  doc?: string
  onChange?: (doc: string) => void
}

export function createEditor({ parent, doc = '', onChange }: EditorOptions): EditorView {
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
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(nibHighlightStyle),
        livePreview(),
        nibTheme,
        keymap.of([
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
