import type { Env } from './types'

/** What one account may keep, notes and images together. */
export const QUOTA = 1024 * 1024 * 1024

/** Bytes an account is using: every note it can reach plus every image it is
 *  keeping. Deleted notes are tombstones with no body, so they cost nothing. */
export async function usedBytes(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare(
    `select
       (select coalesce(sum(n.size), 0)
          from notes n join spaces s on s.id = n.space_id
         where s.user_id = ?1 and n.deleted = 0) as notes,
       (select coalesce(sum(size), 0) from blobs where user_id = ?1) as blobs`,
  )
    .bind(userId)
    .first<{ notes: number; blobs: number }>()

  return (row?.notes ?? 0) + (row?.blobs ?? 0)
}

/** Whether `incoming` more bytes would fit, given that `replacing` bytes of
 *  what is already counted are about to be given back. */
export async function fits(
  env: Env,
  userId: string,
  incoming: number,
  replacing = 0,
): Promise<boolean> {
  const used = await usedBytes(env, userId)
  return used - replacing + incoming <= QUOTA
}
