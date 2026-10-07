import { useEffect, useRef, useState } from 'react'
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
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setText(bar.text)
  }, [bar.text])

  useEffect(() => {
    if (autoFocus) setIsEditing(true)
  }, [autoFocus])

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const { handlers, swipeX, isDragging, snapBack } = useBarGesture({
    disabled: isEditing,
    onTap: () => setIsEditing(true),
    onToggleTodo: () => onToggleTodo(bar.id),
    onDelete: () => onDelete(bar.id),
    onDragStart: () => onDragStart(bar.id),
    onDragMove,
    onDragEnd,
  })

  function commitText() {
    setIsEditing(false)
    onUpdateText(bar.id, text)
    if (autoFocus) onFocusHandled()
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
        <button
          type="button"
          className={styles.checkbox}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggleDone(bar.id)}
          aria-pressed={bar.done}
          aria-label={bar.done ? 'mark not done' : 'mark done'}
        >
          {bar.done ? '[x]' : '[ ]'}
        </button>
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
    </div>
  )
}
