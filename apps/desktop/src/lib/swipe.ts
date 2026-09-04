/** The drawer follows a finger, and has to decide where to land when it lifts.
 *
 *  Kept apart from the DOM wiring because the decision is the part with rules
 *  in it: a flick should win over position, so a short fast swipe opens the
 *  drawer even though the finger never crossed the halfway mark. */

/** Pixels the finger must travel before the gesture is treated as horizontal
 *  rather than a scroll. Below this the drawer stays out of the way. */
export const CLAIM = 12

/** How close to the left edge a swipe must start to open a closed drawer.
 *  Anywhere further in belongs to the text under it. */
export const EDGE = 32

/** Pixels per millisecond past which the gesture reads as a flick. */
const FLICK = 0.5

/** Whether the drawer should end up open.
 *
 *  `offset` is how far it has been pulled out, `width` how far it can go, and
 *  `velocity` the finger's last speed - positive when moving right. */
export function settleOpen(offset: number, width: number, velocity: number): boolean {
  if (Math.abs(velocity) >= FLICK) return velocity > 0
  return offset >= width / 2
}

/** Whether a movement has become a drawer drag rather than a scroll. */
export function claimsGesture(dx: number, dy: number): boolean {
  return Math.abs(dx) > CLAIM && Math.abs(dx) > Math.abs(dy)
}
