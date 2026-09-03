# Nib

A markdown editor. Nothing but markdown.

## Out of all markdown editors, why should you use Nib?

| | Free | Inline preview | Open source | Sync | MCP | Themes | Publish |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Nib** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Typora | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| MarkText | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Obsidian | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Zettlr | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Joplin | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Logseq | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| iA Writer | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Bear | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| VS Code | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Sublime Text | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

**Inline preview** — you edit the markdown in the same place you see the result.
No split pane, no toggling between a source view and a preview.

**Sync** — your notes follow you between machines without buying an add-on or
wiring up a third-party folder.

**MCP** — your own LLM can read and write your notes through a connector the
editor ships with.

**Publish** — one click turns a space into a blog, on a subdomain or a domain
you own.

A ❌ means the feature is missing, paid separately, or left to something outside
the editor. Obsidian Sync and Obsidian Publish are paid add-ons; Joplin can
publish only through Joplin Cloud; iA Writer relies on your own cloud folder for
syncing. Details change — check anything here that would sway your choice.

## Nib itself

```
pnpm install
pnpm dev
```

| path | what |
| --- | --- |
| `apps/desktop` | Tauri v2 app (Rust core, Svelte 5 shell) |
| `packages/editor` | CodeMirror 6 live-preview engine |
| `packages/ui` | shared components + motion primitives |
| `packages/themes` | CSS theme system |
| `services/sync` | Cloudflare Worker sync backend |

Nib runs as a desktop app and as a web page. In the browser your notes live in
that browser until you sign in and turn on syncing.
