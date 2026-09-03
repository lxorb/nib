import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import app from '../src/index'
import type { Env } from '../src/types'

const MIGRATIONS = ['0001_init.sql', '0002_mcp_tokens.sql'].map((name) =>
  fileURLToPath(new URL(`../migrations/${name}`, import.meta.url)),
)

/** D1's shape over Node's built-in SQLite, so routes run against real SQL. */
function d1(database: DatabaseSync) {
  return {
    prepare(sql: string) {
      const statement = {
        args: [] as unknown[],
        bind(...args: unknown[]) {
          statement.args = args
          return statement
        },
        async first<T>() {
          return (database.prepare(sql).get(...(statement.args as never[])) as T) ?? null
        },
        async all<T>() {
          return { results: database.prepare(sql).all(...(statement.args as never[])) as T[] }
        },
        async run() {
          database.prepare(sql).run(...(statement.args as never[]))
          return { success: true }
        },
      }
      return statement
    },
  }
}

function bucket() {
  const store = new Map<string, string>()

  return {
    async put(key: string, value: string) {
      store.set(key, String(value))
    },
    async get(key: string) {
      const value = store.get(key)
      return value === undefined ? null : { text: async () => value }
    },
    async delete(key: string) {
      store.delete(key)
    },
  }
}

export interface TestEnv extends Env {
  close(): void
}

export function testEnv(overrides: Partial<Env> = {}): TestEnv {
  const database = new DatabaseSync(':memory:')
  for (const migration of MIGRATIONS) database.exec(readFileSync(migration, 'utf8'))

  return {
    DB: d1(database) as unknown as D1Database,
    NOTES: bucket() as unknown as R2Bucket,
    BLOG_ROOT: 'nibeditor.com',
    APP_ORIGIN: 'https://nibeditor.com',
    ...overrides,
    close: () => database.close(),
  }
}

interface CallOptions {
  method?: string
  body?: unknown
  token?: string
  host?: string
}

/** Calls the Worker the way the network would. */
export async function call(env: Env, path: string, options: CallOptions = {}) {
  const host = options.host ?? 'nibeditor.com'
  const headers: Record<string, string> = {}

  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.token) headers.authorization = `Bearer ${options.token}`

  const response = await app.fetch(
    new Request(`https://${host}${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    env,
  )

  const text = await response.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    // Blog responses are HTML.
  }

  return { status: response.status, json, text, headers: response.headers }
}

/** Runs the sign-in flow and returns a usable session token. */
export async function signIn(env: Env, email: string): Promise<string> {
  const logged: string[] = []
  const original = console.log
  console.log = (message: string) => logged.push(String(message))

  try {
    await call(env, '/v1/auth/code', { body: { email } })
  } finally {
    console.log = original
  }

  const code = /(\d{3}) (\d{3})/.exec(logged.join('\n'))
  if (!code) throw new Error(`no code was sent:\n${logged.join('\n')}`)

  const verified = await call(env, '/v1/auth/verify', {
    body: { email, code: code[1] + code[2] },
  })

  if (verified.status !== 200) throw new Error(`sign-in failed: ${verified.text}`)
  return verified.json.token as string
}
