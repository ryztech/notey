import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const MOVE_THRESHOLD_PX = 10
const TOGGLE_SWIPE_THRESHOLD_PX = 72
const DELETE_SWIPE_THRESHOLD_PX = 96
const SWIPE_MAX_PX = 140
const LONG_PRESS_MS = 400

type Status = 'pending' | 'swipe-right' | 'swipe-left' | 'scrolling'

interface GestureState {
  pointerId: number
  startX: number
  startY: number
  lastY: number
  startTime: number
  status: Status
}

interface UseBarGestureOptions {
  disabled?: boolean
  /** Quick press-and-release anywhere on the bar. */
  onShortTap: () => void
  /** Press-and-hold anywhere on the bar past the long-press threshold. */
  onLongPress: () => void
  onToggleTodo: () => void
  onDelete: () => void
}

/**
 * Row-level gestures only: horizontal swipe (direction, not start position,
 * decides left vs right) and short-tap vs long-press. Dragging to reorder
 * lives entirely on the dedicated handle (see Bar.tsx) so it never competes
 * with these, with the page scroll, or with the browser's pull-to-refresh.
 * touch-action is fully "none" on the row (see Bar.module.css) and vertical
 * scrolling is reproduced manually, because mobile browsers lock in the
 * effective touch-action at the start of a touch sequence.
 */
export function useBarGesture(options: UseBarGestureOptions) {
  const { disabled, onShortTap, onLongPress, onToggleTodo, onDelete } = options

  const [swipeX, setSwipeX] = useState(0)
  const [snapBack, setSnapBack] = useState(false)

  const stateRef = useRef<GestureState | null>(null)

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    stateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      // The event's own timestamp reflects when the hardware/OS event
      // actually happened, unlike Date.now() which reflects whenever this
      // handler happens to run — keeping short-vs-long classification
      // accurate even if React is busy for a moment.
      startTime: e.timeStamp,
      status: 'pending',
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — some environments (e.g. synthetic events) may reject capture
    }
    setSnapBack(false)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId) return

    const deltaX = e.clientX - s.startX
    const deltaY = e.clientY - s.startY

    if (s.status === 'pending') {
      if (
        Math.abs(deltaX) < MOVE_THRESHOLD_PX &&
        Math.abs(deltaY) < MOVE_THRESHOLD_PX
      ) {
        return
      }
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        s.status = deltaX > 0 ? 'swipe-right' : 'swipe-left'
      } else {
        s.status = 'scrolling'
        s.lastY = e.clientY
        return
      }
    }

    if (s.status === 'scrolling') {
      window.scrollBy(0, s.lastY - e.clientY)
      s.lastY = e.clientY
      return
    }

    if (s.status === 'swipe-right') {
      setSwipeX(Math.max(0, Math.min(deltaX, SWIPE_MAX_PX)))
      return
    }

    if (s.status === 'swipe-left') {
      setSwipeX(Math.min(0, Math.max(deltaX, -SWIPE_MAX_PX)))
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId) return

    if (s.status === 'swipe-right') {
      if (e.clientX - s.startX > TOGGLE_SWIPE_THRESHOLD_PX) onToggleTodo()
      setSnapBack(true)
      setSwipeX(0)
    } else if (s.status === 'swipe-left') {
      // Delete only commits on release, past the threshold — never mid-drag —
      // so the gesture can still be aborted by pulling back before letting go.
      if (e.clientX - s.startX < -DELETE_SWIPE_THRESHOLD_PX) {
        onDelete()
      } else {
        setSnapBack(true)
        setSwipeX(0)
      }
    } else if (s.status === 'pending') {
      if (e.timeStamp - s.startTime >= LONG_PRESS_MS) onLongPress()
      else onShortTap()
    }
    // 'scrolling' status needs no action on release

    stateRef.current = null
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId) return
    setSnapBack(true)
    setSwipeX(0)
    stateRef.current = null
  }

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    swipeX,
    snapBack,
  }
}
