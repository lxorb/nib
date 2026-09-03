import { WidgetType } from '@codemirror/view'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export class MathWidget extends WidgetType {
  constructor(
    private readonly tex: string,
    private readonly block: boolean,
  ) {
    super()
  }

  eq(other: MathWidget) {
    return other.tex === this.tex && other.block === this.block
  }

  toDOM() {
    const host = document.createElement(this.block ? 'div' : 'span')
    host.className = this.block ? 'nib-math-block' : 'nib-math-inline'

    katex.render(this.tex, host, {
      displayMode: this.block,
      throwOnError: false,
      errorColor: 'var(--danger)',
      output: 'html',
      // Typora enables these packages by default; matching keeps documents portable.
      trust: false,
      strict: false,
    })

    return host
  }
}

/** Fence languages Typora renders as pictures rather than code. */
export const DIAGRAM_LANGUAGES = new Set(['mermaid', 'sequence', 'flow'])

let diagramSeq = 0

export class DiagramWidget extends WidgetType {
  constructor(
    private readonly code: string,
    private readonly language: string,
  ) {
    super()
  }

  eq(other: DiagramWidget) {
    return other.code === this.code && other.language === this.language
  }

  toDOM() {
    const host = document.createElement('div')
    host.className = 'nib-diagram'
    host.dataset.language = this.language
    void this.draw(host)
    return host
  }

  /** Mermaid is a megabyte, so it only loads once a document actually has a diagram. */
  private async draw(host: HTMLElement) {
    try {
      const { default: mermaid } = await import('mermaid')
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark',
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-ui'),
      })

      const { svg } = await mermaid.render(`nib-diagram-${diagramSeq++}`, this.code)
      host.innerHTML = svg
    } catch (error) {
      host.classList.add('nib-diagram-error')
      host.textContent = error instanceof Error ? error.message : String(error)
    }
  }
}
