import { WidgetType } from '@codemirror/view'
import katex from 'katex'
// Chemical equations: `\ce{H2O}` and friends, as Typora supports.
import 'katex/contrib/mhchem'
import 'katex/dist/katex.min.css'

/** Equation labels seen in this document, in order, so `\eqref` can resolve. */
const equationNumbers = new Map<string, number>()

export function resetEquationLabels() {
  equationNumbers.clear()
}

export function recordEquationLabel(tex: string, number: number) {
  const label = /\\label\s*\{([^}]+)\}/.exec(tex)
  if (label) equationNumbers.set(label[1], number)
}

/** `\label` is TeX bookkeeping, not something KaTeX renders; `\eqref` becomes
 *  the number the label was given. */
export function prepare(tex: string): string {
  return tex
    .replace(/\\label\s*\{[^}]*\}/g, '')
    .replace(/\\(?:eq)?ref\s*\{([^}]+)\}/g, (whole, name: string) => {
      const number = equationNumbers.get(name)
      return number ? `(${number})` : whole
    })
}

export class MathWidget extends WidgetType {
  constructor(
    private readonly tex: string,
    private readonly block: boolean,
    /** Shown to the right of a display equation when numbering is on. */
    private readonly number?: number,
  ) {
    super()
  }

  eq(other: MathWidget) {
    return other.tex === this.tex && other.block === this.block && other.number === this.number
  }

  toDOM() {
    const host = document.createElement(this.block ? 'div' : 'span')
    host.className = this.block ? 'nib-math-block' : 'nib-math-inline'

    const body = this.number ? document.createElement('span') : host
    if (this.number) host.append(body)

    katex.render(prepare(this.tex), body, {
      displayMode: this.block,
      throwOnError: false,
      errorColor: 'var(--danger)',
      output: 'html',
      // Typora enables these packages by default; matching keeps documents portable.
      trust: false,
      strict: false,
    })

    if (this.number) {
      const tag = document.createElement('span')
      tag.className = 'nib-math-number'
      tag.textContent = `(${this.number})`
      host.append(tag)
    }

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
