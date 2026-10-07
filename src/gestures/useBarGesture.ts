import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const MOVE_THRESHOLD_PX = 10
const TOGGLE_SWIPE_THRESHOLD_PX = 72
const DELETE_SWIPE_THRESHOLD_PX = 96
const SWIPE_MAX_PX = 140
const LONG_PRESS_MS = 400

type Status =
  | 'pending'
  | 'swipe-right'
  | 'swipe-left'
  | 'scrolling'
  | 'dragging'
  | 'done'

interface GestureState {
  pointerId: number
  startX: number
  startY: number
  lastY: number
  startTime: number
  status: Status
  longPressTimer: ReturnType<typeof setTimeout> | null
}

interface UseBarGestureOptions {
  disabled?: boolean
  onTap: () => void
  onToggleTodo: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragMove: (clientY: number) => void
  onDragEnd: () => void
}

/**
 * Gesture direction (not start position) decides the action, so every
 * gesture works no matter where on the bar it begins. touch-action is
 * fully "none" on the row (see Bar.module.css) because mobile browsers
 * lock in the effective touch-action at the start of a touch sequence —
 * flipping it to 'none' only once a long-press fires is too late to stop
 * native scroll from hijacking the gesture. Vertical scrolling is instead
 * reproduced manually (status "scrolling") so it still works everywhere.
 */
export function useBarGesture(options: UseBarGestureOptions) {
  const {
    disabled,
    onTap,
    onToggleTodo,
    onDelete,
    onDragStart,
    onDragMove,
    onDragEnd,
  } = options

  const [swipeX, setSwipeX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [snapBack, setSnapBack] = useState(false)

  const stateRef = useRef<GestureState | null>(null)

  function clearLongPress() {
    const s = stateRef.current
    if (s?.longPressTimer) {
      clearTimeout(s.longPressTimer)
      s.longPressTimer = null
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    const state: GestureState = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastY: e.clientY,
      startTime: Date.now(),
      status: 'pending',
      longPressTimer: null,
    }
    stateRef.current = state

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — some environments (e.g. synthetic events) may reject capture
    }
    setSnapBack(false)

    state.longPressTimer = setTimeout(() => {
      if (state.status === 'pending') {
        state.status = 'dragging'
        setIsDragging(true)
        onDragStart()
      }
    }, LONG_PRESS_MS)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId || s.status === 'done') return

    const deltaX = e.clientX - s.startX
    const deltaY = e.clientY - s.startY

    if (s.status === 'pending') {
      if (
        Math.abs(deltaX) < MOVE_THRESHOLD_PX &&
        Math.abs(deltaY) < MOVE_THRESHOLD_PX
      ) {
        return
      }
      clearLongPress()
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        s.status = deltaX > 0 ? 'swipe-right' : 'swipe-left'
      } else {
        s.status = 'scrolling'
        s.lastY = e.clientY
        return
      }
    }

    if (s.status === 'dragging') {
      onDragMove(e.clientY)
      return
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
      const clamped = Math.min(0, Math.max(deltaX, -SWIPE_MAX_PX))
      setSwipeX(clamped)
      if (clamped <= -DELETE_SWIPE_THRESHOLD_PX) {
        s.status = 'done'
        onDelete()
      }
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId) return

    clearLongPress()

    if (s.status === 'done') {
      stateRef.current = null
      return
    }

    if (s.status === 'dragging') {
      onDragEnd()
      setIsDragging(false)
    } else if (s.status === 'swipe-right') {
      if (e.clientX - s.startX > TOGGLE_SWIPE_THRESHOLD_PX) onToggleTodo()
      setSnapBack(true)
      setSwipeX(0)
    } else if (s.status === 'swipe-left') {
      setSnapBack(true)
      setSwipeX(0)
    } else if (s.status === 'pending') {
      if (Date.now() - s.startTime < LONG_PRESS_MS) onTap()
    }
    // 'scrolling' status needs no action on release

    stateRef.current = null
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId) return
    clearLongPress()
    if (s.status === 'dragging') {
      onDragEnd()
      setIsDragging(false)
    }
    setSnapBack(true)
    setSwipeX(0)
    stateRef.current = null
  }

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    swipeX,
    isDragging,
    snapBack,
  }
}
