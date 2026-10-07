import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const EDGE_ZONE_PX = 28
const TOGGLE_SWIPE_THRESHOLD_PX = 72
const DELETE_SWIPE_THRESHOLD_PX = 96
const LONG_PRESS_MS = 400
const TAP_MOVE_THRESHOLD_PX = 8

type Zone = 'left' | 'right' | 'middle'

interface GestureState {
  zone: Zone
  pointerId: number
  startX: number
  startY: number
  startTime: number
  longPressTimer: ReturnType<typeof setTimeout> | null
  dragging: boolean
  deleted: boolean
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

    const rect = e.currentTarget.getBoundingClientRect()
    const localX = e.clientX - rect.left
    const zone: Zone =
      localX <= EDGE_ZONE_PX
        ? 'left'
        : localX >= rect.width - EDGE_ZONE_PX
          ? 'right'
          : 'middle'

    const state: GestureState = {
      zone,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      longPressTimer: null,
      dragging: false,
      deleted: false,
    }
    stateRef.current = state

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore — some environments (e.g. synthetic events) may reject capture
    }
    setSnapBack(false)

    if (zone === 'middle') {
      state.longPressTimer = setTimeout(() => {
        state.dragging = true
        setIsDragging(true)
        onDragStart()
      }, LONG_PRESS_MS)
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId || s.deleted) return

    const deltaX = e.clientX - s.startX
    const deltaY = e.clientY - s.startY

    if (s.zone === 'middle') {
      if (s.dragging) {
        onDragMove(e.clientY)
        return
      }
      if (
        Math.abs(deltaX) > TAP_MOVE_THRESHOLD_PX ||
        Math.abs(deltaY) > TAP_MOVE_THRESHOLD_PX
      ) {
        clearLongPress()
      }
      return
    }

    if (s.zone === 'left') {
      const clamped = Math.max(0, Math.min(deltaX, EDGE_ZONE_PX * 4))
      setSwipeX(clamped)
      return
    }

    // right zone
    const clamped = Math.min(0, Math.max(deltaX, -EDGE_ZONE_PX * 4))
    setSwipeX(clamped)
    if (clamped <= -DELETE_SWIPE_THRESHOLD_PX) {
      s.deleted = true
      onDelete()
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId) return

    clearLongPress()

    if (s.deleted) {
      stateRef.current = null
      return
    }

    if (s.zone === 'middle') {
      if (s.dragging) {
        onDragEnd()
        setIsDragging(false)
      } else {
        const elapsed = Date.now() - s.startTime
        const deltaX = Math.abs(e.clientX - s.startX)
        const deltaY = Math.abs(e.clientY - s.startY)
        if (
          elapsed < LONG_PRESS_MS &&
          deltaX < TAP_MOVE_THRESHOLD_PX &&
          deltaY < TAP_MOVE_THRESHOLD_PX
        ) {
          onTap()
        }
      }
    } else {
      // left or right edge release without crossing a destructive threshold
      if (s.zone === 'left') {
        const deltaX = e.clientX - s.startX
        if (deltaX > TOGGLE_SWIPE_THRESHOLD_PX) {
          onToggleTodo()
        }
      }
      setSnapBack(true)
      setSwipeX(0)
    }

    stateRef.current = null
  }

  function onPointerCancel(e: ReactPointerEvent<HTMLDivElement>) {
    const s = stateRef.current
    if (!s || s.pointerId !== e.pointerId) return
    clearLongPress()
    if (s.dragging) {
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
