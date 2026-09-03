export interface Env {
  DB: D1Database
  NOTES: R2Bucket

  /** Root domain that hands out free blog subdomains. */
  BLOG_ROOT: string
  APP_ORIGIN: string

  /** Cloudflare Email Sending. Absent in tests, where codes are logged. */
  EMAIL?: EmailSender
  MAIL_FROM?: string
}

/** The `send_email` binding's surface, which workers-types does not yet cover. */
export interface EmailSender {
  send(message: {
    from: string
    to: string | string[]
    subject: string
    text?: string
    html?: string
  }): Promise<{ messageId?: string }>
}

export interface User {
  id: string
  email: string
  created_at: number
}

export interface Space {
  id: string
  user_id: string
  name: string
  created_at: number
  updated_at: number
  blog_enabled: number
  blog_subdomain: string | null
  blog_domain: string | null
  blog_title: string | null
}

export interface Note {
  id: string
  space_id: string
  path: string
  seq: number
  version: number
  updated_at: number
  deleted: number
  size: number
  hash: string
}

export type Variables = { user: User }
