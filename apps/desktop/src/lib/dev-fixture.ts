/** In-browser stand-in for the Rust file commands, so the shell can be built
 *  and reviewed with `pnpm web` without a desktop window. Dev only. */

interface Entry {
  name: string
  path: string
  is_dir: boolean
  children: Entry[]
}

const NOTES: Record<string, string> = {
  '/space/Read me.md': `# Read me

Markdown, and nothing else. Prose with **strong**, *emphasis*, ~~strike~~, \`code\`,
==highlight==, H~2~O and X^2^.

> [!NOTE]
> Syntax reappears only on the line you are editing.

- bullet
- [x] finished
- [ ] pending

Inline math $E = mc^2$ sits in the sentence.

$$
\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}
$$

| Feature | Status | Notes |
| :------ | :----: | ----: |
| Live preview | done | syntax hides |
| Tables | done | click a cell |
| Sync | next | Cloudflare |

\`\`\`js
const nib = 'markdown'
\`\`\`

\`\`\`mermaid
graph LR
  A[Write] --> B[Sync]
  B --> C[Publish]
\`\`\`
`,
  '/space/Notes/Ideas.md': '# Ideas\n\n- One\n- Two\n',
  '/space/Notes/Archive/Old.md': '# Old\n\nSuperseded.\n',
}

function file(path: string): Entry {
  return { name: path.split('/').pop()!, path, is_dir: false, children: [] }
}

const TREE: Entry = {
  name: 'space',
  path: '/space',
  is_dir: true,
  children: [
    {
      name: 'Notes',
      path: '/space/Notes',
      is_dir: true,
      children: [
        {
          name: 'Archive',
          path: '/space/Notes/Archive',
          is_dir: true,
          children: [file('/space/Notes/Archive/Old.md')],
        },
        file('/space/Notes/Ideas.md'),
      ],
    },
    file('/space/Read me.md'),
  ],
}

export function fixtureInvoke<T>(command: string, args?: Record<string, unknown>): T {
  switch (command) {
    case 'read_tree':
      return TREE as T
    case 'read_note':
      return (NOTES[String(args?.path)] ?? '') as T
    case 'write_note':
      NOTES[String(args?.path)] = String(args?.content ?? '')
      return undefined as T
    default:
      throw new Error(`${command} has no browser stand-in`)
  }
}

export const FIXTURE_SPACE = { id: 'fixture', name: 'space', root: '/space' }
