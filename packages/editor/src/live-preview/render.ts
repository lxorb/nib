import { WidgetType } from '@codemirror/view'
import katex from 'katex'
// Chemical equations: `\ce{H2O}` and friends, as Typora supports.
import 'katex/contrib/mhchem'
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
export const DIAGRAM_LANGUAGES = new Set(['mermaid', 'flow'])

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

  /** Both renderers are heavy, so neither loads until a document has one. */
  private async draw(host: HTMLElement) {
    try {
      if (this.language === 'flow') await drawFlowchart(host, this.code)
      else await drawMermaid(host, this.code)
    } catch (error) {
      host.classList.add('nib-diagram-error')
      host.textContent = error instanceof Error ? error.message : String(error)
    }
  }
}

function themeColour(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

async function drawMermaid(host: HTMLElement, code: string) {
  const { default: mermaid } = await import('mermaid')

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: document.documentElement.dataset.theme === 'light' ? 'default' : 'dark',
    fontFamily: themeColour('--font-ui'),
  })

  const { svg } = await mermaid.render(`nib-diagram-${diagramSeq++}`, code)
  host.innerHTML = svg
}

/** Typora's legacy ` ```flow ` fences, drawn by flowchart.js. */
async function drawFlowchart(host: HTMLElement, code: string) {
  const flowchart = (await import('flowchart.js')).default

  host.innerHTML = ''
  flowchart.parse(code).drawSVG(host, {
    'line-width': 1.5,
    'font-family': themeColour('--font-ui'),
    'font-size': 13,
    fill: themeColour('--surface-2'),
    'line-color': themeColour('--muted'),
    'element-color': themeColour('--line-strong'),
    'font-color': themeColour('--text'),
    'yes-text': 'yes',
    'no-text': 'no',
  })
}
