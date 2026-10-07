import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useBarGesture } from '../gestures/useBarGesture'
import type { Bar as BarType } from '../types'
import styles from './Bar.module.css'

interface BarProps {
  bar: BarType
  autoFocus: boolean
  onRef: (id: string, el: HTMLDivElement | null) => void
  onUpdateText: (id: string, text: string) => void
  onToggleTodo: (id: string) => void
  onToggleDone: (id: string) => void
  onDelete: (id: string) => void
  onDragEnd: (id: string, clientY: number) => void
  onFocusHandled: () => void
  onEnterNewRow: (afterId: string) => void
}

export function Bar({
  bar,
  autoFocus,
  onRef,
  onUpdateText,
  onToggleTodo,
  onToggleDone,
  onDelete,
  onDragEnd,
  onFocusHandled,
  onEnterNewRow,
}: BarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(bar.text)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragPointerId = useRef<number | null>(null)
  const dragStartY = useRef(0)
  const lastClientY = useRef(0)

  useEffect(() => {
    setText(bar.text)
  }, [bar.text])

  useEffect(() => {
    if (autoFocus) setIsEditing(true)
  }, [autoFocus])

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const { handlers, swipeX, snapBack } = useBarGesture({
    disabled: isEditing,
    onShortTap: () => {
      if (bar.isTodo) onToggleDone(bar.id)
    },
    onLongPress: () => setIsEditing(true),
    onToggleTodo: () => onToggleTodo(bar.id),
    onDelete: () => onDelete(bar.id),
  })

  function commitText() {
    setIsEditing(false)
    onUpdateText(bar.id, text)
    if (autoFocus) onFocusHandled()
  }

  // Drag handle: grabbing it starts reordering immediately (no long-press,
  // no direction ambiguity) so it never fights the row's own tap/swipe
  // gestures, page scroll, or the browser's pull-to-refresh. The row only
  // floats visually (translateY) while dragging — the real list order is
  // committed once, on release — so the bar's own DOM position never
  // changes mid-gesture and can't drop the active pointer capture, which is
  // what let drags only travel a short, inconsistent range before.
  function onHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    dragPointerId.current = e.pointerId
    dragStartY.current = e.clientY
    lastClientY.current = e.clientY
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setIsDragging(true)
  }

  function onHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    if (dragPointerId.current !== e.pointerId) return
    lastClientY.current = e.clientY
    setDragOffsetY(e.clientY - dragStartY.current)
  }

  function endHandleDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    if (dragPointerId.current !== e.pointerId) return
    dragPointerId.current = null
    setIsDragging(false)
    setDragOffsetY(0)
    onDragEnd(bar.id, lastClientY.current)
  }

  const transforms: string[] = []
  if (swipeX) transforms.push(`translateX(${swipeX}px)`)
  if (dragOffsetY) transforms.push(`translateY(${dragOffsetY}px)`)

  return (
    <div
      ref={(el) => onRef(bar.id, el)}
      className={[
        styles.row,
        isDragging ? styles.dragging : '',
        bar.done ? styles.done : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        transform: transforms.length ? transforms.join(' ') : undefined,
        transition: snapBack ? 'transform 150ms ease-out' : undefined,
      }}
      {...handlers}
    >
      {bar.isTodo && (
        <span className={styles.checkbox} aria-hidden="true">
          {bar.done ? '[x]' : '[ ]'}
        </span>
      )}
      <input
        ref={inputRef}
        className={styles.text}
        value={text}
        readOnly={!isEditing}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
            onEnterNewRow(bar.id)
          }
        }}
        onPointerDown={(e) => {
          if (isEditing) {
            e.stopPropagation()
          } else {
            // A readOnly input is still natively focusable, so a plain
            // click would otherwise place a caret in it (with no keyboard,
            // since it's readOnly) even though nothing should happen here.
            // Edit mode is only ever entered programmatically, on long-press.
            e.preventDefault()
          }
        }}
      />
      <div
        className={styles.handle}
        aria-label="drag to reorder"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={endHandleDrag}
        onPointerCancel={endHandleDrag}
      >
        =
      </div>
    </div>
  )
}
