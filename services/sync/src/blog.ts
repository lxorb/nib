import { marked } from 'marked'
import type { Env, Note, Space } from './types'

/** Which space, if any, a hostname publishes. */
export async function spaceForHost(env: Env, host: string): Promise<Space | null> {
  const hostname = host.toLowerCase().split(':')[0]

  if (hostname.endsWith(`.${env.BLOG_ROOT}`)) {
    const subdomain = hostname.slice(0, -(env.BLOG_ROOT.length + 1))
    return (
      (await env.DB.prepare(
        'select * from spaces where blog_subdomain = ? and blog_enabled = 1',
      )
        .bind(subdomain)
        .first<Space>()) ?? null
    )
  }

  return (
    (await env.DB.prepare('select * from spaces where blog_domain = ? and blog_enabled = 1')
      .bind(hostname)
      .first<Space>()) ?? null
  )
}

/** `Notes/First Idea.md` becomes `notes/first-idea`. */
export function slugFor(path: string): string {
  return path
    .replace(/\.(md|markdown|mdown|mkd)$/i, '')
    .split('/')
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean)
    .join('/')
}

function title(note: Note, body: string): string {
  const heading = /^#\s+(.+)$/m.exec(body)
  if (heading) return heading[1].trim()
  return note.path.replace(/\.(md|markdown|mdown|mkd)$/i, '').split('/').pop() ?? note.path
}

function escape(text: string): string {
  return text.replace(/[&<>"]/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character] as string,
  )
}

const STYLE = `
:root{--bg:#fbfcfd;--fg:#1a1d23;--muted:#8a93a2;--line:#e1e6ed;--accent:#5b4be0;--surface:#f3f5f8}
@media (prefers-color-scheme:dark){:root{--bg:#0e1013;--fg:#dde2ea;--muted:#767e8c;--line:#232830;--accent:#7c6bf5;--surface:#14171c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16.5px/1.72 ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:42rem;margin:0 auto;padding:6rem 1.5rem 8rem}
h1,h2,h3,h4{line-height:1.28;letter-spacing:-.015em;margin:1.9em 0 .6em}
h1{font-size:1.92em;margin-top:0}
h2{font-size:1.5em}h3{font-size:1.22em}
p{margin:0 0 1.15em}
a{color:var(--accent);text-decoration:none;border-bottom:1px solid color-mix(in srgb,var(--accent) 40%,transparent)}
a:hover{border-bottom-color:var(--accent)}
code{font-family:ui-monospace,monospace;font-size:.88em;background:var(--surface);border:1px solid var(--line);border-radius:5px;padding:.12em .34em}
pre{background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:1rem;overflow-x:auto}
pre code{background:none;border:0;padding:0}
blockquote{margin:1.5em 0;padding-left:1.15em;border-left:2px solid var(--line);color:var(--muted)}
table{border-collapse:collapse;width:100%;margin:1.6em 0;font-size:.94em}
th,td{border:1px solid var(--line);padding:.5em .75em;text-align:left}
th{background:var(--surface)}
img{max-width:100%;height:auto;border-radius:9px}
hr{border:0;height:1px;background:var(--line);margin:2.4em 0}
ul.index{list-style:none;padding:0}
ul.index li{border-bottom:1px solid var(--line)}
ul.index a{display:flex;justify-content:space-between;gap:1rem;padding:.85rem 0;border:0;color:var(--fg)}
ul.index a:hover{color:var(--accent)}
ul.index time{color:var(--muted);font-size:.85em;flex:none}
footer{margin-top:5rem;padding-top:1.5rem;border-top:1px solid var(--line);color:var(--muted);font-size:.82em}
`

function page(heading: string, body: string, env: Env): Response {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(heading)}</title>
<style>${STYLE}</style>
</head><body><main>${body}
<footer>Published with <a href="${env.APP_ORIGIN}">Nib</a></footer>
</main></body></html>`

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
  })
}

export async function serveBlog(env: Env, space: Space, url: URL): Promise<Response> {
  const { results } = await env.DB.prepare(
    'select * from notes where space_id = ? and deleted = 0 order by path',
  )
    .bind(space.id)
    .all<Note>()

  const slug = url.pathname.replace(/^\/+|\/+$/g, '')
  const heading = space.blog_title ?? space.name

  if (!slug) {
    const items = results
      .map((note) => {
        const date = new Date(note.updated_at).toISOString().slice(0, 10)
        const label = note.path.replace(/\.(md|markdown|mdown|mkd)$/i, '')
        return `<li><a href="/${slugFor(note.path)}"><span>${escape(label)}</span><time datetime="${date}">${date}</time></a></li>`
      })
      .join('')

    return page(
      heading,
      `<h1>${escape(heading)}</h1><ul class="index">${items}</ul>`,
      env,
    )
  }

  const note = results.find((entry) => slugFor(entry.path) === slug)
  if (!note) return page('Not found', '<h1>Not found</h1>', env)

  const object = await env.NOTES.get(`spaces/${space.id}/${note.id}`)
  const source = object ? await object.text() : ''
  const rendered = await marked.parse(stripFrontMatter(source), { gfm: true, breaks: false })

  return page(title(note, source), `${rendered}<p><a href="/">← ${escape(heading)}</a></p>`, env)
}

function stripFrontMatter(source: string): string {
  return source.startsWith('---') ? source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') : source
}
