import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { slugFor } from '../src/blog'
import { call, signIn, testEnv, type TestEnv } from './harness'

let env: TestEnv
let token: string
let space: string

beforeEach(async () => {
  env = testEnv()
  token = await signIn(env, 'a@b.dev')

  const created = await call(env, '/v1/spaces', { token, body: { name: 'Field notes' } })
  space = created.json.space.id

  await call(env, `/v1/spaces/${space}/notes`, {
    token,
    body: { path: 'Hello world.md', content: '# Hello world\n\nFirst **post**.\n' },
  })
})

afterEach(() => env.close())

async function publish(body: Record<string, unknown>) {
  return call(env, `/v1/spaces/${space}/blog`, { method: 'PUT', token, body })
}

describe('slugs', () => {
  test('lowercases and hyphenates', () => {
    expect(slugFor('Hello world.md')).toBe('hello-world')
  })

  test('keeps folders as path segments', () => {
    expect(slugFor('Notes/First Idea.md')).toBe('notes/first-idea')
  })

  test('drops punctuation', () => {
    expect(slugFor("What's new?.md")).toBe('what-s-new')
  })
})

describe('while a space is private', () => {
  test('its subdomain serves nothing', async () => {
    const response = await call(env, '/', { host: 'field.icinoxis.net' })
    expect(response.status).toBe(404)
  })

  test('a disabled blog stops serving', async () => {
    await publish({ subdomain: 'field' })
    await call(env, `/v1/spaces/${space}/blog`, { method: 'DELETE', token })

    expect((await call(env, '/', { host: 'field.icinoxis.net' })).status).toBe(404)
  })
})

describe('publishing', () => {
  test('a subdomain starts serving the index', async () => {
    await publish({ subdomain: 'field' })

    const response = await call(env, '/', { host: 'field.icinoxis.net' })
    expect(response.status).toBe(200)
    expect(response.text).toContain('Field notes')
    expect(response.text).toContain('/hello-world')
  })

  test('a note renders as HTML', async () => {
    await publish({ subdomain: 'field' })

    const response = await call(env, '/hello-world', { host: 'field.icinoxis.net' })
    expect(response.text).toContain('<h1>Hello world</h1>')
    expect(response.text).toContain('<strong>post</strong>')
  })

  test('an unknown slug is handled', async () => {
    await publish({ subdomain: 'field' })

    const response = await call(env, '/nothing-here', { host: 'field.icinoxis.net' })
    expect(response.text).toContain('Not found')
  })

  test('front matter is not printed', async () => {
    await call(env, `/v1/spaces/${space}/notes`, {
      token,
      body: { path: 'meta.md', content: '---\ntitle: Hi\n---\n\nBody text.\n' },
    })
    await publish({ subdomain: 'field' })

    const response = await call(env, '/meta', { host: 'field.icinoxis.net' })
    expect(response.text).not.toContain('title: Hi')
    expect(response.text).toContain('Body text.')
  })

  test('a custom domain is served too', async () => {
    await publish({ subdomain: 'field', domain: 'notes.example.com' })

    const response = await call(env, '/', { host: 'notes.example.com' })
    expect(response.status).toBe(200)
    expect(response.text).toContain('Field notes')
  })

  test('a custom domain comes back with the record to add', async () => {
    const response = await publish({ subdomain: 'field', domain: 'notes.example.com' })

    expect(response.json.dns).toHaveLength(1)
    expect(response.json.dns[0].type).toBe('CNAME')
    expect(response.json.dns[0].value).toBe('field.icinoxis.net')
  })

  test('an apex domain needs an A record instead', async () => {
    const response = await publish({ subdomain: 'field', domain: 'example.com' })
    expect(response.json.dns[0].type).toBe('A')
  })

  test('a custom title replaces the space name', async () => {
    await publish({ subdomain: 'field', title: 'Notes from the field' })

    const response = await call(env, '/', { host: 'field.icinoxis.net' })
    expect(response.text).toContain('Notes from the field')
  })
})

describe('choosing a subdomain', () => {
  test('reserved names are refused', async () => {
    expect((await publish({ subdomain: 'www' })).status).toBe(409)
    expect((await publish({ subdomain: 'api' })).status).toBe(409)
  })

  test('malformed names are refused', async () => {
    expect((await publish({ subdomain: 'Not Valid' })).status).toBe(400)
    expect((await publish({ subdomain: '-leading' })).status).toBe(400)
  })

  test('a name in use is refused', async () => {
    await publish({ subdomain: 'field' })

    const other = await signIn(env, 'other@b.dev')
    const theirs = await call(env, '/v1/spaces', { token: other, body: { name: 'Theirs' } })
    const response = await call(env, `/v1/spaces/${theirs.json.space.id}/blog`, {
      method: 'PUT',
      token: other,
      body: { subdomain: 'field' },
    })

    expect(response.status).toBe(409)
  })

  test('availability can be checked before committing', async () => {
    expect((await call(env, '/v1/spaces/available/free-name', { token })).json.available).toBe(true)

    await publish({ subdomain: 'taken-name' })
    expect((await call(env, '/v1/spaces/available/taken-name', { token })).json.available).toBe(false)
    expect((await call(env, '/v1/spaces/available/www', { token })).json.available).toBe(false)
  })
})
