/** Typed client for the sync service. Every call carries the session token;
 *  nothing here touches cookies, so it works the same in the app and the web. */

const BASE = import.meta.env.VITE_NIB_API ?? 'https://markdown.emilvinu.ch'

export interface Account {
  id: string
  email: string
}

export interface RemoteSpace {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  blog: {
    enabled: boolean
    subdomain: string | null
    domain: string | null
    title: string | null
  }
}

export interface RemoteNote {
  id: string
  path: string
  seq: number
  version: number
  updatedAt: number
  deleted: boolean
  size: number
  hash: string
}

export interface DnsRecord {
  type: string
  name: string
  value: string
  note: string
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown = null,
  ) {
    super(message)
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.token) headers.authorization = `Bearer ${options.token}`

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const text = await response.text()
  const parsed = text ? safeParse(text) : null

  if (!response.ok) {
    const message =
      (parsed as { error?: string } | null)?.error ?? `request failed (${response.status})`
    throw new ApiError(response.status, message, parsed)
  }

  return parsed as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const api = {
  requestCode: (email: string) =>
    request<{ ok: true; resendIn: number }>('/v1/auth/code', { body: { email } }),

  verifyCode: (email: string, code: string) =>
    request<{ token: string; user: Account }>('/v1/auth/verify', { body: { email, code } }),

  signOut: (token: string) => request<{ ok: true }>('/v1/auth/signout', { method: 'POST', token }),

  me: (token: string) => request<{ user: Account }>('/v1/me', { token }),

  listSpaces: (token: string) => request<{ spaces: RemoteSpace[] }>('/v1/spaces', { token }),

  createSpace: (token: string, name: string) =>
    request<{ space: RemoteSpace }>('/v1/spaces', { token, body: { name } }),

  deleteSpace: (token: string, id: string) =>
    request<{ ok: true }>(`/v1/spaces/${id}`, { method: 'DELETE', token }),

  changes: (token: string, spaceId: string, since: number) =>
    request<{ notes: RemoteNote[]; cursor: number; more: boolean }>(
      `/v1/spaces/${spaceId}/changes?since=${since}`,
      { token },
    ),

  createNote: (token: string, spaceId: string, path: string, content: string) =>
    request<{ note: RemoteNote }>(`/v1/spaces/${spaceId}/notes`, {
      token,
      body: { path, content },
    }),

  readNote: (token: string, id: string) =>
    request<{ note: RemoteNote; content: string }>(`/v1/notes/${id}`, { token }),

  writeNote: (token: string, id: string, path: string, content: string, baseVersion: number) =>
    request<{ note: RemoteNote }>(`/v1/notes/${id}`, {
      method: 'PUT',
      token,
      body: { path, content, baseVersion },
    }),

  deleteNote: (token: string, id: string) =>
    request<{ ok: true }>(`/v1/notes/${id}`, { method: 'DELETE', token }),

  subdomainAvailable: (token: string, subdomain: string) =>
    request<{ available: boolean; reason?: string }>(`/v1/spaces/available/${subdomain}`, { token }),

  publish: (
    token: string,
    spaceId: string,
    settings: { subdomain?: string; domain?: string; title?: string },
  ) =>
    request<{ space: RemoteSpace; dns: DnsRecord[] }>(`/v1/spaces/${spaceId}/blog`, {
      method: 'PUT',
      token,
      body: settings,
    }),

  unpublish: (token: string, spaceId: string) =>
    request<{ ok: true }>(`/v1/spaces/${spaceId}/blog`, { method: 'DELETE', token }),
}
