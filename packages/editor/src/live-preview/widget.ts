import { WidgetType } from '@codemirror/view'

/** The base every widget Nib renders extends, for the one thing they all owe
 *  the editor.
 *
 *  `.cm-content` is contenteditable, and CodeMirror watches it with a
 *  MutationObserver so that typing straight into the DOM becomes a document
 *  change. A mutation inside a widget that the widget does not claim is read
 *  the same way: as text the user typed. The editor then re-derives its
 *  positions from DOM that was never document text, and from that point the
 *  caret lands in the wrong place and selection is unusable.
 *
 *  Widget DOM changes constantly - KaTeX and Mermaid render into it, images
 *  arrive and resize, a table cell swaps between its markdown and its result -
 *  so this is not a rare case. None of it is ever the source of the document:
 *  everything that edits writes back through an explicit dispatch instead. So
 *  every mutation inside a widget is ignored, and the editor's idea of where
 *  things are stays the document's, not the DOM's.
 *
 *  Extending this rather than `WidgetType` directly is enforced by a test, so
 *  a widget added later cannot quietly reintroduce the bug. */
export abstract class NibWidget extends WidgetType {
  ignoreMutation(): boolean {
    return true
  }
}
