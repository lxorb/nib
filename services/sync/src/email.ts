import type { Env } from './types'

export interface Mailer {
  send(to: string, subject: string, body: { text: string; html: string }): Promise<void>
}

/** Without a provider key, codes go to the log — enough to develop against. */
function logging(): Mailer {
  return {
    async send(to, subject, body) {
      console.log(`[mail] ${to} — ${subject}\n${body.text}`)
    },
  }
}

function resend(apiKey: string, from: string): Mailer {
  return {
    async send(to, subject, body) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ from, to, subject, text: body.text, html: body.html }),
      })

      if (!response.ok) {
        throw new Error(`mail provider returned ${response.status}: ${await response.text()}`)
      }
    },
  }
}

export function mailer(env: Env): Mailer {
  if (!env.RESEND_API_KEY) return logging()
  return resend(env.RESEND_API_KEY, env.MAIL_FROM ?? 'Nib <nib@emilvinu.ch>')
}

export function codeMessage(code: string) {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`

  return {
    subject: `${code} is your Nib code`,
    text: `Your sign-in code is ${spaced}. It expires in 10 minutes.\n\nIf you did not ask for it, ignore this message.`,
    html: `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;color:#1a1d23">
  <p>Your sign-in code:</p>
  <p style="font-family:ui-monospace,monospace;font-size:30px;letter-spacing:.18em;font-weight:600">${spaced}</p>
  <p style="color:#8a93a2">It expires in 10 minutes. If you did not ask for it, ignore this message.</p>
</div>`,
  }
}
