import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth, requireUser } from './auth'
import { blobs, publicBlobs } from './blobs'
import { serveBlog, spaceForHost } from './blog'
import { mcp, mcpAdmin } from './mcp'
import { notes } from './notes'
import { spaces } from './spaces'
import { QUOTA, usedBytes } from './storage'
import type { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

/** The desktop app is not served from the API's origin, so it needs to be let in
 *  by name. Auth rides on a bearer token, never on cookies. */
app.use(
  '/v1/*',
  cors({
    origin: (origin) =>
      /^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|tauri:\/\/localhost|https?:\/\/tauri\.localhost|https:\/\/nibeditor\.com)$/.test(
        origin,
      )
        ? origin
        : '',
    allowHeaders: ['authorization', 'content-type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  }),
)

app.route('/v1/auth', auth)

// Images are served by hash, with no session: a note is read wherever it was
// shared, and a published blog has no reader to authenticate. Registered ahead
// of the guard below for that reason.
app.route('/i', publicBlobs)

// The connector carries its own token, so it sits outside the session guard.
app.use('/mcp', cors({ origin: '*', allowHeaders: ['authorization', 'content-type'] }))
app.route('/mcp', mcp)

/** Everything past this point needs a session. */
app.use('/v1/*', async (context, next) => {
  const user = await requireUser(context.env, context.req.header('authorization'))
  if (!user) return context.json({ error: 'sign in first' }, 401)

  context.set('user', user)
  await next()
})

app.get('/v1/me', (context) => {
  const user = context.get('user')
  return context.json({ user: { id: user.id, email: user.email } })
})

app.get('/v1/usage', async (context) => {
  const user = context.get('user')
  return context.json({ used: await usedBytes(context.env, user.id), limit: QUOTA })
})

app.route('/v1/blobs', blobs)
app.route('/v1/spaces', spaces)
app.route('/v1/mcp/token', mcpAdmin)
app.route('/v1', notes)

app.get('/health', (context) => context.json({ ok: true }))

/** Anything that is not the API is either a published space, looked up by
 *  hostname, or the app itself. */
app.all('*', async (context) => {
  const url = new URL(context.req.url)
  const space = await spaceForHost(context.env, url.host)

  if (space) return serveBlog(context.env, space, url)

  // The web build of the editor. It stores notes in the browser until someone
  // signs in, so it is served to anyone who asks.
  const assets = context.env.ASSETS
  if (assets) return assets.fetch(context.req.raw)

  return context.text('Not found', 404)
})

export default app
