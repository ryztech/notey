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
  onDragStart: (id: string) => void
  onDragMove: (clientY: number) => void
  onDragEnd: () => void
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
  onDragStart,
  onDragMove,
  onDragEnd,
  onFocusHandled,
  onEnterNewRow,
}: BarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(bar.text)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragPointerId = useRef<number | null>(null)

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
  // gestures, page scroll, or the browser's pull-to-refresh.
  function onHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    dragPointerId.current = e.pointerId
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setIsDragging(true)
    onDragStart(bar.id)
  }

  function onHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    if (dragPointerId.current !== e.pointerId) return
    onDragMove(e.clientY)
  }

  function endHandleDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    if (dragPointerId.current !== e.pointerId) return
    dragPointerId.current = null
    setIsDragging(false)
    onDragEnd()
  }

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
        transform: swipeX ? `translateX(${swipeX}px)` : undefined,
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
          if (isEditing) e.stopPropagation()
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
        [::]
      </div>
    </div>
  )
}
